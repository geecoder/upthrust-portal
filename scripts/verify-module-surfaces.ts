// scripts/verify-module-surfaces.ts
// ─────────────────────────────────────────────────────────────────────────────
// Proves that every LEARNER-FACING SURFACE of a gated module is actually gated.
//
//     node --experimental-strip-types scripts/verify-module-surfaces.ts
//
// scripts/verify-module-access.ts proves the resolution rule is correct. This
// proves the rule is wired in. They are separate because they fail for
// different reasons: that one fails when the logic is wrong, this one fails
// when the logic is right and nobody called it.
//
// The failure it exists to catch is specific and quiet: a module hidden from
// the sidebar while the page or the endpoint behind it still answers. That
// looks switched off in every screenshot and is not switched off at all. It
// costs money on the three AI routes and discloses content on the rest.
//
// Static: it reads the repo as text. No database, no server, no network — so it
// runs in CI and on a clean checkout, and it cannot be fooled by a cache or by
// whatever the flags happen to say today. What it cannot do is prove a gate
// DECIDES correctly at runtime; that is the other script's job, plus a
// signed-in pass through the live app.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODULE_KEYS, MODULE_REGISTRY, type ModuleKey } from '../lib/module-access-rules.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `\n          ${detail}` : ''}`);
  }
}

function read(relPath: string): string {
  const full = join(ROOT, relPath);
  return existsSync(full) ? readFileSync(full, 'utf8') : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// The declared surfaces. One entry per module, listing the page route and the
// route handlers that belong to it. Adding a gated page later means adding it
// here — the script cannot guess which route serves which module, and a table
// somebody has to update is better than a check that quietly covers less than
// it used to.
//
// `page: null` means the module has no route yet. Capstone is the only one:
// Milestone 4 builds it, and section 2 starts demanding its gate the moment the
// directory appears.
// ─────────────────────────────────────────────────────────────────────────────
interface Surface {
  /** Directory under app/portal that must carry the gate, or null if none yet. */
  page: string | null;
  /** Route handlers that must refuse when the module is off. */
  api: string[];
}

const SURFACES: Record<ModuleKey, Surface> = {
  capstone: { page: null, api: [] },
  notifications: { page: 'notifications', api: [] },
  community: { page: 'community', api: [] },
  'ai_lab.stakeholder_sim': { page: 'simulation', api: ['app/api/simulation/route.ts'] },
  'ai_lab.writing_checker': { page: 'writing-check', api: ['app/api/writing-check/route.ts'] },
  'ai_lab.interview_coach': { page: 'interview', api: ['app/api/interview/route.ts'] },
};

console.log('\n1. Every module key has a declared surface');
for (const key of MODULE_KEYS) {
  check(`${key} declared`, key in SURFACES);
}

console.log('\n2. Every page route carries a server-side gate');
for (const key of MODULE_KEYS) {
  const { page } = SURFACES[key];
  if (!page) {
    const dir = join(ROOT, 'app', 'portal', key);
    check(
      `${key} has no page route yet (Milestone 4)`,
      !existsSync(dir),
      `${dir} now exists — give it a layout that calls gateModule('${key}') and declare it in SURFACES`
    );
    continue;
  }
  const layout = read(`app/portal/${page}/layout.tsx`);
  check(`app/portal/${page}/layout.tsx exists`, layout.length > 0);
  check(`  gates on '${key}'`, layout.includes(`gateModule('${key}')`), 'layout does not call gateModule with this key');
  check('  refuses rather than renders', /if \(!gate\.allowed\)/.test(layout));
  check('  is not statically cached', layout.includes("export const dynamic = 'force-dynamic'"));
}

console.log('\n3. Every route handler of a gated module refuses when it is off');
for (const key of MODULE_KEYS) {
  for (const file of SURFACES[key].api) {
    const src = read(file);
    check(`${file} exists`, src.length > 0);
    check(`  guards on '${key}'`, src.includes(`guardModuleForCurrentUser('${key}')`));

    // Every exported handler, not just the first. The GETs matter as much as
    // the POSTs: /api/simulation GET hands back the character list and
    // /api/interview GET the question bank.
    const handlers = [...src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)].map((m) => m[1]);
    const guards = (src.match(/guardModuleForCurrentUser\(/g) ?? []).length;
    check(
      `  all ${handlers.length} handler(s) guarded (${handlers.join(', ')})`,
      handlers.length > 0 && guards >= handlers.length,
      `${handlers.length} handlers, ${guards} guard calls`
    );
  }
}

console.log('\n4. No ungated route handler can bill the Anthropic API');
{
  // Discovery, not a declared list: anything under app/api that references a
  // model constant is a billable endpoint reachable by URL. It must either
  // carry a module guard or be named here with a reason.
  const ALLOWED_UNGATED: Record<string, string> = {
    'app/api/submit-assignment/route.ts':
      'assignment submission — core programme flow, belongs to no gated module',
    'app/api/ai-feedback/route.ts':
      'no callers anywhere (docs/DEFERRED.md D-19); belongs to no module in the registry',
  };

  function routeFiles(dir: string): string[] {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) return [];
    const out: string[] = [];
    for (const entry of readdirSync(abs, { withFileTypes: true })) {
      if (entry.isDirectory()) out.push(...routeFiles(`${dir}/${entry.name}`));
      else if (entry.name === 'route.ts' || entry.name === 'route.tsx') out.push(`${dir}/${entry.name}`);
    }
    return out;
  }

  const billable = routeFiles('app/api').filter((f) => /MODEL_[A-Z]/.test(read(f)));
  check('found billable routes to check', billable.length > 0);

  for (const file of billable) {
    const src = read(file);
    const guarded = src.includes('guardModuleForCurrentUser(') || src.includes('guardModule(');
    const excused = file in ALLOWED_UNGATED;
    check(
      `${file} ${guarded ? 'is guarded' : excused ? 'is excused' : 'is UNGATED'}`,
      guarded || excused,
      'a billable endpoint has no module guard — gate it, or add it to ALLOWED_UNGATED with a reason'
    );
  }
}

