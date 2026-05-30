'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';
import type { PortfolioItem, Assignment } from '@/lib/types';
import Link from 'next/link';

const REQUIRED_ARTEFACTS_PM = [
  { title: 'Product Teardown Report', week: 1, type: 'Product Teardown' },
  { title: 'Problem Brief', week: 2, type: 'Problem Brief' },
  { title: 'Product Strategy Canvas', week: 3, type: 'Strategy Canvas' },
  { title: 'Full PRD', week: 4, type: 'PRD' },
  { title: 'User Journey Map', week: 5, type: 'Journey Map' },
  { title: 'Design Brief', week: 6, type: 'Design Brief' },
  { title: 'Figma Prototype Review', week: 7, type: 'Design Review' },
  { title: 'Sprint Backlog', week: 8, type: 'Sprint Backlog' },
  { title: 'Stakeholder Simulation Responses', week: 9, type: 'Stakeholder Sim' },
  { title: 'Launch Plan', week: 10, type: 'Launch Plan' },
  { title: 'Metrics Plan', week: 11, type: 'Metrics Plan' },
  { title: 'Capstone Project', week: 12, type: 'Capstone' },
];

const REQUIRED_ARTEFACTS_BA = [
  { title: 'Stakeholder Map & RACI Matrix', week: 1, type: 'Stakeholder Map' },
  { title: 'Elicitation Interview Notes', week: 2, type: 'Elicitation Notes' },
  { title: 'Business Case', week: 3, type: 'Business Case' },
  { title: 'Full BRD', week: 4, type: 'BRD' },
  { title: 'As-Is / To-Be Process Maps', week: 5, type: 'Process Map' },
  { title: 'User Journey vs Process Gap Analysis', week: 6, type: 'Gap Analysis' },
  { title: 'BA Design Review', week: 7, type: 'Design Review' },
  { title: 'User Stories + Acceptance Criteria Library', week: 8, type: 'User Stories' },
  { title: 'Stakeholder Workshop Pack', week: 9, type: 'Workshop Pack' },
  { title: 'Full UAT Pack', week: 10, type: 'UAT Pack' },
  { title: 'Post-Launch Reporting Framework', week: 11, type: 'Reporting Framework' },
  { title: 'Capstone Project', week: 12, type: 'Capstone' },
];

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  Draft: { color: 'var(--ink-muted)', bg: 'rgba(107,114,128,0.08)', label: 'Draft' },
  Submitted: { color: '#2563EB', bg: 'rgba(37,99,235,0.08)', label: 'Submitted' },
  Approved: { color: 'var(--moss)', bg: 'rgba(5,150,105,0.08)', label: 'Approved' },
  Featured: { color: 'var(--amber-deep)', bg: 'rgba(197,116,58,0.1)', label: '⭐ Featured' },
};

