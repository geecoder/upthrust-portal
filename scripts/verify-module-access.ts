// scripts/verify-module-access.ts
// ─────────────────────────────────────────────────────────────────────────────
// Proves the module access resolution rule without a database.
//
//     node --experimental-strip-types scripts/verify-module-access.ts
//
// Exercises lib/module-access-rules.ts directly. It covers the cases that
// decide whether the mechanism is safe — precedence, unknown modules, and every
// shape of bad input that could plausibly resolve to "enabled" by accident.
//
// This does NOT test the database read, the cache or the HTTP guard. Those need
// migration 0003 applied and a signed-in session; the review card says so.
// ─────────────────────────────────────────────────────────────────────────────
import {
  MODULE_KEYS,
  allDisabled,
  explainFromRows,
  isModuleKey,
  resolveFromRows,
  type ModuleAccessRow,
} from '../lib/module-access-rules.ts';

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

/** The state migration 0003 seeds. */
const SEED: ModuleAccessRow[] = [
  { module_key: 'capstone', cohort: null, enabled: false },
  { module_key: 'notifications', cohort: null, enabled: false },
  { module_key: 'community', cohort: null, enabled: false },
  { module_key: 'ai_lab.stakeholder_sim', cohort: null, enabled: true },
  { module_key: 'ai_lab.writing_checker', cohort: null, enabled: false },
  { module_key: 'ai_lab.interview_coach', cohort: null, enabled: false },
];

console.log('\n1. Seed state — only Stakeholder Sim is open');
{
  const r = resolveFromRows(SEED, { cohort: 'Cohort 1' });
  check('capstone off', r.capstone, false);
  check('notifications off', r.notifications, false);
  check('community off', r.community, false);
  check('stakeholder_sim ON', r['ai_lab.stakeholder_sim'], true);
  check('writing_checker off', r['ai_lab.writing_checker'], false);
  check('interview_coach off', r['ai_lab.interview_coach'], false);
}

console.log('\n2. Fail closed — no rows at all denies everything');
{
  check('empty table', resolveFromRows([], { cohort: 'Cohort 1' }), allDisabled());
  check('unseeded module denied', resolveFromRows([], { cohort: null }).community, false);
}

console.log('\n3. Cohort override beats the global row — both directions');
{
  const rows: ModuleAccessRow[] = [
    ...SEED,
    { module_key: 'capstone', cohort: 'Cohort 1', enabled: true },
  ];
  check('Cohort 1 gets capstone ON via override', resolveFromRows(rows, { cohort: 'Cohort 1' }).capstone, true);
  check('Cohort 2 still falls back to global OFF', resolveFromRows(rows, { cohort: 'Cohort 2' }).capstone, false);
  check('no cohort falls back to global OFF', resolveFromRows(rows, { cohort: null }).capstone, false);

  // The reverse: global on, one cohort switched off.
  const inverted: ModuleAccessRow[] = [
    { module_key: 'community', cohort: null, enabled: true },
    { module_key: 'community', cohort: 'Cohort 2', enabled: false },
  ];
  check('global ON reaches Cohort 1', resolveFromRows(inverted, { cohort: 'Cohort 1' }).community, true);
  check('Cohort 2 override forces OFF', resolveFromRows(inverted, { cohort: 'Cohort 2' }).community, false);
}

console.log('\n4. Override with no global row');
{
  const rows: ModuleAccessRow[] = [{ module_key: 'capstone', cohort: 'Cohort 2', enabled: true }];
  check('matching cohort is ON', resolveFromRows(rows, { cohort: 'Cohort 2' }).capstone, true);
  check('other cohort denied (no global to fall back to)', resolveFromRows(rows, { cohort: 'Cohort 1' }).capstone, false);
}

console.log('\n5. Cohort matching is exact and whitespace-tolerant');
{
  const rows: ModuleAccessRow[] = [{ module_key: 'community', cohort: 'Cohort 2', enabled: true }];
  check('padded input trims to a match', resolveFromRows(rows, { cohort: '  Cohort 2  ' }).community, true);
  check('different case does NOT match', resolveFromRows(rows, { cohort: 'cohort 2' }).community, false);
  check('empty string behaves as no cohort', resolveFromRows(rows, { cohort: '   ' }).community, false);
}

