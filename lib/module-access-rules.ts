// lib/module-access-rules.ts
// ─────────────────────────────────────────────────────────────────────────────
// The PURE half of module access: the module registry and the resolution rule.
//
// Deliberately free of `server-only`, of database access, and of every other
// import. Two reasons:
//
//   1. The resolution rule — most specific wins, unknown means denied — is the
//      single most important piece of logic in this mechanism, and it is the
//      one piece that can be proved correct without a database. Keeping it pure
//      means it can be exercised directly (scripts/verify-module-access.ts).
//   2. It draws a clean line: this file decides WHAT access means, and
//      lib/module-access.ts deals with reading, caching and enforcing it.
//
// Import from '@/lib/module-access' in application code — it re-exports all of
// this, so there is one import path to remember.
// ─────────────────────────────────────────────────────────────────────────────

export const MODULE_KEYS = [
  'capstone',
  'notifications',
  'community',
  'ai_lab.stakeholder_sim',
  'ai_lab.writing_checker',
  'ai_lab.interview_coach',
] as const;

export type ModuleKey = (typeof MODULE_KEYS)[number];

/**
 * How a disabled module presents itself to a learner.
 *
 * Note this is a property of the MODULE, not of the scope that disabled it. A
 * learner shut out by their own override sees the same screen as one shut out
 * by their cohort's setting — they are not told which decision produced it,
 * and there is nothing in the learner UI that distinguishes the two.
 *
 *   'absent'  the module vanishes — no nav item, and its route redirects to the
 *             dashboard. Used for Community and Notifications, which the owner
 *             wants gone rather than teased.
 *
 *   'locked'  the nav item REMAINS, in a locked presentation, and the route
 *             renders a designed locked state. Used for Capstone alone: a
 *             capstone learners cannot see at all is a worse experience than
 *             one they can see is coming. Milestone 4 builds that screen.
 */
export type LockedPresentation = 'absent' | 'locked';

export interface ModuleMeta {
  key: ModuleKey;
  /** Admin-facing label. */
  label: string;
  /** Grouping in the admin console. */
  group: 'Learner modules' | 'AI Practice Lab';
  /** Plain-language note shown under the toggle: what learners see when ON. */
  whenOn: string;
  /** Plain-language note shown under the toggle: what learners see when OFF. */
  whenOff: string;
  presentation: LockedPresentation;
}

export const MODULE_REGISTRY: Record<ModuleKey, ModuleMeta> = {
  capstone: {
    key: 'capstone',
    label: 'Capstone',
    group: 'Learner modules',
    whenOn: 'Learners see the capstone brief, deliverables and the submission form.',
    whenOff:
      'Learners still see Capstone in the sidebar, marked as locked. Opening it shows a short explanation of when it unlocks. The brief and deliverables are not sent to the browser at all.',
    presentation: 'locked',
  },
  notifications: {
    key: 'notifications',
    label: 'Notifications',
    group: 'Learner modules',
    whenOn: 'Learners see the Notifications item in the sidebar and can open their notifications.',
    whenOff:
      'Notifications disappears from the learner sidebar entirely — no item, no unread badge, no background polling. Existing notification data is kept and is not deleted.',
    presentation: 'absent',
  },
  community: {
    key: 'community',
    label: 'Community',
    group: 'Learner modules',
    whenOn: 'Learners see Community in the sidebar and can read and post.',
    whenOff:
      'Community disappears from the learner sidebar entirely. Visiting the page sends them to the dashboard. Posting and replying are refused by the server. Existing posts are kept and are not deleted.',
    presentation: 'absent',
  },
  'ai_lab.stakeholder_sim': {
    key: 'ai_lab.stakeholder_sim',
    label: 'Stakeholder Sim',
    group: 'AI Practice Lab',
    whenOn: 'Learners can run stakeholder simulations. This is the one AI tool the cohort keeps.',
    whenOff:
      'Stakeholder Sim disappears from the AI Practice Lab. With all three tools off the section itself disappears from the sidebar.',
    presentation: 'absent',
  },
  'ai_lab.writing_checker': {
    key: 'ai_lab.writing_checker',
    label: 'Writing Checker',
    group: 'AI Practice Lab',
    whenOn: 'Learners can submit writing for AI feedback. This calls the Anthropic API and costs money per use.',
    whenOff:
      'Writing Checker disappears from the AI Practice Lab — no card, no "coming soon" teaser. The API refuses requests, so it cannot be reached or billed by URL.',
    presentation: 'absent',
  },
  'ai_lab.interview_coach': {
    key: 'ai_lab.interview_coach',
    label: 'Interview Coach',
    group: 'AI Practice Lab',
    whenOn: 'Learners can practise interviews with AI feedback. This calls the Anthropic API and costs money per use.',
    whenOff:
      'Interview Coach disappears from the AI Practice Lab — no card, no "coming soon" teaser. The API refuses requests, so it cannot be reached or billed by URL.',
    presentation: 'absent',
  },
};

export type ModuleAccessMap = Record<ModuleKey, boolean>;