export default function PortfolioPage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [adding, setAdding] = useState(false);
  const [view, setView] = useState<'required' | 'all'>('required');
  const [form, setForm] = useState({ title: '', description: '', artefact_type: '', url: '', week_number: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<PortfolioItem | null>(null);

  const db = createBrowserClient();

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: l } = await db.from('learners').select('*').eq('clerk_user_id', user!.id).maybeSingle();
      setLearner(l);
      if (!l) return;
      const [{ data: i }, { data: a }] = await Promise.all([
        db.from('portfolio_items').select('*').eq('learner_id', l.id).order('week_number'),
        db.from('assignments').select('*').eq('learner_id', l.id),
      ]);
      setItems((i || []) as PortfolioItem[]);
      setAssignments((a || []) as Assignment[]);
    }
    load();
  }, [user]);

  async function handleAdd() {
    if (!learner || !form.title || !form.url) return;
    setSaving(true);
    await db.from('portfolio_items').insert({
      learner_id: learner.id,
      title: form.title, description: form.description,
      artefact_type: form.artefact_type,
      url: form.url,
      week_number: form.week_number ? parseInt(form.week_number) : null,
      status: 'Draft',
    });
    const { data: i } = await db.from('portfolio_items').select('*').eq('learner_id', learner.id).order('week_number');
    setItems((i || []) as PortfolioItem[]);
    setForm({ title: '', description: '', artefact_type: '', url: '', week_number: '' });
    setAdding(false);
    setSaving(false);
  }

  async function handleDelete(itemId: string, itemTitle: string) {
    if (!confirm(`Delete "${itemTitle}"? This cannot be undone.`)) return;
    setDeleting(itemId);
    await db.from('portfolio_items').delete().eq('id', itemId);
    const { data: i } = await db.from('portfolio_items').select('*').eq('learner_id', learner.id).order('week_number');
    setItems((i || []) as PortfolioItem[]);
    setDeleting(null);
  }

  async function handleEdit(item: PortfolioItem) {
    setEditingItem(item);
    setForm({ title: item.title, description: item.description || '', artefact_type: item.artefact_type || '', url: item.url || '', week_number: item.week_number?.toString() || '' });
    setAdding(true);
  }

  async function handleSaveEdit() {
    if (!learner || !editingItem || !form.title || !form.url) return;
    setSaving(true);
    await db.from('portfolio_items').update({
      title: form.title, description: form.description,
      artefact_type: form.artefact_type, url: form.url,
      week_number: form.week_number ? parseInt(form.week_number) : null,
    }).eq('id', editingItem.id);
    const { data: i } = await db.from('portfolio_items').select('*').eq('learner_id', learner.id).order('week_number');
    setItems((i || []) as PortfolioItem[]);
    setForm({ title: '', description: '', artefact_type: '', url: '', week_number: '' });
    setAdding(false); setEditingItem(null); setSaving(false);
  }

  const pathway = learner?.pathway || 'PM';
  const requiredArtefacts = pathway === 'PM' ? REQUIRED_ARTEFACTS_PM : REQUIRED_ARTEFACTS_BA;
  const approvedItems = items.filter(i => i.status === 'Approved' || i.status === 'Featured');
  const passportProgress = Math.round((approvedItems.length / 8) * 100);

  function getItemForWeek(weekNum: number) {
    return items.find(i => i.week_number === weekNum) ||
      assignments.find(a => a.week_number === weekNum && (a.status === 'Approved' || a.status === 'Portfolio Ready'));
  }

  return (
    <div className="portal-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Evidence of Capability</p>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>My Portfolio</h1>
        </div>
        <button onClick={() => { setAdding(true); setEditingItem(null); setForm({ title: '', description: '', artefact_type: '', url: '', week_number: '' }); }} className="btn btn-primary">+ Add Artefact</button>
      </div>

      {/* Passport progress bar */}
      <div style={{ padding: '16px 20px', background: 'var(--white)', border: '1px solid var(--paper-line)', borderRadius: 6, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div>
            <p style={{ fontWeight: 700 }}>Passport Progress</p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: 2 }}>
              {approvedItems.length} of 8 artefacts approved for Passport · {items.length} total items
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.5rem', fontWeight: 500, color: approvedItems.length >= 8 ? 'var(--moss)' : 'var(--amber-deep)' }}>
              {approvedItems.length}/8
            </p>
          </div>
        </div>
        <div style={{ height: 8, background: 'var(--paper-line)', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(passportProgress, 100)}%`, background: approvedItems.length >= 8 ? 'var(--moss)' : 'var(--amber)', borderRadius: 4, transition: 'width 600ms ease' }} />
        </div>
        {approvedItems.length < 8 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 8 }}>
            {8 - approvedItems.length} more approved artefact{8 - approvedItems.length !== 1 ? 's' : ''} needed. Submit your assignments to get them reviewed and approved.
          </p>
        )}
      </div>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['required', '📋 Required Artefacts', requiredArtefacts.length], ['all', '💼 All Items', items.length]] as const).map(([v, label, count]) => (
          <button key={v} onClick={() => setView(v)} style={{
            padding: '8px 16px', borderRadius: 100,
            border: `1.5px solid ${view === v ? 'var(--ink)' : 'var(--paper-line)'}`,
            background: view === v ? 'var(--ink)' : 'transparent',
            color: view === v ? 'var(--paper)' : 'var(--ink-muted)',
            fontSize: '0.875rem', fontWeight: view === v ? 700 : 400, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {label}
            <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: view === v ? 'rgba(250,247,241,0.15)' : 'rgba(15,26,46,0.08)' }}>{count}</span>
          </button>
        ))}
      </div>

      {/* Required artefacts view */}
      {view === 'required' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {requiredArtefacts.map(req => {
            const match = getItemForWeek(req.week);
            const status = match ? match.status : 'Not Started';
            const isApproved = status === 'Approved' || status === 'Portfolio Ready' || status === 'Featured';
            const url = match ? ((match as PortfolioItem).url ?? (match as Assignment).submission_url ?? null) : null;

            return (
              <div key={req.week} className="card" style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '14px 18px',
                borderLeft: `3px solid ${isApproved ? 'var(--moss)' : status !== 'Not Started' ? 'var(--amber)' : 'var(--paper-line)'}`,
              }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', flex: 1 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: isApproved ? 'rgba(5,150,105,0.1)' : status !== 'Not Started' ? 'rgba(197,116,58,0.1)' : 'var(--paper-soft)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1rem',
                  }}>
                    {isApproved ? '✅' : status !== 'Not Started' ? '⏳' : '○'}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>{req.title}</p>
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '1px 6px', borderRadius: 3, background: 'var(--paper-soft)', color: 'var(--ink-muted)' }}>Week {req.week}</span>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{req.type}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {status !== 'Not Started' && (
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '3px 8px', borderRadius: 100, background: isApproved ? 'rgba(5,150,105,0.1)' : 'rgba(197,116,58,0.1)', color: isApproved ? 'var(--moss)' : 'var(--amber-deep)' }}>
                      {status}
                    </span>
                  )}
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">View</a>
                  ) : (
                    <Link href="/portal/assignments" className="btn btn-sm btn-outline" style={{ opacity: 0.7 }}>Submit →</Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* All items view */}
      {view === 'all' && (
        <>
          {items.length === 0 ? (
            <div style={{ padding: '56px', textAlign: 'center', background: 'var(--white)', borderRadius: 8, border: '1px solid var(--paper-line)' }}>
              <p style={{ fontSize: '3rem', marginBottom: 12 }}>💼</p>
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: 8 }}>Your portfolio is empty</p>
              <p style={{ color: 'var(--ink-muted)', marginBottom: 20 }}>Submit assignments to get them reviewed and approved. Approved assignments automatically become portfolio artefacts.</p>
              <button onClick={() => { setAdding(true); setEditingItem(null); setForm({ title: '', description: '', artefact_type: '', url: '', week_number: '' }); }} className="btn btn-primary">+ Add Your First Artefact</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {items.map(item => {
                const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.Draft;
                return (
                  <div key={item.id} className="card" style={{ borderTop: `2px solid ${cfg.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {item.week_number != null && <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 2, background: 'var(--paper-soft)', color: 'var(--ink-muted)' }}>Wk {item.week_number}</span>}
                        {item.artefact_type && <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 2, background: 'rgba(197,116,58,0.08)', color: 'var(--amber-deep)' }}>{item.artefact_type}</span>}
                      </div>
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 100, background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                    </div>
                    <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 6 }}>{item.title}</h3>
                    {item.description && <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', lineHeight: 1.5, marginBottom: 10 }}>{item.description}</p>}
                    {item.feedback && <div style={{ padding: '8px 10px', background: 'var(--paper-soft)', borderRadius: 4, marginBottom: 10 }}><p style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', fontStyle: 'italic' }}>"{item.feedback}"</p></div>}
                    <div style={{ display: 'flex', gap: 6 }}>
                      {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">View →</a>}
                      <button onClick={() => handleEdit(item)} className="btn btn-ghost btn-sm" title="Edit">✏️</button>
                      <button onClick={() => handleDelete(item.id, item.title)} disabled={deleting === item.id} className="btn btn-ghost btn-sm" style={{ color: 'var(--red)' }} title="Delete">
                        {deleting === item.id ? '...' : '🗑'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Add form */}
      {adding && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,46,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
          <div style={{ background: 'var(--white)', borderRadius: 8, width: '100%', maxWidth: 560, padding: 32, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem', marginBottom: 20 }}>{editingItem ? 'Edit Artefact' : 'Add Portfolio Artefact'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Title *</label>
                <input className="form-input" placeholder="e.g. Product Teardown — Piggyvest" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Type</label>
                <select className="form-input" value={form.artefact_type} onChange={e => setForm({ ...form, artefact_type: e.target.value })}>
                  <option value="">Select type...</option>
                  {['Product Teardown', 'Problem Brief', 'Strategy Canvas', 'PRD', 'BRD', 'Journey Map', 'Process Map', 'Sprint Backlog', 'UAT Pack', 'Metrics Plan', 'Launch Plan', 'Capstone', 'Other'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Week</label>
                <select className="form-input" value={form.week_number} onChange={e => setForm({ ...form, week_number: e.target.value })}>
                  <option value="">Week...</option>
                  {Array.from({ length: 13 }, (_, i) => <option key={i} value={i}>Week {i}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Link * (Google Drive, Notion, Figma, Miro)</label>
                <input className="form-input" type="url" placeholder="https://docs.google.com/..." value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} />
                <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 4 }}>Make sure sharing is set to "Anyone with the link can view"</p>
              </div>
              <div className="form-group" style={{ gridColumn: '1 / -1', marginBottom: 0 }}>
                <label className="form-label">Description (optional)</label>
                <textarea className="form-input form-textarea" style={{ minHeight: 70 }} placeholder="What does this artefact demonstrate?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button onClick={editingItem ? handleSaveEdit : handleAdd} disabled={!form.title || !form.url || saving} className="btn btn-primary">{saving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add to Portfolio'}</button>
              <button onClick={() => { setAdding(false); setEditingItem(null); }} className="btn btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
