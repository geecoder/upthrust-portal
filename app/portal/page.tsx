export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import Link from 'next/link';
import type { Learner, Assignment, Week, Announcement, Notification } from '@/lib/types';
import { PASSPORT_CRITERIA, ASSIGNMENT_STATUS_COLOR, ASSIGNMENT_STATUS_BG, RISK_COLOR, PHASE_COLORS } from '@/lib/types';

function ProgressRing({ pct, color = 'var(--amber)', size = 80, stroke = 7 }: { pct: number; color?: string; size?: number; stroke?: number }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct / 100, 1) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--paper-line)" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
    </svg>
  );
}

function getCurrentWeek() {
  const now = new Date(); const start = new Date('2026-06-06');
  if (now < start) return 0;
  return Math.min(Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)), 12);
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/auth/sign-in');

  const isAdmin = userId === process.env.ADMIN_USER_ID;
  if (isAdmin) redirect('/admin');

  const db = createAdminClient();
  const currentWeek = getCurrentWeek();

  const [
    { data: learner },
    { data: weeks },
    { data: announcements },
  ] = await Promise.all([
    db.from('learners').select('*').eq('clerk_user_id', userId).maybeSingle(),
    db.from('weeks').select('*').eq('is_published', true).order('week_number'),
    db.from('announcements').select('*').eq('is_published', true).order('created_at', { ascending: false }).limit(3),
  ]);

  if (!learner) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-soft)', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '1.75rem' }}>🔒</div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', marginBottom: 12 }}>Access Pending</h1>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.65, marginBottom: 8 }}>Your Upthrust portal account is being activated. This usually happens within a few hours of enrollment.</p>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.65, marginBottom: 24, fontSize: '0.9375rem' }}>Email <a href="mailto:info@upthrustdigital.com" style={{ color: 'var(--amber-deep)', fontWeight: 600 }}>info@upthrustdigital.com</a> if this takes more than 24 hours.</p>
          <a href="mailto:info@upthrustdigital.com" className="btn btn-primary">Contact Support</a>
        </div>
      </div>
    );
  }

  const typedLearner = learner as Learner;

  // Check onboarding
  if (!typedLearner.onboarding_complete) redirect('/portal/onboarding');

  const { data: assignments } = await db.from('assignments').select('*').eq('learner_id', learner.id).order('week_number');
  const { data: notifications } = await db.from('notifications').select('*').eq('learner_id', learner.id).eq('is_read', false).order('created_at', { ascending: false }).limit(5);

  const typedAssignments = (assignments || []) as Assignment[];
  const typedWeeks = (weeks || []) as Week[];
  const typedAnnouncements = (announcements || []) as Announcement[];
  const typedNotifications = (notifications || []) as Notification[];
  const pathway = typedLearner.pathway === 'PM' || typedLearner.pathway === 'BA' ? typedLearner.pathway : 'PM';

  const thisWeek = typedWeeks.find(w => w.week_number === currentWeek);
  const thisWeekAssignment = typedAssignments.find(a => a.week_number === currentWeek && a.pathway === pathway);

  const submittedCount = typedAssignments.filter(a => a.status !== 'Not Started').length;
  const approvedCount = typedAssignments.filter(a => a.status === 'Approved' || a.status === 'Portfolio Ready' || a.portfolio_approved).length;
  const pendingFeedback = typedAssignments.filter(a => a.feedback && !a.feedback).length;
  const newFeedback = typedAssignments.filter(a => a.feedback_at && new Date(a.feedback_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

  // Determine next best action
  function getNextAction() {
    if (!thisWeek) return { label: 'Program starts June 6', href: '/portal/week', icon: '📅', urgent: false };
    if (!thisWeekAssignment || thisWeekAssignment.status === 'Not Started')
      return { label: `Submit Week ${currentWeek} Assignment`, href: '/portal/assignments', icon: '📝', urgent: true };
    if (thisWeekAssignment.status === 'Needs Revision')
      return { label: `Resubmit Week ${currentWeek} — Revisions needed`, href: '/portal/assignments', icon: '↩', urgent: true };
    if (typedAssignments.some(a => a.feedback && a.status === 'Needs Revision'))
      return { label: 'You have assignments needing resubmission', href: '/portal/assignments', icon: '↩', urgent: true };
    if (newFeedback.length > 0)
      return { label: `Read new feedback on ${newFeedback.length} assignment${newFeedback.length > 1 ? 's' : ''}`, href: '/portal/assignments', icon: '💬', urgent: false };
    if (approvedCount < PASSPORT_CRITERIA.portfolio_items_min)
      return { label: `Add approved work to portfolio (${approvedCount}/${PASSPORT_CRITERIA.portfolio_items_min} needed)`, href: '/portal/portfolio', icon: '💼', urgent: false };
    return { label: 'Review this week\'s content', href: `/portal/week/${currentWeek}`, icon: '📅', urgent: false };
  }

  const nextAction = getNextAction();

  // Passport progress
  const passportChecks = [
    { label: `Attendance ≥${PASSPORT_CRITERIA.attendance_min}%`, met: (typedLearner.attendance_pct || 0) >= PASSPORT_CRITERIA.attendance_min, value: `${typedLearner.attendance_pct || 0}%` },
    { label: `Assignments ≥${PASSPORT_CRITERIA.assignment_submission_min}%`, met: (typedLearner.assignment_completion_pct || 0) >= PASSPORT_CRITERIA.assignment_submission_min, value: `${typedLearner.assignment_completion_pct || 0}%` },
    { label: `Avg score ≥${PASSPORT_CRITERIA.avg_score_min}`, met: (typedLearner.avg_score || 0) >= PASSPORT_CRITERIA.avg_score_min, value: typedLearner.avg_score ? `${typedLearner.avg_score}/100` : '—' },
    { label: 'Capstone submitted', met: typedLearner.capstone_status !== 'Not Started', value: typedLearner.capstone_status },
    { label: `≥${PASSPORT_CRITERIA.portfolio_items_min} portfolio items`, met: approvedCount >= PASSPORT_CRITERIA.portfolio_items_min, value: `${approvedCount}` },
  ];
  const passportMet = passportChecks.filter(c => c.met).length;

  const phaseColor = PHASE_COLORS[thisWeek?.phase || 'Foundation'];

  return (
    <div className="portal-content">
      {/* Welcome */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>
          Welcome back
        </p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 400, letterSpacing: '-0.02em' }}>
          {typedLearner.first_name}, here's where you stand
        </h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
          {pathway} Pathway · {typedLearner.tier} · Week {currentWeek} of 12
        </p>
      </div>

      {/* Announcements */}
      {typedAnnouncements.map(ann => (
        <div key={ann.id} style={{ padding: '14px 18px', marginBottom: 12, background: ann.priority === 'Urgent' ? 'rgba(220,38,38,0.06)' : 'rgba(197,116,58,0.06)', border: `1px solid ${ann.priority === 'Urgent' ? 'rgba(220,38,38,0.25)' : 'rgba(197,116,58,0.2)'}`, borderRadius: 6, borderLeft: `3px solid ${ann.priority === 'Urgent' ? 'var(--red)' : 'var(--amber)'}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ fontSize: '1.1rem' }}>{ann.priority === 'Urgent' ? '🔴' : '📣'}</span>
          <div>
            <p style={{ fontWeight: 700 }}>{ann.title}</p>
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.875rem', marginTop: 2 }}>{ann.content}</p>
          </div>
        </div>
      ))}

      {/* Notifications */}
      {typedNotifications.map(n => (
        <div key={n.id} style={{ padding: '12px 16px', marginBottom: 10, background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: '#1D4ED8' }}>{n.title}</p>
            <p style={{ color: 'var(--ink-muted)', fontSize: '0.8125rem', marginTop: 2 }}>{n.message}</p>
          </div>
          <Link href="/portal/assignments" style={{ fontSize: '0.8125rem', color: '#1D4ED8', fontWeight: 600, whiteSpace: 'nowrap' }}>View →</Link>
        </div>
      ))}

      {/* Next best action CTA */}
      <div style={{ padding: '18px 22px', marginBottom: 24, background: nextAction.urgent ? 'var(--ink)' : 'var(--paper-soft)', border: `1px solid ${nextAction.urgent ? 'transparent' : 'var(--paper-line)'}`, borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <span style={{ fontSize: '1.5rem' }}>{nextAction.icon}</span>
          <div>
            <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: nextAction.urgent ? 'rgba(250,247,241,0.5)' : 'var(--ink-muted)', marginBottom: 4 }}>
              Your next action
            </p>
            <p style={{ fontWeight: 700, fontSize: '1rem', color: nextAction.urgent ? '#FAF7F1' : 'var(--ink)' }}>{nextAction.label}</p>
          </div>
        </div>
        <Link href={nextAction.href} className="btn" style={{ background: nextAction.urgent ? 'var(--amber)' : 'var(--ink)', color: 'var(--paper)', flexShrink: 0 }}>
          Go →
        </Link>
      </div>

      {/* Progress stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        {[
          { label: 'Assignments Submitted', value: `${submittedCount}/${currentWeek + 1}`, sub: `${Math.round((submittedCount / Math.max(currentWeek + 1, 1)) * 100)}% this far`, color: 'var(--ink)' },
          { label: 'Average Score', value: typedLearner.avg_score ? `${typedLearner.avg_score}` : '—', sub: 'out of 100', color: (typedLearner.avg_score || 0) >= 70 ? 'var(--moss)' : 'var(--amber-deep)' },
          { label: 'Attendance', value: `${typedLearner.attendance_pct || 0}%`, sub: '75% required', color: (typedLearner.attendance_pct || 0) >= 75 ? 'var(--moss)' : 'var(--amber-deep)' },
          { label: 'Portfolio Items', value: `${approvedCount}`, sub: `of ${PASSPORT_CRITERIA.portfolio_items_min} required`, color: approvedCount >= PASSPORT_CRITERIA.portfolio_items_min ? 'var(--moss)' : 'var(--amber)' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ textAlign: 'center', padding: '18px 14px' }}>
            <p style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 500, color: stat.color, lineHeight: 1 }}>{stat.value}</p>
            <p style={{ fontWeight: 700, fontSize: '0.6875rem', marginTop: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</p>
            <p style={{ fontSize: '0.625rem', color: 'var(--ink-muted)', marginTop: 3 }}>{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Current week */}
          {thisWeek ? (
            <div className="card" style={{ borderTop: `3px solid ${phaseColor}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 4 }}>
                    Week {thisWeek.week_number} · {thisWeek.phase}
                  </p>
                  <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500 }}>{thisWeek.title}</h2>
                </div>
                <Link href={`/portal/week/${currentWeek}`} className="btn btn-sm btn-outline">Open Week →</Link>
              </div>

              {thisWeek.outcomes && (
                <div style={{ padding: '12px 14px', background: 'var(--paper-soft)', borderRadius: 6, marginBottom: 14 }}>
                  <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>By end of this week you can</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {thisWeek.outcomes.split(',').slice(0, 3).map((o, i) => (
                      <p key={i} style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', display: 'flex', gap: 8 }}>
                        <span style={{ color: 'var(--amber)', flexShrink: 0 }}>→</span>{o.trim()}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Assignment status */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', background: thisWeekAssignment?.status === 'Approved' || thisWeekAssignment?.status === 'Portfolio Ready' ? 'rgba(5,150,105,0.06)' : thisWeekAssignment?.status === 'Needs Revision' ? 'rgba(220,38,38,0.06)' : 'var(--paper-soft)', borderRadius: 6 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-muted)', marginBottom: 4 }}>
                    {pathway} Assignment: {pathway === 'PM' ? thisWeek.pm_assignment_title : thisWeek.ba_assignment_title}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 100, background: ASSIGNMENT_STATUS_BG[thisWeekAssignment?.status || 'Not Started'], color: ASSIGNMENT_STATUS_COLOR[thisWeekAssignment?.status || 'Not Started'] }}>
                      {thisWeekAssignment?.status || 'Not Started'}
                    </span>
                    {thisWeekAssignment?.score && (
                      <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', color: 'var(--amber-deep)' }}>{thisWeekAssignment.score}/100</span>
                    )}
                  </div>
                </div>
                <Link href="/portal/assignments" className="btn btn-sm btn-primary">
                  {!thisWeekAssignment || thisWeekAssignment.status === 'Not Started' ? 'Submit' : thisWeekAssignment.status === 'Needs Revision' ? 'Resubmit' : 'View'}
                </Link>
              </div>
            </div>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: 40 }}>
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem' }}>Program starts June 6, 2026</p>
              <p style={{ color: 'var(--ink-muted)', marginTop: 8 }}>Week 0 content will be available on that date.</p>
            </div>
          )}

          {/* Recent feedback */}
          {typedAssignments.filter(a => a.feedback).length > 0 && (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500 }}>Recent Feedback</h3>
                <Link href="/portal/assignments" style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}>All →</Link>
              </div>
              {typedAssignments.filter(a => a.feedback).slice(-2).reverse().map(a => (
                <div key={a.id} style={{ padding: '14px', background: 'var(--paper-soft)', borderRadius: 6, borderLeft: '3px solid var(--amber)', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <p style={{ fontWeight: 700, fontSize: '0.875rem' }}>Week {a.week_number} — {a.pathway}</p>
                    {a.score && <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', color: 'var(--amber-deep)' }}>{a.score}/100</span>}
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.6, fontStyle: 'italic' }}>"{a.feedback?.substring(0, 180)}{(a.feedback?.length || 0) > 180 ? '...' : ''}"</p>
                  {a.status === 'Needs Revision' && (
                    <Link href="/portal/assignments" className="btn btn-sm" style={{ marginTop: 10, background: 'var(--red)', color: 'var(--paper)', display: 'inline-flex' }}>
                      ↩ Resubmit Required
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Week timeline */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500 }}>Program Timeline</h3>
              <Link href="/portal/week" style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}>All Weeks →</Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {typedWeeks.map(w => {
                const weekAssign = typedAssignments.find(a => a.week_number === w.week_number && a.pathway === pathway);
                const isCurrent = w.week_number === currentWeek;
                const isPast = w.week_number < currentWeek;
                return (
                  <Link key={w.week_number} href={`/portal/week/${w.week_number}`} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 10px', borderRadius: 4, textDecoration: 'none',
                    background: isCurrent ? 'var(--paper-soft)' : 'transparent',
                    borderLeft: `2px solid ${isCurrent ? 'var(--amber)' : 'transparent'}`,
                  }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: isCurrent ? 700 : 400, color: isCurrent ? 'var(--ink)' : isPast ? 'var(--ink-muted)' : 'var(--ink)' }}>
                      Wk {w.week_number} · {w.title}
                    </span>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600 }}>
                      {weekAssign?.status === 'Approved' || weekAssign?.status === 'Portfolio Ready' ? '✓' :
                       weekAssign?.status === 'Submitted' || weekAssign?.status === 'AI Reviewed' ? '⏳' :
                       weekAssign?.status === 'Needs Revision' ? '↩' :
                       isCurrent ? <span style={{ color: 'var(--amber-deep)' }}>NOW</span> : ''}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Passport progress */}
          <div className="card" style={{ borderTop: '3px solid var(--amber)' }}>
            <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 12px' }}>
              <ProgressRing pct={(passportMet / passportChecks.length) * 100} color="var(--amber)" />
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500 }}>{passportMet}/{passportChecks.length}</span>
              </div>
            </div>
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, textAlign: 'center', marginBottom: 4 }}>Capability Passport</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', textAlign: 'center', marginBottom: 14 }}>
              {typedLearner.passport_issued ? '🏆 Issued' : `${passportChecks.length - passportMet} criteria remaining`}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {passportChecks.map(c => (
                <div key={c.label} style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ color: c.met ? 'var(--moss)' : 'var(--paper-line)', fontSize: '0.875rem', flexShrink: 0 }}>{c.met ? '✓' : '○'}</span>
                    <span style={{ fontSize: '0.8125rem', color: c.met ? 'var(--ink)' : 'var(--ink-muted)' }}>{c.label}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: c.met ? 'var(--moss)' : 'var(--amber-deep)' }}>{c.value}</span>
                </div>
              ))}
            </div>
            <Link href="/portal/passport" className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 14 }}>
              View Full Passport
            </Link>
          </div>

          {/* AI Practice Lab */}
          <div className="card">
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>AI Practice Lab</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { href: '/portal/simulation', icon: '🎭', label: 'Stakeholder Simulation', sub: 'Practise real workplace conversations' },
                { href: '/portal/interview', icon: '💬', label: 'Interview Coach', sub: `${pathway} interview questions + scoring` },
                { href: '/portal/writing-check', icon: '✍️', label: 'Writing Checker', sub: 'Polish docs before submitting' },
              ].map(({ href, icon, label, sub }) => (
                <Link key={href} href={href} style={{ display: 'flex', gap: 10, padding: '10px 12px', background: 'var(--paper-soft)', borderRadius: 6, textDecoration: 'none', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{icon}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--ink)' }}>{label}</p>
                    <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{sub}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Quick links */}
          <div className="card">
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Quick Access</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                { href: '/portal/assignments', label: '📝 My Assignments', sub: `${submittedCount} submitted` },
                { href: '/portal/portfolio', label: '💼 My Portfolio', sub: `${approvedCount} items` },
                { href: '/portal/community', label: '💬 Community', sub: 'Ask questions, share wins' },
                { href: '/portal/resources', label: '📚 Resources & Templates', sub: 'Find templates by week' },
              ].map(({ href, label, sub }) => (
                <Link key={href} href={href} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', background: 'var(--paper-soft)', borderRadius: 4, textDecoration: 'none' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{sub}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
