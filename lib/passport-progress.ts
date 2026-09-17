// lib/passport-progress.ts
// ─────────────────────────────────────────────────────────────────────────────
// The five Capability Passport criteria, COMPUTED FROM SOURCE ROWS.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// Three of the five criteria were read straight off columns on `learners`:
// attendance_pct, assignment_completion_pct and avg_score. Two of those three
// are never maintained (docs/DEFERRED.md D-11). Read from production on
// 2026-09-17:
//
//     assignment_completion_pct = 0.00  for ALL 7 learners
//     avg_score                 = 0.00  for 6 of 7
//     attendance_pct            = 64-91 — this one IS maintained
//
// while the assignments those numbers describe say something else entirely:
// 25 of 25 submitted, 11 scored, mean score 82.5. So every real learner was
// being shown 0% submitted and no average, and told they had failed two
// criteria they had in fact passed. Grading an assignment never moved the
// number, and nothing in the product ever noticed.
//
// The fix is to stop trusting a stored summary of data we already hold. These
// functions derive each criterion from the rows themselves, so grading an
// assignment changes the learner's passport progress on the next page load
// because it is the same fact read twice, not two facts kept in step.
//
// ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
// It does not write anything, and it does not decide eligibility. Issuance
// still gates on learners.passport_eligibility, which an admin sets, and
// /api/passport-issue is untouched. Milestone 5 displays progress; it does not
// wire issuance. The practical consequence is a divergence worth knowing
// about: a learner may now correctly see "all criteria met" while their stored
// eligibility still says otherwise, because one is computed and the other is a
// human decision. The passport page has always distinguished those two states
// and still does.
//
// It also does not backfill the stale columns. Writing them would be a
// half-migration — correct until the next submission — and the recomputation
// questions D-11 raises belong to the rebuild. Deriving on read makes the
// columns redundant rather than wrong, which is the safer order to fix this in.
//
// PURE: no I/O, no clock, no imports beyond the criteria constants. Every input
// is passed in, so the whole thing can be exercised without a database
// (scripts/verify-passport-progress.ts).
// ─────────────────────────────────────────────────────────────────────────────
// Explicit .ts extension so this module resolves identically under the Next
// bundler and under `node --experimental-strip-types`, which is how the
// verification script exercises it. tsconfig sets allowImportingTsExtensions.
import { PASSPORT_CRITERIA, isApprovedWork } from './types.ts';

export interface ProgressAssignment {
  week_number: number;
  pathway?: string | null;
  status?: string | null;
  score?: number | null;
  portfolio_approved?: boolean | null;
}

export interface ProgressAttendance {
  week_number: number;
  attended?: boolean | null;
}

export interface ProgressWeek {
  week_number: number;
  phase?: string | null;
  is_published?: boolean | null;
  pm_assignment_title?: string | null;
  ba_assignment_title?: string | null;
}

export interface Criterion {
  key: 'attendance' | 'submission' | 'avg_score' | 'capstone' | 'artefacts';
  label: string;
  /** What the learner has, already rounded for display. */
  actual: number;
  /** What they need. */
  target: number;
  met: boolean;
  /** '%' , '/100' or ''. */
  unit: string;
  /** One line under the label explaining where the number comes from. */
  detail: string;
}

export interface PassportProgress {
  criteria: Criterion[];
  metCount: number;
  allMet: boolean;
  /** Counts the page headers use, so they cannot disagree with the criteria. */
  submittedCount: number;
  expectedCount: number;
  approvedCount: number;
  scoredCount: number;
}

/**
 * Assignments that belong to this learner's pathway.
 *
 * Rows exist per (learner, week, pathway). A learner only ever has rows for
 * their own pathway in practice, but filtering makes the counts correct rather
 * than coincidentally correct.
 */
function forPathway(assignments: ProgressAssignment[], pathway: string): ProgressAssignment[] {
  return assignments.filter((a) => !a.pathway || a.pathway === pathway);
}

/**
 * How many assignments this learner is expected to have.
 *
 * Counted from published weeks that actually carry a brief for their pathway,
 * NOT from a hardcoded 13. The old passport page hardcoded it, which was wrong
 * in both directions: it counted unpublished weeks, and it would have been
 * silently wrong the moment the curriculum changed length. A week with no
 * assignment title for this pathway is not work anybody can submit.
 *
 * Falls back to the number of assignment rows the learner holds when no week
 * data is available, so a caller that cannot load weeks degrades to "of what
 * you have" rather than dividing by zero.
 */
