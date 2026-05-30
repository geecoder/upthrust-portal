'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Week } from '@/lib/types';
import { PHASE_COLORS, WEEK_DATES } from '@/lib/types';

const EDITABLE_FIELDS = [
  { key: 'why_it_matters',      label: 'Why This Week Matters',       type: 'textarea', hint: 'Shown at top of the week page. Motivates learners to engage.' },
  { key: 'pre_work',            label: 'Pre-Work / Preparation',       type: 'textarea', hint: 'What learners should do before the Saturday session.' },
  { key: 'outcomes',            label: 'Learning Outcomes',            type: 'textarea', hint: 'Comma-separated list. "By end of this week you can..."' },
  { key: 'learning_goals',      label: 'Learning Goals (detail)',      type: 'textarea', hint: 'Detailed goals shown in the week page header.' },
  { key: 'concept_topics',      label: 'Concept Class Topics',         type: 'textarea', hint: 'Topics covered in the live session.' },
  { key: 'case_study',          label: 'Case Study / Scenario',        type: 'textarea', hint: 'Grounding scenario used in the session.' },
  { key: 'lab_exercise',        label: 'Practical Lab Exercise',       type: 'textarea', hint: 'What learners do during the lab portion.' },
  { key: 'pm_assignment_title', label: 'PM Assignment Title',          type: 'text', hint: '' },
  { key: 'pm_assignment_brief', label: 'PM Assignment Brief',          type: 'textarea', hint: 'Full brief shown to PM learners on the assignments page.' },
  { key: 'pm_deliverable',      label: 'PM Deliverable',               type: 'text', hint: 'e.g. "Full PRD (Google Doc)"' },
  { key: 'pm_due_date',         label: 'PM Due Date',                  type: 'date', hint: '' },
  { key: 'ba_assignment_title', label: 'BA Assignment Title',          type: 'text', hint: '' },
  { key: 'ba_assignment_brief', label: 'BA Assignment Brief',          type: 'textarea', hint: 'Full brief shown to BA learners on the assignments page.' },
  { key: 'ba_deliverable',      label: 'BA Deliverable',               type: 'text', hint: 'e.g. "Full BRD (Google Doc)"' },
  { key: 'ba_due_date',         label: 'BA Due Date',                  type: 'date', hint: '' },
  { key: 'reflection_prompt',   label: 'Reflection Prompt',            type: 'textarea', hint: 'End-of-week reflection question.' },
  { key: 'recording_url',       label: 'Session Recording URL',        type: 'text', hint: 'Added after the session. Paste YouTube or Google Drive link.' },
  { key: 'session_slides_url',  label: 'Session Slides URL',           type: 'text', hint: 'Google Slides or PDF link.' },
  { key: 'zoom_link',           label: 'Zoom Session Link',            type: 'text', hint: 'The recurring Zoom link for this session.' },
];

