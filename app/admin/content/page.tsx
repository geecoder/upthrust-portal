'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Week } from '@/lib/types';
import { PHASE_COLORS } from '@/lib/types';

export default function ContentPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [editing, setEditing] = useState<Week | null>(null);
  const [saving, setSaving] = useState(false);

  const db = createBrowserClient();

  useEffect(() => {
    db.from('weeks').select('*').order('week_number').then(({ data }) => setWeeks(data || []));
  }, []);

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    await db.from('weeks').update(editing).eq('id', editing.id);
    const { data } = await db.from('weeks').select('*').order('week_number');
    setWeeks(data || []);
    setEditing(null);
    setSaving(false);
  }

  async function togglePublish(week: Week) {
    await db.from('weeks').update({ is_published: !week.is_published }).eq('id', week.id);
    const { data } = await db.from('weeks').select('*').order('week_number');
    setWeeks(data || []);
  }

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Manage Weekly Content</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>Publish weeks when ready. Learners only see published weeks.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {weeks.map(week => {
          const color = PHASE_COLORS[week.phase || 'Foundation'];
          return (
            <div key={week.id} className="card" style={{ borderLeft: `3px solid ${color}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Week {week.week_number} · {week.phase}</span>
                  <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', background: week.is_published ? 'rgba(79,106,74,0.1)' : 'rgba(15,26,46,0.06)', color: week.is_published ? 'var(--moss)' : 'var(--ink-muted)', borderRadius: 2 }}>
                    {week.is_published ? '✓ Published' : 'Draft'}
                  </span>
                </div>
                <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500 }}>{week.title}</h3>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-sm btn-outline" onClick={() => setEditing({ ...week })}>Edit</button>
                <button className={`btn btn-sm ${week.is_published ? 'btn-ghost' : 'btn-primary'}`} onClick={() => togglePublish(week)}>
                  {week.is_published ? 'Unpublish' : 'Publish'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit modal */}
      {editing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,26,46,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200, padding: 24 }}>
          <div style={{ background: 'var(--white)', borderRadius: 8, width: '100%', maxWidth: 720, maxHeight: '90vh', overflow: 'auto', padding: 32 }}>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem', marginBottom: 20 }}>Edit Week {editing.week_number} — {editing.title}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { field: 'learning_goals', label: 'Learning Goals (comma separated)', type: 'textarea' },
                { field: 'concept_topics', label: 'Concept Class Topics', type: 'textarea' },
                { field: 'case_study', label: 'Case Study', type: 'textarea' },
                { field: 'lab_exercise', label: 'Practical Lab', type: 'textarea' },
                { field: 'pm_assignment_brief', label: 'PM Assignment Brief', type: 'textarea' },
                { field: 'ba_assignment_brief', label: 'BA Assignment Brief', type: 'textarea' },
                { field: 'reflection_prompt', label: 'Reflection Prompt', type: 'text' },
                { field: 'recording_url', label: 'Recording URL', type: 'text' },
                { field: 'session_notes', label: 'Session Notes', type: 'textarea' },
              ].map(({ field, label, type }) => (
                <div key={field} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{label}</label>
                  {type === 'textarea' ? (
                    <textarea className="form-input form-textarea" value={(editing as any)[field] || ''} onChange={e => setEditing({ ...editing, [field]: e.target.value } as Week)} />
                  ) : (
                    <input className="form-input" type="text" value={(editing as any)[field] || ''} onChange={e => setEditing({ ...editing, [field]: e.target.value } as Week)} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 20, display: 'flex', gap: 10 }}>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
              <button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
