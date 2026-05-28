export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import type { Week, Attendance } from '@/lib/types';
import { PHASE_COLORS, WEEK_DATES } from '@/lib/types';
import Link from 'next/link';

function getCurrentWeek() {
  const now = new Date(); const start = new Date('2026-06-06');
  if (now < start) return 0;
  return Math.min(Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)), 12);
}

export default async function SessionsPage() {
  const { userId } = await auth();
  const db = createAdminClient();
  const currentWeek = getCurrentWeek();

  const [{ data: weeks }, { data: learner }] = await Promise.all([
    db.from('weeks').select('*').order('week_number'),
    db.from('learners').select('id, pathway, tier').eq('clerk_user_id', userId!).maybeSingle(),
  ]);

  const { data: attendance } = learner
    ? await db.from('attendance').select('*').eq('learner_id', learner.id)
    : { data: [] };

  const typedWeeks = (weeks || []) as Week[];
  const typedAttendance = (attendance || []) as Attendance[];

  function getAttendance(weekNum: number) {
    return typedAttendance.find(a => a.week_number === weekNum);
  }

  const attendedCount = typedAttendance.filter(a => a.attended).length;
  const totalSoFar = currentWeek + 1;
  const attendancePct = totalSoFar > 0 ? Math.round((attendedCount / totalSoFar) * 100) : 0;

  const pathway = learner?.pathway || 'PM';

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Cohort 1</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Live Sessions & Calendar</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>Every Saturday · June 6 – August 30, 2026</p>
      </div>

      {/* Attendance summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center', borderTop: `3px solid ${attendancePct >= 75 ? 'var(--moss)' : 'var(--amber-deep)'}` }}>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 500, color: attendancePct >= 75 ? 'var(--moss)' : 'var(--amber-deep)', lineHeight: 1 }}>{attendancePct}%</p>
          <p style={{ fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8 }}>Attendance Rate</p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginTop: 3 }}>75% required for Passport</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 500, lineHeight: 1 }}>{attendedCount}</p>
          <p style={{ fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8 }}>Sessions Attended</p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginTop: 3 }}>of {totalSoFar} held so far</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 500, color: 'var(--amber-deep)', lineHeight: 1 }}>{13 - totalSoFar}</p>
          <p style={{ fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8 }}>Sessions Remaining</p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginTop: 3 }}>through Demo Day</p>
        </div>
      </div>

      {/* Zoom link */}
      <div style={{ padding: '16px 20px', background: 'var(--ink)', color: 'var(--paper)', borderRadius: 6, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: '1rem' }}>📹 Live Session Link</p>
          <p style={{ color: 'rgba(250,247,241,0.6)', fontSize: '0.875rem', marginTop: 3 }}>
            Every Saturday · Same link for all sessions
          </p>
        </div>
        <a href="#" className="btn" style={{ background: 'var(--amber)', color: 'var(--paper)', flexShrink: 0 }}>
          Join Zoom Session →
        </a>
      </div>

      {/* Session list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {typedWeeks.map(week => {
          const att = getAttendance(week.week_number);
          const isPast = week.week_number < currentWeek;
          const isCurrent = week.week_number === currentWeek;
          const isFuture = week.week_number > currentWeek;
          const phaseColor = PHASE_COLORS[week.phase || 'Foundation'];
          const weekDate = WEEK_DATES.find(w => w.week === week.week_number);
          const assignTitle = pathway === 'PM' ? week.pm_assignment_title : week.ba_assignment_title;
          const dueDate = pathway === 'PM' ? week.pm_due_date : week.ba_due_date;

          return (
            <div key={week.week_number} className="card" style={{
              borderLeft: `4px solid ${isCurrent ? 'var(--amber)' : isPast ? (att?.attended ? 'var(--moss)' : 'var(--red)') : 'var(--paper-line)'}`,
              opacity: isFuture && !week.is_published ? 0.6 : 1,
              padding: '16px 20px',
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                <div>
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                      Week {week.week_number}
                    </span>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: `${phaseColor}18`, color: phaseColor }}>
                      {week.phase}
                    </span>
                    {isCurrent && (
                      <span style={{ fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3, background: 'rgba(197,116,58,0.12)', color: 'var(--amber-deep)' }}>
                        THIS WEEK
                      </span>
                    )}
                    {isPast && att && (
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: att.attended ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)', color: att.attended ? 'var(--moss)' : 'var(--red)' }}>
                        {att.arrival || (att.attended ? 'Attended' : 'Absent')}
                      </span>
                    )}
                  </div>

                  {/* Title */}
                  <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.0625rem', fontWeight: 500, marginBottom: 4 }}>
                    {week.title}
                  </h3>

                  {/* Date */}
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginBottom: 8 }}>
                    {weekDate?.session} · 10:00 AM (WAT) / 9:00 AM (BST)
                    {week.session_date && ` · ${new Date(week.session_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                  </p>

                  {/* Assignment due */}
                  {assignTitle && dueDate && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}>
                      📝 {assignTitle} · Due {new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  )}

                  {/* Recording / pre-work */}
                  {week.recording_url && (
                    <a href={week.recording_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', color: '#2563EB', fontWeight: 600, marginTop: 8 }}>
                      🎬 Watch recording →
                    </a>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                  {week.is_published && (
                    <Link href={`/portal/week/${week.week_number}`} className="btn btn-sm btn-outline">
                      View Content
                    </Link>
                  )}
                  {isCurrent && (
                    <a href="#" className="btn btn-sm btn-primary">
                      Join Session →
                    </a>
                  )}
                  {isPast && !att && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>Not marked</span>
                  )}
                </div>
              </div>

              {/* Missed session note */}
              {isPast && att && !att.attended && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(220,38,38,0.05)', borderRadius: 4, borderLeft: '2px solid var(--red)' }}>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--red)', fontWeight: 600 }}>
                    You missed this session.
                    {week.recording_url
                      ? <> <a href={week.recording_url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'underline' }}>Watch the recording</a> and email info@upthrustdigital.com to confirm.</>
                      : ' Watch the recording when it\'s available (check the Resources page) and email info@upthrustdigital.com to confirm.'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
