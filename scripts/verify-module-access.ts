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
  const r = resolveFromRows(SEED, 'Cohort 1');
  check('capstone off', r.capstone, false);
  check('notifications off', r.notifications, false);
  check('community off', r.community, false);
  check('stakeholder_sim ON', r['ai_lab.stakeholder_sim'], true);
  check('writing_checker off', r['ai_lab.writing_checker'], false);
  check('interview_coach off', r['ai_lab.interview_coach'], false);
}

console.log('\n2. Fail closed — no rows at all denies everything');
{
  check('empty table', resolveFromRows([], 'Cohort 1'), allDisabled());
  check('unseeded module denied', resolveFromRows([], null).community, false);
}

console.log('\n3. Cohort override beats the global row — both directions');
{
  const rows: ModuleAccessRow[] = [
    ...SEED,
    { module_key: 'capstone', cohort: 'Cohort 1', enabled: true },
  ];
  check('Cohort 1 gets capstone ON via override', resolveFromRows(rows, 'Cohort 1').capstone, true);
  check('Cohort 2 still falls back to global OFF', resolveFromRows(rows, 'Cohort 2').capstone, false);
  check('no cohort falls back to global OFF', resolveFromRows(rows, null).capstone, false);

  // The reverse: global on, one cohort switched off.
  const inverted: ModuleAccessRow[] = [
    { module_key: 'community', cohort: null, enabled: true },
    { module_key: 'community', cohort: 'Cohort 2', enabled: false },
  ];
  check('global ON reaches Cohort 1', resolveFromRows(inverted, 'Cohort 1').community, true);
  check('Cohort 2 override forces OFF', resolveFromRows(inverted, 'Cohort 2').community, false);
}

console.log('\n4. Override with no global row');
{
  const rows: ModuleAccessRow[] = [{ module_key: 'capstone', cohort: 'Cohort 2', enabled: true }];
  check('matching cohort is ON', resolveFromRows(rows, 'Cohort 2').capstone, true);
  check('other cohort denied (no global to fall back to)', resolveFromRows(rows, 'Cohort 1').capstone, false);
}

console.log('\n5. Cohort matching is exact and whitespace-tolerant');
{
  const rows: ModuleAccessRow[] = [{ module_key: 'community', cohort: 'Cohort 2', enabled: true }];
  check('padded input trims to a match', resolveFromRows(rows, '  Cohort 2  ').community, true);
  check('different case does NOT match', resolveFromRows(rows, 'cohort 2').community, false);
  check('empty string behaves as no cohort', resolveFromRows(rows, '   ').community, false);
}

console.log('\n6. Only boolean true enables — every other value denies');
{
  const bad = [1, 'true', 'yes', {}, [], null, undefined, 'false', 0];
  for (const v of bad) {
    const rows = [{ module_key: 'community', cohort: null, enabled: v as unknown as boolean }];
    check(`enabled=${JSON.stringify(v)} denies`, resolveFromRows(rows, null).community, false);
  }
  check('enabled=true enables', resolveFromRows([{ module_key: 'community', cohort: null, enabled: true }], null).community, true);
}

console.log('\n7. Junk rows cannot enable anything');
{
  const rows = [
    { module_key: 'not_a_module', cohort: null, enabled: true },
    { module_key: 'community; DROP TABLE', cohort: null, enabled: true },
    { module_key: '', cohort: null, enabled: true },
  ] as ModuleAccessRow[];
  check('unknown keys ignored, all still denied', resolveFromRows(rows, null), allDisabled());
  check('result has exactly the known keys', Object.keys(resolveFromRows(rows, null)).sort(), [...MODULE_KEYS].sort());
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
  check('first global row wins, not the most permissive', resolveFromRows(rows, null).community, false);
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(60)}\n`);

if (failed > 0) process.exit(1);
