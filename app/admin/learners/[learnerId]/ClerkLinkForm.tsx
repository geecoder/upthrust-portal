'use client';

import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

export default function ClerkLinkForm({ learnerId }: { learnerId: string }) {
  const [clerkId, setClerkId] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState('');
  const db = createBrowserClient();

  async function link() {
    if (!clerkId.trim()) return;
    setSaving(true); setErr('');
    const { error } = await db.from('learners').update({
      clerk_user_id: clerkId.trim(),
      updated_at: new Date().toISOString(),
    }).eq('id', learnerId);
    if (error) { setErr(error.message); setSaving(false); return; }
    setDone(true); setSaving(false);
    setTimeout(() => window.location.reload(), 1000);
  }

  if (done) return <p style={{ color: 'var(--moss)', fontWeight: 600 }}>✓ Linked successfully — reloading...</p>;

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input
        className="form-input"
        style={{ flex: 1, minWidth: 260 }}
        placeholder="user_2abc123xyz (from Clerk Dashboard → Users)"
        value={clerkId}
        onChange={e => setClerkId(e.target.value)}
      />
      <button onClick={link} disabled={saving || !clerkId.trim()} className="btn btn-primary btn-sm">
        {saving ? 'Linking...' : 'Link Account'}
      </button>
      {err && <p style={{ fontSize: '0.75rem', color: 'var(--red)', width: '100%' }}>{err}</p>}
    </div>
  );
}