console.log('\n6. Only boolean true enables — every other value denies');
{
  const bad = [1, 'true', 'yes', {}, [], null, undefined, 'false', 0];
  for (const v of bad) {
    const rows = [{ module_key: 'community', cohort: null, enabled: v as unknown as boolean }];
    check(`enabled=${JSON.stringify(v)} denies`, resolveFromRows(rows, { cohort: null }).community, false);
  }
  check('enabled=true enables', resolveFromRows([{ module_key: 'community', cohort: null, enabled: true }], { cohort: null }).community, true);
}

console.log('\n7. Junk rows cannot enable anything');
{
  const rows = [
    { module_key: 'not_a_module', cohort: null, enabled: true },
    { module_key: 'community; DROP TABLE', cohort: null, enabled: true },
    { module_key: '', cohort: null, enabled: true },
  ] as ModuleAccessRow[];
  check('unknown keys ignored, all still denied', resolveFromRows(rows, { cohort: null }), allDisabled());
  check('result has exactly the known keys', Object.keys(resolveFromRows(rows, { cohort: null })).sort(), [...MODULE_KEYS].sort());
}

console.log('\n8. isModuleKey rejects anything not in the registry');
{
  check('known key accepted', isModuleKey('ai_lab.stakeholder_sim'), true);
  check('unknown key rejected', isModuleKey('ai_lab.everything'), false);
  check('non-string rejected', isModuleKey(42), false);
  check('null rejected', isModuleKey(null), false);
  check('__proto__ rejected', isModuleKey('__proto__'), false);
}

console.log('\n9. Duplicate global rows resolve deterministically');
{
  // The partial unique index in migration 0003 makes this impossible in the
  // database. Asserted anyway so a resolver change cannot quietly start
  // returning "whichever row came back first" as enabled.
  const rows: ModuleAccessRow[] = [
    { module_key: 'community', cohort: null, enabled: false },
    { module_key: 'community', cohort: null, enabled: true },
  ];
  check('first global row wins, not the most permissive', resolveFromRows(rows, { cohort: null }).community, false);
}

console.log('\n10. Per-learner overrides beat the cohort row');
{
  const ME = 'a1111111-1111-1111-1111-111111111111';
  const THEM = 'b2222222-2222-2222-2222-222222222222';

  // The owner's case: community is ON for Cohort 1, but OFF for one learner.
  const rows: ModuleAccessRow[] = [
    { module_key: 'community', cohort: null, enabled: false },
    { module_key: 'community', cohort: 'Cohort 1', enabled: true },
    { module_key: 'community', cohort: null, learner_id: ME, enabled: false },
  ];
  check('the singled-out learner is OFF', resolveFromRows(rows, { cohort: 'Cohort 1', learnerId: ME }).community, false);
  check('everyone else in the cohort stays ON', resolveFromRows(rows, { cohort: 'Cohort 1', learnerId: THEM }).community, true);
  check('the cohort view itself is unchanged', resolveFromRows(rows, { cohort: 'Cohort 1' }).community, true);
  check('another cohort still falls back to global OFF', resolveFromRows(rows, { cohort: 'Cohort 2', learnerId: THEM }).community, false);
}

console.log('\n11. The inverse: OFF for a cohort, ON for one learner in it');
{
  const ME = 'a1111111-1111-1111-1111-111111111111';
  const THEM = 'b2222222-2222-2222-2222-222222222222';
  const rows: ModuleAccessRow[] = [
    { module_key: 'ai_lab.interview_coach', cohort: null, enabled: false },
    { module_key: 'ai_lab.interview_coach', cohort: 'Cohort 1', enabled: false },
    { module_key: 'ai_lab.interview_coach', cohort: null, learner_id: ME, enabled: true },
  ];
  check('the named learner gets the AI tool', resolveFromRows(rows, { cohort: 'Cohort 1', learnerId: ME })['ai_lab.interview_coach'], true);
  check('their cohort-mates do not', resolveFromRows(rows, { cohort: 'Cohort 1', learnerId: THEM })['ai_lab.interview_coach'], false);
}