export function expectedAssignments(
  weeks: ProgressWeek[],
  pathway: string,
  fallback: number
): number {
  const published = weeks.filter((w) => w.is_published !== false);
  const withBrief = published.filter((w) =>
    pathway === 'BA' ? !!w.ba_assignment_title : !!w.pm_assignment_title
  );
  if (withBrief.length > 0) return withBrief.length;
  if (published.length > 0) return published.length;
  return fallback;
}

/**
 * Mean of the scores that exist, ignoring unscored rows.
 *
 * Unscored assignments are excluded rather than counted as zero. A submission
 * waiting on a facilitator is not a bad score, and averaging it in as 0 would
 * push a learner's average DOWN for doing the work — which is how the stored
 * column reads today for anyone mid-review.
 *
 * `assignments` is unique on (learner, week, pathway), confirmed in
 * docs/SCHEMA_DRIFT.md B1, so a resubmission REPLACES the row rather than
 * adding one. That settles the open question D-11 raised about whether
 * resubmissions average or replace: at the row level there is nothing to
 * average, and the latest score is the only score.
 */
export function averageScore(assignments: ProgressAssignment[]): { avg: number; scored: number } {
  const scores = assignments
    .map((a) => a.score)
    .filter((s): s is number => typeof s === 'number' && !Number.isNaN(s));
  if (scores.length === 0) return { avg: 0, scored: 0 };
  const sum = scores.reduce((t, s) => t + s, 0);
  return { avg: Math.round((sum / scores.length) * 10) / 10, scored: scores.length };
}

/**
 * Share of live sessions attended.
 *
 * THIS ONE TRUSTS THE STORED COLUMN, and the reason matters.
 *
 * Unlike avg_score and assignment_completion_pct, learners.attendance_pct IS
 * maintained — every learner has a plausible value and D-11 records that the
 * recomputation was built for this metric and only this metric.
 *
 * More importantly, attendance CANNOT be computed from the rows. All 62
 * attendance rows in production have attended = true: absence is recorded by
 * the ABSENCE OF A ROW, not by a false flag. So `attended / rows` is 100% for
 * everybody, always — which is exactly what an earlier version of this function
 * returned for all 7 learners before scripts/check-passport-progress-live.ts
 * showed it up against the real data. The denominator has to be sessions HELD,
 * and that is not reliably available: `sessions` holds 7 rows while learners
 * have 10-14 attendance rows each, and the stored percentages imply a
 * denominator of 11 (10/11 = 91%, 8/11 = 73%) that nothing in the schema
 * states.
 *
 * So: use the maintained column. Fall back to 0 rather than to a number derived
 * from a denominator we do not have — a credential criterion should fail closed,
 * not pass on a fabricated 100%.
 *
 * The attended COUNT from the rows is still worth showing, and the caller puts
 * it in the detail line. A count is a fact; the percentage is the part we cannot
 * derive.
 */
export function attendancePercent(
  attendance: ProgressAttendance[],
  storedPct: number | null | undefined
): number {
  if (typeof storedPct === 'number' && !Number.isNaN(storedPct)) return Math.round(storedPct);
  return 0;
}

/**
 * Has the learner reached the capstone?
 *
 * Derived from their capstone-week assignments, not from learners.capstone_status
 * — that column reads 'Not Started' for all 7 production learners while their
 * week 9-12 assignments are submitted and approved. A criterion that calls the
 * capstone unstarted when the work is done and graded is simply wrong.
 */
