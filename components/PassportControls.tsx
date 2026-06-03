'use client';
// components/PassportControls.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Admin control block for the learner detail page. Issue / re-issue / revoke a
// Capability Passport, plus quick links to preview the passport and the public
// verify page. Calls /api/passport-issue (admin-gated server-side).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from 'react';

interface Props {
  learnerId: string | number;
  passportId?: string | null;
  passportIssued?: boolean;
}

export default function PassportControls({ learnerId, passportId, passportIssued }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [pid, setPid] = useState<string | null>(passportId ?? null);
  const [issued, setIssued] = useState<boolean>(!!passportIssued);

  async function call(action: 'issue' | 'reissue' | 'revoke') {
    setBusy(action);
    setMsg(null);
    try {
      const res = await fetch('/api/passport-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, learnerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      if (action === 'revoke') {
        setIssued(false);
        setMsg({ kind: 'ok', text: 'Passport revoked.' });
      } else {
        setIssued(true);
        setPid(data.passport?.passport_id ?? pid);
        setMsg({ kind: 'ok', text: `Passport ${data.action}: ${data.passport?.passport_id ?? ''}` });
      }
    } catch (e: any) {
      setMsg({ kind: 'err', text: e.message });
    } finally {
      setBusy(null);
    }
  }

  const btn: React.CSSProperties = {
    padding: '9px 16px', borderRadius: 8, fontSize: 14, fontWeight: 600,
    border: '1px solid #d9d4cb', cursor: 'pointer', background: '#fff',
  };
  const primary: React.CSSProperties = { ...btn, background: '#0B1F3A', color: '#fff', border: 'none' };
  const danger: React.CSSProperties = { ...btn, color: '#C0392B', borderColor: '#E7B7B0' };

  return (
    <div style={{ border: '1px solid #E6E0D6', borderRadius: 12, padding: 18, background: '#FBFAF7' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Capability Passport</h3>
        <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
          background: issued ? '#EAF6F0' : '#ECEEF1', color: issued ? '#1E8E4E' : '#7A828E' }}>
          {issued ? 'Issued' : 'Not issued'}
        </span>
      </div>

      {pid && <div style={{ fontSize: 13, color: '#6A727E', marginBottom: 12 }}>ID: <strong>{pid}</strong></div>}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {!issued && (
          <button style={primary} disabled={!!busy} onClick={() => call('issue')}>
            {busy === 'issue' ? 'Issuing…' : 'Issue Passport'}
          </button>
        )}
        {issued && (
          <>
            <button style={btn} disabled={!!busy} onClick={() => call('reissue')}>
              {busy === 'reissue' ? 'Re-issuing…' : 'Re-issue (refresh snapshot)'}
            </button>
            <a style={{ ...btn, textDecoration: 'none', color: '#16243A' }} href={`/api/passport-pdf?learnerId=${learnerId}`} target="_blank" rel="noreferrer">
              Preview Passport
            </a>
            {pid && (
              <a style={{ ...btn, textDecoration: 'none', color: '#16243A' }} href={`/verify/${pid}`} target="_blank" rel="noreferrer">
                Public Verify Page
              </a>
            )}
            <button style={danger} disabled={!!busy} onClick={() => {
              if (confirm('Revoke this passport? It will stop verifying as valid.')) call('revoke');
            }}>
              {busy === 'revoke' ? 'Revoking…' : 'Revoke'}
            </button>
          </>
        )}
      </div>

      {msg && (
        <p style={{ marginTop: 12, marginBottom: 0, fontSize: 13, color: msg.kind === 'ok' ? '#1E8E4E' : '#C0392B' }}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
