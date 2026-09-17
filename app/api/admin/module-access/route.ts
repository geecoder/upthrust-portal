export const dynamic = 'force-dynamic';

/**
 * Admin-only module access control.
 *
 * GET  — every flag row plus the module registry, for the settings screen.
 * POST — toggle one module, write an audit row, invalidate the flag cache.
 *
 * WHY THIS IS ITS OWN ROUTE rather than another case in /api/admin/data:
 * that handler's POST is shared between admin actions and LEARNER actions —
 * learners call it for update_profile, community_post and so on. Putting an
 * access-control write into a handler that learners can also reach means one
 * missing isAdmin() check away from a learner granting themselves a module.
 * Access control gets its own surface with one auth rule at the top, matching
 * the existing admin-only routes (publish-week, save-week).
 *
 * Every write goes through the service-role client. Authorisation comes from
 * the Clerk session and nothing else — never from the request body.
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import {
  MODULE_KEYS,
  MODULE_REGISTRY,
  isModuleKey,
  listModuleAccessRows,
  invalidateModuleAccessCache,
} from '@/lib/module-access';

function isAdmin(userId: string | null): boolean {
  return !!userId && !!process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID;
}

/** 403 rather than 404: the caller is authenticated, just not permitted. */
function forbidden() {
  return NextResponse.json(
    { error: 'Only an administrator can change module access.', code: 'NOT_ADMIN' },
    { status: 403 }
  );
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'You need to sign in.', code: 'UNAUTHENTICATED' }, { status: 401 });
  }
  if (!isAdmin(userId)) return forbidden();

  try {
    const rows = await listModuleAccessRows();

    // Recent changes, so the audit trail is verifiable from the screen itself
    // rather than only by querying the table. Best-effort: a failure here must
    // not stop an admin seeing and changing the flags.
    let audit: unknown[] = [];
    try {
      const db = createAdminClient();
      const { data, error } = await db
        .from('module_access_audit')
        .select('id, module_key, cohort, old_enabled, new_enabled, changed_at')
        .order('changed_at', { ascending: false })
        .limit(15);
      if (error) {
        console.error('[module-access] audit read failed:', error.message);
      } else {
        audit = data ?? [];
      }
    } catch (auditErr) {
      console.error('[module-access] audit read threw:', auditErr);
    }

    return NextResponse.json({
      rows,
      audit,
      registry: MODULE_KEYS.map((k) => MODULE_REGISTRY[k]),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not read module access.';
    console.error('[module-access] admin GET failed:', err);
    // 503 not 500: the usual cause is "migration 0003 has not been run", which
    // is a not-ready-yet condition the admin can fix, not a server fault.
    return NextResponse.json({ error: message, code: 'MODULE_ACCESS_UNAVAILABLE' }, { status: 503 });
  }
}

// ── POST ─────────────────────────────────────────────────────────────────────

interface ToggleBody {
  module_key?: unknown;
  enabled?: unknown;
  cohort?: unknown;
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'You need to sign in.', code: 'UNAUTHENTICATED' }, { status: 401 });
  }
  if (!isAdmin(userId)) return forbidden();

  let body: ToggleBody;
  try {
    body = (await req.json()) as ToggleBody;
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.', code: 'BAD_BODY' }, { status: 400 });
  }

  // ── Validate. Three named fields, read individually. The body is never
  // spread into the database call — the columns written below are literals.
  const moduleKey = body.module_key;
  if (!isModuleKey(moduleKey)) {
    return NextResponse.json(
      {
        error: 'Unknown module.',
        code: 'UNKNOWN_MODULE',
        allowed: MODULE_KEYS,
      },
      { status: 400 }
    );
  }

  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'enabled must be true or false.', code: 'BAD_ENABLED' },
      { status: 400 }
    );
  }
  const enabled: boolean = body.enabled;

  let cohort: string | null = null;
  if (body.cohort !== undefined && body.cohort !== null) {
    if (typeof body.cohort !== 'string') {
      return NextResponse.json(
        { error: 'cohort must be text, or omitted for the global default.', code: 'BAD_COHORT' },
        { status: 400 }
      );
    }
    const trimmed = body.cohort.trim();
    if (trimmed.length > 60) {
      return NextResponse.json(
        { error: 'cohort must be 60 characters or fewer.', code: 'BAD_COHORT' },
        { status: 400 }
      );
    }
    cohort = trimmed || null;
  }

  const db = createAdminClient();

  try {
    // ── Read the current value first: the audit row needs the old value, and
    // we need the row id to update in place.
    const existingQuery = db
      .from('module_access')
      .select('id, enabled')
      .eq('module_key', moduleKey);

    const { data: existing, error: readErr } = await (cohort === null
      ? existingQuery.is('cohort', null)
      : existingQuery.eq('cohort', cohort)
    ).maybeSingle();

    if (readErr) {
      console.error('[module-access] could not read current value:', readErr.message, readErr.code ?? '');
      return NextResponse.json(
        {
          error:
            readErr.code === 'PGRST205' || readErr.code === '42P01'
              ? 'The module_access table does not exist yet. Run supabase/migrations/0003_module_access.sql, then try again.'
              : 'Could not read the current setting. Nothing was changed.',
          code: 'READ_FAILED',
        },
        { status: 503 }
      );
    }

    const oldEnabled: boolean | null = existing ? existing.enabled : null;

    // No-op toggles still return 200 so an optimistic UI settles, but they are
    // not written and not audited — an audit log full of "changed false to
    // false" is an audit log nobody reads.
    if (oldEnabled === enabled) {
      return NextResponse.json({
        ok: true,
        unchanged: true,
        module_key: moduleKey,
        cohort,
        enabled,
      });
    }

    // ── Write.
    if (existing) {
      const { error } = await db
        .from('module_access')
        .update({ enabled, updated_at: new Date().toISOString(), updated_by: userId })
        .eq('id', existing.id);

      if (error) {
        console.error('[module-access] update failed:', error.message, error.code ?? '');
        return NextResponse.json(
          { error: 'Could not save that change. Nothing was changed.', code: 'WRITE_FAILED' },
          { status: 500 }
        );
      }
    } else {
      const { error } = await db.from('module_access').insert({
        module_key: moduleKey,
        cohort,
        enabled,
        note: MODULE_REGISTRY[moduleKey].whenOff,
        updated_by: userId,
      });

      if (error) {
        // 23505 means another admin created the same row between our read and
        // our insert. Their row is now the one that exists, so apply our value
        // to it rather than failing the request on a race we can resolve.
        if (error.code === '23505') {
          const retry = db
            .from('module_access')
            .update({ enabled, updated_at: new Date().toISOString(), updated_by: userId })
            .eq('module_key', moduleKey);

          const { error: retryErr } = await (cohort === null
            ? retry.is('cohort', null)
            : retry.eq('cohort', cohort));

          if (retryErr) {
            console.error('[module-access] insert raced and retry failed:', retryErr.message);
            return NextResponse.json(
              { error: 'Could not save that change. Nothing was changed.', code: 'WRITE_FAILED' },
              { status: 500 }
            );
          }
        } else {
          console.error('[module-access] insert failed:', error.message, error.code ?? '');
          return NextResponse.json(
            { error: 'Could not save that change. Nothing was changed.', code: 'WRITE_FAILED' },
            { status: 500 }
          );
        }
      }
    }

    // ── Audit. Best-effort by design: the toggle has already succeeded, and
    // failing the request now would tell the admin their change did not apply
    // when it did. Logged loudly instead of swallowed.
    const { error: auditErr } = await db.from('module_access_audit').insert({
      module_key: moduleKey,
      cohort,
      old_enabled: oldEnabled,
      new_enabled: enabled,
      actor: userId,
      source: 'admin_console',
    });

    if (auditErr) {
      console.error(
        `[module-access] AUDIT WRITE FAILED for ${moduleKey} (cohort=${cohort ?? 'global'}) ` +
          `${oldEnabled} -> ${enabled} by ${userId}:`,
        auditErr.message
      );
    }

    // ── Make the change visible to this instance immediately. Other instances
    // pick it up within the 30-second cache TTL.
    invalidateModuleAccessCache();

    return NextResponse.json({
      ok: true,
      module_key: moduleKey,
      cohort,
      enabled,
      previous: oldEnabled,
      audited: !auditErr,
    });
  } catch (err) {
    console.error('[module-access] POST threw:', err);
    return NextResponse.json(
      { error: 'Something went wrong saving that change. Nothing was changed.', code: 'UNEXPECTED' },
      { status: 500 }
    );
  }
}