export function capstoneReached(
  assignments: ProgressAssignment[],
  weeks: ProgressWeek[],
  storedStatus: string | null | undefined
): { started: boolean; detail: string } {
  const capstoneWeeks = new Set(
    weeks.filter((w) => w.phase === 'Capstone').map((w) => w.week_number)
  );

  if (capstoneWeeks.size > 0) {
    const mine = assignments.filter((a) => capstoneWeeks.has(a.week_number));
    const submitted = mine.filter((a) => a.status && a.status !== 'Not Started');
    const approved = mine.filter((a) => isApprovedWork(a));
    if (submitted.length > 0) {
      return {
        started: true,
        detail:
          approved.length > 0
            ? `${approved.length} of ${capstoneWeeks.size} capstone stages approved`
            : `${submitted.length} of ${capstoneWeeks.size} capstone stages submitted`,
      };
    }
    return { started: false, detail: `0 of ${capstoneWeeks.size} capstone stages submitted` };
  }

  // No capstone weeks published — fall back to the stored column so the
  // criterion still reflects whatever an admin has recorded by hand.
  const started = !!storedStatus && storedStatus !== 'Not Started';
  return { started, detail: storedStatus || 'Not Started' };
}

/**
 * The five criteria as the learner should see them.
 *
 * Targets come from PASSPORT_CRITERIA rather than being written twice. The old
 * page had `target: 75` beside `PASSPORT_CRITERIA.attendance_min` in the same
 * object literal, which is two places to change and one of them silent.
 */
export function computePassportProgress(input: {
  pathway: string;
  assignments: ProgressAssignment[];
  attendance: ProgressAttendance[];
  weeks: ProgressWeek[];
  storedAttendancePct?: number | null;
  storedCapstoneStatus?: string | null;
}): PassportProgress {
  const mine = forPathway(input.assignments, input.pathway);

  const submittedCount = mine.filter((a) => a.status && a.status !== 'Not Started').length;
  const expectedCount = expectedAssignments(input.weeks, input.pathway, mine.length);
  const submissionPct = expectedCount > 0 ? Math.round((submittedCount / expectedCount) * 100) : 0;

  const approvedCount = mine.filter((a) => isApprovedWork(a)).length;
  const { avg, scored } = averageScore(mine);
  const attendancePct = attendancePercent(input.attendance, input.storedAttendancePct);
  const attendedCount = input.attendance.filter((a) => a.attended === true).length;
  const capstone = capstoneReached(mine, input.weeks, input.storedCapstoneStatus);

  const criteria: Criterion[] = [
    {
      key: 'attendance',
      label: `Session Attendance ≥${PASSPORT_CRITERIA.attendance_min}%`,
      actual: attendancePct,
      target: PASSPORT_CRITERIA.attendance_min,
      met: attendancePct >= PASSPORT_CRITERIA.attendance_min,
      unit: '%',
      detail:
        attendedCount > 0
          ? `${attendedCount} session${attendedCount === 1 ? '' : 's'} attended`
          : 'Attend live Saturday sessions',
    },
    {
      key: 'submission',
      label: `Assignments Submitted ≥${PASSPORT_CRITERIA.assignment_submission_min}%`,
      actual: submissionPct,
      target: PASSPORT_CRITERIA.assignment_submission_min,
      met: submissionPct >= PASSPORT_CRITERIA.assignment_submission_min,
      unit: '%',
      detail: `${submittedCount} of ${expectedCount} submitted`,
    },
    {
      key: 'avg_score',
      label: `Average Score ≥${PASSPORT_CRITERIA.avg_score_min}/100`,
      actual: avg,
      target: PASSPORT_CRITERIA.avg_score_min,
      met: avg >= PASSPORT_CRITERIA.avg_score_min,
      unit: '/100',
      detail:
        scored > 0
          ? `Across ${scored} reviewed submission${scored === 1 ? '' : 's'}`
          : 'No submissions reviewed yet',
    },
    {
      key: 'capstone',
      label: 'Capstone Submitted & Presented',
      actual: capstone.started ? 1 : 0,
      target: 1,
      met: capstone.started,
      unit: '',
      detail: capstone.detail,
    },
    {
      key: 'artefacts',
      label: `≥${PASSPORT_CRITERIA.capstone_artefacts_min} Artefacts Approved`,
      actual: approvedCount,
      target: PASSPORT_CRITERIA.capstone_artefacts_min,
      met: approvedCount >= PASSPORT_CRITERIA.capstone_artefacts_min,
      unit: '',
      detail: `${approvedCount} of ${PASSPORT_CRITERIA.capstone_artefacts_min} required`,
    },
  ];

  const metCount = criteria.filter((c) => c.met).length;

  return {
    criteria,
    metCount,
    allMet: metCount === criteria.length,
    submittedCount,
    expectedCount,
    approvedCount,
    scoredCount: scored,
  };
}
