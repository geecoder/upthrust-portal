'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { WEEK_DATES } from '@/lib/types';

interface Session {
  id: string;
  title: string;
  week_number: number | null;
  session_date: string | null;
  start_time: string | null;
  zoom_link: string | null;
  description: string | null;
  recording_url: string | null;
}

const EMPTY: Omit<Session, 'id'> & { id?: string } = {
  title: '', week_number: null, session_date: '', start_time: '10:00',
  zoom_link: '', description: '', recording_url: '',
};

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch('/api/admin/data?resource=sessions');
    const data = await res.json();
    setSessions((data.sessions || []) as Session[]);
    setLoading(false);
  }

  function openCreate() {
    setForm({ ...EMPTY });
    setShowForm(true);
  }

  function openEdit(s: Session) {
    setForm({
      id: s.id, title: s.title, week_number: s.week_number,
      session_date: s.session_date || '', start_time: s.start_time || '10:00',
      zoom_link: s.zoom_link || '', description: s.description || '',
      recording_url: s.recording_url || '',
    });
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { setMsg('Title is required.'); return; }
    if (!form.zoom_link.trim()) { setMsg('Zoom link is required.'); return; }
    setSaving(true);
    setMsg('');
    const res = await fetch('/api/admin/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'save_session',
        session: {
          ...form,
          week_number: form.week_number === '' || form.week_number === null
            ? null : parseInt(String(form.week_number)),
        },
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) { setMsg(data.error || 'Could not save session.'); return; }
    setShowForm(false);
    await load();
  }

  async function deleteSession(s: Session) {
    if (!confirm(`Delete session "${s.title}"?`)) return;
    await fetch('/api/admin/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete_session', sessionId: s.id }),
    });
    await load();
  }

  return (
    <div className="portal-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Live Sessions</h1>
          <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
            Schedule sessions with Zoom links. Learners see these on their Sessions page.
          </p>
        </div>
        <button onClick={openCreate} className="btn btn-primary">+ Schedule Session</button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : sessions.length === 0 ? (
        <div className="empty-state" style={{ padding: 48, textAlign: 'center', background: 'var(--white)', borderRadius: 8, border: '1px solid var(--paper-line)' }}>
          <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>📅</p>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', marginBottom: 6 }}>No sessions scheduled yet</p>
          <p style={{ color: 'var(--ink-muted)', marginBottom: 16 }}>Add your first live session so learners can join.</p>
          <button onClick={openCreate} className="btn btn-primary">+ Schedule Session</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {sessions.map(s => (
            <div key={s.id} className="card" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  {s.week_number != null && (
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--amber-deep)' }}>Week {s.week_number}</span>
                  )}
                  <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.0625rem', fontWeight: 500 }}>{s.title}</h3>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>
                  {s.session_date ? new Date(s.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                  {s.start_time ? ` · ${s.start_time}` : ''}
                  {s.zoom_link ? ' · 🔗 Zoom link set' : ' · ⚠ No link'}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {s.zoom_link && (
                  <a href={s.zoom_link} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">Open Zoom</a>
                )}
                <button onClick={() => openEdit(s)} className="btn btn-sm btn-ghost">Edit</button>
                <button onClick={() => deleteSession(s)} className="btn btn-sm btn-ghost" style={{ color: 'var(--red)' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,46,0.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: 'var(--white)', borderRadius: 8, width: '100%', maxWidth: 560, maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ padding: '20px 28px', borderBottom: '1px solid var(--paper-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem' }}>{form.id ? 'Edit Session' : 'Schedule a Session'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--ink-muted)' }}>✕</button>
            </div>
            <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Session Title *</label>
                <input className="form-input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Week 1 Live Session — The PM/BA Role" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Week</label>
                  <select className="form-input" value={form.week_number ?? ''} onChange={e => setForm({ ...form, week_number: e.target.value })}>
                    <option value="">Not week-specific</option>
                    {WEEK_DATES.map(w => <option key={w.week} value={w.week}>Week {w.week}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Start Time</label>
                  <input className="form-input" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} placeholder="10:00 AM WAT" />
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Date</label>
                <input className="form-input" type="date" value={form.session_date} onChange={e => setForm({ ...form, session_date: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Zoom Link *</label>
                <input className="form-input" type="url" value={form.zoom_link} onChange={e => setForm({ ...form, zoom_link: e.target.value })} placeholder="https://zoom.us/j/..." />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Description <span style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>(optional)</span></label>
                <textarea className="form-input form-textarea" style={{ minHeight: 64 }} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="What this session covers..." />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Recording URL <span style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>(add after the session)</span></label>
                <input className="form-input" type="url" value={form.recording_url} onChange={e => setForm({ ...form, recording_url: e.target.value })} placeholder="https://..." />
              </div>
              {msg && <p style={{ color: 'var(--red)', fontSize: '0.875rem', fontWeight: 600 }}>{msg}</p>}
            </div>
            <div style={{ padding: '16px 28px', borderTop: '1px solid var(--paper-line)', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button onClick={() => setShowForm(false)} className="btn btn-ghost">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ minWidth: 120 }}>
                {saving ? 'Saving...' : form.id ? 'Save Changes' : 'Schedule Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