export default function ContentPage() {
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [editing, setEditing] = useState<Week | null>(null);
  const [activeSection, setActiveSection] = useState<'session' | 'pm' | 'ba' | 'meta'>('session');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [search, setSearch] = useState('');

  const db = createBrowserClient();

  useEffect(() => { load(); }, []);

  async function load() {
    const { data } = await db.from('weeks').select('*').order('week_number');
    setWeeks((data || []) as Week[]);
  }

  async function handleSave() {
    if (!editing) return;
    setSaving(true);
    const res = await fetch('/api/admin/save-week', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Could not save: ${err.error || 'Unknown error'}`);
      setSaving(false);
      return;
    }
    await load();
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  }

  async function togglePublish(week: Week) {
    const res = await fetch('/api/admin/publish-week', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekId: week.id, isPublished: !week.is_published }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Could not ${week.is_published ? 'unpublish' : 'publish'} week: ${err.error || 'Unknown error'}`);
      return;
    }
    await load();
  }

  const filtered = weeks.filter(w =>
    !search ||
    w.title?.toLowerCase().includes(search.toLowerCase()) ||
    w.phase?.toLowerCase().includes(search.toLowerCase()) ||
    w.week_number.toString().includes(search)
  );

  const SESSION_FIELDS = EDITABLE_FIELDS.filter(f =>
    ['why_it_matters', 'pre_work', 'outcomes', 'learning_goals', 'concept_topics', 'case_study', 'lab_exercise', 'reflection_prompt'].includes(f.key)
  );
  const PM_FIELDS = EDITABLE_FIELDS.filter(f => f.key.startsWith('pm_'));
  const BA_FIELDS = EDITABLE_FIELDS.filter(f => f.key.startsWith('ba_'));
  const META_FIELDS = EDITABLE_FIELDS.filter(f =>
    ['recording_url', 'session_slides_url', 'zoom_link'].includes(f.key)
  );

  const sectionFields = activeSection === 'session' ? SESSION_FIELDS
    : activeSection === 'pm' ? PM_FIELDS
    : activeSection === 'ba' ? BA_FIELDS
    : META_FIELDS;

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Manage Weekly Content</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
          Publish weeks when ready. Edit session content, assignment briefs, and URLs. Learners only see published weeks.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center' }}>
        <input className="form-input" style={{ maxWidth: 300 }} placeholder="Filter weeks..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>
            {weeks.filter(w => w.is_published).length}/{weeks.length} published
          </span>
        </div>
      </div>

      {/* Phase legend */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['Foundation', '#0F1A2E'], ['Core Skills', '#A05A26'], ['Delivery', '#4F6A4A'], ['Capstone', '#C5743A']].map(([phase, color]) => (
          <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            {phase}
          </div>
        ))}
      </div>

      {/* Week list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map(week => {
          const color = PHASE_COLORS[week.phase || 'Foundation'];
          const weekDate = WEEK_DATES.find(w => w.week === week.week_number);
          const hasPMBrief = !!(week.pm_assignment_brief);
          const hasBABrief = !!(week.ba_assignment_brief);
          const hasRecording = !!(week.recording_url);
          const completeness = [
            week.why_it_matters, week.outcomes, week.pre_work,
            week.pm_assignment_brief, week.ba_assignment_brief,
          ].filter(Boolean).length;

          return (
            <div key={week.id} className="card" style={{
              borderLeft: `4px solid ${color}`,
              padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                      Week {week.week_number} · {week.phase}
                    </span>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 2, background: week.is_published ? 'rgba(79,106,74,0.1)' : 'rgba(15,26,46,0.06)', color: week.is_published ? 'var(--moss)' : 'var(--ink-muted)' }}>
                      {week.is_published ? '✓ Published' : 'Draft'}
                    </span>
                    {/* Content completeness indicators */}
                    <div style={{ display: 'flex', gap: 4 }}>
                      {[
                        { done: !!week.why_it_matters, label: 'Why' },
                        { done: hasPMBrief, label: 'PM' },
                        { done: hasBABrief, label: 'BA' },
                        { done: hasRecording, label: 'Rec' },
                      ].map(({ done, label }) => (
                        <span key={label} style={{ fontSize: '0.5rem', fontWeight: 800, padding: '1px 5px', borderRadius: 2, letterSpacing: '0.1em', background: done ? 'rgba(5,150,105,0.1)' : 'rgba(107,114,128,0.08)', color: done ? 'var(--moss)' : 'var(--ink-muted)' }}>
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.0625rem', fontWeight: 500, marginBottom: 3 }}>{week.title}</h3>
                  {weekDate && <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{weekDate.session}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <button className="btn btn-sm btn-outline" onClick={() => { setEditing({ ...week }); setActiveSection('session'); }}>
                    Edit Content
                  </button>
                  <button
                    className={`btn btn-sm ${week.is_published ? 'btn-ghost' : 'btn-primary'}`}
                    onClick={() => togglePublish(week)}
                  >
                    {week.is_published ? 'Unpublish' : 'Publish →'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="empty-state">
            <p style={{ color: 'var(--ink-muted)' }}>No weeks match your filter.</p>
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editing && (
        <div className="modal-overlay">
          <div style={{ background: 'var(--white)', borderRadius: 8, width: '100%', maxWidth: 760, maxHeight: '90vh', overflow: 'auto', padding: 0, boxShadow: '0 24px 48px -12px rgba(15,26,46,0.25)' }}>
            {/* Modal header */}
            <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--paper-line)', position: 'sticky', top: 0, background: 'var(--white)', zIndex: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 4 }}>
                    Editing
                  </p>
                  <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem', fontWeight: 500 }}>
                    Week {editing.week_number} — {editing.title}
                  </h2>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {saved && <span style={{ fontSize: '0.875rem', color: 'var(--moss)', fontWeight: 600 }}>✓ Saved</span>}
                  <button onClick={handleSave} disabled={saving} className="btn btn-primary btn-sm">
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">Close</button>
                </div>
              </div>

              {/* Section tabs */}
              <div style={{ display: 'flex', gap: 0, marginTop: 16, borderBottom: '1px solid var(--paper-line)' }}>
                {([
                  ['session', 'Session Content'],
                  ['pm', 'PM Assignment'],
                  ['ba', 'BA Assignment'],
                  ['meta', 'Links & URLs'],
                ] as const).map(([id, label]) => (
                  <button key={id} onClick={() => setActiveSection(id)} style={{
                    padding: '8px 16px', border: 'none', cursor: 'pointer', background: 'transparent',
                    fontSize: '0.875rem', fontWeight: activeSection === id ? 700 : 400,
                    color: activeSection === id ? 'var(--ink)' : 'var(--ink-muted)',
                    borderBottom: activeSection === id ? '2px solid var(--ink)' : '2px solid transparent',
                    transition: 'all 150ms',
                  }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Fields */}
            <div style={{ padding: '24px 32px 32px', display: 'flex', flexDirection: 'column', gap: 18 }}>
              {sectionFields.map(({ key, label, type, hint }) => (
                <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">{label}</label>
                  {hint && <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: 6 }}>{hint}</p>}
                  {type === 'textarea' ? (
                    <textarea
                      className="form-input form-textarea"
                      style={{ minHeight: key.includes('brief') ? 140 : 80 }}
                      value={(editing as any)[key] || ''}
                      onChange={e => setEditing({ ...editing, [key]: e.target.value } as Week)}
                      placeholder={`Enter ${label.toLowerCase()}...`}
                    />
                  ) : type === 'date' ? (
                    <input
                      className="form-input"
                      type="date"
                      value={(editing as any)[key] || ''}
                      onChange={e => setEditing({ ...editing, [key]: e.target.value } as Week)}
                    />
                  ) : (
                    <input
                      className="form-input"
                      type={type === 'text' && key.includes('url') ? 'url' : 'text'}
                      value={(editing as any)[key] || ''}
                      onChange={e => setEditing({ ...editing, [key]: e.target.value } as Week)}
                      placeholder={key.includes('url') ? 'https://...' : `Enter ${label.toLowerCase()}...`}
                    />
                  )}
                </div>
              ))}

              <div style={{ paddingTop: 8, borderTop: '1px solid var(--paper-line)', display: 'flex', gap: 10 }}>
                <button onClick={handleSave} disabled={saving} className="btn btn-primary">
                  {saving ? 'Saving...' : 'Save All Changes'}
                </button>
                <button onClick={() => setEditing(null)} className="btn btn-ghost">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
