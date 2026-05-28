export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import type { Learner, Assignment, CapabilityScore } from '@/lib/types';
import { PASSPORT_CRITERIA, PROGRAM, CAPABILITY_AREAS } from '@/lib/types';
import Link from 'next/link';

const CAPABILITY_ASSIGNMENT_MAP: Record<string, string[]> = {
  'Product Thinking': ['Week 1 Teardown', 'Week 3 Strategy Canvas', 'Week 12 Capstone'],
  'Business Analysis': ['Week 1 Stakeholder Map', 'Week 2 Elicitation Notes', 'Week 4 BRD'],
  'Discovery & Problem Framing': ['Week 2 Problem Brief', 'Week 2 Elicitation Notes'],
  'Requirements & Documentation': ['Week 4 PRD/BRD', 'Week 8 User Stories', 'Week 10 UAT Pack'],
  'Stakeholder Management': ['Week 9 Simulation', 'Week 9 Workshop Pack'],
  'Delivery & Agile Collaboration': ['Week 8 Sprint Backlog', 'Week 7 Design Review'],
  'Communication & Facilitation': ['Week 5 Journey Map', 'Week 9 Workshop'],
  'Strategy & Commercial Thinking': ['Week 3 Strategy Canvas', 'Week 3 Business Case'],
  'AI-enabled Professional Practice': ['AI Practice Lab attempts'],
  'Portfolio & Career Readiness': ['Capstone Case Study', 'Portfolio completeness'],
};

const LEVEL_COLOR: Record<string, string> = {
  'Not Started': 'var(--ink-muted)',
  'Emerging': 'var(--amber-deep)',
  'Developing': '#2563EB',
  'Competent': 'var(--moss)',
  'Portfolio Ready': '#047857',
};

const LEVEL_BG: Record<string, string> = {
  'Not Started': 'rgba(107,114,128,0.08)',
  'Emerging': 'rgba(217,119,6,0.1)',
  'Developing': 'rgba(37,99,235,0.1)',
  'Competent': 'rgba(5,150,105,0.1)',
  'Portfolio Ready': 'rgba(4,120,87,0.12)',
};

const LEVEL_ORDER = ['Not Started', 'Emerging', 'Developing', 'Competent', 'Portfolio Ready'];

