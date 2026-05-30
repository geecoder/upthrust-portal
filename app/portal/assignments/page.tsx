'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';
import type { Week } from '@/lib/types';
import { ASSIGNMENT_STATUS_COLOR, ASSIGNMENT_STATUS_BG } from '@/lib/types';

interface Assignment {
  id: string;
  learner_id: string;
  week_number: number;
  pathway: string;
  submission_url?: string;
  submission_notes?: string;
  submitted_at?: string;
  status: string;
  score?: number;
  feedback?: string;
  feedback_by?: string;
  feedback_at?: string;
  ai_feedback?: string;
  ai_feedback_at?: string;
  is_portfolio_ready?: boolean;
  portfolio_approved?: boolean;
  resubmission_count?: number;
}

const STATUS_COLOR: Record<string, string> = {
  'Not Started': 'var(--ink-muted)',
  'In Progress': 'var(--amber-deep)',
  'Submitted': '#1D4ED8',
  'AI Reviewed': '#7C3AED',
  'Human Reviewed': '#1D4ED8',
  'Resubmission Requested': 'var(--red)',
  'Approved': 'var(--moss)',
  'Portfolio Ready': '#047857',
};

const STATUS_BG: Record<string, string> = {
  'Not Started': 'rgba(107,114,128,0.08)',
  'In Progress': 'rgba(217,119,6,0.08)',
  'Submitted': 'rgba(37,99,235,0.08)',
  'AI Reviewed': 'rgba(124,58,237,0.08)',
  'Human Reviewed': 'rgba(29,78,216,0.08)',
  'Resubmission Requested': 'rgba(179,56,44,0.08)',
  'Approved': 'rgba(5,150,105,0.08)',
  'Portfolio Ready': 'rgba(4,120,87,0.1)',
};

