// scripts/sql.ts
// ─────────────────────────────────────────────────────────────────────────────
// Run a SQL query against the Supabase project and print the rows.
//
//     node --experimental-strip-types scripts/sql.ts "SELECT 1"
//     node --experimental-strip-types scripts/sql.ts --file docs/INTROSPECT.sql
//     node --experimental-strip-types scripts/sql.ts --file x.sql --json
//
// Intended for INSPECTION — verifying a migration landed, reading constraints
// and policies, checking row counts. Schema changes belong in a numbered file
// under supabase/migrations/ applied by scripts/migrate.ts, so that what ran
// against the database is recorded rather than typed once and forgotten. That
// is the whole lesson of Milestone 0.
//
// Refuses obvious DDL/DML unless --write is passed, so a careless paste cannot
// quietly alter production. The check is a guard against accidents, not a
// security boundary — the token it uses can do anything.
//
// Credentials: SUPABASE_ACCESS_TOKEN, or a file named by SUPABASE_TOKEN_FILE.
// Never read from .env.local, never printed.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';

const PROJECT_REF = 'qzpuvectpqxmtbitmtlm';
const API = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

function readToken(): string {
  const direct = process.env.SUPABASE_ACCESS_TOKEN?.trim();
  if (direct) return direct;
  const file = process.env.SUPABASE_TOKEN_FILE?.trim();
  if (file && fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  console.error('No Supabase access token. Set SUPABASE_ACCESS_TOKEN or SUPABASE_TOKEN_FILE.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const asJson = argv.includes('--json');
const allowWrite = argv.includes('--write');
const fileIdx = argv.indexOf('--file');

let query: string;
if (fileIdx !== -1) {
  const p = argv[fileIdx + 1];
  if (!p || !fs.existsSync(p)) {
    console.error(`No such file: ${p}`);
    process.exit(1);
  }
  query = fs.readFileSync(p, 'utf8');
} else {
  query = argv.filter((a) => !a.startsWith('--')).join(' ');
}

if (!query.trim()) {
  console.error('Nothing to run. Pass a query, or --file <path>.');
  process.exit(1);
}

if (!allowWrite) {
  const danger = /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|GRANT|REVOKE)\b/i;
  if (danger.test(query)) {
    console.error(
      'This looks like it changes the database. Schema changes belong in a numbered\n' +
        'migration applied by scripts/migrate.ts so the change is recorded.\n' +
        'If you really mean to run it ad hoc, pass --write.'
    );
    process.exit(1);
  }
}

const res = await fetch(API, {
  method: 'POST',
  headers: { Authorization: `Bearer ${readToken()}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query }),
});

const text = await res.text();
if (!res.ok) {
  let msg = text;
  try {
    const p = JSON.parse(text);
    msg = p.message || p.error || text;
  } catch {
    /* raw */
  }
  console.error(`HTTP ${res.status}: ${msg}`);
  process.exit(1);
}

let rows: unknown[];
try {
  rows = JSON.parse(text);
} catch {
  console.log(text);
  process.exit(0);
}

if (asJson) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

if (!Array.isArray(rows) || rows.length === 0) {
  console.log('(no rows)');
  process.exit(0);
}

// Column-aligned table.
const cols = Object.keys(rows[0] as Record<string, unknown>);
const cell = (v: unknown) => (v === null ? 'NULL' : typeof v === 'object' ? JSON.stringify(v) : String(v));
const widths = cols.map((c) =>
  Math.min(70, Math.max(c.length, ...rows.map((r) => cell((r as Record<string, unknown>)[c]).length)))
);

const line = (vals: string[]) => vals.map((v, i) => (v.length > widths[i] ? v.slice(0, widths[i] - 1) + '…' : v.padEnd(widths[i]))).join('  ');

console.log(line(cols));
console.log(widths.map((w) => '─'.repeat(w)).join('  '));
for (const r of rows) console.log(line(cols.map((c) => cell((r as Record<string, unknown>)[c]))));
console.log(`\n(${rows.length} row${rows.length === 1 ? '' : 's'})`);
process.exit(0);
