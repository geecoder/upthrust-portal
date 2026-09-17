// scripts/verify-learner-data-path.ts
// ─────────────────────────────────────────────────────────────────────────────
// Proves the D-23 class is closed: no learner-facing page reads learner-scoped
// data through the browser (anon) Supabase client, and the server path that
// replaced those reads actually returns the row.
//
//     node --experimental-strip-types --import ./scripts/_ai-guard-stubs.mjs \
//          scripts/verify-learner-data-path.ts
//
// THE DEFECT CLASS. `learners` has RLS and the anon key is shown 0 of 7 rows.
// Ten client components read it through createBrowserClient() anyway, so every
// one of those reads returned null for every learner, always. The failures
// were silent: an empty profile form, a pathway filter defaulting to 'PM', and
// — on onboarding — a write that PostgREST answers 204 for while changing
// nothing, which left the learner in a redirect loop with no error shown.
//
// Two things are checked, because either alone would be misleading:
//
//   1. STATIC — which files still reach for learner-scoped tables from the
//      browser. A page that works today because its module is switched off is
//      still carrying the defect, so those are listed separately rather than
//      passed over.
//   2. LIVE — the anon key really is refused, and the service-role read that
//      replaced it really does return each learner's row with the allowlisted
//      columns and nothing else.
//
// READ-ONLY: selects only, no writes.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(here, '..');

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

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

/** Tables whose rows belong to one learner. Reading these from the browser is the defect. */
const LEARNER_SCOPED = [
  'learners',
  'assignments',
  'attendance',
  'capability_scores',
  'notifications',
  'portfolio_items',
  'passports',
  'ai_practice_attempts',
];

/**
 * Pages that must be clean, because a learner can reach them today.
 * Community, notifications, interview and writing-check are NOT here: their
 * modules are switched off, so they are unreachable and are reported as
 * carrying the defect rather than asserted against. Admin pages are listed
 * separately for the same reason — /admin is unreachable while ADMIN_USER_ID
 * is a placeholder (D-25).
 */
const MUST_BE_CLEAN = [
  'app/portal/profile/page.tsx',
  'app/portal/simulation/page.tsx',
  'app/portal/onboarding/page.tsx',
  'app/portal/resources/page.tsx',
];

function walk(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
    if (e.isDirectory()) out.push(...walk(`${dir}/${e.name}`));
    else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) out.push(`${dir}/${e.name}`);
  }
  return out;
}

/** Learner-scoped tables a file reads from the browser client. */
function browserLearnerReads(rel: string): string[] {
  const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  if (!src.includes('createBrowserClient')) return [];
  return LEARNER_SCOPED.filter((t) => src.includes(`from('${t}')`));
}

async function main(): Promise<number> {
  console.log('\n══ LEARNER DATA PATH (D-23) ═══════════════════════════════════\n');

  console.log('  1. Reachable learner pages read nothing learner-scoped from the browser');
  for (const file of MUST_BE_CLEAN) {
    const hits = browserLearnerReads(file);
    check(
      `${file}${hits.length ? ` — still reads ${hits.join(', ')}` : ''}`,
      hits.length === 0,
      'this read returns null for every learner; move it behind /api/me or a server component'
    );
  }

  console.log('\n  2. Still carrying the defect, but unreachable today');
  const all = [...walk('app/portal'), ...walk('app/admin'), ...walk('components')];
  const remaining = all
    .map((f) => ({ file: f, tables: browserLearnerReads(f) }))
    .filter((r) => r.tables.length > 0 && !MUST_BE_CLEAN.includes(r.file));
  if (remaining.length === 0) {
    console.log('    (none)');
  } else {
    for (const r of remaining) {
      console.log(`    NOTE  ${r.file} — ${r.tables.join(', ')}`);
    }
    console.log('    Each is behind a switched-off module or behind /admin. Fix before re-enabling.');
  }

  console.log('\n  3. The anon key really is refused');
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  for (const table of ['learners', 'sessions']) {
    const res = await fetch(`${url}/rest/v1/${table}?select=id`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    const body = await res.json().catch(() => null);
    const rows = Array.isArray(body) ? body.length : -1;
    check(`anon sees 0 rows of ${table} (HTTP ${res.status})`, rows === 0, `saw ${rows} rows`);
  }

  console.log('\n  4. The server path returns each learner their own row, allowlisted');
  const { createAdminClient } = await import('../lib/supabase.ts');
  const { LEARNER_SELF_READABLE } = await import('../lib/request-fields.ts');

  const db = createAdminClient();
  const { data: learners } = await db
    .from('learners')
    .select('clerk_user_id, first_name')
    .order('first_name');

  const real = (learners ?? []).filter(
    (l) => typeof l.clerk_user_id === 'string' && !l.clerk_user_id.includes('YOUR_CLERK')
  );

  // Columns a learner must never be served, with the reasons recorded beside
  // LEARNER_SELF_READABLE in lib/request-fields.ts.
  const FORBIDDEN = ['risk_status', 'notes', 'facilitator_note', 'avg_score', 'passport_eligibility'];
  for (const col of FORBIDDEN) {
    check(
      `${col} is not in the read allowlist`,
      !(LEARNER_SELF_READABLE as readonly string[]).includes(col)
    );
  }

  for (const learner of real) {
    const { data, error } = await db
      .from('learners')
      .select(LEARNER_SELF_READABLE.join(','))
      .eq('clerk_user_id', learner.clerk_user_id as string)
      .maybeSingle();

    const row = data as Record<string, unknown> | null;
    check(
      `${learner.first_name} — row returned with ${row ? Object.keys(row).length : 0} allowlisted columns`,
      !error && !!row && !FORBIDDEN.some((c) => c in row),
      error ? error.message : 'no row, or a forbidden column came back'
    );
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
    console.error('verify-learner-data-path failed:', err);
    process.exitCode = 1;
  });
