export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Week, Learner, Assignment } from '@/lib/types';
import { PHASE_COLORS, ASSIGNMENT_STATUS_COLOR, ASSIGNMENT_STATUS_BG } from '@/lib/types';

export default async function WeekDetailPage({ params }: { params: Promise<{ weekNum: string }> }) {
  const { userId } = await auth();
  const { weekNum } = await params;
  const weekNumber = parseInt(weekNum);
  if (isNaN(weekNumber) || weekNumber < 0 || weekNumber > 12) notFound();

  const db = createAdminClient();
  const isAdmin = userId === process.env.ADMIN_USER_ID;

  const [{ data: week }, { data: learner }] = await Promise.all([
    db.from('weeks').select('*').eq('week_number', weekNumber).maybeSingle(),
    isAdmin ? { data: null } : db.from('learners').select('*').eq('clerk_user_id', userId!).maybeSingle(),
  ]);

  if (!week || (!isAdmin && !(week as Week).is_published)) {
    return (
      <div className="portal-content">
        <Link href="/portal/week" style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
          ← All Weeks
        </Link>
        <div className="card" style={{ textAlign: 'center', padding: 56 }}>
          <p style={{ fontSize: '3rem', marginBottom: 12 }}>🔒</p>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: 8 }}>Week {weekNumber} isn't available yet</p>
          <p style={{ color: 'var(--ink-muted)', marginBottom: 20 }}>This week's content will be published before the session.</p>
          <Link href="/portal/week" className="btn btn-outline">← Back to all weeks</Link>
        </div>
      </div>
    );
  }

  const typedWeek = week as Week;
  const typedLearner = learner as Learner | null;
  const pathway = typedLearner?.pathway === 'BA' ? 'BA' : 'PM';

  let assignment: Assignment | null = null;
  if (typedLearner) {
    const { data } = await db
      .from('assignments')
      .select('*')
      .eq('learner_id', typedLearner.id)
      .eq('week_number', weekNumber)
      .maybeSingle();
    assignment = data as Assignment | null;
  }

  const phaseColor = PHASE_COLORS[typedWeek.phase || 'Foundation'];
  const assignTitle = pathway === 'PM' ? typedWeek.pm_assignment_title : typedWeek.ba_assignment_title;
  const assignBrief = pathway === 'PM' ? typedWeek.pm_assignment_brief : typedWeek.ba_assignment_brief;
  const assignDeliverable = pathway === 'PM' ? typedWeek.pm_deliverable : typedWeek.ba_deliverable;
  const assignDue = pathway === 'PM' ? typedWeek.pm_due_date : typedWeek.ba_due_date;
  const assignStatus = assignment?.status || 'Not Started';

  const outcomes = typedWeek.outcomes ? typedWeek.outcomes.split(',').map(o => o.trim()).filter(Boolean) : [];
  const resources = typedWeek.resources ? typedWeek.resources.split(',').map(r => r.trim()).filter(Boolean) : [];

  return (
    <div className="portal-content">
      {/* Back nav */}
      <Link href="/portal/week" style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
        ← All Weeks
      </Link>

      {/* Header */}
      <div style={{ marginBottom: 28, borderLeft: `4px solid ${phaseColor}`, paddingLeft: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', padding: '3px 8px', background: `${phaseColor}18`, color: phaseColor, borderRadius: 2 }}>
            Week {typedWeek.week_number} · {typedWeek.phase}
          </span>
          {!typedWeek.is_published && isAdmin && (
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 7px', borderRadius: 2, background: 'rgba(107,114,128,0.1)', color: 'var(--ink-muted)' }}>Draft — not visible to learners</span>
          )}
        </div>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '2rem', fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 8 }}>
          {typedWeek.title}
        </h1>
        {typedWeek.why_it_matters && (
          <p style={{ fontSize: '1.0625rem', color: 'var(--ink-soft)', lineHeight: 1.65, fontStyle: 'italic', maxWidth: 680 }}>
            {typedWeek.why_it_matters}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Learning outcomes */}
          {outcomes.length > 0 && (
            <div className="card" style={{ borderTop: `3px solid ${phaseColor}` }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 14 }}>
                By end of this week you can
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {outcomes.map((o, i) => (
                  <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontWeight: 800, color: phaseColor, flexShrink: 0, fontSize: '0.875rem', marginTop: 2 }}>→</span>
                    <p style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.55 }}>{o}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pre-work */}
          {typedWeek.pre_work && (
            <div className="card" style={{ background: 'rgba(197,116,58,0.04)', borderLeft: '3px solid var(--amber)' }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--amber-deep)', marginBottom: 10 }}>
                ⏰ Before the session — Pre-Work
              </p>
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {typedWeek.pre_work}
              </p>
            </div>
          )}

          {/* Session topics */}
          {typedWeek.concept_topics && (
            <div className="card">
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 12 }}>
                📋 Session Topics
              </p>
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {typedWeek.concept_topics}
              </p>
            </div>
          )}

          {/* Case study */}
          {typedWeek.case_study && (
            <div className="card" style={{ background: 'var(--paper-soft)' }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 12 }}>
                🧩 Case Study / Scenario
              </p>
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {typedWeek.case_study}
              </p>
            </div>
          )}

          {/* Lab exercise */}
          {typedWeek.lab_exercise && (
            <div className="card" style={{ borderLeft: '3px solid var(--moss)' }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: 12 }}>
                🔬 Practical Lab
              </p>
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
                {typedWeek.lab_exercise}
              </p>
            </div>
          )}

          {/* Assignment brief */}
          {assignBrief && (
            <div className="card" style={{ borderLeft: `3px solid ${assignStatus === 'Approved' || assignStatus === 'Portfolio Ready' ? 'var(--moss)' : assignStatus !== 'Not Started' ? '#2563EB' : 'var(--amber)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                <div>
                  <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--amber-deep)', marginBottom: 6 }}>
                    📝 {pathway} Assignment
                  </p>
                  <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500 }}>{assignTitle}</h3>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
                    {assignDue && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                        Due {new Date(assignDue).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                      </span>
                    )}
                    {assignDeliverable && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>· {assignDeliverable}</span>
                    )}
                  </div>
                </div>
                {typedLearner && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{
                      fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                      padding: '3px 8px', borderRadius: 100,
                      background: ASSIGNMENT_STATUS_BG[assignStatus],
                      color: ASSIGNMENT_STATUS_COLOR[assignStatus],
                    }}>
                      {assignStatus}
                    </span>
                    {assignment?.score && (
                      <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', color: 'var(--amber-deep)' }}>
                        {assignment.score}/100
                      </span>
                    )}
                    <Link href="/portal/assignments" className="btn btn-sm btn-primary">
                      {assignStatus === 'Not Started' ? 'Submit Work' : assignStatus === 'Needs Revision' ? 'Resubmit →' : 'View Status'}
                    </Link>
                  </div>
                )}
              </div>
              <div style={{ padding: '14px 16px', background: 'var(--paper-soft)', borderRadius: 6 }}>
                <p style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {assignBrief}
                </p>
              </div>
              {assignment?.ai_feedback && (
                <div style={{ marginTop: 14, padding: '14px 16px', background: 'rgba(124,58,237,0.05)', borderRadius: 6, borderLeft: '2px solid #7C3AED' }}>
                  <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#7C3AED', marginBottom: 8 }}>⚡ AI First-Pass Feedback</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.65, fontStyle: 'italic' }}>
                    "{assignment.ai_feedback.substring(0, 300)}{assignment.ai_feedback.length > 300 ? '...' : ''}"
                  </p>
                </div>
              )}
              {assignment?.feedback && (
                <div style={{ marginTop: 10, padding: '12px 16px', background: 'rgba(79,106,74,0.06)', borderRadius: 6, borderLeft: '2px solid var(--moss)' }}>
                  <p style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: 8 }}>
                    ✓ Genesis Feedback {assignment.score ? `· ${assignment.score}/100` : ''}
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.65, fontStyle: 'italic' }}>"{assignment.feedback}"</p>
                </div>
              )}
            </div>
          )}

          {/* Reflection */}
          {typedWeek.reflection_prompt && (
            <div className="card" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(250,247,241,0.4)', marginBottom: 10 }}>
                Reflection
              </p>
              <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.0625rem', fontStyle: 'italic', lineHeight: 1.55, color: 'var(--paper)', fontWeight: 400 }}>
                "{typedWeek.reflection_prompt}"
              </p>
              <p style={{ fontSize: '0.8125rem', color: 'rgba(250,247,241,0.45)', marginTop: 10 }}>
                Post your reflection in the community feed or keep it in your notes.
              </p>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Session info */}
          <div className="card">
            <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 12 }}>Session Info</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {typedWeek.session_date && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                  <span style={{ color: 'var(--ink-muted)' }}>Date</span>
                  <span style={{ fontWeight: 600 }}>{new Date(typedWeek.session_date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--ink-muted)' }}>Time</span>
                <span style={{ fontWeight: 600 }}>10:00 WAT / 9:00 BST</span>
              </div>
              {typedWeek.zoom_link ? (
                <a href={typedWeek.zoom_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ marginTop: 4, justifyContent: 'center' }}>
                  Join Zoom Session →
                </a>
              ) : (
                <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>Zoom link will appear here</p>
              )}
            </div>
          </div>

          {/* Recording + slides */}
          {(typedWeek.recording_url || typedWeek.session_slides_url) && (
            <div className="card">
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 12 }}>Session Materials</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {typedWeek.recording_url && (
                  <a href={typedWeek.recording_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    🎬 Watch Recording
                  </a>
                )}
                {typedWeek.session_slides_url && (
                  <a href={typedWeek.session_slides_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm">
                    📑 Session Slides
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Resources link */}
          <div className="card" style={{ background: 'var(--paper-soft)' }}>
            <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 10 }}>Templates & Resources</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', marginBottom: 12, lineHeight: 1.55 }}>
              Find templates, examples, and tools for Week {weekNumber} in the Resource Hub.
            </p>
            <Link href={`/portal/resources?week=${weekNumber}`} className="btn btn-outline btn-sm" style={{ display: 'block', textAlign: 'center' }}>
              Open Resource Hub →
            </Link>
          </div>

          {/* Week navigation */}
          <div className="card">
            <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 12 }}>Navigate</p>
            <div style={{ display: 'flex', gap: 8 }}>
              {weekNumber > 0 && (
                <Link href={`/portal/week/${weekNumber - 1}`} className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                  ← Week {weekNumber - 1}
                </Link>
              )}
              {weekNumber < 12 && (
                <Link href={`/portal/week/${weekNumber + 1}`} className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                  Week {weekNumber + 1} →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