export default function AssignmentsPage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [activeWeek, setActiveWeek] = useState<number | null>(null);
  const [submitUrl, setSubmitUrl] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [urlError, setUrlError] = useState('');

  const db = createBrowserClient();

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: l } = await db.from('learners').select('*').eq('clerk_user_id', user!.id).maybeSingle();
      setLearner(l);
      if (!l) { setLoading(false); return; }
      const [{ data: a }, { data: w }] = await Promise.all([
        db.from('assignments').select('*').eq('learner_id', l.id).order('week_number'),
        db.from('weeks').select('*').eq('is_published', true).order('week_number'),
      ]);
      setAssignments((a || []) as Assignment[]);
      setWeeks((w || []) as Week[]);
      setLoading(false);
    }
    load();
  }, [user]);

  async function reload() {
    if (!learner) return;
    const { data: a } = await db.from('assignments').select('*').eq('learner_id', learner.id).order('week_number');
    setAssignments((a || []) as Assignment[]);
  }

  function validateUrl(url: string): boolean {
    try { new URL(url); return true; } catch { return false; }
  }

  async function handleSubmit(weekNumber: number, pathway: string) {
    setUrlError('');
    if (!learner) return;
    if (!submitUrl.trim()) { setUrlError('Please paste a link to your work.'); return; }
    if (!validateUrl(submitUrl.trim())) { setUrlError('That doesn\'t look like a valid URL. Make sure it starts with https://'); return; }

    setSubmitting(true);
    const week = weeks.find(w => w.week_number === weekNumber);
    const assignTitle = pathway === 'PM' ? week?.pm_assignment_title : week?.ba_assignment_title;
    const existing = assignments.find(a => a.week_number === weekNumber && a.pathway === pathway);

    const payload: any = {
      learner_id: learner.id,
      week_number: weekNumber,
      pathway,
      submission_url: submitUrl.trim(),
      submission_notes: submitNotes.trim() || null,
      status: 'Submitted',
      submitted_at: new Date().toISOString(),
      resubmission_count: existing ? (existing.resubmission_count || 0) + (existing.status === 'Resubmission Requested' ? 1 : 0) : 0,
    };

    let newAssignment: Assignment | null = null;
    if (existing) {
      const { data } = await db.from('assignments').update(payload).eq('id', existing.id).select().maybeSingle();
      newAssignment = data as Assignment;
    } else {
      const { data } = await db.from('assignments').insert(payload).select().maybeSingle();
      newAssignment = data as Assignment;
    }

    await reload();
    setSubmitUrl('');
    setSubmitNotes('');
    setActiveWeek(null);
    setSubmitting(false);

    // Trigger AI feedback non-blocking
    if (newAssignment?.id) {
      setGeneratingAI(newAssignment.id);
      try {
        await fetch('/api/ai-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignmentId: newAssignment.id,
            submissionUrl: submitUrl.trim(),
            weekNumber,
            pathway,
            assignmentTitle: assignTitle || '',
          }),
        });
        await reload();
      } catch (err) {
        console.error('AI feedback failed:', err);
      } finally {
        setGeneratingAI(null);
      }
    }
  }

  const pathway = learner?.pathway === 'BA' ? 'BA' : 'PM';

  // Summary stats
  const submitted = assignments.filter(a => a.status !== 'Not Started').length;
  const approved = assignments.filter(a => a.status === 'Approved' || a.status === 'Portfolio Ready' || a.portfolio_approved).length;
  const needsResubmission = assignments.filter(a => a.status === 'Resubmission Requested').length;
  const pendingFeedback = assignments.filter(a => a.status === 'Submitted' || a.status === 'AI Reviewed').length;

  return (
    <div className="portal-content">
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>
          My Work
        </p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>
          Assignments
        </h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
          Submit your work below. You'll get AI feedback instantly — Genesis reviews within 48 hours.
        </p>
      </div>

      {/* Resubmission alert */}
      {needsResubmission > 0 && (
        <div style={{ padding: '14px 18px', background: 'rgba(179,56,44,0.07)', border: '1px solid rgba(179,56,44,0.25)', borderRadius: 6, borderLeft: '3px solid var(--red)', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontWeight: 700, color: 'var(--red)' }}>
              ↩ {needsResubmission} assignment{needsResubmission > 1 ? 's' : ''} need resubmission
            </p>
            <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: 2 }}>
              Read Genesis's feedback and resubmit within 72 hours to protect your Passport eligibility.
            </p>
          </div>
        </div>
      )}

      {/* Stats row */}
      {!loading && weeks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Submitted', value: submitted, color: '#1D4ED8' },
            { label: 'Pending Feedback', value: pendingFeedback, color: 'var(--amber-deep)' },
            { label: 'Approved', value: approved, color: 'var(--moss)' },
            { label: 'Total Weeks', value: weeks.length, color: 'var(--ink-muted)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center', padding: '14px' }}>
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 500, color: s.color, lineHeight: 1 }}>{s.value}</p>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--ink-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ color: 'var(--ink-muted)' }}>Loading your assignments...</p>
        </div>
      )}

      {/* No weeks published yet */}
      {!loading && weeks.length === 0 && (
        <div className="empty-state">
          <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>📅</p>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: 8 }}>
            No content published yet
          </p>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            Week 0 content will appear here when Genesis publishes it before June 6.
            Check back on program start day.
          </p>
        </div>
      )}

      {/* Assignment cards */}
      {!loading && weeks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {weeks.map(week => {
            const assignTitle   = pathway === 'PM' ? week.pm_assignment_title   : week.ba_assignment_title;
            const assignBrief   = pathway === 'PM' ? week.pm_assignment_brief   : week.ba_assignment_brief;
            const assignDue     = pathway === 'PM' ? week.pm_due_date           : week.ba_due_date;
            const assignDeliv   = pathway === 'PM' ? week.pm_deliverable        : week.ba_deliverable;
            const myAssignment  = assignments.find(a => a.week_number === week.week_number && a.pathway === pathway);
            const status        = myAssignment?.status || 'Not Started';
            const isExpanded    = activeWeek === week.week_number;
            const isGenerating  = generatingAI === myAssignment?.id;
            const isOverdue     = assignDue && new Date(assignDue) < new Date() && status === 'Not Started';
            const canSubmit     = status !== 'Approved' && status !== 'Portfolio Ready';

            return (
              <div key={week.week_number} className="card" style={{
                borderLeft: `3px solid ${STATUS_COLOR[status] || 'var(--paper-line)'}`,
                padding: '18px 20px',
              }}>

                {/* Card header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Week label + status badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                        Week {week.week_number} · {week.phase}
                      </span>
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 100, background: STATUS_BG[status] || 'rgba(15,26,46,0.06)', color: STATUS_COLOR[status] || 'var(--ink-muted)' }}>
                        {status}
                      </span>
                      {isOverdue && (
                        <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 100, background: 'rgba(179,56,44,0.1)', color: 'var(--red)' }}>
                          Overdue
                        </span>
                      )}
                    </div>

                    {/* Week title */}
                    <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.0625rem', fontWeight: 500, marginBottom: assignTitle ? 4 : 0 }}>
                      {week.title}
                    </h3>

                    {/* Assignment title — always show even if null */}
                    <p style={{ fontSize: '0.875rem', color: assignTitle ? 'var(--amber-deep)' : 'var(--ink-muted)', fontWeight: assignTitle ? 600 : 400, fontStyle: assignTitle ? 'normal' : 'italic' }}>
                      {assignTitle || 'Assignment brief coming soon'}
                    </p>

                    {/* Due date + deliverable */}
                    <div style={{ display: 'flex', gap: 12, marginTop: 5, flexWrap: 'wrap' }}>
                      {assignDue && (
                        <p style={{ fontSize: '0.75rem', color: isOverdue ? 'var(--red)' : 'var(--ink-muted)', fontWeight: isOverdue ? 600 : 400 }}>
                          {isOverdue ? '⚠ Due ' : 'Due '}
                          {new Date(assignDue).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                      )}
                      {assignDeliv && (
                        <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>· {assignDeliv}</p>
                      )}
                    </div>
                  </div>

                  {/* Right side: score + action button */}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {myAssignment?.score && (
                      <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', color: myAssignment.score >= 70 ? 'var(--moss)' : 'var(--amber-deep)', fontWeight: 500 }}>
                        {myAssignment.score}/100
                      </span>
                    )}
                    {canSubmit && assignTitle && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={() => {
                          setActiveWeek(isExpanded ? null : week.week_number);
                          setSubmitUrl(myAssignment?.submission_url || '');
                          setSubmitNotes('');
                          setUrlError('');
                        }}
                      >
                        {isExpanded ? 'Cancel'
                          : status === 'Not Started' ? 'Submit Work'
                          : status === 'Resubmission Requested' ? '↩ Resubmit'
                          : 'Update Submission'}
                      </button>
                    )}
                    {(status === 'Approved' || status === 'Portfolio Ready') && (
                      <span style={{ fontSize: '0.875rem', color: 'var(--moss)', fontWeight: 700 }}>✓ Approved</span>
                    )}
                  </div>
                </div>

                {/* AI generating spinner */}
                {isGenerating && (
                  <div style={{ marginTop: 14, padding: '12px 16px', background: 'rgba(124,58,237,0.06)', borderRadius: 6, border: '1px solid rgba(124,58,237,0.15)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 14, height: 14, border: '2px solid rgba(124,58,237,0.2)', borderTopColor: '#7C3AED', borderRadius: '50%', animation: 'spin 700ms linear infinite', flexShrink: 0 }} />
                    <p style={{ fontSize: '0.875rem', color: '#7C3AED', fontWeight: 600 }}>
                      Getting your AI feedback — this takes about 10 seconds...
                    </p>
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                )}

                {/* AI feedback */}
                {myAssignment?.ai_feedback && !isGenerating && (
                  <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(124,58,237,0.04)', borderRadius: 6, border: '1px solid rgba(124,58,237,0.12)', borderLeft: '3px solid #7C3AED' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C3AED' }}>
                        ⚡ AI First-Pass Feedback
                      </p>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>
                        Human review from Genesis within 48 hours
                      </p>
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}
                      dangerouslySetInnerHTML={{ __html: myAssignment.ai_feedback.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                    />
                  </div>
                )}

                {/* Genesis feedback */}
                {myAssignment?.feedback && (
                  <div style={{ marginTop: 12, padding: '14px 16px', background: 'rgba(79,106,74,0.05)', borderRadius: 6, borderLeft: '3px solid var(--moss)' }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: 8 }}>
                      ✓ Genesis Feedback {myAssignment.score ? `· ${myAssignment.score}/100` : ''}
                      {myAssignment.feedback_at && (
                        <span style={{ fontWeight: 400, color: 'var(--ink-muted)', marginLeft: 8 }}>
                          · {new Date(myAssignment.feedback_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </span>
                      )}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.7, fontStyle: 'italic' }}>
                      "{myAssignment.feedback}"
                    </p>
                    {myAssignment.status === 'Resubmission Requested' && (
                      <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(179,56,44,0.06)', borderRadius: 4 }}>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--red)', fontWeight: 600 }}>
                          ↩ Revision required — read the feedback above and resubmit using the button on the right.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Submission form */}
                {isExpanded && (
                  <div style={{ marginTop: 16, padding: '20px', background: 'var(--paper-soft)', borderRadius: 6, border: '1px solid var(--paper-line)' }}>

                    {/* Brief */}
                    {assignBrief && (
                      <div style={{ marginBottom: 18, padding: '14px 16px', background: 'var(--white)', borderRadius: 4, borderLeft: '3px solid var(--amber)' }}>
                        <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--amber-deep)', marginBottom: 6 }}>Assignment Brief</p>
                        <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.7 }}>{assignBrief}</p>
                      </div>
                    )}

                    {/* Resubmission note */}
                    {myAssignment?.resubmission_count && myAssignment.resubmission_count > 0 ? (
                      <div style={{ marginBottom: 14, padding: '10px 14px', background: 'rgba(197,116,58,0.07)', borderRadius: 4 }}>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}>
                          Resubmission #{myAssignment.resubmission_count} — make sure you've addressed all feedback points before resubmitting.
                        </p>
                      </div>
                    ) : null}

                    {/* URL input */}
                    <div className="form-group">
                      <label className="form-label">
                        Your submission link *
                      </label>
                      <input
                        className="form-input"
                        type="url"
                        placeholder="https://docs.google.com/... or https://notion.so/..."
                        value={submitUrl}
                        onChange={e => { setSubmitUrl(e.target.value); setUrlError(''); }}
                        autoFocus
                      />
                      <p style={{ fontSize: '0.75rem', color: urlError ? 'var(--red)' : 'var(--ink-muted)', marginTop: 5, fontWeight: urlError ? 600 : 400 }}>
                        {urlError || 'Paste a Google Doc, Notion page, Figma, Miro, or any other link. Set sharing to "Anyone with the link can view".'}
                      </p>
                    </div>

                    {/* Notes */}
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Note for Genesis <span style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>(optional)</span></label>
                      <textarea
                        className="form-input form-textarea"
                        style={{ minHeight: 72 }}
                        placeholder="Anything specific you'd like Genesis to focus on, or context about your submission..."
                        value={submitNotes}
                        onChange={e => setSubmitNotes(e.target.value)}
                      />
                    </div>

                    {/* Buttons */}
                    <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                      <button
                        className="btn btn-primary"
                        disabled={!submitUrl.trim() || submitting}
                        onClick={() => handleSubmit(week.week_number, pathway)}
                        style={{ opacity: !submitUrl.trim() || submitting ? 0.6 : 1 }}
                      >
                        {submitting
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ width: 12, height: 12, border: '2px solid rgba(250,247,241,0.3)', borderTopColor: '#FAF7F1', borderRadius: '50%', animation: 'spin 600ms linear infinite', display: 'inline-block' }} />
                              Submitting...
                            </span>
                          : myAssignment?.status === 'Resubmission Requested' ? '↩ Submit Revision'
                          : myAssignment?.submission_url ? 'Update Submission'
                          : 'Submit Assignment →'}
                      </button>
                      <button className="btn btn-ghost" onClick={() => { setActiveWeek(null); setUrlError(''); }}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Submitted work link */}
                {myAssignment?.submission_url && !isExpanded && (
                  <div style={{ marginTop: 10 }}>
                    <a href={myAssignment.submission_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}>
                      View submitted work →
                    </a>
                    {myAssignment.submitted_at && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginLeft: 10 }}>
                        Submitted {new Date(myAssignment.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
