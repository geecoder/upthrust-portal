'use client';

import { useState } from 'react';

export default function PathwayEditor({
  learnerId,
  currentPathway,
  currentTier,
}: {
  learnerId: string;
  currentPathway: string | null;
  currentTier: string | null;
}) {
  const [pathway, setPathway] = useState(currentPathway || '');
  const [tier, setTier] = useState(currentTier || 'Standard');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');

  const dirty = pathway !== (currentPathway || '') || tier !== (currentTier || 'Standard');

  async function save() {
    if (!pathway) { setErr('Choose a pathway (PM or BA).'); return; }
    setSaving(true); setErr('');
    const res = await fetch('/api/admin/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'admin_update_learner',
        learnerId,
        fields: { pathway, tier },
      }),
    });
    const data = await res.json();
    if (!res.ok) { setErr(data.error || 'Could not update.'); setSaving(false); return; }
    setDone(true); setSaving(false);
    setTimeout(() => window.location.reload(), 900);
  }

  if (done) return <p style={{ color: 'var(--moss)', fontWeight: 600 }}>✓ Updated — reloading...</p>;

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div style={{ flex: 1, minWidth: 160 }}>
        <label className="form-label" style={{ fontSize: '0.75rem' }}>Pathway</label>
        <select className="form-input" value={pathway} onChange={e => setPathway(e.target.value)}>
          <option value="">— Not set —</option>
          <option value="PM">Product Management (PM)</option>
          <option value="BA">Business Analysis (BA)</option>
        </select>
      </div>
      <div style={{ flex: 1, minWidth: 140 }}>
        <label className="form-label" style={{ fontSize: '0.75rem' }}>Tier</label>
        <select className="form-input" value={tier} onChange={e => setTier(e.target.value)}>
          {['Standard', 'Premium', 'VIP', 'Corporate'].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <button onClick={save} disabled={saving || !dirty} className="btn btn-primary btn-sm"
        style={{ opacity: dirty ? 1 : 0.5 }}>
        {saving ? 'Saving...' : 'Update enrolment'}
      </button>
      {err && <p style={{ fontSize: '0.75rem', color: 'var(--red)', width: '100%' }}>{err}</p>}
    </div>
  );
}
