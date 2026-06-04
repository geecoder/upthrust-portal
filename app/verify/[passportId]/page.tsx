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

function Badge({ children, tone }: { children: React.ReactNode; tone: 'adv' | 'pro' | 'dev' | 'fnd' }) {
  const map = {
    adv: { bg: NAVY, fg: '#fff' },
    pro: { bg: '#DCE6F4', fg: '#2C5FA0' },
    dev: { bg: '#FBEFD6', fg: '#9A6E12' },
    fnd: { bg: '#ECEEF1', fg: '#7A828E' },
  }[tone];
  return <span style={{ background: map.bg, color: map.fg, fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 5 }}>{children}</span>;
}

function toneFor(level: string): 'adv' | 'pro' | 'dev' | 'fnd' {
  if (/advanced/i.test(level)) return 'adv';
  if (/proficient/i.test(level)) return 'pro';
  if (/developing/i.test(level)) return 'dev';
  return 'fnd';
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

  const db = createAdminClient();
  const { data: p } = await db
    .from('passports')
    .select('*')
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

  const breakdown: { domain: string; score: number; level: string }[] = Array.isArray(p.capability_breakdown) ? p.capability_breakdown : [];
  const evidence: { title: string; score: number; reviewer: string }[] = Array.isArray(p.evidence) ? p.evidence : [];
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

        {/* Identity */}
        <div style={{ padding: '28px 28px 8px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, color: MUTE, textTransform: 'uppercase' }}>Verified Learner</div>
          <h1 style={{ fontSize: 28, margin: '6px 0 2px', fontFamily: 'Georgia, serif' }}>{p.full_name}</h1>
          <div style={{ color: MUTE, fontSize: 14 }}>
            {p.pathway}{p.country ? ` · ${p.country}` : ''} · {p.cohort}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 20, marginTop: 20 }}>
            <Stat label="Overall Capability" value={`${p.overall_score}/100`} sub={p.rating} />
            <Stat label="Readiness Level" value={p.readiness_level} />
            <Stat label="Credential ID" value={p.passport_id} mono />
            <Stat label="Date Issued" value={issuedDate} />
          </div>
        </div>

        {/* Capability breakdown */}
        {breakdown.length > 0 && (
          <Section title="Capability Framework">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 0 }}>
              {breakdown.map((b) => (
                <div key={b.domain} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #F0ECE4' }}>
                  <span style={{ fontSize: 14 }}>{b.domain}</span>
                  <Badge tone={toneFor(b.level)}>{b.level}</Badge>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Evidence portfolio */}
        {evidence.length > 0 && (
          <Section title="Evidence Portfolio">
            {evidence.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #F0ECE4' }}>
                <span style={{ fontSize: 14 }}>{e.title}</span>
                <span style={{ fontSize: 13, color: MUTE }}><strong style={{ color: INK }}>{e.score}</strong>/100 · {e.reviewer}</span>
              </div>
            ))}
          </Section>
        )}

        {/* Facilitator validation */}
        <Section title="Mentor Validation">
          <p style={{ fontSize: 14, lineHeight: 1.6, color: '#3A4250', margin: 0 }}>
            {p.facilitator_note ||
              'This learner has successfully demonstrated practical capability through assignments, simulations, projects, and assessment activities within the Upthrust Career Capability Accelerator.'}
          </p>
          <div style={{ marginTop: 12, fontSize: 13, color: MUTE }}>
            <strong style={{ color: INK }}>Genesis Nneji Enwenyeokwu</strong> · Founder &amp; Lead Facilitator, Upthrust
          </div>
        </Section>

        {/* Portfolio link */}
        {p.portfolio_url && (
          <Section title="Learner Portfolio">
            <a href={p.portfolio_url} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, fontSize: 14, fontWeight: 600 }}>
              {p.portfolio_url}
            </a>
          </Section>
        )}

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
