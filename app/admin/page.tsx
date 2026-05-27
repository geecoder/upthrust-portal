export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import Link from 'next/link';
import type { Learner, Assignment } from '@/lib/types';
import { RISK_COLOR } from '@/lib/types';

function StatCard({ value, label, sub, color = 'var(--ink)', href }: {
  value: string | number; label: string; sub?: string; color?: string; href?: string;
}) {
  const inner = (
    <div className="card" style={{ textAlign: 'center', padding: '20px 16px', borderTop: `3px solid ${color}`, cursor: href ? 'pointer' : 'default' }}>
      <p style={{ fontFamily: 'Fraunces, serif', fontSize: '2.25rem', fontWeight: 500, color, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</p>
      <p style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--ink)', marginTop: 8 }}>{label}</p>
      {sub && <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginTop: 3 }}>{sub}</p>}
    </div>
  );
  return href ? <Link href={href} style={{ textDecoration: 'none' }}>{inner}</Link> : inner;
}

export default async function AdminDashboard() {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/portal');

  const db = createAdminClient();

  const [
    { data: learners },
    { data: allAssignments },
    { data: weeks },
  ] = await Promise.all([
    db.from('learners').select('*').order('first_name'),
    db.from('assignments').select('*').order('submitted_at', { ascending: false }),
    db.from('weeks').select('week_number, title, session_date').eq('is_published', true).order('week_number'),
  ]);

  const typedLearners = (learners || []) as Learner[];
  const typedAssignments = (allAssignments || []) as Assignment[];

  // Stats
  const active = typedLearners.filter(l => l.enrollment_status === 'Active');
  const pending = typedAssignments.filter(a => a.status === 'Submitted' || a.status === 'AI Reviewed');
  const resubRequired = typedAssignments.filter(a => a.status === 'Resubmission Requested');
  const portfolioReady = typedAssignments.filter(a => a.status === 'Portfolio Ready' || a.portfolio_approved);
  const redLearners = typedLearners.filter(l => l.risk_status === 'Red');
  const amberLearners = typedLearners.filter(l => l.risk_status === 'Amber');
  const totalSubmissions = typedAssignments.filter(a => a.status !== 'Not Started').length;
  const currentWeek = getCurrentWeek();
  const expectedSubmissions = active.length * (currentWeek + 1);
  const submissionRate = expectedSubmissions > 0 ? Math.round((totalSubmissions / expectedSubmissions) * 100) : 0;

  // Recent submissions for review queue preview
  const recentPending = pending.slice(0, 5);

  // Learner risk summary
  const riskSummary = [
    { status: 'Red', count: redLearners.length, learners: redLearners, color: 'var(--red)' },
    { status: 'Amber', count: amberLearners.length, learners: amberLearners, color: 'var(--amber-deep)' },
    { status: 'Green', count: typedLearners.filter(l => l.risk_status === 'Green').length, learners: [], color: 'var(--moss)' },
  ];

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Cohort 1 — Command Centre</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
          Week {currentWeek} of 12 · {active.length} active learners · Updated live
        </p>
      </div>

      {/* Alert bar — Red learners need action */}
      {redLearners.length > 0 && (
        <div style={{ padding: '14px 18px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '1.25rem' }}>🔴</span>
            <div>
              <p style={{ fontWeight: 700, color: 'var(--red)' }}>{redLearners.length} learner{redLearners.length > 1 ? 's' : ''} at risk — action required within 48 hours</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: 2 }}>{redLearners.map(l => `${l.first_name} ${l.last_name || ''}`).join(' · ')}</p>
            </div>
          </div>
          <Link href="/admin" className="btn btn-danger btn-sm">View Learners</Link>
        </div>
      )}

      {/* Pending reviews alert */}
      {pending.length > 0 && (
        <div style={{ padding: '14px 18px', background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.25)', borderRadius: 6, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: '1.25rem' }}>📬</span>
            <div>
              <p style={{ fontWeight: 700, color: '#1D4ED8' }}>{pending.length} assignment{pending.length > 1 ? 's' : ''} waiting for your review</p>
              <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: 2 }}>Review within 48 hours to meet the SLA</p>
            </div>
          </div>
          <Link href="/admin/reviews" className="btn btn-primary btn-sm">Open Review Queue</Link>
        </div>
      )}

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 24 }}>
        <StatCard value={active.length} label="Active Learners" sub={`${typedLearners.length} total enrolled`} color="var(--ink)" href="/admin" />
        <StatCard value={pending.length} label="Pending Reviews" sub="Need feedback" color="#2563EB" href="/admin/reviews" />
        <StatCard value={resubRequired.length} label="Resubmissions" sub="Waiting for update" color="var(--amber-deep)" href="/admin/reviews" />
        <StatCard value={`${submissionRate}%`} label="Submission Rate" sub={`${totalSubmissions} of ~${expectedSubmissions} expected`} color="var(--moss)" />
        <StatCard value={portfolioReady.length} label="Portfolio Ready" sub="Artefacts approved" color="var(--amber)" href="/admin" />
      </div>

      {/* Main grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>

        {/* Left: Review queue + recent submissions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Review queue */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500 }}>Review Queue</h2>
              <Link href="/admin/reviews" className="btn btn-primary btn-sm">Open Full Queue →</Link>
            </div>
            {recentPending.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', background: 'var(--paper-soft)', borderRadius: 6 }}>
                <p style={{ color: 'var(--moss)', fontWeight: 600 }}>✓ All caught up — no pending reviews</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {recentPending.map(a => {
                  const learner = typedLearners.find(l => l.id === a.learner_id);
                  const submittedAgo = a.submitted_at
                    ? Math.floor((Date.now() - new Date(a.submitted_at).getTime()) / (1000 * 60 * 60))
                    : null;
                  const isOverdue = submittedAgo !== null && submittedAgo > 48;
                  return (
                    <div key={a.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '12px 14px', background: isOverdue ? 'rgba(220,38,38,0.04)' : 'var(--paper-soft)',
                      borderRadius: 4, borderLeft: `3px solid ${isOverdue ? 'var(--red)' : '#2563EB'}`,
                    }}>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.9rem' }}>
                          {learner?.first_name} {learner?.last_name} — Week {a.week_number} ({a.pathway})
                        </p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '1px 6px', borderRadius: 3, background: a.status === 'AI Reviewed' ? 'rgba(124,58,237,0.1)' : 'rgba(37,99,235,0.1)', color: a.status === 'AI Reviewed' ? '#7C3AED' : '#2563EB' }}>
                            {a.status}
                          </span>
                          {submittedAgo !== null && (
                            <span style={{ fontSize: '0.6875rem', color: isOverdue ? 'var(--red)' : 'var(--ink-muted)', fontWeight: isOverdue ? 700 : 400 }}>
                              {isOverdue ? `⚠ ${submittedAgo}h ago — overdue` : `${submittedAgo}h ago`}
                            </span>
                          )}
                        </div>
                      </div>
                      <Link href={`/admin/reviews?learner=${a.learner_id}&week=${a.week_number}`} className="btn btn-sm btn-primary">
                        Review
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Learner risk table */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500 }}>Learner Progress Overview</h2>
              <Link href="/admin" className="btn btn-outline btn-sm">All Learners →</Link>
            </div>
            <div className="table-wrapper" style={{ border: 'none' }}>
              <table>
                <thead>
                  <tr>
                    <th>Learner</th>
                    <th>Pathway</th>
                    <th>Risk</th>
                    <th>Submitted</th>
                    <th>Avg Score</th>
                    <th>Attendance</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {typedLearners.filter(l => l.enrollment_status === 'Active').map(l => {
                    const lAssignments = typedAssignments.filter(a => a.learner_id === l.id);
                    const submitted = lAssignments.filter(a => a.status !== 'Not Started').length;
                    return (
                      <tr key={l.id}>
                        <td>
                          <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{l.first_name} {l.last_name}</p>
                          <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>{l.email}</p>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: l.pathway === 'PM' ? 'rgba(15,26,46,0.08)' : 'rgba(160,90,38,0.1)', color: l.pathway === 'PM' ? 'var(--ink)' : 'var(--amber-deep)' }}>
                            {l.pathway}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: RISK_COLOR[l.risk_status || 'Green'] }} />
                            <span style={{ fontSize: '0.8125rem', color: RISK_COLOR[l.risk_status || 'Green'], fontWeight: 600 }}>{l.risk_status || 'Green'}</span>
                          </div>
                        </td>
                        <td>
                          <div>
                            <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{submitted}/{currentWeek + 1}</p>
                            <div style={{ width: 48, height: 3, background: 'var(--paper-line)', borderRadius: 2, marginTop: 4, overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${(currentWeek + 1) > 0 ? (submitted / (currentWeek + 1)) * 100 : 0}%`, background: 'var(--amber)', borderRadius: 2 }} />
                            </div>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, color: (l.avg_score || 0) >= 70 ? 'var(--moss)' : (l.avg_score || 0) > 0 ? 'var(--amber-deep)' : 'var(--ink-muted)' }}>
                          {l.avg_score ? `${l.avg_score}/100` : '—'}
                        </td>
                        <td style={{ fontSize: '0.875rem', color: (l.attendance_pct || 0) >= 75 ? 'var(--moss)' : 'var(--amber-deep)', fontWeight: 600 }}>
                          {l.attendance_pct ? `${l.attendance_pct}%` : '—'}
                        </td>
                        <td>
                          <Link href={`/admin/learners/${l.id}`} className="btn btn-sm btn-outline">View</Link>
                        </td>
                      </tr>
                    );
                  })}
                  {typedLearners.filter(l => l.enrollment_status === 'Active').length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--ink-muted)' }}>
                        No active learners yet. Add learners in the Learner Management section.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Monday checklist */}
          <div className="card" style={{ borderTop: '3px solid var(--amber)' }}>
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 14 }}>Weekly Checklist</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { done: pending.length === 0, text: 'Review all pending submissions' },
                { done: redLearners.length === 0, text: 'Contact Red-status learners' },
                { done: false, text: 'Update attendance for last session' },
                { done: false, text: 'Publish upcoming week content' },
                { done: false, text: 'Post cohort announcement if needed' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ color: item.done ? 'var(--moss)' : 'var(--paper-line)', fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>{item.done ? '✓' : '○'}</span>
                  <p style={{ fontSize: '0.875rem', color: item.done ? 'var(--ink-muted)' : 'var(--ink-soft)', textDecoration: item.done ? 'line-through' : 'none' }}>{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Risk breakdown */}
          <div className="card">
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 14 }}>Risk Status</h3>
            {riskSummary.map(({ status, count, color, learners: rLearners }) => (
              <div key={status} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color }}>{status}</span>
                  </div>
                  <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500 }}>{count}</span>
                </div>
                {rLearners.length > 0 && (
                  <div style={{ paddingLeft: 16 }}>
                    {rLearners.map(l => (
                      <Link key={l.id} href={`/admin/learners/${l.id}`} style={{ display: 'block', fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: 2 }}>
                        → {l.first_name} {l.last_name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Quick actions */}
          <div className="card">
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Quick Actions</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { href: '/admin/reviews', label: '📬 Open Review Queue', sub: `${pending.length} pending` },
                { href: '/admin/attendance', label: '📋 Mark Attendance', sub: `Week ${currentWeek}` },
                { href: '/admin/content', label: '✏️ Manage Week Content', sub: 'Publish next week' },
                { href: '/admin/cohort', label: '📣 Post Announcement', sub: 'All learners' },
                { href: '/admin', label: '👥 All Learners', sub: `${active.length} active` },
              ].map(({ href, label, sub }) => (
                <Link key={href} href={href} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'var(--paper-soft)', borderRadius: 4, textDecoration: 'none' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--ink)' }}>{label}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{sub}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Program timeline */}
          <div className="card">
            <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500, marginBottom: 12 }}>Content Published</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {(weeks || []).slice(0, 5).map((w: any) => (
                <div key={w.week_number} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 8px', borderRadius: 4, background: w.week_number === currentWeek ? 'var(--paper-soft)' : 'transparent' }}>
                  <span style={{ fontSize: '0.8125rem', color: w.week_number === currentWeek ? 'var(--ink)' : 'var(--ink-muted)', fontWeight: w.week_number === currentWeek ? 700 : 400 }}>
                    Wk {w.week_number} · {w.title}
                  </span>
                  {w.week_number === currentWeek && <span style={{ fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--amber-deep)' }}>NOW</span>}
                </div>
              ))}
              <Link href="/admin/content" style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600, padding: '5px 8px' }}>Manage content →</Link>
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
  return Math.min(Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)), 12);
}
