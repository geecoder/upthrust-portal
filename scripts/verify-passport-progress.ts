// scripts/verify-passport-progress.ts
// ─────────────────────────────────────────────────────────────────────────────
// Proves the Capability Passport criteria are computed correctly, without a
// database.
//
//     node --experimental-strip-types scripts/verify-passport-progress.ts
//
// The case that matters most is section 1: the exact production state on
// 2026-09-17, where the stored columns said a learner had submitted 0% and
// scored 0 while their assignment rows said 25 of 25 submitted at a mean of
// 82.5. That is the defect lib/passport-progress.ts exists to fix, so it is
// asserted as data rather than described in a comment.
//
// Pure inputs, pure outputs. No network, no clock, no environment.
// ─────────────────────────────────────────────────────────────────────────────
import {
  computePassportProgress,
  averageScore,
  expectedAssignments,
  attendancePercent,
  capstoneReached,
  type ProgressAssignment,
  type ProgressWeek,
} from '../lib/passport-progress.ts';
import { PASSPORT_CRITERIA } from '../lib/types.ts';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readFile = (rel: string): string => {
  const full = join(ROOT, rel);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
};

let passed = 0;
let failed = 0;

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}\n          expected ${e}\n          actual   ${a}`);
  }
}

/** Weeks 0-12 as published in production: 9-12 are the capstone arc. */
const WEEKS: ProgressWeek[] = Array.from({ length: 13 }, (_, i) => ({
  week_number: i,
  phase: i >= 9 ? 'Capstone' : i >= 7 ? 'Delivery' : i >= 3 ? 'Core Skills' : 'Foundation',
  is_published: true,
  pm_assignment_title: `PM week ${i}`,
  ba_assignment_title: `BA week ${i}`,
}));

function criterion(progress: ReturnType<typeof computePassportProgress>, key: string) {
  return progress.criteria.find((c) => c.key === key)!;
}

console.log('\n1. The production defect — stored columns said 0, the rows said otherwise');
{
  // 13 assignments, all submitted, 11 carrying a score averaging 82.5, and the
  // capstone weeks among them approved. The learner row said 0% and 0.
  const assignments: ProgressAssignment[] = WEEKS.map((w, i) => ({
    week_number: w.week_number,
    pathway: 'PM',
    status: i >= 9 ? 'Capstone Ready' : 'Approved',
    score: i < 11 ? [80, 85, 90, 75, 88, 82, 79, 91, 77, 84, 76][i] : null,
  }));
  const attendance = WEEKS.map((w, i) => ({ week_number: w.week_number, attended: i !== 3 }));

  const p = computePassportProgress({
    pathway: 'PM',
    assignments,
    attendance,
    weeks: WEEKS,
    storedAttendancePct: 91,
    storedCapstoneStatus: 'Not Started', // what production actually holds
  });

  check('submission is 100%, not 0%', criterion(p, 'submission').actual, 100);
  check('  and it is met', criterion(p, 'submission').met, true);
  check('average score is the mean of scored rows', criterion(p, 'avg_score').actual, 82.5);
  check('  and it is met', criterion(p, 'avg_score').met, true);
  check('capstone counts as reached despite the stored column', criterion(p, 'capstone').met, true);
  check('  detail names the approved stages', criterion(p, 'capstone').detail, '4 of 4 capstone stages approved');
  check('attendance uses the maintained column, not the rows', criterion(p, 'attendance').actual, 91);
  check('artefacts counted', criterion(p, 'artefacts').actual, 13);
  check('all five met', p.allMet, true);
}

console.log('\n2. Unscored submissions do not count as zero');
{
  // One scored 90, three awaiting review. Averaging the unscored in as 0 would
  // give 22.5 and fail the criterion for doing the work.
  const assignments: ProgressAssignment[] = [
    { week_number: 1, pathway: 'PM', status: 'Approved', score: 90 },
    { week_number: 2, pathway: 'PM', status: 'Submitted', score: null },
    { week_number: 3, pathway: 'PM', status: 'Submitted' },
    { week_number: 4, pathway: 'PM', status: 'AI Reviewed', score: null },
  ];
  check('average ignores unscored', averageScore(assignments), { avg: 90, scored: 1 });

  const p = computePassportProgress({ pathway: 'PM', assignments, attendance: [], weeks: WEEKS });
  check('average criterion is met on the one real score', criterion(p, 'avg_score').met, true);
  check('  detail says how many were reviewed', criterion(p, 'avg_score').detail, 'Across 1 reviewed submission');
}

console.log('\n3. No data at all fails closed, without dividing by zero');
{
  const p = computePassportProgress({ pathway: 'PM', assignments: [], attendance: [], weeks: WEEKS });
  check('submission 0%', criterion(p, 'submission').actual, 0);
  check('average 0', criterion(p, 'avg_score').actual, 0);
  check('  and says so plainly', criterion(p, 'avg_score').detail, 'No submissions reviewed yet');
  check('capstone not reached', criterion(p, 'capstone').met, false);
  check('nothing met', p.metCount, 0);
  check('not allMet', p.allMet, false);
}

console.log('\n4. Expected count comes from the curriculum, never a hardcoded 13');
{
  check('13 published weeks with PM briefs', expectedAssignments(WEEKS, 'PM', 99), 13);

  const shorter = WEEKS.slice(0, 9);
  check('a 9-week curriculum expects 9', expectedAssignments(shorter, 'PM', 99), 9);

  const halfPublished = WEEKS.map((w, i) => ({ ...w, is_published: i < 5 }));
  check('unpublished weeks are not expected work', expectedAssignments(halfPublished, 'PM', 99), 5);

  const pmOnly = WEEKS.map((w) => ({ ...w, ba_assignment_title: null }));
  check('a BA learner is not expected to do PM-only weeks', expectedAssignments(pmOnly, 'BA', 99), 13);

  check('no week data falls back to what the learner holds', expectedAssignments([], 'PM', 7), 7);
}

console.log('\n5. Submission percentage is against expected, not against rows held');
{
  // 5 of 13 submitted is 38%, not 100% — the trap in dividing by rows held.
  const assignments: ProgressAssignment[] = [0, 1, 2, 3, 4].map((i) => ({
    week_number: i,
    pathway: 'PM',
    status: 'Submitted',
  }));
  const p = computePassportProgress({ pathway: 'PM', assignments, attendance: [], weeks: WEEKS });
  check('5 of 13 is 38%', criterion(p, 'submission').actual, 38);
  check('  not met at 38%', criterion(p, 'submission').met, false);
  check('  detail shows both numbers', criterion(p, 'submission').detail, '5 of 13 submitted');
}

console.log('\n6. Attendance trusts the maintained column, never the rows');
{
  // Every attendance row in production has attended = true — absence is a
  // MISSING row. Counting rows gives 100% for everyone, which is the bug the
  // live check caught. These assertions pin the fix.
  const allTrue = [
    { week_number: 1, attended: true },
    { week_number: 2, attended: true },
    { week_number: 3, attended: true },
  ];
  check('three attended rows do not become 100%', attendancePercent(allTrue, 91), 91);
  check('no rows still uses the column', attendancePercent([], 91), 91);
  check('no column at all fails closed', attendancePercent(allTrue, null), 0);
  check('  and does not pass the criterion on nothing', attendancePercent([], undefined), 0);
  check('a real zero is respected', attendancePercent(allTrue, 0), 0);

  // The detail line still reports the count, which IS a fact.
  const p = computePassportProgress({
    pathway: 'PM',
    assignments: [],
    attendance: allTrue,
    weeks: WEEKS,
    storedAttendancePct: 91,
  });
  check('detail counts sessions without claiming a percentage', criterion(p, 'attendance').detail, '3 sessions attended');
  check('  and the percentage is the stored one', criterion(p, 'attendance').actual, 91);
}

console.log('\n7. Capstone is derived from the capstone weeks');
{
  const submittedOnly: ProgressAssignment[] = [{ week_number: 9, pathway: 'PM', status: 'Submitted' }];
  check('submitted counts as reached', capstoneReached(submittedOnly, WEEKS, 'Not Started').started, true);
  check('  detail counts submitted, not approved', capstoneReached(submittedOnly, WEEKS, 'Not Started').detail, '1 of 4 capstone stages submitted');

  const notStarted: ProgressAssignment[] = [{ week_number: 9, pathway: 'PM', status: 'Not Started' }];
  check('a Not Started capstone row is not reached', capstoneReached(notStarted, WEEKS, 'Not Started').started, false);

  const preCapstoneOnly: ProgressAssignment[] = [{ week_number: 1, pathway: 'PM', status: 'Approved' }];
  check('approved earlier weeks do not reach the capstone', capstoneReached(preCapstoneOnly, WEEKS, 'Not Started').started, false);

  // No capstone weeks published — the stored column is all there is.
  const noCapstone = WEEKS.filter((w) => w.phase !== 'Capstone');
  check('falls back to the stored status', capstoneReached([], noCapstone, 'Presented'), { started: true, detail: 'Presented' });
  check('  and to Not Started when empty', capstoneReached([], noCapstone, null), { started: false, detail: 'Not Started' });
}

console.log('\n8. The legacy status still counts as approved work');
{
  // Migration 0004 renamed 'Portfolio Ready' to 'Capstone Ready'. A database
  // that has not had it applied must not show a learner's approved work
  // vanishing from their passport.
  const legacy: ProgressAssignment[] = [
    { week_number: 1, pathway: 'PM', status: 'Portfolio Ready' },
    { week_number: 2, pathway: 'PM', status: 'Capstone Ready' },
    { week_number: 3, pathway: 'PM', status: 'Approved' },
    { week_number: 4, pathway: 'PM', status: 'Submitted', portfolio_approved: true },
  ];
  const p = computePassportProgress({ pathway: 'PM', assignments: legacy, attendance: [], weeks: WEEKS });
  check('all four count as approved', criterion(p, 'artefacts').actual, 4);
}

console.log('\n9. Targets come from PASSPORT_CRITERIA, not from copied literals');
{
  const p = computePassportProgress({ pathway: 'PM', assignments: [], attendance: [], weeks: WEEKS });
  check('attendance target', criterion(p, 'attendance').target, PASSPORT_CRITERIA.attendance_min);
  check('submission target', criterion(p, 'submission').target, PASSPORT_CRITERIA.assignment_submission_min);
  check('score target', criterion(p, 'avg_score').target, PASSPORT_CRITERIA.avg_score_min);
  check('artefact target', criterion(p, 'artefacts').target, PASSPORT_CRITERIA.capstone_artefacts_min);
  check('five criteria, no more', p.criteria.length, 5);
}

console.log('\n10. Another pathway’s rows are not counted');
{
  const mixed: ProgressAssignment[] = [
    { week_number: 1, pathway: 'PM', status: 'Approved', score: 80 },
    { week_number: 1, pathway: 'BA', status: 'Approved', score: 40 },
  ];
  const p = computePassportProgress({ pathway: 'PM', assignments: mixed, attendance: [], weeks: WEEKS });
  check('only the PM row averages', criterion(p, 'avg_score').actual, 80);
  check('only the PM row is approved', criterion(p, 'artefacts').actual, 1);
}

console.log('\n11. The stale columns cannot creep back into the pages');
{
  // The defect was not that the columns were wrong — it was that three pages
  // read them directly. These assertions fail if anyone reintroduces that,
  // which is the only way this fix silently regresses.
  const SITES = [
    'app/portal/passport/page.tsx',
    'app/portal/page.tsx',
    'app/admin/learners/[learnerId]/page.tsx',
  ];
  for (const site of SITES) {
    const src = readFile(site);
    check(`${site} computes progress`, src.includes('computePassportProgress('), true);
    // Passing a stored value INTO the computation is fine and intended; reading
    // one to decide a criterion is not. The distinction is the `>=` comparison.
    const readsStoredDirectly =
      /avg_score\s*\|\|\s*0\)?\s*>=/.test(src) ||
      /assignment_completion_pct/.test(src);
    check(`  ${site} does not judge a criterion from a stored column`, readsStoredDirectly, false);
  }

  // And the hardcoded expected-assignment count is gone for good.
  check('no hardcoded totalExpected', readFile('app/portal/passport/page.tsx').includes('totalExpected = 13'), false);
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(60)}\n`);

if (failed > 0) process.exit(1);
