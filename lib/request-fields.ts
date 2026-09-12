// lib/request-fields.ts
// ─────────────────────────────────────────────────────────────────────────────
// Allowlisting for request bodies that end up in a Supabase update()/insert().
//
// Every write in this app goes through the SERVICE ROLE client, which bypasses
// RLS entirely. That makes any unfiltered spread of a request body into
// .update()/.insert() a direct write path to every column on the row — the
// caller decides which columns to set, not the server.
//
// Use pickAllowedFields() at the top of any handler that writes caller-supplied
// fields. It returns either the exact set of columns the handler permits, or a
// 400 naming the keys it refused. Unknown keys are REJECTED, never dropped
// silently: a caller sending `passport_eligibility` should be told no, not
// quietly ignored and left believing it worked.
// ─────────────────────────────────────────────────────────────────────────────

/** Column values we are willing to hand to PostgREST. Rejects objects/arrays. */
export type ScalarValue = string | number | boolean | null;

export type PickOk = { ok: true; values: Record<string, ScalarValue> };
export type PickErr = { ok: false; status: number; error: string; rejected?: string[] };
export type PickResult = PickOk | PickErr;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isScalar(v: unknown): v is ScalarValue {
  return v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

/**
 * Narrow an untrusted object to an explicit column allowlist.
 *
 * @param input   the caller-supplied object (e.g. body.fields)
 * @param allowed column names this handler permits the caller to write
 * @param opts.ignore keys that are expected but are NOT column writes — routing
 *                or addressing keys such as `id` or `action`. Dropped silently,
 *                because refusing them would be noise, not a security signal.
 * @param opts.allowEmpty permit a result with no columns (default: false)
 */
export function pickAllowedFields(
  input: unknown,
  allowed: readonly string[],
  opts: { ignore?: readonly string[]; allowEmpty?: boolean } = {}
): PickResult {
  if (!isPlainObject(input)) {
    return { ok: false, status: 400, error: 'Expected an object of fields to update.' };
  }

  const allow = new Set(allowed);
  const ignore = new Set(opts.ignore ?? []);
  const values: Record<string, ScalarValue> = {};
  const rejected: string[] = [];
  const badTypes: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    if (ignore.has(key)) continue;
    if (!allow.has(key)) { rejected.push(key); continue; }
    if (value === undefined) continue;
    if (!isScalar(value)) { badTypes.push(key); continue; }
    values[key] = value;
  }

  if (rejected.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `These fields cannot be set here: ${rejected.sort().join(', ')}.`,
      rejected: rejected.sort(),
    };
  }

  if (badTypes.length > 0) {
    return {
      ok: false,
      status: 400,
      error: `These fields must be a string, number, boolean or null: ${badTypes.sort().join(', ')}.`,
      rejected: badTypes.sort(),
    };
  }

  if (!opts.allowEmpty && Object.keys(values).length === 0) {
    return { ok: false, status: 400, error: 'No fields to update.' };
  }

  return { ok: true, values };
}

// ── Allowlists ───────────────────────────────────────────────────────────────

/**
 * Columns a learner may write about THEMSELVES via `update_profile`.
 * Mirrors the fields the profile form actually collects
 * (app/portal/profile/page.tsx:64-78) plus the onboarding subset.
 *
 * Deliberately excluded — a learner must never set these about themselves:
 *   pathway, tier, cohort, enrollment_status   (enrolment facts: admin only)
 *   avg_score, attendance_pct,
 *   assignment_completion_pct, risk_status     (derived metrics)
 *   passport_eligibility, passport_issued,
 *   passport_issued_at, passport_id            (credential gating)
 *   portfolio_status, capstone_status          (assessment state)
 *   clerk_user_id, email, id                   (identity)
 *   onboarding_complete,
 *   onboarding_completed_at                    (set by /api/complete-onboarding)
 *   notes, facilitator_note, portfolio_url     (staff-authored)
 *   created_at, updated_at                     (managed by the database)
 */
export const LEARNER_SELF_EDITABLE = [
  'first_name',
  'last_name',
  'phone',
  'country',
  'current_job_role',
  'career_goal',
  'bio',
  'linkedin_url',
  'cv_url',
  'work_preference',
  'availability',
  'preferred_roles',
  'employer_visible',
] as const;

/**
 * Columns an admin may write on a `weeks` row via /api/admin/save-week.
 * Mirrors EDITABLE_FIELDS in app/admin/content/page.tsx:9-29.
 *
 * Deliberately excluded:
 *   is_published                 publish state is owned by /api/admin/publish-week,
 *                                which is the single audited path for it. Letting
 *                                the content editor also write it means any save
 *                                silently rewrites publish state from whatever the
 *                                form happened to load.
 *   week_number, title, phase,
 *   start_date, end_date,
 *   session_date                 cohort calendar facts, not week content
 *   id, created_at, updated_at   identity / database-managed
 */
export const WEEK_ADMIN_EDITABLE = [
  'why_it_matters',
  'pre_work',
  'outcomes',
  'learning_goals',
  'concept_topics',
  'case_study',
  'lab_exercise',
  'pm_assignment_title',
  'pm_assignment_brief',
  'pm_deliverable',
  'pm_due_date',
  'pm_rubric',
  'ba_assignment_title',
  'ba_assignment_brief',
  'ba_deliverable',
  'ba_due_date',
  'ba_rubric',
  'reflection_prompt',
  'recording_url',
  'session_slides_url',
  'zoom_link',
  'resources',
  'session_notes',
  'ai_practice_type',
] as const;
