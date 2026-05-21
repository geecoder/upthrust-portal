'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';
import type { Week } from '@/lib/types';

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
  is_portfolio_ready: boolean;
}

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

  useEffect(() => {
    if (!user) return;
    async function load() {
      const db = createBrowserClient();
      const { data: l } = await db.from('learners').select('*').eq('clerk_user_id', user!.id).maybeSingle();
      setLearner(l);
      if (!l) return;
      const { data: a } = await db.from('assignments').select('*').eq('learner_id', l.id).order('week_number');
      setAssignments(a || []);
      const { data: w } = await db.from('weeks').select('*').eq('is_published', true).order('week_number');
      setWeeks(w || []);
    }
    load();
  }, [user]);

  async function handleSubmit(weekNumber: number, pathway: string) {
    if (!learner || !submitUrl) return;
    setSubmitting(true);
    const db = createBrowserClient();

    const week = weeks.find(w => w.week_number === weekNumber);
    const assignTitle = pathway === 'PM' ? week?.pm_assignment_title : week?.ba_assignment_title;

    const existing = assignments.find(a => a.week_number === weekNumber && a.pathway === pathway);
    const payload: any = {
      learner_id: learner.id, week_number: weekNumber, pathway,
      submission_url: submitUrl, submission_notes: submitNotes || null,
      status: 'Submitted', submitted_at: new Date().toISOString(),
    };

    let newAssignment: Assignment | null = null;
    if (existing) {
      const { data } = await db.from('assignments').update(payload).eq('id', existing.id).select().maybeSingle();
      newAssignment = data;
    } else {
      const { data } = await db.from('assignments').insert(payload).select().maybeSingle();
      newAssignment = data;
    }

    // Refresh assignments
    const { data: refreshed } = await db.from('assignments').select('*').eq('learner_id', learner.id).order('week_number');
    setAssignments(refreshed || []);
    setSubmitUrl('');
    setSubmitNotes('');
    setActiveWeek(null);
    setSubmitting(false);

    // Trigger AI feedback asynchronously
    if (newAssignment) {
      setGeneratingAI(newAssignment.id);
      try {
        await fetch('/api/ai-feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assignmentId: newAssignment.id,
            submissionUrl: submitUrl,
            weekNumber,
            pathway,
            assignmentTitle: assignTitle || '',
          }),
        });
        // Refresh again to get AI feedback
        const { data: withAI } = await db.from('assignments').select('*').eq('learner_id', learner.id).order('week_number');
        setAssignments(withAI || []);
      } catch (err) {
        console.error('AI feedback failed:', err);
      } finally {
        setGeneratingAI(null);
      }
    }
  }

  const statusColor: Record<string, string> = {
    'Not Started': 'var(--ink-muted)',
    'In Progress': 'var(--amber-deep)',
    'Submitted': '#1D4ED8',
    'In Review': 'var(--amber)',
    'Needs Revision': 'var(--red)',
    'Approved': 'var(--moss)',
    'Portfolio Ready': 'var(--moss)',
  };

  const pathway = learner?.pathway === 'PM' || learner?.pathway === 'BA' ? learner.pathway : 'PM';

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>
          My Work
        </p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>
          Assignments
        </h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
          Submit your work. You'll receive AI feedback instantly, then Genesis reviews within 48 hours.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {weeks.map(week => {
          const assignTitle = pathway === 'PM' ? week.pm_assignment_title : week.ba_assignment_title;
          const assignBrief = pathway === 'PM' ? week.pm_assignment_brief : week.ba_assignment_brief;
          const dueDate = pathway === 'PM' ? week.pm_due_date : week.ba_due_date;
          const myAssignment = assignments.find(a => a.week_number === week.week_number && a.pathway === pathway);
          const status = myAssignment?.status || 'Not Started';
          const isExpanded = activeWeek === week.week_number;
          const isGenerating = generatingAI === myAssignment?.id;

          return (
            <div key={week.week_number} className="card" style={{ borderLeft: `3px solid ${statusColor[status] || 'var(--paper-line)'}` }}>
              {/* Header row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                      Week {week.week_number} · {week.phase}
                    </span>
                    <span style={{
                      fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '2px 8px', borderRadius: 100,
                      background: status === 'Approved' || status === 'Portfolio Ready' ? 'rgba(79,106,74,0.12)' :
                        status === 'Submitted' || status === 'In Review' ? 'rgba(29,78,216,0.1)' :
                        status === 'Needs Revision' ? 'rgba(179,56,44,0.1)' : 'rgba(15,26,46,0.06)',
                      color: statusColor[status],
                    }}>
                      {status}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500 }}>
                    {week.title}
                  </h3>
                  {assignTitle && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--amber-deep)', fontWeight: 600, marginTop: 2 }}>
                      {assignTitle}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {dueDate && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                      Due {new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {myAssignment?.score && (
                    <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', color: 'var(--amber-deep)', fontWeight: 500 }}>
                      {myAssignment.score}/100
                    </span>
                  )}
                  {status !== 'Approved' && status !== 'Portfolio Ready' && (
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => setActiveWeek(isExpanded ? null : week.week_number)}
                    >
                      {isExpanded ? 'Cancel' : status === 'Not Started' ? 'Submit Work' : 'Update'}
                    </button>
                  )}
                </div>
              </div>

              {/* AI Feedback — shows immediately after submission */}
              {isGenerating && (
                <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(197,116,58,0.06)', borderRadius: 6, border: '1px solid rgba(197,116,58,0.2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 16, height: 16, border: '2px solid rgba(197,116,58,0.3)', borderTopColor: 'var(--amber)', borderRadius: '50%', animation: 'spin 700ms linear infinite', flexShrink: 0 }} />
                  <p style={{ fontSize: '0.875rem', color: 'var(--amber-deep)', fontWeight: 600 }}>
                    Generating AI feedback on your submission...
                  </p>
                  <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                </div>
              )}

              {myAssignment?.ai_feedback && !isGenerating && (
                <div style={{ marginTop: 14, padding: '16px 18px', background: 'rgba(197,116,58,0.04)', borderRadius: 6, border: '1px solid rgba(197,116,58,0.15)', borderLeft: '3px solid var(--amber)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--amber-deep)' }}>
                      ⚡ AI First-Pass Feedback
                    </p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>
                      Genesis human review within 48hrs
                    </p>
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                    {myAssignment.ai_feedback}
                  </div>
                </div>
              )}

              {/* Genesis human feedback */}
              {myAssignment?.feedback && (
                <div style={{ marginTop: 12, padding: '14px 16px', background: 'var(--paper-soft)', borderRadius: 6, borderLeft: '3px solid var(--moss)' }}>
                  <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: 8 }}>
                    ✓ Genesis Feedback {myAssignment.score ? `· ${myAssignment.score}/100` : ''}
                  </p>
                  <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.65, fontStyle: 'italic' }}>
                    "{myAssignment.feedback}"
                  </p>
                </div>
              )}

              {/* Submission form */}
              {isExpanded && (
                <div style={{ marginTop: 16, padding: '18px', background: 'var(--paper-soft)', borderRadius: 6 }}>
                  {assignBrief && (
                    <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', marginBottom: 14, lineHeight: 1.6 }}>
                      {assignBrief}
                    </p>
                  )}
                  <div className="form-group">
                    <label className="form-label">Your Google Drive or Notion link *</label>
                    <input
                      className="form-input" type="url"
                      placeholder="https://docs.google.com/..."
                      value={submitUrl}
                      onChange={e => setSubmitUrl(e.target.value)}
                    />
                    <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 4 }}>
                      Make sure sharing is set to "Anyone with the link can comment"
                    </p>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Notes for Genesis (optional)</label>
                    <textarea
                      className="form-input form-textarea"
                      placeholder="Anything you want Genesis to know..."
                      value={submitNotes}
                      onChange={e => setSubmitNotes(e.target.value)}
                      style={{ minHeight: 80 }}
                    />
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                    <button
                      className="btn btn-primary"
                      disabled={!submitUrl || submitting}
                      onClick={() => handleSubmit(week.week_number, pathway)}
                    >
                      {submitting ? 'Submitting...' : 'Submit Assignment'}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setActiveWeek(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* View submitted work link */}
              {myAssignment?.submission_url && !isExpanded && (
                <div style={{ marginTop: 10 }}>
                  <a
                    href={myAssignment.submission_url}
                    target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}
                  >
                    View submitted work →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
