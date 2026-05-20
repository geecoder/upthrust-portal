import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import { Card, ProgressBar, SectionHeader, Badge } from '@/components/ui';
import { CheckCircle2, Clock, Lock, Award, Shield } from 'lucide-react';

export default async function PassportPage() {
  const { userId } = await auth();
  if (!userId) redirect('/auth/login');

  const db = createServiceClient();

  const { data: learner } = await db
    .from('learners').select('*').eq('clerk_user_id', userId).single();

  if (!learner) redirect('/dashboard');

  const { data: submissions } = await db
    .from('submissions').select('score').eq('learner_id', learner.id).not('score', 'is', null);

  const { data: portfolioItems } = await db
    .from('portfolio_items').select('id, status').eq('learner_id', learner.id);

  const approvedPortfolio = (portfolioItems || []).filter(p => p.status === 'approved').length;
  const avgScore = submissions?.length
    ? Math.round(submissions.reduce((sum, s) => sum + s.score, 0) / submissions.length)
    : 0;

  const { data: capstoneSubmission } = await db
    .from('submissions').select('score, status')
    .eq('learner_id', learner.id)
    .eq('week_number', 12)
    .single();

  const capstoneScore = capstoneSubmission?.score ?? 0;
  const capstoneSubmitted = !!capstoneSubmission;

  const criteria = [
    {
      key: 'attendance',
      label: 'Session Attendance',
      description: 'Attend at least 75% of live sessions',
      required: 75,
      actual: learner.attendance_percent,
      met: learner.attendance_percent >= 75,
      displayValue: `${learner.attendance_percent}%`,
    },
    {
      key: 'assignments',
      label: 'Assignment Completion',
      description: 'Submit at least 80% of required assignments',
      required: 80,
      actual: learner.assignment_completion_percent,
      met: learner.assignment_completion_percent >= 80,
      displayValue: `${learner.assignment_completion_percent}%`,
    },
    {
      key: 'score',
      label: 'Average Assignment Score',
      description: 'Achieve an average score of 70 or above',
      required: 70,
      actual: avgScore,
      met: avgScore >= 70,
      displayValue: submissions?.length ? `${avgScore}/100` : 'No scores yet',
    },
    {
      key: 'capstone',
      label: 'Capstone Submission',
      description: 'Submit and present your capstone project',
      required: 1,
      actual: capstoneSubmitted ? 1 : 0,
      met: capstoneSubmitted,
      displayValue: capstoneSubmitted ? 'Submitted' : 'Not submitted',
    },
    {
      key: 'capstone_score',
      label: 'Capstone Score',
      description: 'Achieve a capstone score of 65 or above',
      required: 65,
      actual: capstoneScore,
      met: capstoneScore >= 65,
      displayValue: capstoneScore ? `${capstoneScore}/100` : 'Pending',
    },
    {
      key: 'portfolio',
      label: 'Portfolio Artefacts',
      description: 'Build and have approved at least 8 portfolio items',
      required: 8,
      actual: approvedPortfolio,
      met: approvedPortfolio >= 8,
      displayValue: `${approvedPortfolio}/8 approved`,
    },
  ];

  const metCount = criteria.filter(c => c.met).length;
  const isEligible = metCount === criteria.length;

  const statusConfig = {
    locked: { color: 'text-ink-muted', bg: 'bg-paper-soft', icon: Lock, label: 'Locked', desc: 'Meet all six criteria to unlock your Passport' },
    pending_review: { color: 'text-amber-deep', bg: 'bg-amber/10', icon: Clock, label: 'Under Review', desc: 'Genesis is reviewing your evidence. You will hear back within 7 days of Demo Day.' },
    approved: { color: 'text-moss', bg: 'bg-moss/10', icon: Award, label: 'Issued', desc: 'Congratulations — your Capability Passport has been issued.' },
    withheld: { color: 'text-red-600', bg: 'bg-red-50', icon: Shield, label: 'Withheld', desc: 'Your Passport has been withheld. Please contact Genesis for details.' },
    needs_revision: { color: 'text-amber-deep', bg: 'bg-amber/10', icon: Clock, label: 'Revision Required', desc: 'Some criteria need attention. Review the details below and reach out to Genesis.' },
  };

  const status = statusConfig[learner.passport_status as keyof typeof statusConfig] || statusConfig.locked;
  const StatusIcon = status.icon;

  return (
    <div className="animate-fade-up">
      <SectionHeader
        eyebrow="Your Evidence Record"
        title="Capability Passport"
        description="The Capability Passport is issued only when you meet all six criteria. It is not automatic — it is earned."
      />

      {/* Status card */}
      <Card className={`p-6 mb-8 ${status.bg} border-2 ${learner.passport_status === 'approved' ? 'border-moss' : learner.passport_status === 'pending_review' ? 'border-amber' : 'border-paper-line'}`}>
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${learner.passport_status === 'approved' ? 'bg-moss/20' : 'bg-paper-line'}`}>
            <StatusIcon size={24} className={status.color} />
          </div>
          <div>
            <p className={`font-serif text-2xl font-medium ${status.color}`}>{status.label}</p>
            <p className="text-sm text-ink-muted mt-0.5">{status.desc}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="font-serif text-3xl font-medium text-ink">{metCount}/6</p>
            <p className="text-xs text-ink-muted">criteria met</p>
          </div>
        </div>
        {metCount > 0 && (
          <div className="mt-4">
            <ProgressBar value={metCount} max={6} color={isEligible ? '#4F6A4A' : '#C5743A'} height={6} />
          </div>
        )}
      </Card>

      {/* Criteria detail */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {criteria.map(criterion => (
          <Card key={criterion.key} className={`p-5 ${criterion.met ? 'border-moss/30' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                {criterion.met
                  ? <CheckCircle2 size={16} className="text-moss flex-shrink-0" />
                  : <Clock size={16} className="text-ink-muted flex-shrink-0" />}
                <h3 className="font-semibold text-sm text-ink">{criterion.label}</h3>
              </div>
              <Badge color={criterion.met ? 'green' : 'default'}>
                {criterion.met ? 'Met' : 'Pending'}
              </Badge>
            </div>
            <p className="text-xs text-ink-muted mb-3">{criterion.description}</p>
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-ink-muted">Your progress</span>
              <span className={`font-bold ${criterion.met ? 'text-moss' : 'text-ink-muted'}`}>
                {criterion.displayValue}
              </span>
            </div>
            {typeof criterion.actual === 'number' && typeof criterion.required === 'number' && criterion.required > 1 && (
              <ProgressBar
                value={Math.min(criterion.actual, criterion.required)}
                max={criterion.required}
                color={criterion.met ? '#4F6A4A' : '#C5743A'}
                height={3}
              />
            )}
          </Card>
        ))}
      </div>

      {/* What the Passport looks like */}
      <div>
        <h2 className="font-semibold text-ink mb-4">What Your Passport Will Show</h2>
        <div className="relative">
          <div aria-hidden className="absolute top-4 left-4 right-[-8px] bottom-[-8px] bg-paper-line" />
          <Card className="relative overflow-hidden">
            <div className="bg-ink px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <svg width="18" height="18" viewBox="0 0 28 28" fill="none">
                  <path d="M4 22 L14 6 L24 22 M9 18 L19 18" stroke="#FAF7F1" strokeWidth="2.2" strokeLinecap="square"/>
                </svg>
                <span className="font-serif text-base text-paper">Upthrust</span>
              </div>
              <div className="text-right">
                <p className="text-xs font-bold tracking-widest uppercase text-amber-soft">Capability Passport</p>
                <p className="text-xs text-paper/40 mt-0.5">UP-C1-XXXX-{learner.pathway?.toUpperCase()}</p>
              </div>
            </div>
            <div className="p-6">
              <div className="flex justify-between items-start mb-4 pb-4 border-b border-paper-line">
                <div>
                  <p className="font-serif text-xl font-medium">{learner.first_name} {learner.last_name}</p>
                  <p className="text-sm text-amber-deep font-semibold mt-1">
                    {learner.pathway === 'pm' ? 'Product Management' : 'Business Analysis'} Pathway
                  </p>
                  <p className="text-xs text-ink-muted mt-0.5">Cohort 1 · Upthrust Career Capability Accelerator · 2026</p>
                </div>
                <div className={`px-2.5 py-1.5 text-center text-xs font-bold tracking-wider uppercase ${isEligible ? 'bg-moss text-paper' : 'bg-paper-soft text-ink-muted'}`}>
                  {isEligible ? 'VERIFIED READY' : 'IN PROGRESS'}
                </div>
              </div>

              <p className="text-xs font-bold tracking-wider uppercase text-ink-muted mb-3">Assessed Capability Areas</p>
              {[
                learner.pathway === 'pm'
                  ? [
                    'Product Strategy & Discovery',
                    'Requirements Documentation (PRD)',
                    'Delivery & Backlog Management',
                    'Stakeholder Management',
                    'Metrics & Launch Readiness',
                    'Capstone Defence',
                  ]
                  : [
                    'Requirements Elicitation & Analysis',
                    'Business Requirements Documentation',
                    'Process & Journey Mapping',
                    'UAT Planning & Test Scenarios',
                    'Stakeholder Management & Facilitation',
                    'Capstone Defence',
                  ]
              ][0].map(cap => (
                <div key={cap} className="flex items-center justify-between mb-2">
                  <span className="text-sm text-ink">{cap}</span>
                  <div className="h-1.5 w-24 bg-paper-line rounded-full overflow-hidden ml-4">
                    <div className="h-full bg-paper-line rounded-full" style={{ width: '0%' }} />
                  </div>
                </div>
              ))}

              <div className="mt-4 p-3 bg-paper-soft border-l-4 border-amber">
                <p className="text-xs text-ink-muted font-bold tracking-wider uppercase mb-1">Facilitator Sign-off</p>
                <p className="text-sm text-ink-muted italic">Will be added at Week 12 after capstone defence</p>
                <p className="text-xs text-ink-muted mt-1">— Genesis N. Enwenyeokwu · CBAP</p>
              </div>
            </div>
          </Card>
          <div className="absolute top-2 right-0 bg-amber text-paper px-2 py-1 text-xs font-bold tracking-widest uppercase rotate-2">
            PREVIEW
          </div>
        </div>
      </div>
    </div>
  );
}