console.log('\n5. The sidebar filters on the registry, not on hardcoded labels');
{
  const sidebar = read('components/Sidebar.tsx');
  check('Sidebar.tsx exists', sidebar.length > 0);
  check('access is a required prop', /access: ModuleAccessMap;/.test(sidebar));
  for (const key of MODULE_KEYS) {
    const { page } = SURFACES[key];
    if (!page) continue;
    // Notifications is its own conditional rather than a nav entry, so accept
    // either the nav field or a direct read of the flag.
    const byNavItem = sidebar.includes(`module: '${key}'`);
    const byFlag = sidebar.includes(`access?.${key} === true`) || sidebar.includes(`access.${key} === true`);
    check(`${key} governs its sidebar item`, byNavItem || byFlag);
  }
}

console.log('\n6. The dashboard gates the module surfaces it renders itself');
{
  // The dashboard is not a route of any module, so nothing above covers it —
  // and it renders a card or link for four of them.
  const dash = read('app/portal/page.tsx');
  check('app/portal/page.tsx resolves access', dash.includes('getModuleAccess('));
  check('  notifications are not even queried when off', /access\.notifications\s*\n?\s*\?/.test(dash));
  check('  community quick link is gated', dash.includes('on: access.community'));
  for (const key of ['ai_lab.stakeholder_sim', 'ai_lab.writing_checker', 'ai_lab.interview_coach'] as const) {
    check(`  ${key} card is gated`, dash.includes(`on: access['${key}']`));
  }
}

console.log('\n7. Every module states what a learner sees when it is off');
for (const key of MODULE_KEYS) {
  const meta = MODULE_REGISTRY[key];
  check(`${key} has whenOff copy`, !!meta?.whenOff && meta.whenOff.length > 20);
  check('  presentation is declared', meta?.presentation === 'absent' || meta?.presentation === 'locked');
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(60)}\n`);

if (failed > 0) process.exit(1);
