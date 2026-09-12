// app/verify/[passportId]/page.tsx
// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC verification page (no auth). The authoritative source of truth for a
// Capability Passport. Reads the immutable snapshot from `passports`, confirms
// status === 'issued', and checks the HMAC signature from ?sig=.
//
// Framing note (Notion 2.6 "Sequencing Reality Check"): the Passport is a
// learner-facing record of *assessed evidence*, NOT an employer hiring standard.
// Copy here reflects that and never promises employer recognition.
// ─────────────────────────────────────────────────────────────────────────────
import { createAdminClient } from '@/lib/supabase';
import {
  verifySignature,
  type SignablePassport,
} from '@/lib/passport';

export const dynamic = 'force-dynamic';

type Params = { passportId: string };
type Search = { sig?: string };

const NAVY = '#0B1F3A';
const GOLD = '#C99A3C';
const INK = '#16243A';
const MUTE = '#6A727E';

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#F4F1EC', fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif', color: INK, padding: '32px 16px' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>{children}</div>
    </div>
  );
}

function Header() {
  return (
    <div style={{ background: NAVY, borderRadius: '14px 14px 0 0', padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: 40, fontWeight: 700, color: GOLD, lineHeight: 0.8 }}>U</div>
      <div>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>UPTHRUST</div>
        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase' }}>Capability Passport · Verification</div>
      </div>
    </div>
  );
}

function NotValid({ title, detail }: { title: string; detail: string }) {
  return (
    <Shell>
      <Header />
      <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', padding: 36, border: '1px solid #E6E0D6', borderTop: 'none', textAlign: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#FBE9E9', color: '#C0392B', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34, margin: '0 auto 18px' }}>✕</div>
        <h1 style={{ fontSize: 22, margin: '0 0 8px' }}>{title}</h1>
        <p style={{ color: MUTE, fontSize: 15, lineHeight: 1.55, maxWidth: 460, margin: '0 auto' }}>{detail}</p>
        <p style={{ color: MUTE, fontSize: 13, marginTop: 24 }}>
          If you believe this is an error, contact <a href="mailto:info@upthrustdigital.com" style={{ color: GOLD }}>info@upthrustdigital.com</a>.
        </p>
      </div>
    </Shell>
  );
}

