// scripts/migrate.ts
// ─────────────────────────────────────────────────────────────────────────────
// Applies the SQL files in supabase/migrations/ to the Supabase project, in
// filename order, exactly once each.
//
//     node --experimental-strip-types scripts/migrate.ts --status
//     node --experimental-strip-types scripts/migrate.ts --dry-run
//     node --experimental-strip-types scripts/migrate.ts --apply
//
// WHY THIS EXISTS
// Milestone 0 found that 0002_app_settings.sql had been written, committed, and
// never run — and that nothing anywhere recorded the fact. The code shipped
// assuming a table that did not exist. This runner keeps a schema_migrations
// ledger IN the database so "which migrations have actually been applied?" has
// an answer that does not depend on anyone's memory.
//
// SAFETY
//   * Runs only files matching NNNN_name.sql, in ascending numeric order.
//   * Skips any file already recorded in schema_migrations.
//   * Records a SHA-256 of each file. If a file changes after being applied the
//     runner REFUSES to continue rather than silently ignoring the edit — an
//     applied migration is history and editing it means the database and the
//     repo disagree.
//   * 0000_baseline.sql is never executed. It is a reconstructed record of what
//     production already looked like, not a runnable script, and it says so.
//   * --apply is required to write. Default is a dry run.
//
// CREDENTIALS
// Reads a Supabase personal access token from SUPABASE_ACCESS_TOKEN, or from
// the file named by SUPABASE_TOKEN_FILE. Never from .env.local, never written
// to disk by this script, never printed. Uses the Management API's
// database/query endpoint, so no Postgres driver dependency is needed.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(here, '..');
const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');

const PROJECT_REF = 'qzpuvectpqxmtbitmtlm';
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

/** Never executed — a record of pre-existing production state, not a script. */
const NEVER_RUN = new Set(['0000_baseline.sql']);

function readToken(): string {
  const direct = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (direct) return direct;
  const file = process.env.SUPABASE_TOKEN_FILE?.trim();
  if (file && fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  console.error(
    'No Supabase access token. Set SUPABASE_ACCESS_TOKEN, or SUPABASE_TOKEN_FILE to a file containing one.'
  );
  process.exit(1);
}

const TOKEN = readToken();

interface QueryResult {
  ok: boolean;
  rows?: unknown[];
  error?: string;
}

async function runSql(query: string): Promise<QueryResult> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try {
      const parsed = JSON.parse(text);
      msg = parsed.message || parsed.error || text;
    } catch {
      /* keep raw text */
    }
    return { ok: false, error: `HTTP ${res.status}: ${msg}` };
  }
  try {
    return { ok: true, rows: JSON.parse(text) };
  } catch {
    return { ok: true, rows: [] };
  }
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function sqlQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

async function ensureLedger(): Promise<void> {
  const r = await runSql(`
    CREATE TABLE IF NOT EXISTS public.schema_migrations (
      filename    text PRIMARY KEY,
      checksum    text NOT NULL,
      applied_at  timestamptz NOT NULL DEFAULT now(),
      applied_by  text
    );
    COMMENT ON TABLE public.schema_migrations IS
      'Which files in supabase/migrations/ have been applied. Written by scripts/migrate.ts. Do not edit by hand.';
    ALTER TABLE public.schema_migrations ENABLE ROW LEVEL SECURITY;
    REVOKE ALL ON public.schema_migrations FROM anon, authenticated;
  `);
  if (!r.ok) {
    console.error('Could not create the migration ledger:', r.error);
    process.exit(1);
  }
}

interface Applied {
  filename: string;
  checksum: string;
  applied_at: string;
}

async function getApplied(): Promise<Map<string, Applied>> {
  const r = await runSql(
    'SELECT filename, checksum, applied_at FROM public.schema_migrations ORDER BY filename;'
  );
  if (!r.ok) {
    console.error('Could not read the migration ledger:', r.error);
    process.exit(1);
  }
  const map = new Map<string, Applied>();
  for (const row of (r.rows ?? []) as Applied[]) map.set(row.filename, row);
  return map;
}

function listMigrationFiles(): string[] {
  if (!fs.existsSync(migrationsDir)) return [];
  return fs
    .readdirSync(migrationsDir)
    .filter((f) => /^\d{4}_.*\.sql$/.test(f))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

// ── main ─────────────────────────────────────────────────────────────────────

const args = new Set(process.argv.slice(2));
const apply = args.has('--apply');
const statusOnly = args.has('--status');

console.log(`\n══ MIGRATIONS ═══════════════════════════════════════════════`);
console.log(`project: ${PROJECT_REF}`);
console.log(`mode:    ${statusOnly ? 'status' : apply ? 'APPLY' : 'dry run (pass --apply to write)'}\n`);

await ensureLedger();
const applied = await getApplied();
const files = listMigrationFiles();

if (files.length === 0) {
  console.log('  No migration files found.\n');
  process.exit(0);
}

const pending: string[] = [];
let drift = false;

console.log('  FILE                                  STATUS');
for (const f of files) {
  const body = fs.readFileSync(path.join(migrationsDir, f), 'utf8');
  const sum = sha256(body);
  const rec = applied.get(f);

  let status: string;
  if (NEVER_RUN.has(f)) {
    status = 'skipped — record only, never executed';
  } else if (!rec) {
    status = 'PENDING';
    pending.push(f);
  } else if (rec.checksum !== sum) {
    status = '*** CHANGED SINCE APPLIED ***';
    drift = true;
  } else {
    status = `applied ${new Date(rec.applied_at).toISOString().slice(0, 16).replace('T', ' ')}`;
  }
  console.log(`  ${f.padEnd(38)}${status}`);
}

if (drift) {
  console.error(
    '\n  A migration file changed after it was applied. The database and the repo\n' +
      '  now disagree. Resolve this by adding a NEW migration rather than editing\n' +
      '  history, then re-run. Refusing to continue.\n'
  );
  process.exit(1);
}

if (statusOnly) {
  console.log(`\n  ${pending.length} pending.\n`);
  process.exit(0);
}

if (pending.length === 0) {
  console.log('\n  Nothing to apply — every migration is already recorded.\n');
  process.exit(0);
}

console.log(`\n  ${pending.length} to apply: ${pending.join(', ')}`);

if (!apply) {
  console.log('\n  Dry run — nothing was written. Re-run with --apply.\n');
  process.exit(0);
}

for (const f of pending) {
  const full = path.join(migrationsDir, f);
  const body = fs.readFileSync(full, 'utf8');
  process.stdout.write(`\n  applying ${f} … `);

  const r = await runSql(body);
  if (!r.ok) {
    console.log('FAILED');
    console.error(`\n  ${r.error}\n`);
    console.error('  Stopped. No later migration was attempted.\n');
    process.exit(1);
  }

  const rec = await runSql(
    `INSERT INTO public.schema_migrations (filename, checksum, applied_by)
     VALUES (${sqlQuote(f)}, ${sqlQuote(sha256(body))}, 'scripts/migrate.ts')
     ON CONFLICT (filename) DO UPDATE SET checksum = EXCLUDED.checksum, applied_at = now();`
  );
  if (!rec.ok) {
    console.log('APPLIED, BUT NOT RECORDED');
    console.error(`\n  The migration ran but the ledger write failed: ${rec.error}`);
    console.error('  Record it by hand before re-running, or it will be applied twice.\n');
    process.exit(1);
  }
  console.log('ok');
}

console.log('\n  All pending migrations applied.\n');
console.log('═══════════════════════════════════════════════════════════════\n');
process.exit(0);
