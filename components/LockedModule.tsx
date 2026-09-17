// components/LockedModule.tsx
// ─────────────────────────────────────────────────────────────────────────────
// The 'locked' disabled presentation: the screen a learner sees when a module
// exists, is coming, and is not open yet.
//
// The counterpart to 'absent', which has no screen at all because the module
// is meant to be gone (see the Community and Notifications gates). Capstone is
// the only module that uses this one: a capstone learners cannot see is a worse
// experience than one they can see coming, and the countdown is part of the
// programme rather than something to hide.
//
// Server component. It takes only a module key and reads its own copy from
// MODULE_REGISTRY, so the admin console's "what learners see when OFF" note and
// the screen learners actually get cannot drift apart — they are the same
// string. Nothing learner-specific is passed in, and nothing gated is rendered.
// ─────────────────────────────────────────────────────────────────────────────
import Link from 'next/link';
import { MODULE_REGISTRY, type ModuleKey } from '@/lib/module-access-rules';

interface LockedModuleProps {
  moduleKey: ModuleKey;
  /**
   * When it opens, in the learner's words. Deliberately not a date: capstone
   * unlock is per-cohort and an admin decides it, so a date rendered here would
   * be a promise this component is in no position to make.
   */
  timing?: string;
  /** Where the "meanwhile" button goes. Defaults to the current week. */
  backHref?: string;
  backLabel?: string;
}

export default function LockedModule({
  moduleKey,
  timing = 'in the closing weeks of the programme',
  backHref = '/portal/week',
  backLabel = 'Go to this week',
}: LockedModuleProps) {
  const meta = MODULE_REGISTRY[moduleKey];
  const label = meta?.label ?? moduleKey;

  return (
    <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 24px', textAlign: 'center' }}>
      <div
        style={{
          width: 64,
          height: 64,
          margin: '0 auto 24px',
          borderRadius: '50%',
          background: 'var(--paper-soft)',
          border: '1px solid var(--paper-line)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '1.5rem',
        }}
      >
        🔒
      </div>

      <p
        style={{
          fontSize: '0.625rem',
          fontWeight: 700,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'var(--ink-muted)',
          marginBottom: 8,
        }}
      >
        Not open yet
      </p>

      <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 500, marginBottom: 12 }}>
        {label}
      </h1>

      <p style={{ color: 'var(--ink-muted)', lineHeight: 1.65, marginBottom: 20 }}>
        Your {label.toLowerCase()} opens {timing}. Your facilitator will tell you when — you do not need to
        check back here, and nothing is late.
      </p>

      {/* The one place the registry copy is shown to a learner rather than an
          admin. It describes what appears here once the module is open, which
          is exactly what someone landing on this screen wants to know. */}
      {meta?.whenOn && (
        <div
          style={{
            padding: '14px 18px',
            marginBottom: 24,
            background: 'var(--paper-soft)',
            border: '1px solid var(--paper-line)',
            borderRadius: 6,
            textAlign: 'left',
          }}
        >
          <p
            style={{
              fontSize: '0.625rem',
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--ink-muted)',
              marginBottom: 6,
            }}
          >
            What you will find here
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--ink)', lineHeight: 1.6 }}>{meta.whenOn}</p>
        </div>
      )}

      <Link href={backHref} className="btn btn-primary">
        {backLabel}
      </Link>
    </div>
  );
}

/**
 * The banner an admin sees when they open a gated page that is closed to
 * learners — the visible half of ModuleGate.adminOverride.
 *
 * Without it an admin who had forgotten the flag was off would read the real
 * page as proof the module was live. Rendering the page and saying nothing is
 * the one outcome worth ruling out.
 */
export function AdminOverrideNotice({ moduleKey }: { moduleKey: ModuleKey }) {
  const meta = MODULE_REGISTRY[moduleKey];
  const label = meta?.label ?? moduleKey;
  const locked = meta?.presentation === 'locked';

  return (
    <div
      style={{
        padding: '12px 18px',
        margin: '0 0 20px',
        background: 'rgba(197,116,58,0.08)',
        border: '1px solid rgba(197,116,58,0.25)',
        borderLeft: '3px solid var(--amber)',
        borderRadius: 6,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>🔐</span>
      <div>
        <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>
          {label} is switched off — you are seeing this because you are an admin.
        </p>
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.8125rem', marginTop: 2, lineHeight: 1.55 }}>
          {locked
            ? 'Learners visiting this page get the locked screen instead.'
            : 'Learners have no link to this page and are redirected to their dashboard.'}{' '}
          Turn it on from{' '}
          <Link href="/admin/modules" style={{ color: 'var(--amber-deep)', fontWeight: 600 }}>
            Module Access
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
