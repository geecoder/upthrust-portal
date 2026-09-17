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
  cohort: string | null;
  enabled: boolean;
  note?: string | null;
  updated_at?: string | null;
  updated_by?: string | null;
}

export function isModuleKey(value: unknown): value is ModuleKey {
  return typeof value === 'string' && (MODULE_KEYS as readonly string[]).includes(value);
}

/** Every module disabled. The shape returned whenever we cannot do better. */
export function allDisabled(): ModuleAccessMap {
  return Object.fromEntries(MODULE_KEYS.map((k) => [k, false])) as ModuleAccessMap;
}

/**
 * THE RESOLUTION RULE.
 *
 * Given every flag row and a learner's cohort, decide each module's state.
 *
 *   - A row whose cohort equals the learner's cohort wins.
 *   - Otherwise the global row (cohort IS NULL) applies.
 *   - A module with no applicable row at all is DISABLED. Unknown means denied.
 *   - `enabled` must be exactly true. Anything else — null, undefined, a string
 *     that slipped through — is denied.
 *
 * Pure: no I/O, no clock, no globals. Same inputs, same answer, always.
 *
 * @param rows   every row from module_access (pass [] if there are none)
 * @param cohort the learner's cohort label, or null/undefined for global only
 */
export function resolveFromRows(
  rows: readonly ModuleAccessRow[],
  cohort: string | null | undefined
): ModuleAccessMap {
  const result = allDisabled();
  const wanted = cohort?.trim() || null;

  for (const key of MODULE_KEYS) {
    const forModule = rows.filter((r) => r.module_key === key);
    const override = wanted ? forModule.find((r) => r.cohort === wanted) : undefined;
    const global = forModule.find((r) => r.cohort === null);
    const chosen = override ?? global;
    result[key] = chosen ? chosen.enabled === true : false;
  }

  return result;
}
