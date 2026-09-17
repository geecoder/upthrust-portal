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
// `page: null` means the module has no route yet. Nothing uses it now that
// Capstone exists; it stays because section 2 needs a way to say "no route yet,
// and shout the moment one appears".
// ─────────────────────────────────────────────────────────────────────────────
interface Surface {
  /** Directory under app/portal that must carry the gate, or null if none yet. */
  page: string | null;
  /** Route handlers that must refuse when the module is off. */
  api: string[];
}

const SURFACES: Record<ModuleKey, Surface> = {
  capstone: { page: 'capstone', api: [] },
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

  // The gate must refuse the way the registry says it does. A module declared
  // 'locked' that quietly redirects, or an 'absent' one that renders a teaser,
  // is a screen the admin console is describing wrongly.
  const presentation = MODULE_REGISTRY[key]?.presentation;
  const redirects = layout.includes("redirect('/portal')");
  const rendersLocked = /<LockedModule[\s/>]/.test(layout);
  if (presentation === 'absent') {
    check("  'absent' redirects to the dashboard", redirects && !rendersLocked);
  } else {
    check("  'locked' renders a locked screen, never redirects", rendersLocked && !redirects);
    check('  admin override is visible, not silent', /adminOverride/.test(layout));
  }
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
  // The filter must read the registry, not name capstone. Hardcoding the one
  // 'locked' module here is how the sidebar and the gate start disagreeing.
  check('filter reads presentation from the registry', sidebar.includes("presentation === 'locked'"));
  check('  no hardcoded capstone special case', !/'capstone'\s*===|===\s*'capstone'/.test(sidebar));
}

console.log('\n6. The dashboard gates the module surfaces it renders itself');
{
  // The dashboard is not a route of any module, so nothing above covers it —
  // and it renders a card or link for four of them.
  const dash = read('app/portal/page.tsx');
  check('app/portal/page.tsx resolves access', dash.includes('getModuleAccess('));
  check('  notifications are not even queried when off', /access\.notifications\s*\n?\s*\?/.test(dash));
  check('  community quick link is gated', dash.includes('on: access.community'));
  check('  capstone quick link is gated', dash.includes('on: access.capstone'));
  check('  no link to the retired portfolio route', !dash.includes("'/portal/portfolio'"));
  for (const key of ['ai_lab.stakeholder_sim', 'ai_lab.writing_checker', 'ai_lab.interview_coach'] as const) {
    check(`  ${key} card is gated`, dash.includes(`on: access['${key}']`));
  }
}

console.log('\n7. The retired Portfolio route still resolves');
{
  // M4 replaced Portfolio with Capstone. The old path is in learner history and
  // in onboarding copy, so it must redirect rather than 404 — and it must not
  // be re-implemented as a second copy of the page.
  const retired = read('app/portal/portfolio/page.tsx');
  check('app/portal/portfolio/page.tsx exists as a redirect', retired.includes("redirect('/portal/capstone')"));
  check('  it does not read the database', !/from\('(learners|portfolio_items|assignments)'\)/.test(retired));
  check('  nothing else links to it', !read('components/Sidebar.tsx').includes("href: '/portal/portfolio'"));
}

console.log('\n8. The renamed status vocabulary is consistent');
{
  // Migration 0004 renames 'Portfolio Ready' to 'Capstone Ready'. Reads must
  // tolerate the old value until it is applied; writes must never produce it.
  const types = read('lib/types.ts');
  check('AssignmentStatus no longer permits the old value', !/\| 'Portfolio Ready'/.test(types));
  check('the legacy value is named once, for reads', types.includes("LEGACY_CAPSTONE_READY = 'Portfolio Ready'"));
  check('isApprovedWork is the shared predicate', types.includes('export function isApprovedWork('));

  // The admin review queue is the only writer of this status.
  const reviews = read('app/admin/reviews/page.tsx');
  check('the review queue writes the new value', reviews.includes("submitFeedback('Capstone Ready')"));
  check('  and cannot write the old one', !reviews.includes("submitFeedback('Portfolio Ready')"));

  // The migration must actually move the rows and rebuild the CHECK.
  const mig = read('supabase/migrations/0004_capstone_status_rename.sql');
  check('migration 0004 exists', mig.length > 0);
  check('  it updates the rows', /UPDATE public\.assignments/i.test(mig) && mig.includes("'Capstone Ready'"));
  check('  it rebuilds the CHECK', /ADD CONSTRAINT assignments_status_check/i.test(mig));
  check('  it verifies before committing', /still hold the old status/.test(mig));
}

console.log('\n9. Every module states what a learner sees when it is off');
for (const key of MODULE_KEYS) {
  const meta = MODULE_REGISTRY[key];
  check(`${key} has whenOff copy`, !!meta?.whenOff && meta.whenOff.length > 20);
  check('  presentation is declared', meta?.presentation === 'absent' || meta?.presentation === 'locked');
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(60)}\n`);

if (failed > 0) process.exit(1);
