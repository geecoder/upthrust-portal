'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { ASSIGNMENT_STATUS_COLOR, ASSIGNMENT_STATUS_BG } from '@/lib/types';
import type { Assignment, Learner, Week } from '@/lib/types';
import Link from 'next/link';

export default function AdminReviewsPage() {
  const [learners, setLearners] = useState<Learner[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [selected, setSelected] = useState<Assignment | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'resubmission'>('pending');
  const [score, setScore] = useState('');
  const [feedback, setFeedback] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const db = createBrowserClient();

  useEffect(() => { load(); }, []);

  async function load() {
    const res = await fetch('/api/admin/data?resource=review_queue');
    const data = await res.json();
    if (res.ok) {
      setLearners((data.learners || []) as Learner[]);
      setAssignments((data.assignments || []) as Assignment[]);
      setWeeks((data.weeks || []) as Week[]);
    }
  }

  function getLearner(id: string) { return learners.find(l => l.id === id); }
  function getWeek(n: number) { return weeks.find(w => w.week_number === n); }

  const filtered = assignments.filter(a => {
    if (filter === 'pending') return a.status === 'Submitted' || a.status === 'AI Reviewed';
    if (filter === 'resubmission') return a.status === 'Resubmission Requested';
    return a.status !== 'Not Started';
  });

  async function submitFeedback(status: 'Human Reviewed' | 'Resubmission Requested' | 'Approved' | 'Portfolio Ready') {
    if (!selected) return;
    setSaving(true);
    const res = await fetch('/api/admin/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'review_feedback',
        assignmentId: selected.id,
        status,
        score: score ? parseFloat(score) : null,
        feedback,
      }),
    });
    if (!res.ok) { const e = await res.json(); alert(e.error || 'Could not save feedback.'); setSaving(false); return; }

    // Send email (non-blocking) — in-portal notification already created by the API
    if (status !== 'Human Reviewed') {
      fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: status === 'Resubmission Requested' ? 'resubmission_required' : 'feedback_ready',
          learnerId: selected.learner_id,
          assignmentId: selected.id,
        }),
      }).catch(console.error);
    }

    await load();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    setSaving(false);
    setSelected(null);
    setScore('');
    setFeedback('');
  }

  const selectedLearner = selected ? getLearner(selected.learner_id) : null;
  const selectedWeek = selected ? getWeek(selected.week_number) : null;
  const rubric = selected
    ? (selected.pathway === 'PM' ? selectedWeek?.pm_rubric : selectedWeek?.ba_rubric)
    : null;

  const hoursAgo = (dateStr?: string) => {
    if (!dateStr) return null;
    return Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60));
  };

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Review Queue & Feedback</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>Review submissions, add scores and feedback, approve for portfolio.</p>
      </div>

      {saved && (
        <div style={{ padding: '12px 16px', background: 'rgba(5,150,105,0.1)', border: '1px solid rgba(5,150,105,0.3)', borderRadius: 6, marginBottom: 16, color: 'var(--moss)', fontWeight: 600 }}>
          ✓ Feedback saved and learner notified
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, alignItems: 'start' }}>

        {/* LEFT: submission list */}
        <div className="card" style={{ padding: 0 }}>
          {/* Filter tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--paper-line)' }}>
            {([['pending', 'Pending'], ['resubmission', 'Resubmissions'], ['all', 'All']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setFilter(val)} style={{
                flex: 1, padding: '12px 8px', border: 'none', cursor: 'pointer',
                background: filter === val ? 'var(--paper-soft)' : 'transparent',
                fontWeight: filter === val ? 700 : 400,
                fontSize: '0.8125rem', color: filter === val ? 'var(--ink)' : 'var(--ink-muted)',
                borderBottom: filter === val ? '2px solid var(--ink)' : '2px solid transparent',
              }}>
                {label}
                <span style={{ marginLeft: 5, fontSize: '0.6875rem', fontWeight: 700, color: filter === val ? 'var(--amber-deep)' : 'var(--ink-muted)' }}>
                  ({val === 'pending' ? assignments.filter(a => a.status === 'Submitted' || a.status === 'AI Reviewed').length
                    : val === 'resubmission' ? assignments.filter(a => a.status === 'Resubmission Requested').length
                    : assignments.filter(a => a.status !== 'Not Started').length})
                </span>
              </button>
            ))}
          </div>

          {/* Submission list */}
          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ink-muted)' }}>
                <p style={{ fontSize: '1.5rem', marginBottom: 8 }}>✓</p>
                <p>No {filter === 'pending' ? 'pending reviews' : filter === 'resubmission' ? 'resubmissions' : 'submissions'}</p>
              </div>
            ) : filtered.map(a => {
              const learner = getLearner(a.learner_id);
              const hours = hoursAgo(a.submitted_at);
              const overdue = hours !== null && hours > 48 && (a.status === 'Submitted' || a.status === 'AI Reviewed');
              const isSelected = selected?.id === a.id;
              return (
                <button key={a.id} onClick={() => { setSelected(a); setFeedback(a.feedback || ''); setScore(a.score?.toString() || ''); setSaved(false); }}
                  style={{
                    display: 'block', width: '100%', textAlign: 'left', padding: '14px 16px',
                    borderBottom: '1px solid var(--paper-line)', cursor: 'pointer',
                    background: isSelected ? 'var(--paper-soft)' : overdue ? 'rgba(220,38,38,0.03)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--ink)' : `3px solid ${overdue ? 'var(--red)' : 'transparent'}`,
                    border: 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                      {learner?.first_name} {learner?.last_name}
                    </p>
                    {a.score && <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', color: 'var(--amber-deep)' }}>{a.score}/100</span>}
                  </div>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginBottom: 5 }}>
                    Week {a.week_number} · {a.pathway}
                  </p>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 100, background: ASSIGNMENT_STATUS_BG[a.status], color: ASSIGNMENT_STATUS_COLOR[a.status] }}>
                      {a.status}
                    </span>
                    {hours !== null && (
                      <span style={{ fontSize: '0.6875rem', color: overdue ? 'var(--red)' : 'var(--ink-muted)', fontWeight: overdue ? 700 : 400 }}>
                        {overdue ? `⚠ ${hours}h — overdue` : `${hours}h ago`}
                      </span>
                    )}
                    {a.ai_feedback && <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '1px 5px', background: 'rgba(124,58,237,0.1)', color: '#7C3AED', borderRadius: 3 }}>AI ✓</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* RIGHT: review panel */}
        {!selected ? (
          <div style={{ padding: '48px', textAlign: 'center', background: 'var(--white)', border: '1px solid var(--paper-line)', borderRadius: 8 }}>
            <p style={{ fontSize: '2rem', marginBottom: 12 }}>📬</p>
            <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: 8 }}>Select a submission to review</p>
            <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>Choose any submission from the queue on the left. You'll see the learner's work, AI feedback, and the rubric side by side.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Header */}
            <div className="card" style={{ borderTop: '3px solid var(--ink)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 4 }}>
                    Reviewing
                  </p>
                  <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem', fontWeight: 500 }}>
                    {selectedLearner?.first_name} {selectedLearner?.last_name}
                  </h2>
                  <p style={{ color: 'var(--ink-muted)', marginTop: 2 }}>
                    Week {selected.week_number} — {selected.pathway} · {selectedWeek?.title}
                  </p>
                  {selected.pathway === 'PM' ? (
                    <p style={{ color: 'var(--amber-deep)', fontWeight: 600, fontSize: '0.875rem', marginTop: 4 }}>{selectedWeek?.pm_assignment_title}</p>
                  ) : (
                    <p style={{ color: 'var(--amber-deep)', fontWeight: 600, fontSize: '0.875rem', marginTop: 4 }}>{selectedWeek?.ba_assignment_title}</p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {selected.submission_url && (
                    <a href={selected.submission_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                      Open Submission →
                    </a>
                  )}
                </div>
              </div>
              {selected.submission_notes && (
                <div style={{ marginTop: 14, padding: '10px 14px', background: 'var(--paper-soft)', borderRadius: 4, borderLeft: '2px solid var(--amber)' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--amber-deep)', marginBottom: 4 }}>Learner's note</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)' }}>{selected.submission_notes}</p>
                </div>
              )}
            </div>

            {/* AI Feedback */}
            {selected.ai_feedback && (
              <div className="card" style={{ borderLeft: '3px solid #7C3AED' }}>
                <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C3AED', marginBottom: 12 }}>
                  ⚡ AI First-Pass Feedback {selected.ai_score ? `· AI Score: ${selected.ai_score}/100` : ''}
                </p>
                <div style={{ fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--ink-soft)', whiteSpace: 'pre-wrap' }}
                  dangerouslySetInnerHTML={{ __html: selected.ai_feedback.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                />
                {selected.ai_quality_rating && (
                  <div style={{ marginTop: 12, display: 'inline-block', padding: '4px 10px', borderRadius: 100, background: selected.ai_quality_rating === 'Portfolio Ready' ? 'rgba(5,150,105,0.1)' : selected.ai_quality_rating === 'Good' ? 'rgba(37,99,235,0.1)' : 'rgba(217,119,6,0.1)', color: selected.ai_quality_rating === 'Portfolio Ready' ? 'var(--moss)' : selected.ai_quality_rating === 'Good' ? '#1D4ED8' : 'var(--amber-deep)', fontSize: '0.75rem', fontWeight: 700 }}>
                    AI Rating: {selected.ai_quality_rating}
                  </div>
                )}
              </div>
            )}

            {/* Rubric */}
            {rubric && (
              <div className="card" style={{ background: 'var(--paper-soft)' }}>
                <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 10 }}>Assessment Rubric</p>
                <div style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>{rubric}</div>
              </div>
            )}

            {/* Your feedback */}
            <div className="card">
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 14 }}>Your Human Feedback</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: 14, marginBottom: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Feedback *</label>
                  <textarea className="form-input form-textarea" style={{ minHeight: 140 }} value={feedback}
                    onChange={e => setFeedback(e.target.value)}
                    placeholder="Be specific — name what was done well, what needs improvement, and the exact change to make..." />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Score /100</label>
                  <input className="form-input" type="number" min="0" max="100" value={score}
                    onChange={e => setScore(e.target.value)}
                    placeholder="75" style={{ marginBottom: 12 }} />
                  <label className="form-label" style={{ marginTop: 8 }}>Previous</label>
                  <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
                    {selected.score ? `${selected.score}/100` : 'Not scored'}
                  </p>
                  {selected.resubmission_count ? (
                    <p style={{ fontSize: '0.75rem', color: 'var(--amber-deep)', marginTop: 6 }}>Resubmission #{selected.resubmission_count}</p>
                  ) : null}
                </div>
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: 14 }}>
                Feedback standard: Name what worked, name what needs to change with a specific example, and suggest the next action.
              </p>

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button onClick={() => submitFeedback('Approved')} disabled={!feedback || saving}
                  className="btn btn-primary" style={{ background: 'var(--moss)' }}>
                  ✓ Approve
                </button>
                <button onClick={() => submitFeedback('Portfolio Ready')} disabled={!feedback || saving}
                  className="btn btn-primary" style={{ background: 'var(--amber-deep)' }}>
                  ⭐ Approve + Portfolio Ready
                </button>
                <button onClick={() => submitFeedback('Resubmission Requested')} disabled={!feedback || saving}
                  className="btn btn-outline">
                  ↩ Request Resubmission
                </button>
                <button onClick={() => submitFeedback('Human Reviewed')} disabled={!feedback || saving}
                  className="btn btn-ghost">
                  Save Draft
                </button>
              </div>
              {saving && <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: 10 }}>Saving and notifying learner...</p>}
            </div>

            {/* Previous feedback history */}
            {selected.feedback && (
              <div className="card" style={{ background: 'var(--paper-soft)' }}>
                <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 10 }}>
                  Previous Feedback {selected.score ? `· ${selected.score}/100` : ''}
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.65, fontStyle: 'italic' }}>
                  "{selected.feedback}"
                </p>
                {selected.feedback_at && (
                  <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginTop: 8 }}>
                    {new Date(selected.feedback_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
