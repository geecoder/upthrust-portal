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
        .select('id, module_key, cohort, learner_id, old_enabled, new_enabled, changed_at')
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

    // The learner roster, so the console can offer per-learner overrides. Only
    // what the screen needs to label a row — no scores, no notes, nothing
    // about the learner beyond who they are and which cohort they sit in.
    // Also best-effort: losing the roster costs the per-learner section, not
    // the whole screen.
    let learners: unknown[] = [];
    try {
      const db = createAdminClient();
      const { data, error } = await db
        .from('learners')
        .select('id, first_name, last_name, email, cohort, pathway')
        .order('cohort', { ascending: true })
        .order('first_name', { ascending: true });
      if (error) {
        console.error('[module-access] learner roster read failed:', error.message);
      } else {
        learners = data ?? [];
      }
    } catch (rosterErr) {
      console.error('[module-access] learner roster read threw:', rosterErr);
    }

    return NextResponse.json({
      rows,
      audit,
      learners,
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
  /** true, false, or null to CLEAR the row and inherit from the level above. */
  enabled?: unknown;
  cohort?: unknown;
  learner_id?: unknown;
}

/** Postgres uuid text form. Checked here so a bad id is a 400, not an FK 500. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Scope =
  | { kind: 'global'; cohort: null; learnerId: null }
  | { kind: 'cohort'; cohort: string; learnerId: null }
  | { kind: 'learner'; cohort: null; learnerId: string };

function describeScope(scope: Scope): string {
  if (scope.kind === 'global') return 'the global default';
  if (scope.kind === 'cohort') return `cohort ${scope.cohort}`;
  return `learner ${scope.learnerId}`;
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

  // ── Validate. Named fields, read individually. The body is never spread
  // into the database call — every column written below is a literal.
  const moduleKey = body.module_key;
  if (!isModuleKey(moduleKey)) {
    return NextResponse.json(
      { error: 'Unknown module.', code: 'UNKNOWN_MODULE', allowed: MODULE_KEYS },
      { status: 400 }
    );
  }

  // `enabled: null` means CLEAR: delete this scope's row so it inherits again.
  // That is what makes the per-learner control a tri-state rather than a
  // switch — without it, "not decided for this learner" would be
  // indistinguishable from "decided: off", and an admin could never undo an
  // override.
  if (body.enabled !== null && typeof body.enabled !== 'boolean') {
    return NextResponse.json(
      { error: 'enabled must be true, false, or null to clear the override.', code: 'BAD_ENABLED' },
      { status: 400 }
    );
  }
  const enabled: boolean | null = body.enabled as boolean | null;

  // ── Resolve the scope, and refuse the ambiguous combination ───────────────
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

  let learnerId: string | null = null;
  if (body.learner_id !== undefined && body.learner_id !== null) {
    if (typeof body.learner_id !== 'string' || !UUID_RE.test(body.learner_id.trim())) {
      return NextResponse.json(
        { error: 'learner_id must be a learner UUID, or omitted.', code: 'BAD_LEARNER_ID' },
        { status: 400 }
      );
    }
    learnerId = body.learner_id.trim();
  }

  if (cohort !== null && learnerId !== null) {
    // The database rejects this too (module_access_scope_check). Refused here
    // as well so the caller gets a sentence rather than a constraint name.
    return NextResponse.json(
      {
        error:
          'Give a cohort or a learner, not both. A learner override applies to that person wherever they sit.',
        code: 'AMBIGUOUS_SCOPE',
      },
      { status: 400 }
    );
  }

  const scope: Scope =
    learnerId !== null
      ? { kind: 'learner', cohort: null, learnerId }
      : cohort !== null
        ? { kind: 'cohort', cohort, learnerId: null }
        : { kind: 'global', cohort: null, learnerId: null };

  // Clearing the global row would leave the module with no applicable row at
  // all, which resolves to denied — the same outcome as off, reached by a route
  // that leaves nothing on the screen to explain it. Refused so the global
  // state is always an explicit, visible decision.
  if (enabled === null && scope.kind === 'global') {
    return NextResponse.json(
      {
        error: 'The global default cannot be cleared. Set it to off instead.',
        code: 'CANNOT_CLEAR_GLOBAL',
      },
      { status: 400 }
    );
  }

  const db = createAdminClient();

  /** Narrow a query to exactly this scope's row. */
  function atScope<T extends { is: Function; eq: Function }>(query: T): T {
    const q = scope.learnerId !== null
      ? (query.eq('learner_id', scope.learnerId) as T)
      : (query.is('learner_id', null) as T);
    return scope.cohort !== null ? (q.eq('cohort', scope.cohort) as T) : (q.is('cohort', null) as T);
  }

  try {
    // A learner override names a person, so check they exist. The foreign key
    // would catch it, but as a 500 with a constraint message.
    if (scope.kind === 'learner') {
      const { data: learner, error: learnerErr } = await db
        .from('learners')
        .select('id')
        .eq('id', scope.learnerId)
        .maybeSingle();
      if (learnerErr) {
        console.error('[module-access] learner check failed:', learnerErr.message);
        return NextResponse.json(
          { error: 'Could not verify that learner. Nothing was changed.', code: 'READ_FAILED' },
          { status: 503 }
        );
      }
      if (!learner) {
        return NextResponse.json(
          { error: 'No learner with that id.', code: 'NO_SUCH_LEARNER' },
          { status: 404 }
        );
      }
    }

    // ── Read the current value first: the audit row needs the old value, and
    // we need the row id to update or delete in place.
    const { data: existing, error: readErr } = await atScope(
      db.from('module_access').select('id, enabled').eq('module_key', moduleKey)
    ).maybeSingle();

    if (readErr) {
      console.error('[module-access] could not read current value:', readErr.message, readErr.code ?? '');
      const missing = readErr.code === 'PGRST205' || readErr.code === '42P01';
      const noColumn = readErr.code === '42703';
      return NextResponse.json(
        {
          error: missing
            ? 'The module_access table does not exist yet. Run the migrations, then try again.'
            : noColumn
              ? 'module_access has no learner_id column yet. Run supabase/migrations/0006_module_access_per_learner.sql, then try again.'
              : 'Could not read the current setting. Nothing was changed.',
          code: 'READ_FAILED',
        },
        { status: 503 }
      );
    }

    const oldEnabled: boolean | null = existing ? existing.enabled : null;

    // ── No-op. Still 200 so an optimistic UI settles, but not written and not
    // audited — an audit log full of "changed false to false" is one nobody
    // reads. Clearing a scope that has no row is equally a no-op.
    const alreadyThere = enabled === null ? !existing : oldEnabled === enabled;
    if (alreadyThere) {
      return NextResponse.json({
        ok: true,
        unchanged: true,
        module_key: moduleKey,
        cohort: scope.cohort,
        learner_id: scope.learnerId,
        enabled,
      });
    }

    // ── Write.
    if (enabled === null) {
      // CLEAR: delete the row so this scope inherits from the level above.
      const { error } = await db.from('module_access').delete().eq('id', existing!.id);
      if (error) {
        console.error('[module-access] clear failed:', error.message, error.code ?? '');
        return NextResponse.json(
          { error: 'Could not clear that override. Nothing was changed.', code: 'WRITE_FAILED' },
          { status: 500 }
        );
      }
    } else if (existing) {
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
        cohort: scope.cohort,
        learner_id: scope.learnerId,
        enabled,
        note: MODULE_REGISTRY[moduleKey].whenOff,
        updated_by: userId,
      });

      if (error) {
        // 23505 means another admin created the same row between our read and
        // our insert. Their row is now the one that exists, so apply our value
        // to it rather than failing on a race we can resolve.
        if (error.code === '23505') {
          const { error: retryErr } = await atScope(
            db
              .from('module_access')
              .update({ enabled, updated_at: new Date().toISOString(), updated_by: userId })
              .eq('module_key', moduleKey)
          );

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

    // ── Audit. Best-effort by design: the change has already succeeded, and
    // failing the request now would tell the admin their change did not apply
    // when it did. Logged loudly instead of swallowed. new_enabled is NULL for
    // a clear, which is why migration 0006 drops that column's NOT NULL.
    const { error: auditErr } = await db.from('module_access_audit').insert({
      module_key: moduleKey,
      cohort: scope.cohort,
      learner_id: scope.learnerId,
      old_enabled: oldEnabled,
      new_enabled: enabled,
      actor: userId,
      source: 'admin_console',
    });

    if (auditErr) {
      console.error(
        `[module-access] AUDIT WRITE FAILED for ${moduleKey} (${describeScope(scope)}) ` +
          `${oldEnabled} -> ${enabled} by ${userId}:`,
        auditErr.message
      );
    }

    // ── Make the change visible to this instance immediately. Other instances
    // pick it up within the 30-second cache TTL.
    invalidateModuleAccessCache();

    return NextResponse.json({
      ok: true,
      cleared: enabled === null,
      module_key: moduleKey,
      cohort: scope.cohort,
      learner_id: scope.learnerId,
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
