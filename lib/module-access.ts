// lib/module-access.ts
// ─────────────────────────────────────────────────────────────────────────────
// Module access control — the single mechanism behind four items in the brief:
// remove Notifications, remove Community, reduce the AI Practice Lab to
// Stakeholder Sim, and lock Capstone until an admin opens it.
//
// Backed by public.module_access (migration 0003). Server-side only.
//
// This file is the I/O half: reading, caching and enforcing. The registry and
// the resolution rule live in ./module-access-rules, which is pure and has no
// database access so the rule can be proved correct on its own
// (scripts/verify-module-access.ts). Everything from there is re-exported here,
// so application code only ever imports '@/lib/module-access'.
//
// ── SCOPE MODEL: global default, per-cohort override, per-learner override ──
// Three scopes, most specific wins (see resolveFromRows):
//
//     learner_id set          this learner only
//     cohort set              that cohort
//     both null               the global default
//
// So a module can be open to a cohort and shut for one learner in it, or shut
// to a cohort and open for one learner in it.
//
// THIS FILE USED TO ARGUE AGAINST THE LEARNER SCOPE, and the correction is
// worth keeping rather than deleting. It said: "It would turn a six-row
// settings screen into a learners x modules permissions matrix, and — the real
// cost — it would make the flag cache learner-keyed, so the cache would hold
// one entry per learner instead of one entry for the whole product."
//
// The first half was a judgement about requirements and the requirement
// arrived: the owner needs a module open for some learners in a cohort and not
// others. The second half was simply wrong. The cache holds RAW ROWS, not
// resolved maps — loadRows() reads the whole table in one query and
// resolveFromRows() is pure and applied per request. Adding a scope therefore
// adds no cache entries at all; it adds rows, at most one per learner per
// module they are singled out for. 7 learners x 6 modules is 42 rows; a cohort
// of 200 would reach 1,200, still one query.
//
// Why not per-programme: there is exactly one programme. A dimension with one
// value in it is the speculative generality that ground rule 4 exists to stop.
//
// Why cohort still earns its place between the two: capstone unlock is
// genuinely per-cohort, and expressing "this whole cohort" as N learner rows
// would be N rows to keep in step and N chances to miss one.
//
// ── FAILURE MODE: CLOSED ─────────────────────────────────────────────────────
// Every path that cannot positively establish "this module is enabled" returns
// disabled. A dropped connection, a query error, a missing table, an unknown
// module key — all deny. An admin who turns a module off must not have it come
// back because the database hiccuped.
//
// The one cost of this is worth stating plainly: until migration 0003 is run,
// public.module_access does not exist, so EVERY gated module reads as disabled,
// including Stakeholder Sim. That is the correct direction to fail, and the log
// line below names the migration so the cause is never a mystery.
//
// ── CACHING ──────────────────────────────────────────────────────────────────
// Flags are read on nearly every request, so they are cached in-process for 30
// seconds. The whole table is loaded in ONE query (it is a handful of rows) and
// resolved in memory, so adding gated modules never adds queries — there is no
// N+1 here by construction.
//
// Propagation: the brief requires a toggle to reach a learner within 60 seconds
// without them signing out. A 30-second TTL gives 2x headroom on every serving
// instance with no cross-instance coordination and no new dependency. Admin
// writes additionally call invalidateModuleAccessCache() so the admin sees
// their own change on the very next request rather than waiting out the TTL.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only';

import { NextResponse } from 'next/server';
import { createAdminClient } from './supabase';
import {
  MODULE_REGISTRY,
  type AccessScope,
  type ModuleAccessMap,
  type ModuleAccessRow,
  type ModuleKey,
  allDisabled,
  resolveFromRows,
} from './module-access-rules';

// One import path for application code.
export {
  MODULE_KEYS,
  MODULE_REGISTRY,
  allDisabled,
  explainFromRows,
  isModuleKey,
  resolveFromRows,
} from './module-access-rules';
export type {
  AccessScope,
  LockedPresentation,
  ModuleAccessMap,
  ModuleAccessRow,
  ModuleKey,
  ModuleMeta,
} from './module-access-rules';

// ── Cache ────────────────────────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000;

let cachedRows: ModuleAccessRow[] | null = null;
let cachedAt = 0;

/** Drop the in-process cache. Called after every admin write. */
export function invalidateModuleAccessCache(): void {
  cachedRows = null;
  cachedAt = 0;
}

/** True when the table is absent — i.e. migration 0003 has not been run. */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  // PGRST205: PostgREST cannot find the table in its schema cache.
  // 42P01:    Postgres "relation does not exist".
  return err.code === 'PGRST205' || err.code === '42P01';
}

/**
 * Load every flag row, cached for CACHE_TTL_MS.
 *
 * Returns null — never throws and never returns a partial set — when the rows
 * could not be read. A null result means "deny everything", and callers treat
 * it that way.
 */
