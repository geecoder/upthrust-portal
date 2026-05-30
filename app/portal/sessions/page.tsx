export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import type { Week, Attendance } from '@/lib/types';
import { PHASE_COLORS, WEEK_DATES } from '@/lib/types';
import Link from 'next/link';

function getCurrentWeek() {
  const now = new Date(); const start = new Date('2026-06-06');
  if (now < start) return -1;
  return Math.min(Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)), 12);
}

function isSessionPast(weekNum: number): boolean {
  const sessionDates: Record<number, string> = {
    0:'2026-06-06',1:'2026-06-14',2:'2026-06-21',3:'2026-06-28',
    4:'2026-07-05',5:'2026-07-12',6:'2026-07-19',7:'2026-07-26',
    8:'2026-08-02',9:'2026-08-09',10:'2026-08-16',11:'2026-08-23',12:'2026-08-30',
  };
  const d = sessionDates[weekNum];
  return d ? new Date(d) < new Date() : false;
}

export default async function SessionsPage() {
  const { userId } = await auth();
  const db = createAdminClient();
  const currentWeek = getCurrentWeek();

  const [{ data: weeks }, { data: learner }, { data: zoomConfig }] = await Promise.all([
    db.from('weeks').select('*').order('week_number'),
    db.from('learners').select('id, pathway, tier, attendance_pct').eq('clerk_user_id', userId!).maybeSingle(),
    db.from('weeks').select('zoom_link').eq('week_number', 0).maybeSingle(),
  ]);

  const { data: attendance } = learner
    ? await db.from('attendance').select('*').eq('learner_id', learner.id)
    : { data: [] };

  const typedWeeks = (weeks || []) as Week[];
  const typedAttendance = (attendance || []) as Attendance[];
  // Use Week 0's zoom link as the global recurring zoom link
  const globalZoomLink = zoomConfig?.zoom_link || '';

  function getAttendance(weekNum: number) {
    return typedAttendance.find(a => a.week_number === weekNum);
  }

  const attendedCount = typedAttendance.filter(a => a.attended).length;
  const sessionsPast = typedWeeks.filter(w => isSessionPast(w.week_number)).length;
  const attendancePct = sessionsPast > 0 ? Math.round((attendedCount / sessionsPast) * 100) : 100;

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Cohort 1</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Live Sessions</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>Every Saturday · June 6 – August 30, 2026 · 10:00 AM WAT / 9:00 AM BST</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <div className="card" style={{ textAlign: 'center', borderTop: `3px solid ${attendancePct >= 75 ? 'var(--moss)' : 'var(--amber-deep)'}` }}>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 500, color: attendancePct >= 75 ? 'var(--moss)' : 'var(--amber-deep)', lineHeight: 1 }}>{attendancePct}%</p>
          <p style={{ fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8 }}>Attendance Rate</p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginTop: 3 }}>75% required for Passport</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 500, lineHeight: 1 }}>{attendedCount}</p>
          <p style={{ fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8 }}>Sessions Attended</p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginTop: 3 }}>of {sessionsPast} held so far</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 500, color: 'var(--amber-deep)', lineHeight: 1 }}>{13 - sessionsPast}</p>
          <p style={{ fontWeight: 700, fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 8 }}>Sessions Remaining</p>
          <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', marginTop: 3 }}>through Demo Day</p>
        </div>
      </div>

      {/* Global Zoom link — shown if set */}
      {globalZoomLink ? (
        <div style={{ padding: '16px 20px', background: 'var(--ink)', color: 'var(--paper)', borderRadius: 6, marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: '1rem' }}>📹 Recurring Session Link</p>
            <p style={{ color: 'rgba(250,247,241,0.6)', fontSize: '0.875rem', marginTop: 3 }}>Same link for every Saturday session</p>
          </div>
          <a href={globalZoomLink} target="_blank" rel="noopener noreferrer" className="btn" style={{ background: 'var(--amber)', color: 'var(--paper)', flexShrink: 0 }}>
            Join Session on Zoom →
          </a>
        </div>
      ) : (
        <div style={{ padding: '14px 18px', background: 'rgba(197,116,58,0.07)', border: '1px solid rgba(197,116,58,0.2)', borderRadius: 6, marginBottom: 24 }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--amber-deep)', fontWeight: 600 }}>
            📹 Zoom link coming soon — Genesis will add it before June 6.
          </p>
        </div>
      )}

      {/* Session list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {typedWeeks.map(week => {
          const att = getAttendance(week.week_number);
          const isPast = isSessionPast(week.week_number);
          const isCurrent = week.week_number === currentWeek;
          const isFuture = !isPast && !isCurrent;
          const phaseColor = PHASE_COLORS[week.phase || 'Foundation'];
          const weekDate = WEEK_DATES.find(w => w.week === week.week_number);
          const pathway = learner?.pathway || 'PM';
          const assignTitle = pathway === 'PM' ? week.pm_assignment_title : week.ba_assignment_title;
          const dueDate = pathway === 'PM' ? week.pm_due_date : week.ba_due_date;
          // Only show recording if past AND recording URL exists
          const showRecording = isPast && !!week.recording_url;
          // Only show Join button if current week AND zoom link exists
          const zoomLink = week.zoom_link || globalZoomLink;

          return (
            <div key={week.week_number} className="card" style={{
              borderLeft: `4px solid ${isCurrent ? 'var(--amber)' : isPast ? (att?.attended ? 'var(--moss)' : att ? 'var(--red)' : 'var(--paper-line)') : 'var(--paper-line)'}`,
              padding: '16px 20px',
              opacity: isFuture && !week.is_published ? 0.7 : 1,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'start' }}>
                <div>
                  {/* Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--ink-muted)' }}>
                      Week {week.week_number}
                    </span>
                    <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: `${phaseColor}18`, color: phaseColor }}>
                      {week.phase}
                    </span>
                    {isCurrent && <span style={{ fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 3, background: 'rgba(197,116,58,0.12)', color: 'var(--amber-deep)' }}>THIS WEEK</span>}
                    {isPast && att && (
                      <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: att.attended ? 'rgba(5,150,105,0.1)' : 'rgba(220,38,38,0.1)', color: att.attended ? 'var(--moss)' : 'var(--red)' }}>
                        {att.arrival || (att.attended ? 'Attended' : 'Absent')}
                      </span>
                    )}
                    {isPast && !att && (
                      <span style={{ fontSize: '0.5625rem', color: 'var(--ink-muted)' }}>Not recorded</span>
                    )}
                  </div>

                  <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.0625rem', fontWeight: 500, marginBottom: 4 }}>{week.title}</h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginBottom: 6 }}>
                    {weekDate?.session} · 10:00 AM WAT / 9:00 AM BST
                  </p>
                  {assignTitle && dueDate && (
                    <p style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600 }}>
                      📝 {assignTitle} · Due {new Date(dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  )}
                  {/* Recording — only for past sessions with a recording URL */}
                  {showRecording && (
                    <a href={week.recording_url!} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', color: '#2563EB', fontWeight: 600, marginTop: 8 }}>
                      🎬 Watch recording →
                    </a>
                  )}
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}>
                  {week.is_published && (
                    <Link href={`/portal/week/${week.week_number}`} className="btn btn-sm btn-outline">
                      View Content
                    </Link>
                  )}
                  {/* Join button: only for current or next session, only if zoom link exists */}
                  {(isCurrent || (week.week_number === currentWeek + 1)) && zoomLink && (
                    <a href={zoomLink} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-primary">
                      Join Session →
                    </a>
                  )}
                  {/* If current but no zoom link yet */}
                  {isCurrent && !zoomLink && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>Zoom link soon</span>
                  )}
                </div>
              </div>

              {/* Missed session alert */}
              {isPast && att && !att.attended && (
                <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(220,38,38,0.05)', borderRadius: 4, borderLeft: '2px solid var(--red)' }}>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--red)', fontWeight: 600 }}>
                    You missed this session.{' '}
                    {showRecording
                      ? <><a href={week.recording_url!} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--red)', textDecoration: 'underline' }}>Watch the recording</a> and email info@upthrustdigital.com to confirm.</>
                      : 'The recording will appear here once available.'}
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
