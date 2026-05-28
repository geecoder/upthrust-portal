export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect, notFound } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import type { Learner, Assignment, Attendance, CapabilityScore } from '@/lib/types';
import { RISK_COLOR, ASSIGNMENT_STATUS_COLOR, ASSIGNMENT_STATUS_BG } from '@/lib/types';
import Link from 'next/link';
import ClerkLinkForm from './ClerkLinkForm';

export default async function LearnerDetailPage({ params }: { params: Promise<{ learnerId: string }> }) {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/portal');

  const { learnerId } = await params;
  const db = createAdminClient();

  const [{ data: learner }, { data: assignments }, { data: attendance }, { data: capScores }] = await Promise.all([
    db.from('learners').select('*').eq('id', learnerId).maybeSingle(),
    db.from('assignments').select('*').eq('learner_id', learnerId).order('week_number'),
    db.from('attendance').select('*').eq('learner_id', learnerId).order('week_number'),
    db.from('capability_scores').select('*').eq('learner_id', learnerId),
  ]);

  if (!learner) notFound();

  const typedLearner = learner as Learner;
  const typedAssignments = (assignments || []) as Assignment[];
  const typedAttendance = (attendance || []) as Attendance[];
  const typedCapScores = (capScores || []) as CapabilityScore[];

  const submitted = typedAssignments.filter(a => a.status !== 'Not Started').length;
  const approved = typedAssignments.filter(a => a.status === 'Approved' || a.status === 'Portfolio Ready' || a.portfolio_approved).length;
  const withFeedback = typedAssignments.filter(a => a.feedback).length;

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 24 }}>
        <Link href="/admin/learners" style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>← All Learners</Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>
              {typedLearner.first_name} {typedLearner.last_name}
            </h1>
            <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
              {typedLearner.email} · {typedLearner.pathway} · {typedLearner.tier} · {typedLearner.country}
            </p>
            {typedLearner.passport_id && <p style={{ fontFamily: 'monospace', fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: 3 }}>Passport ID: {typedLearner.passport_id}</p>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link href={`/admin/reviews?learner=${learnerId}`} className="btn btn-primary btn-sm">Review Submissions</Link>
            <Link href="/admin/attendance" className="btn btn-outline btn-sm">Mark Attendance</Link>
          </div>
        </div>
      </div>

      {/* Account linking warning */}
      {!typedLearner.clerk_user_id && (
        <div style={{ padding: '14px 18px', background: 'rgba(179,56,44,0.06)', border: '1px solid rgba(179,56,44,0.2)', borderRadius: 6, marginBottom: 20, borderLeft: '3px solid var(--red)' }}>
          <p style={{ fontWeight: 700, color: 'var(--red)', marginBottom: 6 }}>⚠ Account not linked — learner cannot log in yet</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', marginBottom: 12 }}>
            Once the learner signs up at the portal, paste their Clerk User ID below to link their account. Or set up the Clerk webhook to automate this.
          </p>
          <ClerkLinkForm learnerId={typedLearner.id} />
        </div>
      )}
      {typedLearner.clerk_user_id && (
        <div style={{ padding: '10px 16px', background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: 6, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--moss)', fontWeight: 600 }}>✓ Account linked — learner can sign in</p>
          <p style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--ink-muted)' }}>{typedLearner.clerk_user_id}</p>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Risk Status', value: typedLearner.risk_status || 'Green', color: RISK_COLOR[typedLearner.risk_status || 'Green'] },
          { label: 'Submitted', value: `${submitted}`, sub: 'assignments', color: 'var(--ink)' },
          { label: 'Approved', value: `${approved}`, sub: 'portfolio items', color: 'var(--moss)' },
          { label: 'Avg Score', value: typedLearner.avg_score ? `${typedLearner.avg_score}` : '—', sub: 'out of 100', color: (typedLearner.avg_score || 0) >= 70 ? 'var(--moss)' : 'var(--amber-deep)' },
          { label: 'Attendance', value: `${typedLearner.attendance_pct || 0}%`, sub: '75% required', color: (typedLearner.attendance_pct || 0) >= 75 ? 'var(--moss)' : 'var(--amber-deep)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
            <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.5rem', color: s.color, lineHeight: 1, fontWeight: 500 }}>{s.value}</p>
            <p style={{ fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 6 }}>{s.label}</p>
            {s.sub && <p style={{ fontSize: '0.625rem', color: 'var(--ink-muted)', marginTop: 2 }}>{s.sub}</p>}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>

        {/* Assignments */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500 }}>Assignment History</h2>
            <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{withFeedback} reviewed</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {typedAssignments.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: 32, color: 'var(--ink-muted)' }}>No assignments submitted yet.</div>
            ) : typedAssignments.map(a => (
              <div key={a.id} className="card" style={{ padding: '14px 16px', borderLeft: `3px solid ${ASSIGNMENT_STATUS_COLOR[a.status] || 'var(--paper-line)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
                      <p style={{ fontWeight: 600 }}>Week {a.week_number} · {a.pathway}</p>
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 100, background: ASSIGNMENT_STATUS_BG[a.status], color: ASSIGNMENT_STATUS_COLOR[a.status] }}>
                        {a.status}
                      </span>
                    </div>
                    {a.submitted_at && <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Submitted {new Date(a.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {a.score && <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', color: a.score >= 70 ? 'var(--moss)' : 'var(--amber-deep)' }}>{a.score}/100</p>}
                    {a.submission_url && <a href={a.submission_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--amber-deep)', fontWeight: 600 }}>View →</a>}
                  </div>
                </div>
                {a.feedback && (
                  <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--paper-soft)', borderRadius: 4, borderLeft: '2px solid var(--amber)' }}>
                    <p style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', fontStyle: 'italic', lineHeight: 1.55 }}>"{a.feedback}"</p>
                  </div>
                )}
                {a.ai_feedback && !a.feedback && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: 'rgba(124,58,237,0.05)', borderRadius: 4 }}>
                    <p style={{ fontSize: '0.625rem', fontWeight: 700, color: '#7C3AED', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>AI Feedback (pending human review)</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--ink-soft)', lineHeight: 1.55 }}>{a.ai_feedback.substring(0, 150)}...</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right col */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Profile info */}
          <div className="card">
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 14 }}>Learner Profile</h3>
            {[
              ['Enrolment', typedLearner.enrollment_status],
              ['Cohort', typedLearner.cohort],
              ['Current Role', typedLearner.current_role],
              ['Career Goal', typedLearner.career_goal],
              ['Onboarded', typedLearner.onboarding_complete ? 'Yes' : 'Not yet'],
              ['LinkedIn', typedLearner.linkedin_url],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--paper-line)', fontSize: '0.875rem', gap: 8 }}>
                <span style={{ color: 'var(--ink-muted)', flexShrink: 0 }}>{k as string}</span>
                <span style={{ fontWeight: 500, textAlign: 'right', wordBreak: 'break-word' }}>
                  {k === 'LinkedIn' ? <a href={v as string} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--amber-deep)' }}>View profile →</a> : v as string}
                </span>
              </div>
            ))}
          </div>

          {/* Attendance */}
          <div className="card">
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Attendance</h3>
            {typedAttendance.length === 0 ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>No attendance recorded yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {typedAttendance.map(a => (
                  <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                    <span style={{ color: 'var(--ink-muted)' }}>Week {a.week_number}</span>
                    <span style={{ fontWeight: 600, color: a.attended ? 'var(--moss)' : 'var(--red)' }}>
                      {a.arrival || (a.attended ? 'Present' : 'Absent')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Capability snapshot */}
          {typedCapScores.length > 0 && (
            <div className="card">
              <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Capability Snapshot</h3>
              {typedCapScores.slice(0, 5).map(s => (
                <div key={s.capability} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600 }}>{s.capability}</p>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>{s.level}</p>
                  </div>
                  <div style={{ height: 3, background: 'var(--paper-line)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(s.score || 0)}%`, background: 'var(--amber)', borderRadius: 2 }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Passport */}
          <div className="card">
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Passport Status</h3>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 8 }}>
              <span style={{ color: 'var(--ink-muted)' }}>Eligibility</span>
              <span style={{ fontWeight: 600, color: typedLearner.passport_eligibility === 'Approved' ? 'var(--moss)' : 'var(--ink-muted)' }}>{typedLearner.passport_eligibility || 'Not Eligible'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: 'var(--ink-muted)' }}>Issued</span>
              <span style={{ fontWeight: 600, color: typedLearner.passport_issued ? 'var(--moss)' : 'var(--ink-muted)' }}>{typedLearner.passport_issued ? 'Yes' : 'No'}</span>
            </div>
            {typedLearner.passport_issued && (
              <a href={`/api/passport-pdf?learnerId=${typedLearner.id}`} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ marginTop: 12, display: 'block', textAlign: 'center' }}>
                Preview Passport PDF
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