export default async function VerifyPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { passportId } = await params;
  const { sig } = await searchParams;

  // This page is PUBLIC (middleware.ts). Select only the columns it needs, so a
  // future edit cannot accidentally render something that was merely in scope.
  //   rendered:            full_name, pathway, cohort, issued_at, passport_id
  //   read but NOT shown:  learner_id, overall_score, signature — required to
  //                        recompute the HMAC over the canonical payload
  // Deliberately not selected: country, rating, readiness_level,
  //   capability_breakdown, evidence, facilitator_note, portfolio_url.
  const db = createAdminClient();
  const { data: p } = await db
    .from('passports')
    .select('passport_id, learner_id, full_name, pathway, cohort, overall_score, issued_at, signature, status')
    .eq('passport_id', passportId)
    .order('issued_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!p) {
    return <NotValid title="Passport not found" detail="No Upthrust Capability Passport matches this verification ID. Check the link or QR code and try again." />;
  }
  if (p.status === 'revoked') {
    return <NotValid title="Passport revoked" detail="This Capability Passport has been revoked by Upthrust and is no longer valid." />;
  }
  if (p.status === 'superseded') {
    return <NotValid title="Superseded passport" detail="This passport has been replaced by a newer version. Request the current verification link from the holder." />;
  }
  if (p.status !== 'issued') {
    return <NotValid title="Not verifiable" detail="This passport is not in an issued state and cannot be verified." />;
  }

  // Signature check (tamper-evidence). The page still loads for a valid issued
  // passport without a sig, but only shows the strong "cryptographically verified"
  // mark when the signature over the snapshot checks out.
  const signable: SignablePassport = {
    passport_id: p.passport_id,
    learner_id: p.learner_id,
    pathway: p.pathway,
    cohort: p.cohort,
    overall_score: Number(p.overall_score),
    issued_at: typeof p.issued_at === 'string' ? p.issued_at.slice(0, 10) : p.issued_at,
  };
  const sigParamValid = verifySignature(signable, sig);
  const storedSigValid = verifySignature(signable, p.signature);
  const cryptoVerified = sigParamValid || storedSigValid;

  const issuedDate = new Date(p.issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <Shell>
      <Header />
      <div style={{ background: '#fff', borderRadius: '0 0 14px 14px', padding: 0, border: '1px solid #E6E0D6', borderTop: 'none', overflow: 'hidden' }}>

        {/* Verified banner */}
        <div style={{ background: cryptoVerified ? '#EAF6F0' : '#FFF9E9', borderBottom: '1px solid #E6E0D6', padding: '16px 28px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: cryptoVerified ? '#27AE60' : GOLD, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>✓</div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>
              {cryptoVerified ? 'Verified — cryptographically authenticated' : 'Valid issued passport'}
            </div>
            <div style={{ fontSize: 13, color: MUTE }}>
              {cryptoVerified
                ? 'This credential was issued by Upthrust and has not been altered.'
                : 'This credential is issued by Upthrust. Open the original QR link for cryptographic verification.'}
            </div>
          </div>
        </div>

        {/* Identity.
            This page is public and unauthenticated, so it shows only what
            verifying a credential requires: who it belongs to, which programme
            and cohort, when it was issued, its id, and whether the signature
            checks out. No score, no per-domain breakdown, no assignment
            evidence, no reviewer names, no country, no portfolio link, no
            facilitator free text. Anyone who needs the detail should be sent
            the portfolio directly by the holder. */}
        <div style={{ padding: '28px 28px 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: MUTE, textTransform: 'uppercase' }}>Verified Learner</div>
          <h1 style={{ fontSize: 28, margin: '6px 0 2px', fontFamily: 'Georgia, serif' }}>{p.full_name}</h1>
          <div style={{ color: MUTE, fontSize: 14 }}>
            {p.pathway} · {p.cohort}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 20 }}>
            <Stat label="Programme" value={p.pathway} />
            <Stat label="Cohort" value={p.cohort} />
            <Stat label="Credential ID" value={p.passport_id} mono />
            <Stat label="Date Issued" value={issuedDate} />
          </div>
        </div>

        {/* Facilitator validation — fixed attestation text only. The
            per-passport facilitator_note is staff-authored free text and is
            deliberately not fetched or shown on a public page. */}
        <Section title="Issued By">
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#3A4250', margin: 0 }}>
            This learner completed assessed practical work — assignments, simulations,
            a capstone project and facilitator review — within the Upthrust Career
            Capability Accelerator.
          </p>
          <div style={{ marginTop: 12, fontSize: 13, color: MUTE }}>
            <strong style={{ color: INK }}>Genesis Nneji Enwenyeokwu</strong> · Founder &amp; Lead Facilitator, Upthrust
          </div>
        </Section>

        {/* Honest interpretation — matches Notion sequencing guardrail */}
        <div style={{ background: '#F7F8FA', borderTop: '1px solid #E6E0D6', padding: '20px 28px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: MUTE, textTransform: 'uppercase', marginBottom: 8 }}>How to interpret this</div>
          <p style={{ fontSize: 13, lineHeight: 1.6, color: MUTE, margin: 0 }}>
            The Upthrust Capability Passport is an evidence-based record of assessed practical work — completed
            projects, assessed deliverables, a capstone, and facilitator review. It shows what this learner
            practised, built, and can explain. It is not a certificate of employment readiness in all contexts and
            does not replace an employer's own interview, technical assessment, or hiring process.
          </p>
        </div>

        {/* Footer */}
        <div style={{ background: NAVY, padding: '14px 28px', textAlign: 'center' }}>
          <span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, letterSpacing: 1 }}>
            Verified at <strong style={{ color: GOLD }}>app.upthrustdigital.com/verify</strong>
          </span>
        </div>
      </div>
    </Shell>
  );
}

function Stat({ label, value, sub, mono }: { label: string; value: string; sub?: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, color: '#9AA1AC', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 3, fontFamily: mono ? 'ui-monospace, monospace' : 'inherit' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: GOLD, fontWeight: 600 }}>{sub}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '20px 28px', borderTop: '1px solid #F0ECE4' }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: MUTE, textTransform: 'uppercase', marginBottom: 12 }}>{title}</div>
      {children}
    </div>
  );
}
