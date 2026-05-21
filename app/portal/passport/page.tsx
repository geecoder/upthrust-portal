export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import type { Learner, Assignment } from '@/lib/types';
import { PASSPORT_CRITERIA, PROGRAM } from '@/lib/types';
import Link from 'next/link';

export default async function PassportPage() {
  const { userId } = await auth();
  const db = createAdminClient();

  const { data: learner } = await db
    .from('learners').select('*').eq('clerk_user_id', userId!).maybeSingle();
  const typedLearner = learner as Learner | null;

  const { data: assignments } = learner
    ? await db.from('assignments').select('*').eq('learner_id', learner.id)
    : { data: [] };
  const typedAssignments = (assignments || []) as Assignment[];

  const approvedCount = typedAssignments.filter(
    a => a.status === 'Approved' || a.status === 'Portfolio Ready'
  ).length;

  const criteria = typedLearner ? [
    { label: 'Session Attendance ≥75%', target: 75, actual: typedLearner.attendance_pct || 0, met: (typedLearner.attendance_pct || 0) >= PASSPORT_CRITERIA.attendance_min, unit: '%' },
    { label: 'Assignments Submitted ≥80%', target: 80, actual: typedLearner.assignment_completion_pct || 0, met: (typedLearner.assignment_completion_pct || 0) >= PASSPORT_CRITERIA.assignment_submission_min, unit: '%' },
    { label: 'Average Score ≥70/100', target: 70, actual: typedLearner.avg_score || 0, met: (typedLearner.avg_score || 0) >= PASSPORT_CRITERIA.avg_score_min, unit: '' },
    { label: 'Capstone Submitted & Presented', target: 1, actual: typedLearner.capstone_status !== 'Not Started' ? 1 : 0, met: typedLearner.capstone_status !== 'Not Started', unit: '' },
    { label: 'Portfolio Items Approved ≥8', target: 8, actual: approvedCount, met: approvedCount >= PASSPORT_CRITERIA.portfolio_items_min, unit: '' },
  ] : [];

  const metCount = criteria.filter(c => c.met).length;
  const eligible = metCount === criteria.length;
  const issued = typedLearner?.passport_issued;
  const isPremium = typedLearner?.tier === 'Premium';

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>
          Your Achievement
        </p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em' }}>
          Capability Passport
        </h1>
      </div>

      {/* Status banner */}
      <div style={{
        padding: '24px 28px', borderRadius: 8, marginBottom: 28,
        background: issued ? 'var(--moss)' : eligible ? 'var(--amber)' : 'var(--ink)',
        color: 'var(--paper)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 20,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: '2.5rem' }}>
            {issued ? '🏆' : eligible ? '✅' : '🔒'}
          </span>
          <div>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem', color: 'var(--paper)', marginBottom: 4 }}>
              {issued ? 'Passport Issued' : eligible ? 'Eligible — Pending Issuance' : 'Passport Locked'}
            </h2>
            <p style={{ color: 'rgba(250,247,241,0.8)', fontSize: '0.9375rem' }}>
              {issued
                ? `Issued ${typedLearner?.passport_issued_at ? new Date(typedLearner.passport_issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'on Demo Day'}`
                : eligible
                  ? 'You have met all criteria. Genesis will issue your Passport within 7 days of Demo Day.'
                  : `${criteria.length - metCount} of ${criteria.length} criteria still to meet.`}
            </p>
          </div>
        </div>

        {/* Download button — only if issued */}
        {issued && isPremium && (
          <a
            href="/api/passport-pdf"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              padding: '12px 20px',
              background: 'rgba(250,247,241,0.15)',
              border: '1.5px solid rgba(250,247,241,0.4)',
              color: 'var(--paper)',
              fontWeight: 700, fontSize: '0.875rem',
              textDecoration: 'none', borderRadius: 6,
              display: 'flex', alignItems: 'center', gap: 8,
              transition: 'background 150ms',
              flexShrink: 0,
            }}
          >
            ⬇ Download Passport PDF
          </a>
        )}
      </div>

      {/* Not premium notice */}
      {!isPremium && (
        <div style={{ marginBottom: 24, padding: '16px 20px', background: 'rgba(197,116,58,0.08)', border: '1px solid rgba(197,116,58,0.2)', borderRadius: 6, borderLeft: '3px solid var(--amber)' }}>
          <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--amber-deep)', marginBottom: 4 }}>
            Capability Passport requires Premium tier
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
            You are on Standard tier. Standard tier graduates receive a Completion Certificate. To upgrade to Premium and unlock the Capability Passport, email{' '}
            <a href={`mailto:${PROGRAM.contact}`} style={{ color: 'var(--amber-deep)', fontWeight: 600 }}>{PROGRAM.contact}</a>
          </p>
        </div>
      )}

      {/* Criteria */}
      <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500, marginBottom: 16 }}>
        Your Progress Against Criteria
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
        {criteria.map((c, i) => (
          <div key={i} className="card" style={{ borderLeft: `3px solid ${c.met ? 'var(--moss)' : 'var(--paper-line)'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: c.unit !== '' ? 12 : 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.125rem' }}>{c.met ? '✅' : '○'}</span>
                <h3 style={{ fontFamily: 'Fraunces, serif', fontSize: '1rem', fontWeight: 500 }}>{c.label}</h3>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', color: c.met ? 'var(--moss)' : 'var(--ink)', fontWeight: 500 }}>
                  {c.unit === '' ? (c.actual ? '✓ Done' : 'Not yet') : `${c.actual}${c.unit}`}
                </p>
              </div>
            </div>
            {c.unit !== '' && (
              <div style={{ height: 5, background: 'var(--paper-line)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min((c.actual / c.target) * 100, 100)}%`,
                  background: c.met ? 'var(--moss)' : 'var(--amber)',
                  borderRadius: 3, transition: 'width 600ms ease',
                }} />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* What the Passport means */}
      <div className="card" style={{ background: 'var(--paper-soft)' }}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 14 }}>
          What the Capability Passport includes
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            'Your name, pathway, cohort, and a unique Passport ID',
            'Six capability areas with individual proficiency scores',
            'Your average assignment score and attendance record',
            'Number of approved portfolio artefacts',
            'A facilitator summary from Genesis on your capstone performance',
            'A QR code that employers can scan to verify the Passport',
            'Downloadable as a professional A4 PDF document',
          ].map((point, i) => (
            <p key={i} style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', display: 'flex', gap: 10 }}>
              <span style={{ color: 'var(--amber)', flexShrink: 0 }}>—</span>
              {point}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