export interface ModuleAccessRow {
  module_key: string;
  /** Non-null on a cohort row. Always null on a learner row. */
  cohort: string | null;
  /**
   * Non-null on a learner row, which beats both the cohort row and the global
   * row. Null on cohort and global rows. A row may not carry both — the
   * database rejects it (migration 0006, module_access_scope_check).
   */
  learner_id?: string | null;
  enabled: boolean;
  note?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

/**
 * Who we are resolving access for.
 *
 * Both fields optional: the admin console resolves with neither to see the
 * global picture, and with a cohort to see what that cohort gets.
 */
export interface AccessScope {
  /** The learner's cohort label, or null for "global only". */
  cohort?: string | null;
  /** The learner's `learners.id`. Null when resolving for a cohort in general. */
  learnerId?: string | null;
}

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === 'string' && (MODULE_KEYS as readonly string[]).includes(value);
}

/** Every module disabled. The shape returned whenever we cannot do better. */
export function allDisabled(): ModuleAccessMap {
  return Object.fromEntries(MODULE_KEYS.map((k) => [k, false])) as ModuleAccessMap;
}

/**
 * Is this row unscoped to a learner — i.e. a cohort row or the global row?
 *
 * Deliberately tests for the field being ABSENT rather than merely falsy. A row
 * carrying `learner_id: ''` is malformed (the column is a uuid, so the database
 * cannot produce one), and a falsy test would classify it as unscoped and
 * promote it to the GLOBAL row — turning one corrupt row into access for
 * everybody. Treating it as scoped instead makes it match no learner and
 * therefore inert, which is the direction this mechanism fails in everywhere
 * else.
 */
function isUnscopedToLearner(row: ModuleAccessRow): boolean {
  return row.learner_id === null || row.learner_id === undefined;
}

/** Does this row target exactly this learner? */
function targetsLearner(row: ModuleAccessRow, learnerId: string): boolean {
  return !isUnscopedToLearner(row) && row.learner_id === learnerId;
}

/**
 * THE RESOLUTION RULE.
 *
 * Given every flag row and who is asking, decide each module's state.
 *
 * THREE SCOPES, MOST SPECIFIC WINS:
 *
 *   1. a row for this learner          (learner_id matches)
 *   2. else a row for their cohort     (cohort matches, learner_id null)
 *   3. else the global row             (cohort null, learner_id null)
 *   4. else DISABLED. Unknown means denied.
 *
 * So a module can be open to a cohort and shut for one learner in it, or shut
 * to a cohort and open for one learner in it. The learner row is an exception
 * to their cohort, in either direction, which is exactly what it is for.
 *
 * `enabled` must be exactly true. Anything else — null, undefined, a string
 * that slipped through — is denied.
 *
 * NOTE the isUnscopedToLearner() guards on steps 2 and 3. Without them a
 * learner row would also match as a cohort or global row, because a learner row
 * carries cohort NULL — and then one learner's exception would leak to
 * everybody. That is the single most important condition in this function, and
 * why it tests for the field being absent rather than merely falsy.
 *
 * Pure: no I/O, no clock, no globals. Same inputs, same answer, always.
 *
 * @param rows  every row from module_access (pass [] if there are none)
 * @param scope who to resolve for; {} resolves the global defaults alone
 */
export function resolveFromRows(
  rows: readonly ModuleAccessRow[],
  scope: AccessScope = {}
): ModuleAccessMap {
  const result = allDisabled();
  const wantedCohort = scope.cohort?.trim() || null;
  const wantedLearner = scope.learnerId?.trim() || null;

  for (const key of MODULE_KEYS) {
    const forModule = rows.filter((r) => r.module_key === key);

    const learnerRow = wantedLearner
      ? forModule.find((r) => targetsLearner(r, wantedLearner))
      : undefined;
    const cohortRow = wantedCohort
      ? forModule.find((r) => isUnscopedToLearner(r) && r.cohort === wantedCohort)
      : undefined;
    const globalRow = forModule.find((r) => isUnscopedToLearner(r) && r.cohort === null);

    const chosen = learnerRow ?? cohortRow ?? globalRow;
    result[key] = chosen ? chosen.enabled === true : false;
  }

  return result;
}

/**
 * Which scope actually decided a module, for the admin console.
 *
 * The toggle screen has to show an admin *why* a learner sees what they see —
 * "off because their cohort is off" and "off because you switched it off for
 * them" need different buttons. Returns the same precedence as
 * resolveFromRows, so the two can never disagree about which row won.
 */
export function explainFromRows(
  rows: readonly ModuleAccessRow[],
  moduleKey: ModuleKey,
  scope: AccessScope = {}
): { enabled: boolean; source: 'learner' | 'cohort' | 'global' | 'none' } {
  const wantedCohort = scope.cohort?.trim() || null;
  const wantedLearner = scope.learnerId?.trim() || null;
  const forModule = rows.filter((r) => r.module_key === moduleKey);

  const learnerRow = wantedLearner
    ? forModule.find((r) => targetsLearner(r, wantedLearner))
    : undefined;
  if (learnerRow) return { enabled: learnerRow.enabled === true, source: 'learner' };

  const cohortRow = wantedCohort
    ? forModule.find((r) => isUnscopedToLearner(r) && r.cohort === wantedCohort)
    : undefined;
  if (cohortRow) return { enabled: cohortRow.enabled === true, source: 'cohort' };

  const globalRow = forModule.find((r) => isUnscopedToLearner(r) && r.cohort === null);
  if (globalRow) return { enabled: globalRow.enabled === true, source: 'global' };

  return { enabled: false, source: 'none' };
}
