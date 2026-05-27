'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import type { Learner, Assignment, Week } from '@/lib/types';
import Link from 'next/link';

export default function AdminLearnerPage() {
  const { learnerId } = useParams();
  const [learner, setLearner] = useState<Learner | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [scoreText, setScoreText] = useState('');
  const [saving, setSaving] = useState(false);

  const db = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data: l } = await db.from('learners').select('*').eq('id', learnerId).single();
      setLearner(l);
      const { data: a } = await db.from('assignments').select('*').eq('learner_id', learnerId).order('week_number');
      setAssignments(a || []);
      const { data: w } = await db.from('weeks').select('*').eq('is_published', true).order('week_number');
      setWeeks(w || []);
    }
    load();
  }, [learnerId]);

  async function updateLearnerField(field: string, value: any) {
    await db.from('learners').update({ [field]: value }).eq('id', learnerId as string);
    const { data: l } = await db.from('learners').select('*').eq('id', learnerId).single();
    setLearner(l);
  }

  async function submitFeedback(assignmentId: string) {
    setSaving(true);
    await db.from('assignments').update({
      feedback: feedbackText,
      score: scoreText ? parseFloat(scoreText) : null,
      feedback_by: 'Genesis',
      feedback_at: new Date().toISOString(),
      status: 'In Review',
    }).eq('id', assignmentId);
    const { data: a } = await db.from('assignments').select('*').eq('learner_id', learnerId).order('week_number');
    setAssignments(a || []);
    setEditing(null);
    setFeedbackText('');
    setScoreText('');
    setSaving(false);
  }

  async function approveAssignment(assignmentId: string) {
    await db.from('assignments').update({ status: 'Approved' }).eq('id', assignmentId);
    const { data: a } = await db.from('assignments').select('*').eq('learner_id', learnerId).order('week_number');
    setAssignments(a || []);
  }

  if (!learner) return <div className="portal-content"><p>Loading...</p></div>;

  return (
    <div className="portal-content">
      <Link href="/admin" style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', display: 'inline-flex', gap: 6, marginBottom: 20 }}>← All Learners</Link>

      {/* Learner header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>{learner.first_name} {learner.last_name}</h1>
          <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>{learner.email} · {learner.pathway} · {learner.tier} · {learner.country}</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select defaultValue={learner.risk_status} onChange={e => updateLearnerField('risk_status', e.target.value)} className="form-input" style={{ padding: '8px 12px' }}>
            <option value="Green">🟢 Green</option>
            <option value="Amber">🟡 Amber</option>
            <option value="Red">🔴 Red</option>
          </select>
          <select defaultValue={learner.passport_eligibility} onChange={e => updateLearnerField('passport_eligibility', e.target.value)} className="form-input" style={{ padding: '8px 12px' }}>
            <option value="Not Eligible">Passport: Not Eligible</option>
            <option value="Pending Review">Passport: Pending Review</option>
            <option value="Approved">Passport: Approved</option>
            <option value="Withheld">Passport: Withheld</option>
          </select>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Attendance', value: `${learner.attendance_pct || 0}%`, editable: 'attendance_pct', type: 'number' },
          { label: 'Completion', value: `${learner.assignment_completion_pct || 0}%` },
          { label: 'Avg Score', value: learner.avg_score ? `${learner.avg_score}/100` : '—' },
          { label: 'Passport', value: learner.passport_issued ? '✓ Issued' : learner.passport_eligibility || 'Not Eligible' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.5rem', fontWeight: 500, lineHeight: 1 }}>{stat.value}</p>
            <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-muted)', marginTop: 6 }}>{stat.label}</p>
            {stat.editable && (
              <input type={stat.type || 'text'} defaultValue={stat.value.replace('%', '')} className="form-input" style={{ marginTop: 8, textAlign: 'center', padding: '4px 8px' }}
                onBlur={e => updateLearnerField(stat.editable!, parseFloat(e.target.value))} />
            )}
          </div>
        ))}
      </div>

      {/* Assignments */}
      <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500, marginBottom: 16 }}>Assignments & Feedback</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {assignments.map(a => {
          const week = weeks.find(w => w.week_number === a.week_number);
          const isEditing = editing === a.id;
          return (
            <div key={a.id} className="card" style={{ borderLeft: `3px solid ${a.status === 'Approved' ? 'var(--moss)' : a.status === 'Submitted' ? 'var(--amber)' : 'var(--paper-line)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: a.submission_url || a.feedback ? 12 : 0 }}>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Week {a.week_number} — {a.pathway}: {week?.title || ''}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 2 }}>Status: {a.status} {a.score ? `· Score: ${a.score}/100` : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {a.submission_url && <a href={a.submission_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline">View Work</a>}
                  {a.status === 'Submitted' && <button className="btn btn-sm btn-amber" onClick={() => { setEditing(a.id); setFeedbackText(a.feedback || ''); setScoreText(a.score?.toString() || ''); }}>Give Feedback</button>}
                  {a.status === 'Human Reviewed' && <button className="btn btn-sm btn-primary" onClick={() => approveAssignment(a.id)}>Approve</button>}
                </div>
              </div>

              {a.feedback && !isEditing && (
                <div style={{ padding: '10px 12px', background: 'var(--paper-soft)', borderRadius: 4 }}>
                  <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--amber-deep)', marginBottom: 4 }}>Your Feedback</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', fontStyle: 'italic' }}>{a.feedback}</p>
                </div>
              )}

              {isEditing && (
                <div style={{ marginTop: 12, padding: 16, background: 'var(--paper-soft)', borderRadius: 6 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, marginBottom: 12 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Feedback</label>
                      <textarea className="form-input form-textarea" style={{ minHeight: 100 }} value={feedbackText} onChange={e => setFeedbackText(e.target.value)} placeholder="Be specific — name what was done well and what needs to improve..." />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Score /100</label>
                      <input className="form-input" type="number" min="0" max="100" value={scoreText} onChange={e => setScoreText(e.target.value)} placeholder="75" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" disabled={!feedbackText || saving} onClick={() => submitFeedback(a.id)}>
                      {saving ? 'Saving...' : 'Submit Feedback'}
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {assignments.length === 0 && <p style={{ color: 'var(--ink-muted)', padding: '24px 0' }}>No assignments submitted yet.</p>}
      </div>

      {/* Notes */}
      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500, marginBottom: 12 }}>Genesis Notes</h2>
        <textarea className="form-input form-textarea" defaultValue={learner.notes || ''} style={{ minHeight: 100 }}
          onBlur={e => updateLearnerField('notes', e.target.value)} placeholder="Private notes about this learner..." />
      </div>
    </div>
  );
}