async function loadRows(): Promise<ModuleAccessRow[] | null> {
  const now = Date.now();
  if (cachedRows && now - cachedAt < CACHE_TTL_MS) return cachedRows;

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from('module_access')
      .select('module_key, cohort, learner_id, enabled, note, updated_at, updated_by');

    if (error) {
      if (isMissingTable(error)) {
        console.error(
          '[module-access] public.module_access does not exist — every gated module is DISABLED. ' +
            'Run supabase/migrations/0003_module_access.sql in the Supabase SQL Editor.'
        );
      } else {
        console.error('[module-access] flag lookup failed, failing CLOSED:', error.message, error.code ?? '');
      }
      return null;
    }

    const rows = (data ?? []) as ModuleAccessRow[];
    cachedRows = rows;
    cachedAt = now;
    return rows;
  } catch (err) {
    console.error('[module-access] flag lookup threw, failing CLOSED:', err);
    return null;
  }
}

// ── Resolution ───────────────────────────────────────────────────────────────

/**
 * Resolve every module for a cohort in ONE query.
 * Rule and precedence: see resolveFromRows in ./module-access-rules.
 *
 * @param cohort the learner's cohort label, or null for "global only"
 */
export async function getModuleAccess(scope: AccessScope = {}): Promise<ModuleAccessMap> {
  const rows = await loadRows();
  if (!rows) return allDisabled();
  return resolveFromRows(rows, scope);
}

/** Single-module convenience. Still one query, still cached. */
export async function isModuleEnabled(
  moduleKey: ModuleKey,
  scope: AccessScope = {}
): Promise<boolean> {
  const map = await getModuleAccess(scope);
  return map[moduleKey] === true;
}

// ── The guard ────────────────────────────────────────────────────────────────

/**
 * The single reusable server-side guard. EVERY route handler belonging to a
 * gated module calls this before doing any work.
 *
 * Returns null when the caller may proceed, or a ready-to-return 403 with a
 * structured body when they may not. Written to return-rather-than-throw so the
 * call site reads as two lines and cannot forget to stop:
 *
 *     const denied = await guardModule('community', { cohort, learnerId });
 *     if (denied) return denied;
 *
 * The body is structured so a client can branch on `code` instead of matching
 * on prose, and carries a human sentence so anything that surfaces it raw still
 * reads as English rather than as an error code.
 */
export async function guardModule(
  moduleKey: ModuleKey,
  scope: AccessScope = {}
): Promise<NextResponse | null> {
  const enabled = await isModuleEnabled(moduleKey, scope);
  if (enabled) return null;
  return moduleDisabledResponse(moduleKey);
}

/**
 * The 403 a disabled module returns. Exported so the route-handler guard in
 * ./module-gate refuses in exactly the same words and shape as this one — a
 * client branching on `code` must not have to care which guard said no.
 */
export function moduleDisabledResponse(moduleKey: ModuleKey): NextResponse {
  const meta = MODULE_REGISTRY[moduleKey];
  return NextResponse.json(
    {
      error: `${meta?.label ?? moduleKey} is not available on your programme right now.`,
      code: 'MODULE_DISABLED',
      module: moduleKey,
    },
    { status: 403 }
  );
}

/**
 * Same guard, for handlers that have already loaded the learner row.
 *
 * Takes the learner's `id` as well as their cohort, so a per-learner override
 * applies here too. A caller that passes only a cohort gets cohort-level
 * resolution — correct, but it would miss an exception set for that one
 * learner, so pass the id whenever the row is in hand.
 */
export async function guardModuleForLearner(
  moduleKey: ModuleKey,
  learner: { id?: string | null; cohort?: string | null } | null | undefined
): Promise<NextResponse | null> {
  return guardModule(moduleKey, {
    cohort: learner?.cohort ?? null,
    learnerId: learner?.id ?? null,
  });
}

// ── Admin-side reads ─────────────────────────────────────────────────────────

/**
 * Every flag row, for the admin console. Uncached — an admin looking at the
 * settings screen must see the truth, not a copy up to 30 seconds old.
 *
 * Throws on failure rather than failing closed: this is a read for a human
 * staring at a management screen, and showing them "everything is off" when the
 * real answer is "we could not read it" would be a lie that invites them to
 * toggle things they have not actually seen.
 */
export async function listModuleAccessRows(): Promise<ModuleAccessRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from('module_access')
    .select('module_key, cohort, learner_id, enabled, note, updated_at, updated_by')
    .order('module_key', { ascending: true })
    .order('cohort', { ascending: true, nullsFirst: true })
    .order('learner_id', { ascending: true, nullsFirst: true });

  if (error) {
    if (isMissingTable(error)) {
      throw new Error(
        'The module_access table does not exist yet. Run supabase/migrations/0003_module_access.sql in the Supabase SQL Editor, then reload this page.'
      );
    }
    throw new Error(error.message);
  }
  return (data ?? []) as ModuleAccessRow[];
}
