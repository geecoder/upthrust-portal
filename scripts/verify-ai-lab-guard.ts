// scripts/verify-ai-lab-guard.ts
// ─────────────────────────────────────────────────────────────────────────────
// Milestone 3's review gate: show what the AI Practice Lab route handlers
// actually answer, per learner, for each of the three tools.
//
//     node --experimental-strip-types --import ./scripts/_ai-guard-stubs.mjs \
//          scripts/verify-ai-lab-guard.ts
//
// This runs the REAL guard the handlers call — guardModuleForCurrentUser() from
// lib/module-gate.ts — against the REAL database and the REAL module_access
// rows, once per learner, and prints the actual HTTP status and JSON body it
// returns. A disabled tool must produce 403 MODULE_DISABLED; the enabled one
// must produce null, meaning "proceed".
//
// WHY NOT curl WITH A LEARNER COOKIE. That was tried first and does not work
// against a Clerk *development* instance: a session token minted through the
// Clerk Backend API is rejected by clerkMiddleware without the dev-browser JWT
// that only a real browser handshake produces, and auth.protect() then answers
// 404 for every API route — including the enabled one, which is how you can
// tell it is the middleware and not the guard. So the guard is exercised
// directly instead, with only Clerk stubbed. See scripts/_ai-guard-stubs.mjs
// for exactly what is replaced and why.
//
// The remaining link — that every handler calls this guard BEFORE doing any
// work, so nothing reaches the Anthropic API first — is proved statically for
// every exported handler by scripts/verify-module-surfaces.ts section 3, which
// was mutation-tested by removing a guard and confirming it fails.
//
// READ-ONLY: selects only, no writes.
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// .env.local is not loaded for us outside Next, and lib/supabase needs it.
for (const line of fs.readFileSync(path.join(here, '..', '.env.local'), 'utf8').split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
}

const AI_MODULES = [
  'ai_lab.stakeholder_sim',
  'ai_lab.writing_checker',
  'ai_lab.interview_coach',
] as const;

/** Which handlers each module guards, for the report. */
const HANDLERS: Record<string, string> = {
  'ai_lab.stakeholder_sim': 'POST+GET /api/simulation',
  'ai_lab.writing_checker': 'POST /api/writing-check',
  'ai_lab.interview_coach': 'POST+GET /api/interview',
};

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
  const { getModuleAccess } = await import('../lib/module-access.ts');

  const db = createAdminClient();
  const { data: learners, error } = await db
    .from('learners')
    .select('id, clerk_user_id, first_name, last_name, cohort, pathway')
    .order('first_name');

  if (error) {
    console.error('Could not read learners:', error.message);
    return 1;
  }

  console.log('\n══ AI PRACTICE LAB — WHAT THE ROUTES ANSWER ═══════════════════');
  console.log('  Real guard, real database, real flags. Clerk stubbed so a learner');
  console.log('  can be impersonated; see scripts/_ai-guard-stubs.mjs.\n');

  const real = (learners ?? []).filter(
    (l) => typeof l.clerk_user_id === 'string' && !l.clerk_user_id.includes('YOUR_CLERK')
  );

  if (real.length === 0) {
    console.log('  No learners with a real Clerk id. Nothing to check.\n');
    return 1;
  }

  for (const learner of real) {
    const name = `${learner.first_name ?? ''} ${learner.last_name ?? ''}`.trim() || '(unnamed)';
    const adminTag =
      !!process.env.ADMIN_USER_ID && learner.clerk_user_id === process.env.ADMIN_USER_ID
        ? '  [ADMIN — bypasses every gate]'
        : '';
    console.log(`  ${name} — ${learner.cohort ?? 'no cohort'}, ${learner.pathway ?? '?'}${adminTag}`);

    // Impersonate this learner for the guard's auth() call.
    process.env.VERIFY_AS_CLERK_USER_ID = learner.clerk_user_id as string;

    // Imported inside the loop so the module-level React cache() — a
    // pass-through under the stub — cannot carry one learner's identity into
    // the next. Node caches the module, so this is cheap after the first.
    const { guardModuleForCurrentUser } = await import('../lib/module-gate.ts');

    // Full scope, not just the cohort: a per-learner override (migration 0006)
    // must be reflected here, or this script would report the cohort's answer
    // while the guard gives the learner's.
    const access = await getModuleAccess({
      cohort: learner.cohort as string | null,
      learnerId: learner.id as string | null,
    });

    // An admin passes every gate by design (see gateModule), so their row
    // proves the bypass rather than the 403. Without this the script fails the
    // moment ADMIN_USER_ID names someone who also has a learner row — which is
    // exactly what happened the first time it was set.
    const isAdminLearner =
      !!process.env.ADMIN_USER_ID && learner.clerk_user_id === process.env.ADMIN_USER_ID;

    for (const moduleKey of AI_MODULES) {
      const enabled = access[moduleKey] === true;
      const denied = await guardModuleForCurrentUser(moduleKey);

      if (isAdminLearner && !enabled) {
        check(
          `${HANDLERS[moduleKey]} — flag OFF but caller is the admin, bypass allowed`,
          denied === null,
          `an admin should pass the gate; got HTTP ${denied?.status}`
        );
      } else if (enabled) {
        check(
          `${HANDLERS[moduleKey]} — flag ON, guard says proceed`,
          denied === null,
          `expected null, got HTTP ${denied?.status}`
        );
      } else {
        const status = denied?.status;
        const body = denied ? await denied.clone().json() : null;
        check(
          `${HANDLERS[moduleKey]} — flag OFF, HTTP ${status ?? 'none'} ${body?.code ?? ''}`,
          status === 403 && body?.code === 'MODULE_DISABLED' && body?.module === moduleKey,
          denied === null
            ? 'guard let the request through — a disabled tool is reachable and billable'
            : `body was ${JSON.stringify(body)}`
        );
        if (denied && body) {
          console.log(`            body: ${JSON.stringify(body)}`);
        }
      }
    }
    console.log('');
  }

  console.log(`  ${'─'.repeat(60)}`);
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
    console.error('verify-ai-lab-guard failed:', err);
    process.exitCode = 1;
  });
