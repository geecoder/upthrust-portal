export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import Link from 'next/link';
import type { Learner, Assignment, Week, Announcement } from '@/lib/types';
import { PASSPORT_CRITERIA, PHASE_COLORS } from '@/lib/types';

function ProgressRing({ pct, color = 'var(--amber)', size = 72, stroke = 6 }: { pct: number; color?: string; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} className="progress-ring">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--paper-line)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 600ms ease' }} />
    </svg>
  );
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/auth/sign-in');

  const isAdmin = userId === process.env.ADMIN_USER_ID;
  const db = createAdminClient();

  const { data: learner } = await db.from('learners').select('*').eq('clerk_user_id', userId).single();
  const typedLearner = learner as Learner | null;
  const pathway = typedLearner?.pathway === 'PM' || typedLearner?.pathway === 'BA' ? typedLearner.pathway : 'PM';

  const { data: weeks } = await db.from('weeks').select('*').eq('is_published', true).order('week_number');
  const { data: assignments } = learner ? await db.from('assignments').select('*').eq('learner_id', learner.id) : { data: [] };
  const { data: announcements } = await db.from('announcements').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(3);

  const typedWeeks = (weeks || []) as Week[];
  const typedAssignments = (assignments || []) as Assignment[];
  const typedAnnouncements = (announcements || []) as Announcement[];

  const currentWeek = getCurrentWeek();
  const thisWeek = typedWeeks.find(w => w.week_number === currentWeek);
  const nextAssignment = typedAssignments.find(a => a.status === 'Not Started' || a.status === 'In Progress');

  const submittedCount = typedAssignments.filter(a => ['Submitted','In Review','Needs Revision','Approved','Portfolio Ready'].includes(a.status)).length;
  const approvedCount = typedAssignments.filter(a => a.status === 'Approved' || a.status === 'Portfolio Ready').length;

  // Passport progress
  const passportChecks = typedLearner ? [
    { label: 'Attendance ≥75%', met: (typedLearner.attendance_pct || 0) >= PASSPORT_CRITERIA.attendance_min },
    { label: 'Assignments ≥80%', met: (typedLearner.assignment_completion_pct || 0) >= PASSPORT_CRITERIA.assignment_submission_min },
    { label: 'Avg score ≥70', met: (typedLearner.avg_score || 0) >= PASSPORT_CRITERIA.avg_score_min },
    { label: 'Capstone submitted', met: typedLearner.capstone_status !== 'Not Started' },
    { label: '≥8 portfolio items', met: approvedCount >= PASSPORT_CRITERIA.portfolio_items_min },
  ] : [];
  const passportMetCount = passportChecks.filter(c => c.met).length;

  const phaseColor = PHASE_COLORS[thisWeek?.phase || 'Foundation'];

  return (
    <div className="portal-content">
      {/* Header */}
      <div style={{ marginBottom: 28 }} className="fade-up">
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>
          Welcome back
        </p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 400, letterSpacing: '-0.02em' }}>
          {isAdmin ? 'Genesis — Admin View' : `${typedLearner?.first_name || 'Learner'}'s Dashboard`}
        </h1>
        {!isAdmin && typedLearner && (
          <p style={{ marginTop: 4, color: 'var(--ink-muted)', fontSize: '0.9375rem' }}>
            {typedLearner.pathway} Pathway · {typedLearner.tier} · {typedLearner.cohort}
          </p>
        )}
      </div>

      {/* Announcements */}
      {typedAnnouncements.length > 0 && (
        <div style={{ marginBottom: 24 }} className="fade-up delay-1">
          {typedAnnouncements.map((ann) => (
            <div key={ann.id} style={{
              padding: '14px 18px', marginBottom: 8,
              background: ann.priority === 'Urgent' ? 'rgba(179,56,44,0.08)' : ann.priority === 'Important' ? 'rgba(197,116,58,0.08)' : 'var(--white)',
              border: `1px solid ${ann.priority === 'Urgent' ? 'rgba(179,56,44,0.3)' : ann.priority === 'Important' ? 'rgba(197,116,58,0.3)' : 'var(--paper-line)'}`,
              borderRadius: 6,
              borderLeft: `3px solid ${ann.priority === 'Urgent' ? 'var(--red)' : ann.priority === 'Important' ? 'var(--amber)' : 'var(--ink)'}`,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}>
              <span style={{ fontSize: '1rem' }}>{ann.priority === 'Urgent' ? '🔴' : ann.priority === 'Important' ? '🟡' : 'ℹ️'}</span>
              <div>
                <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{ann.title}</p>
                <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', marginTop: 2 }}>{ann.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats grid */}
      {!isAdmin && typedLearner && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }} className="fade-up delay-2">
          {[
            { label: 'Assignments Submitted', value: `${submittedCount}/13`, sub: `${Math.round((submittedCount/13)*100)}% complete`, color: 'var(--ink)' },
            { label: 'Avg Score', value: typedLearner.avg_score ? `${typedLearner.avg_score}` : '—', sub: 'out of 100', color: 'var(--amber-deep)' },
            { label: 'Attendance', value: `${typedLearner.attendance_pct || 0}%`, sub: 'sessions attended', color: 'var(--moss)' },
            { label: 'Portfolio Items', value: `${approvedCount}`, sub: `8 required for Passport`, color: 'var(--amber)' },
          ].map((stat) => (
            <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.03em', color: stat.color, lineHeight: 1 }}>
                {stat.value}
              </p>
              <p style={{ fontWeight: 700, fontSize: '0.75rem', marginTop: 6, color: 'var(--ink)' }}>{stat.label}</p>
              <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginTop: 2 }}>{stat.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }} className="fade-up delay-3">

        {/* Left: current week + next assignment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Current week card */}
          {thisWeek ? (
            <div className="card" style={{ borderTop: `3px solid ${phaseColor}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 4 }}>
                    Week {thisWeek.week_number} · {thisWeek.phase}
                  </p>
                  <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem', fontWeight: 500, letterSpacing: '-0.02em' }}>
                    {thisWeek.title}
                  </h2>
                </div>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', background: `${phaseColor}18`, color: phaseColor, borderRadius: 4, flexShrink: 0 }}>
                  {thisWeek.phase}
                </span>
              </div>

              {thisWeek.learning_goals && (
                <div style={{ padding: '12px 14px', background: 'var(--paper-soft)', borderRadius: 6, marginBottom: 16 }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>This week you'll learn</p>
                  <p style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.55 }}>{thisWeek.learning_goals}</p>
                </div>
              )}

              {/* Assignment due this week */}
              {typedLearner && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {(['PM', 'BA'] as const).filter(p => p === pathway || isAdmin).map(p => {
                    const title = p === 'PM' ? thisWeek.pm_assignment_title : thisWeek.ba_assignment_title;
                    const due = p === 'PM' ? thisWeek.pm_due_date : thisWeek.ba_due_date;
                    const myAssignment = typedAssignments.find(a => a.week_number === currentWeek && a.pathway === p);
                    if (!title) return null;
                    return (
                      <div key={p} style={{ padding: '14px', border: '1px solid var(--paper-line)', borderRadius: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: p === 'PM' ? 'var(--ink)' : 'var(--amber-deep)' }}>{p}</span>
                          {myAssignment && (
                            <span className={`badge badge-${myAssignment.status === 'Approved' ? 'green' : myAssignment.status === 'Submitted' ? 'blue' : myAssignment.status === 'Needs Revision' ? 'amber' : 'ink'}`}>
                              {myAssignment.status}
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 4 }}>{title}</p>
                        {due && <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>Due {new Date(due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                <Link href={`/portal/week/${currentWeek}`} className="btn btn-primary btn-sm">View Week Content</Link>
                <Link href="/portal/assignments" className="btn btn-outline btn-sm">Submit Assignment</Link>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ fontSize: '1.125rem', fontFamily: 'Fraunces, serif' }}>Cohort 1 starts June 6, 2026</p>
              <p style={{ color: 'var(--ink-muted)', marginTop: 8 }}>Week 0 content will be available on that date.</p>
            </div>
          )}

          {/* Recent assignment feedback */}
          {typedAssignments.filter(a => a.feedback).length > 0 && (
            <div className="card">
              <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 16 }}>Recent Feedback</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {typedAssignments.filter(a => a.feedback).slice(0, 2).map((a) => (
                  <div key={a.id} style={{ padding: '14px', background: 'var(--paper-soft)', borderRadius: 6, borderLeft: '3px solid var(--amber)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <p style={{ fontSize: '0.8125rem', fontWeight: 700 }}>Week {a.week_number} — {a.pathway}</p>
                      {a.score && <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, color: 'var(--amber-deep)' }}>{a.score}/100</span>}
                    </div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.55, fontStyle: 'italic' }}>"{a.feedback}"</p>
                  </div>
                ))}
              </div>
              <Link href="/portal/assignments" style={{ display: 'inline-block', marginTop: 12, fontSize: '0.875rem', color: 'var(--amber-deep)', fontWeight: 600 }}>
                See all feedback →
              </Link>
            </div>
          )}
        </div>

        {/* Right: passport + quick nav */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Capability Passport */}
          {!isAdmin && typedLearner && (
            <div className="card" style={{ textAlign: 'center', borderTop: '3px solid var(--amber)' }}>
              <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 12px' }}>
                <ProgressRing pct={(passportMetCount / passportChecks.length) * 100} color="var(--amber)" />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500 }}>{passportMetCount}/{passportChecks.length}</span>
                </div>
              </div>
              <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 4 }}>Capability Passport</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: 14 }}>
                {typedLearner.passport_issued ? '✅ Issued' : typedLearner.passport_eligibility === 'Approved' ? '🔄 Pending issuance' : `${passportChecks.length - passportMetCount} criteria remaining`}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, textAlign: 'left', marginBottom: 14 }}>
                {passportChecks.map((check) => (
                  <div key={check.label} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8125rem' }}>
                    <span style={{ color: check.met ? 'var(--moss)' : 'var(--paper-line)', flexShrink: 0, fontSize: '0.875rem' }}>{check.met ? '✓' : '○'}</span>
                    <span style={{ color: check.met ? 'var(--ink)' : 'var(--ink-muted)' }}>{check.label}</span>
                  </div>
                ))}
              </div>
              <Link href="/portal/passport" className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center' }}>
                View Passport Details
              </Link>
            </div>
          )}

          {/* Quick links */}
          <div className="card">
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Quick Access</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[
                { href: '/portal/community', label: '💬 Community Feed', sub: 'Ask questions, share progress' },
                { href: '/portal/resources', label: '📚 Resource Library', sub: 'Templates + recordings' },
                { href: '/portal/portfolio', label: '💼 My Portfolio', sub: `${approvedCount} artefacts` },
              ].map(({ href, label, sub }) => (
                <Link key={href} href={href} className="quick-link" style={{
                  display: 'flex', flexDirection: 'column', padding: '10px 12px',
                  borderRadius: 6, textDecoration: 'none', transition: 'background 150ms',
                }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{sub}</span>
                </Link>
              ))}
              {/* Session booking (Premium only) */}
              {typedLearner?.tier === 'Premium' && (
                <a href="#" style={{
                  display: 'flex', flexDirection: 'column', padding: '10px 12px',
                  borderRadius: 6, textDecoration: 'none',
                  background: 'rgba(197,116,58,0.06)', border: '1px solid rgba(197,116,58,0.2)',
                }}>
                  <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--amber-deep)' }}>📅 Book 1:1 with Genesis</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--amber-deep)', opacity: 0.75 }}>Premium · Portfolio or Capstone review</span>
                </a>
              )}
            </div>
          </div>

          {/* Program timeline */}
          <div className="card">
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Program Timeline</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {typedWeeks.slice(0, 6).map((w) => (
                <Link key={w.week_number} href={`/portal/week/${w.week_number}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', borderRadius: 4, textDecoration: 'none',
                  background: w.week_number === currentWeek ? 'var(--paper-soft)' : 'transparent',
                  borderLeft: w.week_number === currentWeek ? '2px solid var(--amber)' : '2px solid transparent',
                }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: w.week_number === currentWeek ? 700 : 400, color: w.week_number === currentWeek ? 'var(--ink)' : 'var(--ink-muted)' }}>
                    Wk {w.week_number} · {w.title}
                  </span>
                  {w.week_number < currentWeek && <span style={{ color: 'var(--moss)', fontSize: '0.75rem' }}>✓</span>}
                  {w.week_number === currentWeek && <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--amber-deep)' }}>NOW</span>}
                </Link>
              ))}
              {typedWeeks.length > 6 && (
                <Link href="/portal/week" style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600, padding: '6px 10px' }}>
                  View all weeks →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getCurrentWeek(): number {
  const now = new Date();
  const start = new Date('2026-06-06');
  if (now < start) return 0;
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(Math.floor(diffDays / 7), 12);
}
