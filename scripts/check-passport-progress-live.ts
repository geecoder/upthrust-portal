// scripts/check-passport-progress-live.ts
// ─────────────────────────────────────────────────────────────────────────────
// Prints what each real learner's Capability Passport progress actually says,
// side by side with the stored columns the product used to read.
//
//     node --experimental-strip-types scripts/check-passport-progress-live.ts
//
// READ-ONLY. GET requests over PostgREST, no writes, safe on production at any
// time. Credentials come from .env.local, which is never printed.
//
// scripts/verify-passport-progress.ts proves the computation is right on made-up
// inputs. This one answers the different question the owner actually has: what
// does it now say about MY learners, and how far off were the stored numbers?
// The STORED column is shown next to the COMPUTED one precisely so the gap is
// visible rather than asserted.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computePassportProgress } from '../lib/passport-progress.ts';

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

function pad(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n);
}

async function main(): Promise<number> {
  const env = readEnv();
  const url = (env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  const key = env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.');
    return 1;
  }

  async function get<T>(pathAndQuery: string): Promise<T[]> {
    const res = await fetch(`${url}/rest/v1/${pathAndQuery}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      console.error(`  read failed: ${pathAndQuery} — HTTP ${res.status}`);
      return [];
    }
    return (await res.json()) as T[];
  }

  console.log('\n══ LIVE PASSPORT PROGRESS ═════════════════════════════════════');
  console.log(`project: ${url.replace(/^https?:\/\//, '')}\n`);

  const [learners, assignments, attendance, weeks] = await Promise.all([
    get<Record<string, unknown>>(
      'learners?select=id,first_name,last_name,cohort,pathway,attendance_pct,assignment_completion_pct,avg_score,capstone_status,passport_eligibility,passport_issued&order=first_name'
    ),
    get<Record<string, unknown>>('assignments?select=learner_id,week_number,pathway,status,score,portfolio_approved'),
    get<Record<string, unknown>>('attendance?select=learner_id,week_number,attended'),
    get<Record<string, unknown>>('weeks?select=week_number,phase,is_published,pm_assignment_title,ba_assignment_title'),
  ]);

  if (learners.length === 0) {
    console.log('  No learners readable. Nothing to report.\n');
    return 1;
  }

  const anyWeeks = weeks as never[];

  console.log('  COMPUTED vs STORED  (stored = the columns the product used to read)\n');
  console.log(
    `  ${pad('LEARNER', 20)}${pad('SUBMIT', 15)}${pad('AVG SCORE', 15)}${pad('ATTEND', 14)}${pad('CAPSTONE', 12)}MET`
  );
  console.log(`  ${'─'.repeat(20)}${'─'.repeat(15)}${'─'.repeat(15)}${'─'.repeat(14)}${'─'.repeat(12)}───`);

  let divergent = 0;

  for (const l of learners) {
    const id = l.id as string;
    const mine = assignments.filter((a) => a.learner_id === id) as never[];
    const mineAtt = attendance.filter((a) => a.learner_id === id) as never[];

    const p = computePassportProgress({
      pathway: l.pathway === 'BA' ? 'BA' : 'PM',
      assignments: mine,
      attendance: mineAtt,
      weeks: anyWeeks,
      storedAttendancePct: (l.attendance_pct as number) ?? null,
      storedCapstoneStatus: (l.capstone_status as string) ?? null,
    });

    const c = (k: string) => p.criteria.find((x) => x.key === k)!;

    const storedSubmit = Math.round(Number(l.assignment_completion_pct ?? 0));
    const storedAvg = Number(l.avg_score ?? 0);
    const storedAtt = Math.round(Number(l.attendance_pct ?? 0));
    const storedCapstone = (l.capstone_status as string) || 'Not Started';

    const submitCell = `${c('submission').actual}% / ${storedSubmit}%`;
    const avgCell = `${c('avg_score').actual} / ${storedAvg}`;
    const attCell = `${c('attendance').actual}% / ${storedAtt}%`;
    const capCell = `${c('capstone').met ? 'yes' : 'no'} / ${storedCapstone === 'Not Started' ? 'no' : 'yes'}`;

    const name = `${l.first_name ?? ''} ${l.last_name ?? ''}`.trim() || '(unnamed)';
    console.log(
      `  ${pad(name, 20)}${pad(submitCell, 15)}${pad(avgCell, 15)}${pad(attCell, 14)}${pad(capCell, 12)}${p.metCount}/5`
    );

    if (
      c('submission').actual !== storedSubmit ||
      c('avg_score').actual !== storedAvg ||
      c('capstone').met !== (storedCapstone !== 'Not Started')
    ) {
      divergent++;
    }
  }

  console.log(`\n  ${divergent} of ${learners.length} learner(s) were being shown a number that the rows contradict.`);
  console.log('  Each pair reads COMPUTED / STORED. Where they differ, computed is what the');
  console.log('  learner now sees, and stored is what they saw before Milestone 5.\n');

  // Eligibility is deliberately untouched by M5 — worth stating here so nobody
  // reads this table as a change to who gets a passport.
  const eligible = learners.filter((l) => l.passport_eligibility === 'Approved' || l.passport_issued === true).length;
  console.log(`  Stored eligibility is unchanged: ${eligible} of ${learners.length} marked Approved or Issued.`);
  console.log('  Issuance still gates on that column and on an admin. M5 displays progress only.\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  return 0;
}

// Never process.exit() after a fetch — it truncates stdout. Set the code and
// let the process end naturally. (Same lesson as commit a3fd9fe.)
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error('check-passport-progress-live failed:', err);
    process.exitCode = 1;
  });
