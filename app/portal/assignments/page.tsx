export const dynamic = 'force-dynamic';

/**
 * Assignments — Server Component
 * Uses admin (service role) client to bypass RLS entirely.
 * Renders all published weeks with assignment cards.
 * Submission handled by AssignmentSubmitPanel (client component).
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import AssignmentSubmitPanel from './AssignmentSubmitPanel';

// ── Types ─────────────────────────────────────────────────────

interface Week {
  id: string;
  week_number: number;
  title: string;
  phase: string;
  is_published: boolean;
  pm_assignment_title?: string;
  pm_assignment_brief?: string;
  pm_deliverable?: string;
  pm_due_date?: string;
  ba_assignment_title?: string;
  ba_assignment_brief?: string;
  ba_deliverable?: string;
  ba_due_date?: string;
}

interface Assignment {
  id: string;
  learner_id: string;
  week_number: number;
  pathway: string;
  status: string;
  submission_url?: string;
  submission_notes?: string;
  submitted_at?: string;
  score?: number;
  feedback?: string;
  feedback_at?: string;
  ai_feedback?: string;
  portfolio_approved?: boolean;
  resubmission_count?: number;
}

// ── Status colours ────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  'Not Started':              'var(--ink-muted)',
  'Submitted':                '#1D4ED8',
  'AI Reviewed':              '#7C3AED',
  'Human Reviewed':           '#1D4ED8',
  'Needs Revision':   'var(--red)',
  'Approved':                 'var(--moss)',
  'Portfolio Ready':          '#047857',
};

const STATUS_BG: Record<string, string> = {
  'Not Started':              'rgba(107,114,128,0.08)',
  'Submitted':                'rgba(37,99,235,0.08)',
  'AI Reviewed':              'rgba(124,58,237,0.08)',
  'Human Reviewed':           'rgba(29,78,216,0.08)',
  'Needs Revision':   'rgba(179,56,44,0.08)',
  'Approved':                 'rgba(5,150,105,0.08)',
  'Portfolio Ready':          'rgba(4,120,87,0.1)',
};

// ── Page ──────────────────────────────────────────────────────

export default async function AssignmentsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/auth/sign-in');

  const db = createAdminClient();

  // Load learner
  const { data: learner } = await db
    .from('learners')
    .select('id, pathway, tier, first_name')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (!learner) {
    return (
      <div className="portal-content">
        <div style={{ padding: '48px', textAlign: 'center', background: 'var(--white)', borderRadius: 8, border: '1px solid var(--paper-line)' }}>
          <p style={{ fontSize: '2rem', marginBottom: 12 }}>🔒</p>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: 8 }}>
            Account not yet activated
          </p>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            Your learner record hasn't been linked yet. Email{' '}
            <a href="mailto:info@upthrustdigital.com" style={{ color: 'var(--amber-deep)', fontWeight: 600 }}>
              info@upthrustdigital.com
            </a>
          </p>
        </div>
      </div>
    );
  }

  const pathway = learner.pathway === 'BA' ? 'BA' : 'PM';

  // Load weeks (admin client — bypasses RLS completely)
  const { data: weeksRaw, error: weeksError } = await db
    .from('weeks')
    .select('*')
    .eq('is_published', true)
    .order('week_number');

  // Load assignments
  const { data: assignmentsRaw } = await db
    .from('assignments')
    .select('*')
    .eq('learner_id', learner.id)
    .order('week_number');

  const weeks = (weeksRaw || []) as Week[];
  const assignments = (assignmentsRaw || []) as Assignment[];

  // ── Stats ──────────────────────────────────────────────────
  const submitted     = assignments.filter(a => a.status !== 'Not Started').length;
  const approved      = assignments.filter(a => a.status === 'Approved' || a.status === 'Portfolio Ready' || a.portfolio_approved).length;
  const pendingFb     = assignments.filter(a => a.status === 'Submitted' || a.status === 'AI Reviewed').length;
  const needsResub    = assignments.filter(a => a.status === 'Needs Revision').length;

  function getAssignment(weekNum: number): Assignment | undefined {
    return assignments.find(a => a.week_number === weekNum && a.pathway === pathway);
  }

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
      {needsResub > 0 && (
        <div style={{ padding: '14px 18px', background: 'rgba(179,56,44,0.06)', border: '1px solid rgba(179,56,44,0.2)', borderRadius: 6, borderLeft: '3px solid var(--red)', marginBottom: 20 }}>
          <p style={{ fontWeight: 700, color: 'var(--red)' }}>
            ↩ {needsResub} assignment{needsResub > 1 ? 's' : ''} need{needsResub === 1 ? 's' : ''} resubmission
          </p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: 2 }}>
            Read Genesis's feedback below and resubmit within 72 hours.
          </p>
        </div>
      )}

      {/* Stats */}
      {weeks.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'Submitted',       value: submitted,  color: '#1D4ED8' },
            { label: 'Pending Review',  value: pendingFb,  color: 'var(--amber-deep)' },
            { label: 'Approved',        value: approved,   color: 'var(--moss)' },
            { label: 'Total Weeks',     value: weeks.length, color: 'var(--ink-muted)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ textAlign: 'center', padding: 14 }}>
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 500, color: s.color, lineHeight: 1 }}>
                {s.value}
              </p>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--ink-muted)', marginTop: 6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* No weeks published */}
      {weeks.length === 0 && (
        <div style={{ padding: '56px 32px', textAlign: 'center', background: 'var(--white)', border: '1px solid var(--paper-line)', borderRadius: 8 }}>
          <p style={{ fontSize: '2.5rem', marginBottom: 12 }}>📅</p>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: 8 }}>
            No assignments published yet
          </p>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            Week 0 assignments will appear here on June 6. Check back then.
          </p>
          {weeksError && (
            <p style={{ fontSize: '0.75rem', color: 'var(--red)', marginTop: 12, fontFamily: 'monospace' }}>
              Error: {weeksError.message}
            </p>
          )}
        </div>
      )}

      {/* Assignment cards */}
      {weeks.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {weeks.map(week => {
            const aTitle  = pathway === 'PM' ? week.pm_assignment_title  : week.ba_assignment_title;
            const aBrief  = pathway === 'PM' ? week.pm_assignment_brief  : week.ba_assignment_brief;
            const aDue    = pathway === 'PM' ? week.pm_due_date           : week.ba_due_date;
            const aDeliv  = pathway === 'PM' ? week.pm_deliverable        : week.ba_deliverable;
            const myAssign = getAssignment(week.week_number);
            const status   = myAssign?.status || 'Not Started';
            const isApproved = status === 'Approved' || status === 'Portfolio Ready' || myAssign?.portfolio_approved;
            const isOverdue  = aDue && new Date(aDue) < new Date() && !myAssign?.submission_url;

            return (
              <div key={week.week_number} className="card" style={{
                borderLeft: `3px solid ${STATUS_COLOR[status] || 'var(--paper-line)'}`,
                padding: '18px 20px',
              }}>

                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>

                    {/* Badges */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                        Week {week.week_number} · {week.phase}
                      </span>
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 100, background: STATUS_BG[status] || 'rgba(15,26,46,0.06)', color: STATUS_COLOR[status] || 'var(--ink-muted)' }}>
                        {status}
                      </span>
                      {isOverdue && (
                        <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: 'rgba(179,56,44,0.08)', color: 'var(--red)' }}>
                          Overdue
                        </span>
                      )}
                    </div>

                    {/* Week title */}
                    <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.0625rem', fontWeight: 500, marginBottom: 4 }}>
                      {week.title}
                    </h3>

                    {/* Assignment title */}
                    <p style={{ fontSize: '0.875rem', fontWeight: aTitle ? 600 : 400, color: aTitle ? 'var(--amber-deep)' : 'var(--ink-muted)', fontStyle: aTitle ? 'normal' : 'italic', marginBottom: 4 }}>
                      {aTitle || 'Brief coming soon'}
                    </p>

                    {/* Due + deliverable */}
                    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                      {aDue && (
                        <p style={{ fontSize: '0.75rem', color: isOverdue ? 'var(--red)' : 'var(--ink-muted)', fontWeight: isOverdue ? 600 : 400 }}>
                          {isOverdue ? '⚠ Due ' : 'Due '}
                          {new Date(aDue).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </p>
                      )}
                      {aDeliv && <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>· {aDeliv}</p>}
                    </div>
                  </div>

                  {/* Score */}
                  {myAssign?.score && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem', fontWeight: 500, color: myAssign.score >= 70 ? 'var(--moss)' : 'var(--amber-deep)', lineHeight: 1 }}>
                        {myAssign.score}/100
                      </p>
                    </div>
                  )}
                </div>

                {/* AI feedback */}
                {myAssign?.ai_feedback && (
                  <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(124,58,237,0.04)', borderRadius: 6, borderLeft: '3px solid #7C3AED' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                      <p style={{ fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C3AED' }}>
                        ⚡ AI First-Pass Feedback
                      </p>
                      <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>
                        Genesis human review within 48 hrs
                      </p>
                    </div>
                    <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                      {myAssign.ai_feedback}
                    </p>
                  </div>
                )}

                {/* Genesis feedback */}
                {myAssign?.feedback && (
                  <div style={{ marginTop: 12, padding: '14px 16px', background: 'rgba(79,106,74,0.05)', borderRadius: 6, borderLeft: '3px solid var(--moss)' }}>
                    <p style={{ fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: 8 }}>
                      ✓ Genesis Feedback
                      {myAssign.score ? ` · ${myAssign.score}/100` : ''}
                      {myAssign.feedback_at ? ` · ${new Date(myAssign.feedback_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
                    </p>
                    <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.7, fontStyle: 'italic' }}>
                      "{myAssign.feedback}"
                    </p>
                    {myAssign.status === 'Needs Revision' && (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--red)', fontWeight: 600, marginTop: 10 }}>
                        ↩ Revision required — read the feedback above and use the resubmit button below.
                      </p>
                    )}
                  </div>
                )}

                {/* Submitted work link */}
                {myAssign?.submission_url && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                    <a href={myAssign.submission_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}>
                      View submitted work →
                    </a>
                    {myAssign.submitted_at && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                        Submitted {new Date(myAssign.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    )}
                  </div>
                )}

                {/* Submit / resubmit panel — client component */}
                {!isApproved && (
                  <AssignmentSubmitPanel
                    learnerId={learner.id}
                    weekNumber={week.week_number}
                    pathway={pathway}
                    assignmentTitle={aTitle || `Week ${week.week_number} Assignment`}
                    assignmentBrief={aBrief || ''}
                    existingAssignment={myAssign ? {
                      id: myAssign.id,
                      status: myAssign.status,
                      submission_url: myAssign.submission_url,
                      resubmission_count: myAssign.resubmission_count,
                    } : null}

                  />
                )}

                {isApproved && (
                  <p style={{ marginTop: 10, fontSize: '0.875rem', color: 'var(--moss)', fontWeight: 700 }}>
                    ✓ Approved — this assignment is in your portfolio
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
