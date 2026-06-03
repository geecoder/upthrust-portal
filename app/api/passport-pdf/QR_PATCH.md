// app/api/passport-pdf/QR_PATCH.md
// ─────────────────────────────────────────────────────────────────────────────
// HOW TO ADD THE SCANNABLE QR TO YOUR EXISTING /api/passport-pdf ROUTE
// ─────────────────────────────────────────────────────────────────────────────
//
// Your existing route builds an HTML string and returns it as text/html.
// To add a real, scannable, signed QR you make THREE small changes.
//
// ── 1) Add imports at the top of app/api/passport-pdf/route.ts ──────────────

import { qrSvg } from '@/lib/qr';
import { signPassport, verifyUrl, type SignablePassport } from '@/lib/passport';

// ── 2) After you've fetched the learner + know their passport_id, score,
//       pathway, cohort, and issue date, build the signed verify URL + QR.
//
//    IMPORTANT: the signed fields must EXACTLY match what was signed at
//    issuance (and what /verify checks). Prefer reading the issued snapshot
//    from the `passports` table so they always match:
//
//    const { data: pp } = await db.from('passports')
//      .select('*').eq('learner_id', learnerId).eq('status','issued').maybeSingle();
//
//    Then:

const signable /*: SignablePassport */ = {
  passport_id: pp.passport_id,
  learner_id: pp.learner_id,
  pathway: pp.pathway,
  cohort: pp.cohort,
  overall_score: Number(pp.overall_score),
  issued_at: String(pp.issued_at).slice(0, 10),
};
const sig = pp.signature || signPassport(signable);
const verifyHref = verifyUrl(pp.passport_id, sig);
const qrMarkup = qrSvg(verifyHref, { module: 4, quiet: 4, dark: '#0B1F3A' });

// ── 3) Drop the QR block into your HTML where the verify URL currently shows.
//       Replace your existing "verify URL" text node with this block:

const qrBlockHtml = `
  <div style="display:flex;align-items:center;gap:14px;">
    <div style="width:104px;height:104px;border:2px solid #C99A3C;border-radius:8px;padding:4px;background:#fff;">
      ${qrMarkup}
    </div>
    <div>
      <div style="font-size:10px;font-weight:700;letter-spacing:1.2px;color:#9AA1AC;text-transform:uppercase;">Verify this credential</div>
      <div style="font-size:12px;color:#A87E28;font-weight:600;margin-top:4px;word-break:break-all;">
        ${verifyHref.replace(/^https?:\/\//, '')}
      </div>
      <div style="font-size:10px;color:#9AA1AC;margin-top:6px;">Scan to confirm authenticity at upthrustdigital.com</div>
    </div>
  </div>
`;

// Inject qrBlockHtml into your template string where the old verify line was.
// Because qrSvg() returns inline SVG, it prints crisp as vector — no image host,
// no client JS, nothing to load. Works inside window.print() → PDF.
