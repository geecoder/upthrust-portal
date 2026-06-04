'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const COUNTRIES = ['Nigeria', 'United Kingdom', 'Canada', 'United States', 'Ghana', 'Kenya', 'South Africa', 'Other'];

export default function AddLearnerPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '',
    country: 'Nigeria', pathway: 'PM', tier: 'Standard',
    current_job_role: '', career_goal: '', linkedin_url: '',
  });

  function f(k: keyof typeof form, v: string) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSubmit() {
    if (!form.first_name || !form.email || !form.pathway) {
      setError('First name, email, and pathway are required.');
      return;
    }
    setError('');
    setSaving(true);

    const res = await fetch('/api/admin/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add_learner', learner: form }),
    });
    const json = await res.json();

    if (!res.ok) {
      setError(json.error || 'Failed to add learner.');
      setSaving(false);
      return;
    }

    setSuccess(`${form.first_name} ${form.last_name} added successfully.`);
    setSaving(false);

    setTimeout(() => router.push('/admin/learners'), 1500);
  }

  return (
    <div className="portal-content" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <Link href="/admin/learners" style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
          ← All Learners
        </Link>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Add Learner to Cohort 1</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4, fontSize: '0.9rem' }}>
          Add a learner manually. Once added, they sign up at the portal and are automatically linked to this record via Clerk webhook.
        </p>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'rgba(179,56,44,0.08)', border: '1px solid rgba(179,56,44,0.25)', borderRadius: 6, marginBottom: 20, color: 'var(--red)', fontWeight: 600 }}>
          ⚠ {error}
        </div>
      )}
      {success && (
        <div style={{ padding: '12px 16px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 6, marginBottom: 20, color: 'var(--moss)', fontWeight: 600 }}>
          ✓ {success}
        </div>
      )}

      <div className="card">
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 20 }}>Personal Information</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">First Name *</label>
            <input className="form-input" placeholder="Chioma" value={form.first_name} onChange={e => f('first_name', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Last Name</label>
            <input className="form-input" placeholder="Okonkwo" value={form.last_name} onChange={e => f('last_name', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email *</label>
            <input className="form-input" type="email" placeholder="chioma@email.com" value={form.email} onChange={e => f('email', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Phone</label>
            <input className="form-input" type="tel" placeholder="+234 800 000 0000" value={form.phone} onChange={e => f('phone', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Country</label>
            <select className="form-input" value={form.country} onChange={e => f('country', e.target.value)}>
              {COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">LinkedIn (optional)</label>
            <input className="form-input" type="url" placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => f('linkedin_url', e.target.value)} />
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--paper-line)', margin: '4px 0 20px' }} />

        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 20 }}>Program Settings</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Pathway *</label>
            <select className="form-input" value={form.pathway} onChange={e => f('pathway', e.target.value)}>
              <option value="PM">Product Management (PM)</option>
              <option value="BA">Business Analysis (BA)</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tier</label>
            <select className="form-input" value={form.tier} onChange={e => f('tier', e.target.value)}>
              <option value="Standard">Standard</option>
              <option value="Premium">Premium</option>
              <option value="VIP">VIP</option>
              <option value="Corporate">Corporate</option>
            </select>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 4 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Current Role (optional)</label>
            <input className="form-input" placeholder="Business Analyst, Operations Manager..." value={form.current_job_role} onChange={e => f('current_job_role', e.target.value)} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Career Goal (optional)</label>
            <input className="form-input" placeholder="Transition to PM by Q1 2027..." value={form.career_goal} onChange={e => f('career_goal', e.target.value)} />
          </div>
        </div>
      </div>

      <div style={{ padding: '16px 20px', background: 'rgba(197,116,58,0.07)', border: '1px solid rgba(197,116,58,0.2)', borderRadius: 6, margin: '16px 0' }}>
        <p style={{ fontWeight: 700, color: 'var(--amber-deep)', marginBottom: 4 }}>After adding this learner</p>
        <div style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', lineHeight: 1.7 }}>
          <p>1. Send them the portal link: <strong>https://app.upthrustdigital.com</strong></p>
          <p>2. They sign up with the same email address above</p>
          <p>3. The Clerk webhook automatically links their account (if webhook is set up)</p>
          <p>4. Or manually: go to Learner Detail → paste their Clerk User ID</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={handleSubmit} disabled={saving || !form.first_name || !form.email} className="btn btn-primary" style={{ minWidth: 160 }}>
          {saving ? 'Adding learner...' : 'Add Learner →'}
        </button>
        <Link href="/admin/learners" className="btn btn-ghost">Cancel</Link>
      </div>
    </div>
  );
}
