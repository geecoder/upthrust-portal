'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';
import type { PortfolioItem } from '@/lib/types';

export default function PortfolioPage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', artefact_type: '', url: '', week_number: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: l } = await createBrowserClient().from('learners').select('*').eq('clerk_user_id', user!.id).single();
      setLearner(l);
      if (!l) return;
      const { data: i } = await createBrowserClient().from('portfolio_items').select('*').eq('learner_id', l.id).order('week_number');
      setItems(i || []);
    }
    load();
  }, [user]);

  async function handleSave() {
    if (!learner || !form.title || !form.url) return;
    setSaving(true);
    await createBrowserClient().from('portfolio_items').insert({
      learner_id: learner.id,
      title: form.title,
      description: form.description,
      artefact_type: form.artefact_type,
      url: form.url,
      week_number: form.week_number ? parseInt(form.week_number) : null,
      status: 'Draft',
    });
    const { data: i } = await createBrowserClient().from('portfolio_items').select('*').eq('learner_id', learner.id).order('week_number');
    setItems(i || []);
    setForm({ title: '', description: '', artefact_type: '', url: '', week_number: '' });
    setAdding(false);
    setSaving(false);
  }

  const statusColor: Record<string, string> = { Draft: 'var(--ink-muted)', Submitted: '#1D4ED8', Approved: 'var(--moss)', Featured: 'var(--amber-deep)' };

  return (
    <div className="portal-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Evidence of Capability</p>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>My Portfolio</h1>
          <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>{items.length} artefacts · 8 required for Capability Passport</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add Artefact</button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="card" style={{ marginBottom: 24, borderTop: '3px solid var(--amber)' }}>
          <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 16 }}>Add Portfolio Artefact</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Title *</label>
              <input className="form-input" placeholder="e.g. Product Teardown — Piggyvest" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="form-group">
              <label className="form-label">Artefact Type</label>
              <select className="form-input" value={form.artefact_type} onChange={e => setForm({ ...form, artefact_type: e.target.value })}>
                <option value="">Select type...</option>
                {['Product Teardown', 'Problem Brief', 'Product Strategy Canvas', 'PRD', 'BRD', 'User Journey Map', 'Process Map', 'UAT Pack', 'Sprint Backlog', 'Metrics Plan', 'Launch Plan', 'Capstone', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Week</label>
              <select className="form-input" value={form.week_number} onChange={e => setForm({ ...form, week_number: e.target.value })}>
                <option value="">Select week...</option>
                {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>Week {i}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Link * (Google Drive or Notion)</label>
              <input className="form-input" type="url" placeholder="https://docs.google.com/..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
            </div>
            <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
              <label className="form-label">Description (optional)</label>
              <textarea className="form-input form-textarea" placeholder="What does this artefact show?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} style={{ minHeight: 80 }} />
            </div>
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" disabled={!form.title || !form.url || saving} onClick={handleSave}>{saving ? 'Saving...' : 'Add to Portfolio'}</button>
            <button className="btn btn-ghost" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Portfolio items */}
      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-muted)' }}>
          <p style={{ fontSize: '3rem', marginBottom: 12 }}>💼</p>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: 8 }}>Your portfolio is empty</p>
          <p style={{ marginBottom: 20 }}>Add your first artefact above, or submit assignments to start building your evidence.</p>
          <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add Your First Artefact</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          {items.map(item => (
            <div key={item.id} className="card" style={{ borderTop: `3px solid ${statusColor[item.status]}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {item.week_number !== undefined && item.week_number !== null && (
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', background: 'var(--paper-soft)', color: 'var(--ink-muted)', borderRadius: 2 }}>Wk {item.week_number}</span>
                  )}
                  {item.artefact_type && (
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', background: 'rgba(197,116,58,0.08)', color: 'var(--amber-deep)', borderRadius: 2 }}>{item.artefact_type}</span>
                  )}
                </div>
                <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: statusColor[item.status] }}>{item.status}</span>
              </div>
              <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 6 }}>{item.title}</h3>
              {item.description && <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', lineHeight: 1.55, marginBottom: 10 }}>{item.description}</p>}
              {item.feedback && (
                <div style={{ padding: '8px 10px', background: 'var(--paper-soft)', borderRadius: 4, marginBottom: 10 }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', fontStyle: 'italic' }}>"{item.feedback}"</p>
                </div>
              )}
              <a href={item.url || '#'} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ display: 'inline-block' }}>View Work →</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
