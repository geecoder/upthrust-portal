import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import type { Learner, Assignment } from '@/lib/types';
import { PASSPORT_CRITERIA, PROGRAM } from '@/lib/types';
import Link from 'next/link';

export default async function PassportPage() {
  const { userId } = await auth();
  const db = createAdminClient();
  const { data: learner } = await db.from('learners').select('*').eq('clerk_user_id', userId!).single();
  const typedLearner = learner as Learner | null;
  const { data: assignments } = learner ? await db.from('assignments').select('*').eq('learner_id', learner.id) : { data: [] };
  const typedAssignments = (assignments || []) as Assignment[];

  const approvedCount = typedAssignments.filter(a => a.status === 'Approved' || a.status === 'Portfolio Ready').length;

  const criteria = typedLearner ? [
    { label: 'Session Attendance', desc: 'Must attend ≥75% of live sessions', target: 75, actual: typedLearner.attendance_pct || 0, met: (typedLearner.attendance_pct || 0) >= PASSPORT_CRITERIA.attendance_min, unit: '%' },
    { label: 'Assignment Completion', desc: 'Must submit ≥80% of required assignments', target: 80, actual: typedLearner.assignment_completion_pct || 0, met: (typedLearner.assignment_completion_pct || 0) >= PASSPORT_CRITERIA.assignment_submission_min, unit: '%' },
    { label: 'Average Assignment Score', desc: 'Must achieve an average score of ≥70/100', target: 70, actual: typedLearner.avg_score || 0, met: (typedLearner.avg_score || 0) >= PASSPORT_CRITERIA.avg_score_min, unit: '/100' },
    { label: 'Capstone Submission', desc: 'Must submit and present your capstone project', target: 1, actual: typedLearner.capstone_status !== 'Not Started' ? 1 : 0, met: typedLearner.capstone_status !== 'Not Started', unit: '' },
    { label: 'Portfolio Items', desc: 'Must have ≥8 approved portfolio artefacts', target: 8, actual: approvedCount, met: approvedCount >= PASSPORT_CRITERIA.portfolio_items_min, unit: ' items' },
  ] : [];

  const metCount = criteria.filter(c => c.met).length;
  const eligible = metCount === criteria.length;
  const issued = typedLearner?.passport_issued;

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Your Achievement</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>Capability Passport</h1>
      </div>

      {/* Status banner */}
      <div style={{
        padding: '24px 28px', borderRadius: 8, marginBottom: 28,
        background: issued ? 'var(--moss)' : eligible ? 'var(--amber)' : 'var(--ink)',
        color: 'var(--paper)',
        display: 'flex', alignItems: 'center', gap: 20,
      }}>
        <span style={{ fontSize: '2.5rem' }}>{issued ? '🏆' : eligible ? '✅' : '🔒'}</span>
        <div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem', color: 'var(--paper)', marginBottom: 4 }}>
            {issued ? 'Passport Issued' : eligible ? 'Eligible — Pending Issuance' : 'Passport Locked'}
          </h2>
          <p style={{ color: 'rgba(250,247,241,0.8)', fontSize: '0.9375rem' }}>
            {issued ? `Issued on ${typedLearner?.passport_issued_at ? new Date(typedLearner.passport_issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Demo Day'}` :
              eligible ? 'You have met all criteria. Genesis will review and issue your Passport within 7 days of Demo Day.' :
              `${criteria.length - metCount} criteria still to meet. Keep going — you have until Week 12.`}
          </p>
        </div>
      </div>

      {/* Criteria */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500 }}>Passport Criteria</h2>
        {criteria.map((c, i) => (
          <div key={i} className="card" style={{ borderLeft: `3px solid ${c.met ? 'var(--moss)' : 'var(--paper-line)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontSize: '1.125rem' }}>{c.met ? '✅' : '○'}</span>
                  <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500 }}>{c.label}</h3>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', marginLeft: 28 }}>{c.desc}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', color: c.met ? 'var(--moss)' : 'var(--ink)', fontWeight: 500 }}>
                  {c.unit === '' ? (c.actual ? 'Done' : 'Pending') : `${c.actual}${c.unit}`}
                </p>
                <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>Target: {c.unit === '' ? 'Required' : `${c.target}${c.unit}`}</p>
              </div>
            </div>
            {c.unit !== '' && (
              <div style={{ height: 6, background: 'var(--paper-line)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min((c.actual / c.target) * 100, 100)}%`, background: c.met ? 'var(--moss)' : 'var(--amber)', borderRadius: 3, transition: 'width 600ms ease' }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* What the Passport is */}
      <div className="card" style={{ background: 'var(--paper-soft)' }}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 14 }}>What the Capability Passport means</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'It is not issued automatically — it is earned when you meet the evidence standard.',
            'It includes your capability scores across all assessed areas.',
            'It includes a summary of your capstone project and a facilitator review.',
            'It is shareable — employers can verify it using your unique Passport ID.',
            'Standard tier graduates receive a Completion Certificate. Passport is Premium tier only.',
          ].map((point, i) => (
            <p key={i} style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', display: 'flex', gap: 10 }}>
              <span style={{ color: 'var(--amber)', flexShrink: 0 }}>—</span>
              {point}
            </p>
          ))}
        </div>
        {typedLearner?.tier === 'Standard' && (
          <div style={{ marginTop: 18, padding: '14px 16px', background: 'rgba(197,116,58,0.08)', borderRadius: 6, border: '1px solid rgba(197,116,58,0.2)' }}>
            <p style={{ fontSize: '0.875rem', color: 'var(--amber-deep)', fontWeight: 600 }}>You are on Standard tier.</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', marginTop: 4 }}>Upgrade to Premium to become eligible for the Capability Passport. Contact Genesis at {PROGRAM.contact}</p>
          </div>
        )}
      </div>
    </div>
  );
}
