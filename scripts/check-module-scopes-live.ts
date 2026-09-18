// scripts/check-module-scopes-live.ts
// ─────────────────────────────────────────────────────────────────────────────
// Exercises the three-scope model against the LIVE database, then puts it back.
//
//     node --experimental-strip-types --import ./scripts/_ai-guard-stubs.mjs \
//          scripts/check-module-scopes-live.ts
//
// Unlike scripts/verify-module-access.ts, which proves the rule on made-up
// rows, this proves the whole path: a real row written to module_access, read
// back through the real cache and the real resolver, and resolved per real
// learner — the two things the owner asked for, in both directions:
//
//   1. ON for a cohort, OFF for one named learner in it
//   2. OFF for a cohort, ON for one named learner in it
//
// WRITES, then REVERTS. Every row it creates is deleted again, and it prints
// the before and after state so a half-finished run is visible rather than
// silent. It touches one module — community — and never the AI Lab flags that
// govern billable endpoints.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
for (const line of fs.readFileSync(path.join(here, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

/** The module under test. Deliberately not an ai_lab.* key. */
const MODULE = 'community' as const;
const ACTOR = 'claude-code/scope-check';

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed++;
    console.log(`    PASS  ${name}`);
  } else {
    failed++;
    console.log(`    FAIL  ${name}${detail ? `\n            ${detail}` : ''}`);
  }
}

async function main(): Promise<number> {
  const { createAdminClient } = await import('../lib/supabase.ts');
  const { getModuleAccess, invalidateModuleAccessCache } = await import('../lib/module-access.ts');

  const db = createAdminClient();

  const { data: learners, error: lErr } = await db
    .from('learners')
    .select('id, first_name, cohort')
    .not('cohort', 'is', null)
    .order('first_name');

  if (lErr || !learners || learners.length < 2) {
    console.error('Need at least two learners sharing a cohort. Got:', lErr?.message ?? learners?.length);
    return 1;
  }

  // Two learners in the same cohort: one to single out, one to prove the rest
  // of the cohort is unaffected.
  const cohort = learners[0].cohort as string;
  const sameCohort = learners.filter((l) => l.cohort === cohort);
  if (sameCohort.length < 2) {
    console.error(`Need two learners in ${cohort}; found ${sameCohort.length}.`);
    return 1;
  }
  const [target, bystander] = sameCohort;

  console.log('\n══ MODULE SCOPES, LIVE ════════════════════════════════════════');
  console.log(`  module : ${MODULE}`);
  console.log(`  cohort : ${cohort}`);
  console.log(`  target : ${target.first_name} (the exception)`);
  console.log(`  other  : ${bystander.first_name} (must be unaffected)\n`);

  // ── Record what to put back ────────────────────────────────────────────────
  const { data: before } = await db
    .from('module_access')
    .select('id, cohort, learner_id, enabled')
    .eq('module_key', MODULE);
  console.log(`  ${before?.length ?? 0} existing row(s) for ${MODULE}; they will be restored.\n`);

  const created: string[] = [];
  const changed: Array<{ id: string; enabled: boolean }> = [];

  async function setScope(scope: { cohort?: string | null; learnerId?: string | null }, enabled: boolean) {
    const q = db.from('module_access').select('id, enabled').eq('module_key', MODULE);
    const scoped = scope.learnerId
      ? q.eq('learner_id', scope.learnerId).is('cohort', null)
      : scope.cohort
        ? q.is('learner_id', null).eq('cohort', scope.cohort)
        : q.is('learner_id', null).is('cohort', null);
    const { data: row } = await scoped.maybeSingle();

    if (row) {
      changed.push({ id: row.id, enabled: row.enabled });
      await db.from('module_access').update({ enabled, updated_by: ACTOR }).eq('id', row.id);
    } else {
      const { data: ins } = await db
        .from('module_access')
        .insert({
          module_key: MODULE,
          cohort: scope.cohort ?? null,
          learner_id: scope.learnerId ?? null,
          enabled,
          updated_by: ACTOR,
        })
        .select('id')
        .maybeSingle();
      if (ins?.id) created.push(ins.id);
    }
    invalidateModuleAccessCache();
  }

  async function sees(learner: { id: string; cohort: string | null }): Promise<boolean> {
    const map = await getModuleAccess({ cohort: learner.cohort, learnerId: learner.id });
    return map[MODULE] === true;
  }

  try {
    console.log('  1. Cohort ON, one learner switched OFF');
    await setScope({ cohort }, true);
    await setScope({ learnerId: target.id }, false);
    check(`${target.first_name} does NOT see it`, (await sees(target)) === false);
    check(`${bystander.first_name} DOES see it`, (await sees(bystander)) === true);

    console.log('\n  2. Clearing the learner row returns them to the cohort');
    await db.from('module_access').delete().eq('module_key', MODULE).eq('learner_id', target.id);
    invalidateModuleAccessCache();
    check(`${target.first_name} sees it again`, (await sees(target)) === true);

    console.log('\n  3. Cohort OFF, one learner switched ON');
    await setScope({ cohort }, false);
    await setScope({ learnerId: target.id }, true);
    check(`${target.first_name} DOES see it`, (await sees(target)) === true);
    check(`${bystander.first_name} does NOT see it`, (await sees(bystander)) === false);

    console.log('\n  4. A learner exception does not leak to another cohort');
    const other = learners.find((l) => l.cohort && l.cohort !== cohort);
    if (!other) {
      console.log('    SKIP  only one cohort exists in the data');
    } else {
      check(
        `a learner in ${other.cohort} is unaffected`,
        (await sees(other)) === false,
        'the exception reached a different cohort'
      );
    }
  } finally {
    // ── Put everything back, whatever happened above ────────────────────────
    console.log('\n  Reverting…');
    await db.from('module_access').delete().eq('module_key', MODULE).eq('learner_id', target.id);
    for (const id of created) await db.from('module_access').delete().eq('id', id);
    for (const c of changed) await db.from('module_access').update({ enabled: c.enabled }).eq('id', c.id);
    invalidateModuleAccessCache();

    const { data: after } = await db
      .from('module_access')
      .select('cohort, learner_id, enabled')
      .eq('module_key', MODULE);
    console.log(`    ${after?.length ?? 0} row(s) for ${MODULE} after revert:`);
    for (const r of after ?? []) {
      console.log(
        `      cohort=${r.cohort ?? 'global'} learner=${r.learner_id ?? '-'} enabled=${r.enabled}`
      );
    }
  }

  console.log(`\n  ${'─'.repeat(60)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log(`  ${'─'.repeat(60)}\n`);
  return failed > 0 ? 1 : 0;
}

// Never process.exit() after a fetch — it truncates stdout (commit a3fd9fe).
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error('check-module-scopes-live failed:', err);
    process.exitCode = 1;
  });
