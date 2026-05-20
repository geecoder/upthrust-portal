import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Week } from '@/lib/types';
import { PHASE_COLORS } from '@/lib/types';

export default async function WeekDetailPage({ params }: { params: { weekNum: string } }) {
  const { userId } = await auth();
  const weekNum = parseInt(params.weekNum);
  if (isNaN(weekNum) || weekNum < 0 || weekNum > 12) notFound();

  const db = createAdminClient();
  const { data: week } = await db.from('weeks').select('*').eq('week_number', weekNum).eq('is_published', true).single();
  if (!week) return <div className="portal-content"><p>This week is not yet available.</p></div>;

  const typedWeek = week as Week;
  const { data: learner } = await db.from('learners').select('pathway').eq('clerk_user_id', userId!).single();
  const pathway = learner?.pathway === 'PM' || learner?.pathway === 'BA' ? learner.pathway : 'PM';
  const phaseColor = PHASE_COLORS[typedWeek.phase || 'Foundation'];

  const assignTitle = pathway === 'PM' ? typedWeek.pm_assignment_title : typedWeek.ba_assignment_title;
  const assignBrief = pathway === 'PM' ? typedWeek.pm_assignment_brief : typedWeek.ba_assignment_brief;
  const dueDate = pathway === 'PM' ? typedWeek.pm_due_date : typedWeek.ba_due_date;

  return (
    <div className="portal-content">
      {/* Back */}
      <Link href="/portal/week" style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>
        ← All Weeks
      </Link>

      {/* Header */}
      <div style={{ padding: '24px 28px', background: 'var(--ink)', color: 'var(--paper)', borderRadius: 8, marginBottom: 24, borderTop: `4px solid ${phaseColor}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(250,247,241,0.5)', marginBottom: 8 }}>
              Week {typedWeek.week_number} · {typedWeek.phase}
            </p>
            <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(1.5rem, 3vw, 2rem)', fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--paper)' }}>
              {typedWeek.title}
            </h1>
          </div>
          {typedWeek.session_date && (
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(250,247,241,0.4)', marginBottom: 2 }}>Live Session</p>
              <p style={{ fontWeight: 600, color: 'var(--amber-soft)' }}>{new Date(typedWeek.session_date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Main content */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Learning goals */}
          {typedWeek.learning_goals && (
            <div className="card">
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 14 }}>🎯 Learning Goals</h2>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none' }}>
                {typedWeek.learning_goals.split(',').map((goal, i) => (
                  <li key={i} style={{ display: 'flex', gap: 10, fontSize: '0.9375rem', color: 'var(--ink-soft)' }}>
                    <span style={{ color: 'var(--amber)', flexShrink: 0, marginTop: 1 }}>→</span>
                    {goal.trim()}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Concept class */}
          {typedWeek.concept_topics && (
            <div className="card">
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 14 }}>📖 Concept Class</h2>
              <div style={{ whiteSpace: 'pre-line', fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.7 }}>{typedWeek.concept_topics}</div>
            </div>
          )}

          {/* Case study */}
          {typedWeek.case_study && (
            <div className="card" style={{ borderLeft: '3px solid var(--amber)' }}>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 12 }}>🔍 Real-World Case Study</h2>
              <div style={{ whiteSpace: 'pre-line', fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.7 }}>{typedWeek.case_study}</div>
            </div>
          )}

          {/* Lab */}
          {typedWeek.lab_exercise && (
            <div className="card" style={{ borderLeft: '3px solid var(--moss)' }}>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 12 }}>🛠️ Practical Lab</h2>
              <div style={{ whiteSpace: 'pre-line', fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.7 }}>{typedWeek.lab_exercise}</div>
            </div>
          )}

          {/* Session notes / recording */}
          {(typedWeek.session_notes || typedWeek.recording_url) && (
            <div className="card">
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 12 }}>📹 Session Notes & Recording</h2>
              {typedWeek.recording_url && (
                <a href={typedWeek.recording_url} target="_blank" rel="noopener noreferrer" className="btn btn-outline btn-sm" style={{ marginBottom: 14 }}>
                  Watch Recording →
                </a>
              )}
              {typedWeek.session_notes && (
                <div style={{ whiteSpace: 'pre-line', fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.7 }}>{typedWeek.session_notes}</div>
              )}
            </div>
          )}
        </div>

        {/* Right: assignment */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {assignTitle && (
            <div className="card" style={{ borderTop: `3px solid ${phaseColor}` }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 8 }}>
                {pathway} Assignment
              </p>
              <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 12 }}>{assignTitle}</h3>
              {dueDate && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--amber-deep)', fontWeight: 600, marginBottom: 12 }}>
                  Due: {new Date(dueDate).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
              )}
              {assignBrief && <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.65, marginBottom: 16 }}>{assignBrief}</p>}
              <Link href="/portal/assignments" className="btn btn-primary" style={{ display: 'block', textAlign: 'center' }}>Submit This Assignment</Link>
            </div>
          )}

          {/* Reflection */}
          {typedWeek.reflection_prompt && (
            <div className="card" style={{ background: 'var(--paper-soft)' }}>
              <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 8 }}>Reflection Prompt</p>
              <p style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.6 }}>
                "{typedWeek.reflection_prompt}"
              </p>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 8 }}>
            {weekNum > 0 && <Link href={`/portal/week/${weekNum - 1}`} className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center' }}>← Previous</Link>}
            {weekNum < 12 && <Link href={`/portal/week/${weekNum + 1}`} className="btn btn-outline btn-sm" style={{ flex: 1, justifyContent: 'center' }}>Next →</Link>}
          </div>
        </div>
      </div>
    </div>
  );
}
