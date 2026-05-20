'use client';
import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { supabase } from '@/lib/supabase';
import type { Assignment, Week } from '@/lib/types';
import Link from 'next/link';

export default function AssignmentsPage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [submitUrl, setSubmitUrl] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');
  const [activeWeek, setActiveWeek] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: l } = await supabase.from('learners').select('*').eq('clerk_user_id', user!.id).single();
      setLearner(l);
      if (!l) return;
      const { data: a } = await supabase.from('assignments').select('*').eq('learner_id', l.id);
      setAssignments(a || []);
      const { data: w } = await supabase.from('weeks').select('*').eq('is_published', true).order('week_number');
      setWeeks(w || []);
    }
    load();
  }, [user]);

  async function handleSubmit(weekNumber: number, pathway: 'PM' | 'BA') {
    if (!learner || !submitUrl) return;
    setSubmitting(`${weekNumber}-${pathway}`);

    const existing = assignments.find(a => a.week_number === weekNumber && a.pathway === pathway);
    const payload = {
      learner_id: learner.id, week_number: weekNumber, pathway,
      submission_url: submitUrl, submission_notes: submitNotes,
      status: 'Submitted', submitted_at: new Date().toISOString(),
    };

    if (existing) {
      await supabase.from('assignments').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('assignments').insert(payload);
    }

    const { data: a } = await supabase.from('assignments').select('*').eq('learner_id', learner.id);
    setAssignments(a || []);
    setSubmitting(null);
    setSubmitUrl('');
    setSubmitNotes('');
    setActiveWeek(null);
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
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>My Work</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>Assignments</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>Submit your work by adding the Google Drive or Notion link below.</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {weeks.map((week) => {
          const assignTitle = pathway === 'PM' ? week.pm_assignment_title : week.ba_assignment_title;
          const assignBrief = pathway === 'PM' ? week.pm_assignment_brief : week.ba_assignment_brief;
          const dueDate = pathway === 'PM' ? week.pm_due_date : week.ba_due_date;
          const myAssignment = assignments.find(a => a.week_number === week.week_number && a.pathway === pathway);
          const status = myAssignment?.status || 'Not Started';
          const isExpanded = activeWeek === week.week_number;

          return (
            <div key={week.week_number} className="card" style={{ borderLeft: `3px solid ${statusColor[status]}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>Week {week.week_number} · {week.phase}</span>
                    <span className={`badge badge-${status === 'Approved' || status === 'Portfolio Ready' ? 'green' : status === 'Submitted' || status === 'In Review' ? 'blue' : status === 'Needs Revision' ? 'amber' : status === 'In Progress' ? 'amber' : 'ink'}`}>
                      {status}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500 }}>{week.title}</h3>
                  {assignTitle && <p style={{ fontSize: '0.875rem', color: 'var(--amber-deep)', fontWeight: 600, marginTop: 2 }}>{assignTitle}</p>}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {dueDate && <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>Due {new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                  {myAssignment?.score && <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', color: 'var(--amber-deep)', fontWeight: 500 }}>{myAssignment.score}/100</span>}
                  {status !== 'Approved' && status !== 'Portfolio Ready' && (
                    <button className="btn btn-sm btn-outline" onClick={() => setActiveWeek(isExpanded ? null : week.week_number)}>
                      {isExpanded ? 'Cancel' : status === 'Not Started' ? 'Submit' : 'Update'}
                    </button>
                  )}
                </div>
              </div>

              {/* Feedback */}
              {myAssignment?.feedback && (
                <div style={{ marginTop: 14, padding: '12px 14px', background: 'var(--paper-soft)', borderRadius: 6, borderLeft: '3px solid var(--amber)' }}>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--amber-deep)', marginBottom: 6 }}>Feedback from {myAssignment.feedback_by || 'Genesis'}</p>
                  <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.6, fontStyle: 'italic' }}>{myAssignment.feedback}</p>
                </div>
              )}

              {/* Submission form */}
              {isExpanded && (
                <div style={{ marginTop: 16, padding: '16px', background: 'var(--paper-soft)', borderRadius: 6 }}>
                  {assignBrief && <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', marginBottom: 14, lineHeight: 1.6 }}>{assignBrief}</p>}
                  <div className="form-group">
                    <label className="form-label">Google Drive or Notion Link *</label>
                    <input className="form-input" type="url" placeholder="https://docs.google.com/..." value={submitUrl} onChange={e => setSubmitUrl(e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Notes for Genesis (optional)</label>
                    <textarea className="form-input form-textarea" placeholder="Anything you want Genesis to know about your submission..." value={submitNotes} onChange={e => setSubmitNotes(e.target.value)} style={{ minHeight: 80 }} />
                  </div>
                  <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                    <button className="btn btn-primary" disabled={!submitUrl || submitting === `${week.week_number}-${pathway}`}
                      onClick={() => handleSubmit(week.week_number, pathway as 'PM' | 'BA')}>
                      {submitting === `${week.week_number}-${pathway}` ? 'Submitting...' : 'Submit Assignment'}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setActiveWeek(null)}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Existing submission link */}
              {myAssignment?.submission_url && !isExpanded && (
                <div style={{ marginTop: 10 }}>
                  <a href={myAssignment.submission_url} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}>
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