export default async function PassportPage() {
  const { userId } = await auth();
  const db = createAdminClient();

  const { data: learner } = await db.from('learners').select('*').eq('clerk_user_id', userId!).maybeSingle();
  const typedLearner = learner as Learner | null;

  const [{ data: assignments }, { data: capScores }, { data: aiAttempts }] = await Promise.all([
    learner ? db.from('assignments').select('*').eq('learner_id', learner.id) : { data: [] },
    learner ? db.from('capability_scores').select('*').eq('learner_id', learner.id) : { data: [] },
    learner ? db.from('ai_practice_attempts').select('*').eq('learner_id', learner.id).eq('completed', true) : { data: [] },
  ]);

  const typedAssignments = (assignments || []) as Assignment[];
  const typedCapScores = (capScores || []) as CapabilityScore[];

  const approvedCount = typedAssignments.filter(a =>
    a.status === 'Approved' || a.status === 'Portfolio Ready' || a.portfolio_approved
  ).length;
  const submittedCount = typedAssignments.filter(a => a.status !== 'Not Started').length;
  const totalExpected = 13;

  const criteria = typedLearner ? [
    { label: `Session Attendance ≥${PASSPORT_CRITERIA.attendance_min}%`, target: 75, actual: typedLearner.attendance_pct || 0, met: (typedLearner.attendance_pct || 0) >= PASSPORT_CRITERIA.attendance_min, unit: '%', detail: 'Attend live Saturday sessions' },
    { label: `Assignments Submitted ≥${PASSPORT_CRITERIA.assignment_submission_min}%`, target: 80, actual: typedLearner.assignment_completion_pct || 0, met: (typedLearner.assignment_completion_pct || 0) >= PASSPORT_CRITERIA.assignment_submission_min, unit: '%', detail: `${submittedCount} of ${totalExpected} submitted` },
    { label: `Average Score ≥${PASSPORT_CRITERIA.avg_score_min}/100`, target: 70, actual: typedLearner.avg_score || 0, met: (typedLearner.avg_score || 0) >= PASSPORT_CRITERIA.avg_score_min, unit: '/100', detail: 'Based on Genesis-reviewed submissions' },
    { label: 'Capstone Submitted & Presented', target: 1, actual: typedLearner.capstone_status !== 'Not Started' ? 1 : 0, met: typedLearner.capstone_status !== 'Not Started', unit: '', detail: 'Week 12 Demo Day' },
    { label: `≥${PASSPORT_CRITERIA.portfolio_items_min} Portfolio Items Approved`, target: 8, actual: approvedCount, met: approvedCount >= PASSPORT_CRITERIA.portfolio_items_min, unit: '', detail: `${approvedCount} of 8 required` },
  ] : [];

  const metCount = criteria.filter(c => c.met).length;
  const isPremium = typedLearner?.tier === 'Premium';
  const issued = typedLearner?.passport_issued;
  const approved = typedLearner?.passport_eligibility === 'Approved';
  const allMet = metCount === criteria.length;

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Your Achievement</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Capability Passport</h1>
        {typedLearner?.passport_id && (
          <p style={{ color: 'var(--ink-muted)', marginTop: 4, fontFamily: 'monospace', fontSize: '0.8125rem' }}>ID: {typedLearner.passport_id}</p>
        )}
      </div>

      {/* Status banner */}
      <div style={{
        padding: '22px 28px', borderRadius: 8, marginBottom: 24,
        background: issued ? '#047857' : approved ? 'var(--moss)' : allMet ? 'var(--amber-deep)' : 'var(--ink)',
        color: 'var(--paper)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: '2.5rem' }}>{issued ? '🏆' : approved ? '✅' : allMet ? '🔓' : '🔒'}</span>
          <div>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem', color: 'var(--paper)', marginBottom: 4 }}>
              {issued ? 'Capability Passport Issued' : approved ? 'Eligible — Pending Issuance' : allMet ? 'All Criteria Met!' : 'Passport Locked'}
            </h2>
            <p style={{ color: 'rgba(250,247,241,0.75)', fontSize: '0.9rem' }}>
              {issued
                ? `Issued ${typedLearner?.passport_issued_at ? new Date(typedLearner.passport_issued_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}`
                : approved ? 'Genesis will issue your Passport within 7 days of Demo Day.'
                : allMet ? 'You\'ve met all criteria. Genesis reviews and issues after Demo Day (Aug 30).'
                : `${criteria.length - metCount} criteria still to meet. Keep submitting and attending.`}
            </p>
          </div>
        </div>
        {issued && isPremium && (
          <a href="/api/passport-pdf" target="_blank" rel="noopener noreferrer"
            className="btn" style={{ background: 'rgba(250,247,241,0.15)', border: '1.5px solid rgba(250,247,241,0.35)', color: 'var(--paper)', flexShrink: 0 }}>
            ⬇ Download PDF
          </a>
        )}
      </div>

      {/* Not premium warning */}
      {!isPremium && (
        <div style={{ padding: '14px 18px', background: 'rgba(197,116,58,0.07)', border: '1px solid rgba(197,116,58,0.2)', borderRadius: 6, marginBottom: 20, borderLeft: '3px solid var(--amber)' }}>
          <p style={{ fontWeight: 700, color: 'var(--amber-deep)', marginBottom: 4 }}>Capability Passport requires Premium tier</p>
          <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
            Standard tier graduates receive a Completion Certificate. Email <a href={`mailto:${PROGRAM.contact}`} style={{ color: 'var(--amber-deep)', fontWeight: 600 }}>{PROGRAM.contact}</a> to discuss upgrading before Week 6.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

        {/* LEFT: Criteria + capability areas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Eligibility criteria */}
          <div>
            <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500, marginBottom: 16 }}>Eligibility Criteria</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {criteria.map((c, i) => (
                <div key={i} className="card" style={{
                  borderLeft: `3px solid ${c.met ? 'var(--moss)' : 'var(--paper-line)'}`,
                  padding: '16px 18px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flex: 1 }}>
                      <span style={{ fontSize: '1.125rem', flexShrink: 0, marginTop: 1 }}>{c.met ? '✅' : '○'}</span>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: '0.9375rem', color: c.met ? 'var(--ink)' : 'var(--ink-soft)' }}>{c.label}</p>
                        <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', marginTop: 2 }}>{c.detail}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, color: c.met ? 'var(--moss)' : 'var(--ink)' }}>
                        {c.unit === '' ? (c.actual ? 'Done' : 'Pending') : `${c.actual}${c.unit}`}
                      </p>
                    </div>
                  </div>
                  {c.unit !== '' && (
                    <div style={{ marginTop: 10, height: 5, background: 'var(--paper-line)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((c.actual / c.target) * 100, 100)}%`, background: c.met ? 'var(--moss)' : 'var(--amber)', borderRadius: 3, transition: 'width 600ms ease' }} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Capability areas with evidence */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', fontWeight: 500 }}>Capability Areas</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>
                Updated as assignments are reviewed
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {CAPABILITY_AREAS.map(cap => {
                const score = typedCapScores.find(s => s.capability === cap);
                const level = score?.level || 'Not Started';
                const levelIdx = LEVEL_ORDER.indexOf(level);
                const pct = (levelIdx / (LEVEL_ORDER.length - 1)) * 100;
                const evidence = CAPABILITY_ASSIGNMENT_MAP[cap] || [];

                return (
                  <div key={cap} className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <p style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cap}</p>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '2px 8px', borderRadius: 100, background: LEVEL_BG[level], color: LEVEL_COLOR[level] }}>
                        {level}
                      </span>
                    </div>
                    <div style={{ height: 4, background: 'var(--paper-line)', borderRadius: 2, overflow: 'hidden', marginBottom: 8 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: LEVEL_COLOR[level] !== 'var(--ink-muted)' ? LEVEL_COLOR[level] : 'var(--paper-line)', borderRadius: 2, transition: 'width 500ms ease' }} />
                    </div>
                    <p style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>
                      Evidence: {evidence.join(' · ')}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT: What the passport contains */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          <div className="card" style={{ background: 'var(--ink)', color: 'var(--paper)' }}>
            <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(250,247,241,0.45)', marginBottom: 14 }}>What the Passport includes</p>
            {[
              'Your name, pathway, cohort, and unique ID',
              'Score across all 10 capability areas',
              'Attendance and submission record',
              'Portfolio artefact count',
              'Capstone summary and project name',
              'Facilitator sign-off from Genesis',
              'QR code for employer verification',
              'Downloadable branded PDF',
            ].map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--amber)', flexShrink: 0, fontSize: '0.875rem' }}>→</span>
                <p style={{ fontSize: '0.875rem', color: 'rgba(250,247,241,0.7)', lineHeight: 1.5 }}>{item}</p>
              </div>
            ))}
          </div>

          <div className="card" style={{ background: 'var(--paper-soft)' }}>
            <p style={{ fontWeight: 700, marginBottom: 10 }}>Important to know</p>
            {[
              'The Passport is never issued from AI feedback alone — Genesis must review and approve.',
              'Meeting the 5 criteria does not guarantee approval — Genesis assesses quality of evidence.',
              'Standard tier graduates receive a Completion Certificate, not a Passport.',
            ].map((item, i) => (
              <p key={i} style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.6, marginBottom: 8, paddingLeft: 14, borderLeft: '2px solid var(--paper-line)' }}>{item}</p>
            ))}
          </div>

          {/* AI Practice contribution */}
          {(aiAttempts || []).length > 0 && (
            <div className="card">
              <p style={{ fontWeight: 700, marginBottom: 10 }}>AI Practice Contributions</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[...new Set((aiAttempts || []).map((a: any) => a.practice_type))].map(type => {
                  const count = (aiAttempts || []).filter((a: any) => a.practice_type === type).length;
                  return (
                    <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                      <span style={{ color: 'var(--ink-soft)' }}>{type}</span>
                      <span style={{ fontWeight: 700, color: 'var(--amber-deep)' }}>{count} completed</span>
                    </div>
                  );
                })}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginTop: 10 }}>
                AI practice contributes to your AI-enabled Professional Practice capability score.
              </p>
            </div>
          )}

          <Link href="/portal/portfolio" className="btn btn-outline" style={{ display: 'block', textAlign: 'center' }}>
            View My Portfolio →
          </Link>
        </div>
      </div>
    </div>
  );
}
