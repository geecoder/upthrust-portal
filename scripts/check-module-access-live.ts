// scripts/check-module-access-live.ts
// ─────────────────────────────────────────────────────────────────────────────
// Reports the LIVE module access state straight from the database.
//
//     node --experimental-strip-types scripts/check-module-access-live.ts
//
// READ-ONLY. Issues SELECTs over PostgREST and nothing else — no INSERT, no
// UPDATE, no DDL. Safe to run against production at any time.
//
// Run it BEFORE applying migration 0003 to see the fail-closed path, and AFTER
// to confirm the seed landed and resolves as intended. It reads credentials
// from .env.local and never prints them.
//
// This exercises the same rows and the same resolution function the application
// uses (lib/module-access-rules.ts), so what it prints is what a learner gets.
// It does not exercise the HTTP guard or the cache — those need a running
// server and a signed-in session.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MODULE_KEYS,
  MODULE_REGISTRY,
  resolveFromRows,
  type ModuleAccessRow,
} from '../lib/module-access-rules.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(here, '..', '.env.local');

function readEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}

const env = readEnv();
const url = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
  process.exit(1);
}

const SELECT = 'module_key,cohort,enabled,note,updated_at';

async function fetchRows(key: string): Promise<{ rows?: ModuleAccessRow[]; status: number; body: string }> {
  const res = await fetch(`${url}/rest/v1/module_access?select=${SELECT}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  if (!res.ok) return { status: res.status, body };
  return { rows: JSON.parse(body) as ModuleAccessRow[], status: res.status, body };
}

console.log('\n══ LIVE MODULE ACCESS ═════════════════════════════════════════');
console.log(`project: ${url.replace(/^https?:\/\//, '')}\n`);

const service = await fetchRows(serviceKey);

if (!service.rows) {
  const missing = service.body.includes('PGRST205') || service.body.includes('42P01');
  console.log(`  module_access read FAILED — HTTP ${service.status}`);
  if (missing) {
    console.log('\n  The table does not exist. Migration 0003 has not been run.');
    console.log('  The application FAILS CLOSED in this state: every gated module');
    console.log('  reads as disabled, including Stakeholder Sim.\n');
    console.log('  Resolved state a learner would get right now:');
    const resolved = resolveFromRows([], 'Cohort 1');
    for (const k of MODULE_KEYS) console.log(`    ${k.padEnd(26)} ${resolved[k] ? 'ON' : 'off'}`);
    console.log('\n  Fix: run supabase/migrations/0003_module_access.sql in the SQL Editor.');
  } else {
    console.log(`  ${service.body.slice(0, 300)}`);
  }
  console.log('\n═══════════════════════════════════════════════════════════════\n');
  process.exit(0);
}

const rows = service.rows;
console.log(`  ${rows.length} row(s) present\n`);
console.log('  ROWS');
for (const r of rows.sort((a, b) => a.module_key.localeCompare(b.module_key))) {
  console.log(
    `    ${r.module_key.padEnd(26)} cohort=${String(r.cohort ?? 'GLOBAL').padEnd(12)} ${r.enabled ? 'ON ' : 'off'}`
  );
}

// Resolution for each cohort actually present on learners, plus the global view.
const learnersRes = await fetch(`${url}/rest/v1/learners?select=cohort`, {
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
});
const cohorts = new Set<string | null>([null]);
if (learnersRes.ok) {
  for (const l of (await learnersRes.json()) as { cohort: string | null }[]) {
    if (l.cohort) cohorts.add(l.cohort);
  }
}

console.log('\n  RESOLVED PER COHORT  (what a learner in that cohort actually gets)');
for (const c of cohorts) {
  const resolved = resolveFromRows(rows, c);
  const on = MODULE_KEYS.filter((k) => resolved[k]);
  console.log(`\n    ${c ?? '(no cohort / global)'}`);
  for (const k of MODULE_KEYS) {
    const meta = MODULE_REGISTRY[k];
    console.log(`      ${k.padEnd(26)} ${resolved[k] ? 'ON ' : 'off'}  ${resolved[k] ? '' : `(${meta.presentation})`}`);
  }
  console.log(`      → ${on.length} of ${MODULE_KEYS.length} open`);
}

// The anon key ships in the browser bundle. It must see nothing.
const anon = anonKey ? await fetchRows(anonKey) : null;
console.log('\n  RLS CHECK — the anon key ships in the browser bundle');
if (!anon) {
  console.log('    skipped: no anon key in .env.local');
} else if (!anon.rows) {
  console.log(`    anon read refused (HTTP ${anon.status}) — correct.`);
} else if (anon.rows.length === 0) {
  console.log('    anon sees 0 rows — correct.');
} else {
  console.log(`    *** anon sees ${anon.rows.length} rows — RLS IS NOT BLOCKING. Investigate. ***`);
}

console.log('\n═══════════════════════════════════════════════════════════════\n');

// Explicit exit. Node on Windows can trip a libuv assertion tearing down
// undici sockets at natural exit; this closes cleanly instead.
process.exit(0);