console.log('\n12. A learner row must not leak to anyone else');
{
  // This is the failure the !r.learner_id guards exist to prevent: a learner
  // row carries cohort NULL, so without them it would also match as the GLOBAL
  // row and one person's exception would become everybody's.
  const ME = 'a1111111-1111-1111-1111-111111111111';
  const rows: ModuleAccessRow[] = [
    { module_key: 'community', cohort: null, learner_id: ME, enabled: true },
  ];
  check('no scope at all stays denied', resolveFromRows(rows, {}).community, false);
  check('a learner with no override stays denied', resolveFromRows(rows, { learnerId: 'b2222222-2222-2222-2222-222222222222' }).community, false);
  check('a cohort view stays denied', resolveFromRows(rows, { cohort: 'Cohort 1' }).community, false);
  check('only the named learner is enabled', resolveFromRows(rows, { learnerId: ME }).community, true);
}

console.log('\n13. A learner override survives a cohort move');
{
  const ME = 'a1111111-1111-1111-1111-111111111111';
  const rows: ModuleAccessRow[] = [
    { module_key: 'capstone', cohort: null, enabled: false },
    { module_key: 'capstone', cohort: 'Cohort 1', enabled: true },
    { module_key: 'capstone', cohort: null, learner_id: ME, enabled: true },
  ];
  // The override is keyed on the person, so moving them keeps it.
  check('in Cohort 1', resolveFromRows(rows, { cohort: 'Cohort 1', learnerId: ME }).capstone, true);
  check('moved to Cohort 2, still ON', resolveFromRows(rows, { cohort: 'Cohort 2', learnerId: ME }).capstone, true);
}

console.log('\n14. Bad learner ids are denied, not crashed on');
{
  const rows: ModuleAccessRow[] = [
    { module_key: 'community', cohort: 'Cohort 1', enabled: true },
  ];
  for (const bad of [null, undefined, '', '   ']) {
    check(
      `learnerId=${JSON.stringify(bad)} falls back to the cohort`,
      resolveFromRows(rows, { cohort: 'Cohort 1', learnerId: bad as string | null }).community,
      true
    );
  }
  // An empty-string learner_id on a ROW must never match a real learner.
  const junk: ModuleAccessRow[] = [{ module_key: 'community', cohort: null, learner_id: '', enabled: true }];
  check('a row with an empty learner_id is not a learner row', resolveFromRows(junk, { learnerId: 'a1111111-1111-1111-1111-111111111111' }).community, false);
}

console.log('\n15. explainFromRows agrees with resolveFromRows about who won');
{
  const ME = 'a1111111-1111-1111-1111-111111111111';
  const rows: ModuleAccessRow[] = [
    { module_key: 'community', cohort: null, enabled: false },
    { module_key: 'community', cohort: 'Cohort 1', enabled: true },
    { module_key: 'community', cohort: null, learner_id: ME, enabled: false },
  ];
  check('learner row wins and is named', explainFromRows(rows, 'community', { cohort: 'Cohort 1', learnerId: ME }), { enabled: false, source: 'learner' });
  check('cohort row wins for a cohort-mate', explainFromRows(rows, 'community', { cohort: 'Cohort 1', learnerId: 'b2222222-2222-2222-2222-222222222222' }), { enabled: true, source: 'cohort' });
  check('global wins elsewhere', explainFromRows(rows, 'community', { cohort: 'Cohort 9' }), { enabled: false, source: 'global' });
  check('nothing applies reads as none', explainFromRows([], 'community', { cohort: 'Cohort 1' }), { enabled: false, source: 'none' });

  // The two must never disagree, for any scope.
  for (const scope of [{}, { cohort: 'Cohort 1' }, { cohort: 'Cohort 1', learnerId: ME }, { learnerId: ME }]) {
    check(
      `agreement for ${JSON.stringify(scope)}`,
      explainFromRows(rows, 'community', scope).enabled,
      resolveFromRows(rows, scope).community
    );
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(60)}\n`);

if (failed > 0) process.exit(1);
