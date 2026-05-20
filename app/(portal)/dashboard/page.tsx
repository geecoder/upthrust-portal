import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ProgressRing, ProgressBar, Card, Badge, RiskDot, SectionHeader } from '@/components/ui';
import { BookOpen, Briefcase, FileText, Award, ChevronRight, CheckCircle2, Clock, AlertCircle, Users } from 'lucide-react';

async function getLearnerData(clerkUserId: string) {
  const db = createServiceClient();

  const { data: learner } = await db
    .from('learners')
    .select('*')
    .eq('clerk_user_id', clerkUserId)
    .single();

  if (!learner) return null;

  const { data: progress } = await db
    .from('learner_progress')
    .select('*')
    .eq('learner_id', learner.id)
    .order('week_number');

  const { data: submissions } = await db
    .from('submissions')
    .select('*')
    .eq('learner_id', learner.id)
    .order('week_number', { ascending: false });

  const { data: weeks } = await db
    .from('weeks')
    .select('week_number, title, theme, phase, dates, is_unlocked')
    .order('week_number');

  const { data: portfolioItems } = await db
    .from('portfolio_items')
    .select('id, status')
    .eq('learner_id', learner.id);

  return { learner, progress: progress || [], submissions: submissions || [], weeks: weeks || [], portfolioItems: portfolioItems || [] };
}

function PassportCriteriaCard({ learner }: { learner: any }) {
  const criteria = [
    { label: 'Attendance ≥ 75%', met: learner.attendance_percent >= 75, value: `${learner.attendance_percent}%` },
    { label: 'Assignments ≥ 80%', met: learner.assignment_completion_percent >= 80, value: `${learner.assignment_completion_percent}%` },
    { label: 'Portfolio ≥ 8 items', met: false, value: '0 items' },
    { label: 'Capstone submitted', met: ['submitted', 'presented', 'approved'].includes(learner.capstone_status), value: learner.capstone_status },
  ];

  return (
    <Card className="p-6 border-t-4" style={{ borderTopColor: learner.passport_status === 'approved' ? '#4F6A4A' : 'var(--amber)' }}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="eyebrow mb-1">Capability Passport</p>
          <p className="font-serif text-lg font-medium text-ink">
            {learner.passport_status === 'approved' ? '🏅 Issued' :
             learner.passport_status === 'pending_review' ? '⏳ Under Review' :
             '🔒 Locked'}
          </p>
        </div>
        <Award size={24} className="text-amber flex-shrink-0" />
      </div>
      <div className="space-y-2">
        {criteria.map(({ label, met, value }) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              {met
                ? <CheckCircle2 size={14} className="text-moss flex-shrink-0" />
                : <Clock size={14} className="text-ink-muted flex-shrink-0" />}
              <span className={met ? 'text-ink' : 'text-ink-muted'}>{label}</span>
            </div>
            <span className={`text-xs font-semibold ${met ? 'text-moss' : 'text-ink-muted'}`}>{value}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/auth/login');

  const data = await getLearnerData(userId);

  // If no learner record — they've logged in but haven't been enrolled yet
  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <div className="w-16 h-16 rounded-full bg-amber/10 flex items-center justify-center mb-6">
          <Clock size={28} className="text-amber" />
        </div>
        <h1 className="font-serif text-2xl font-medium text-ink mb-3">Enrollment pending</h1>
        <p className="text-ink-muted max-w-sm mb-6">
          Your account is created, but you haven't been enrolled in Cohort 1 yet. Genesis will activate your access after payment is confirmed.
        </p>
        <a href="mailto:info@upthrustdigital.com" className="text-amber-deep font-semibold text-sm underline">
          Contact info@upthrustdigital.com
        </a>
      </div>
    );
  }

  const { learner, progress, submissions, weeks, portfolioItems } = data;

  const unlockedWeeks = weeks.filter(w => w.is_unlocked);
  const currentWeek = unlockedWeeks.length > 0 ? unlockedWeeks[unlockedWeeks.length - 1] : weeks[0];
  const recentSubmissions = submissions.slice(0, 3);
  const approvedPortfolioItems = portfolioItems.filter(p => p.status === 'approved').length;

  // Calculate average score from submissions
  const scoredSubmissions = submissions.filter(s => s.score !== null);
  const avgScore = scoredSubmissions.length > 0
    ? Math.round(scoredSubmissions.reduce((sum, s) => sum + s.score, 0) / scoredSubmissions.length)
    : null;

  return (
    <div className="animate-fade-up">
      {/* Welcome header */}
      <div className="mb-8">
        <p className="eyebrow mb-2">Cohort 1 · {learner.pathway === 'pm' ? 'Product Management' : 'Business Analysis'} · {learner.tier === 'premium' ? 'Premium' : 'Standard'}</p>
        <h1 className="font-serif text-4xl font-medium text-ink tracking-tight">
          Good to see you, {learner.first_name}.
        </h1>
        <div className="flex items-center gap-2 mt-2">
          <RiskDot status={learner.risk_status} />
          <span className="text-sm text-ink-muted">
            {learner.risk_status === 'green' ? 'On track — keep going' :
             learner.risk_status === 'amber' ? 'Needs attention — check with Genesis' :
             'At risk — please reach out to Genesis immediately'}
          </span>
        </div>
      </div>

      {/* Progress overview */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Attendance', value: learner.attendance_percent,
            ring: true, color: learner.attendance_percent >= 75 ? '#4F6A4A' : '#C5743A',
            sublabel: '%'
          },
          {
            label: 'Assignments', value: learner.assignment_completion_percent,
            ring: true, color: learner.assignment_completion_percent >= 80 ? '#4F6A4A' : '#C5743A',
            sublabel: '%'
          },
          {
            label: 'Avg Score', value: avgScore ?? 0,
            ring: true, color: (avgScore ?? 0) >= 70 ? '#4F6A4A' : '#C5743A',
            sublabel: '/100', display: avgScore ? String(avgScore) : '—'
          },
          {
            label: 'Portfolio', value: (approvedPortfolioItems / 8) * 100,
            ring: true, color: '#0F1A2E',
            sublabel: '/8', display: String(approvedPortfolioItems)
          },
        ].map(({ label, value, color, sublabel, display }) => (
          <Card key={label} className="p-5 flex flex-col items-center text-center">
            <ProgressRing
              value={value}
              size={72}
              color={color}
              label={display ?? String(value)}
              sublabel={sublabel}
            />
            <p className="mt-3 text-xs font-bold tracking-wider uppercase text-ink-muted">{label}</p>
          </Card>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left — current week + recent activity */}
        <div className="col-span-2 space-y-6">

          {/* Current week */}
          {currentWeek && (
            <Card className="overflow-hidden">
              <div className="bg-ink px-6 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold tracking-widest uppercase text-paper/50 mb-1">Currently active</p>
                  <p className="font-serif text-xl font-medium text-paper">
                    Week {currentWeek.week_number} — {currentWeek.title}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-paper/50">{currentWeek.dates}</p>
                  <span className={`phase-${currentWeek.phase} status-badge mt-1 inline-flex`}>
                    {currentWeek.phase}
                  </span>
                </div>
              </div>
              <div className="px-6 py-4 flex items-center justify-between">
                <p className="text-sm text-ink-muted">
                  {unlockedWeeks.length} of 13 weeks unlocked
                </p>
                <Link href="/weeks" className="flex items-center gap-1 text-sm font-semibold text-amber-deep hover:text-ink transition-colors">
                  Go to this week <ChevronRight size={14} />
                </Link>
              </div>
              <div className="px-6 pb-4">
                <ProgressBar value={unlockedWeeks.length} max={13} color="var(--ink)" height={3} />
              </div>
            </Card>
          )}

          {/* Recent submissions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ink">Recent Submissions</h2>
              <Link href="/assignments" className="text-sm text-amber-deep hover:text-ink font-medium">View all →</Link>
            </div>
            {recentSubmissions.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText size={28} className="mx-auto mb-3 text-paper-line" />
                <p className="font-medium text-ink-muted">No submissions yet</p>
                <p className="text-sm text-ink-muted mt-1">Your submissions will appear here once you start Week 1</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {recentSubmissions.map(sub => (
                  <Card key={sub.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink">{sub.assignment_title}</p>
                      <p className="text-xs text-ink-muted mt-0.5">Week {sub.week_number} · {new Date(sub.submitted_at).toLocaleDateString()}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {sub.score !== null && (
                        <span className="text-sm font-bold text-ink">{sub.score}/100</span>
                      )}
                      <Badge color={
                        sub.status === 'approved' ? 'green' :
                        sub.status === 'needs_revision' ? 'red' :
                        sub.status === 'in_review' ? 'amber' : 'blue'
                      }>
                        {sub.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* All weeks mini-grid */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-ink">Program Progress</h2>
              <Link href="/weeks" className="text-sm text-amber-deep hover:text-ink font-medium">View curriculum →</Link>
            </div>
            <div className="grid grid-cols-7 gap-2">
              {weeks.map(week => {
                const weekProgress = progress.find(p => p.week_number === week.week_number);
                const weekSubmission = submissions.find(s => s.week_number === week.week_number);
                return (
                  <Link
                    key={week.week_number}
                    href={week.is_unlocked ? `/weeks/${week.week_number}` : '#'}
                    className={`relative rounded p-2 text-center border transition-all duration-150 ${
                      week.is_unlocked
                        ? 'border-paper-line bg-white hover:border-ink cursor-pointer'
                        : 'border-paper-line bg-paper-soft cursor-not-allowed opacity-50'
                    }`}
                  >
                    <p className="text-xs font-bold text-ink-muted">{week.week_number === 0 ? 'W0' : `W${week.week_number}`}</p>
                    {weekProgress?.assignment_submitted && (
                      <div className="absolute top-1 right-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-moss" />
                      </div>
                    )}
                    {!week.is_unlocked && (
                      <p className="text-xs mt-0.5">🔒</p>
                    )}
                  </Link>
                );
              })}
            </div>
            <p className="text-xs text-ink-muted mt-2">Green dot = assignment submitted · 🔒 = not yet unlocked</p>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">
          <PassportCriteriaCard learner={{ ...learner, portfolioCount: approvedPortfolioItems }} />

          {/* Quick actions */}
          <Card className="p-5">
            <h3 className="font-semibold text-sm text-ink mb-4">Quick Links</h3>
            <div className="space-y-2">
              {[
                { href: '/assignments', icon: FileText, label: 'Submit an assignment' },
                { href: '/portfolio', icon: Briefcase, label: 'View my portfolio' },
                { href: '/community', icon: Users, label: 'Community feed' },
                { href: '/resources', icon: BookOpen, label: 'Templates & resources' },
                ...(learner.tier === 'premium' ? [{ href: '/settings', icon: Award, label: 'Book 1:1 with Genesis' }] : []),
              ].map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href} className="flex items-center gap-3 p-2 rounded hover:bg-paper-soft transition-colors text-sm text-ink-muted hover:text-ink">
                  <Icon size={14} className="flex-shrink-0" />
                  {label}
                </Link>
              ))}
            </div>
          </Card>

          {/* Program info */}
          <Card className="p-5 bg-ink">
            <p className="text-xs font-bold tracking-widest uppercase text-paper/50 mb-3">Program Info</p>
            <div className="space-y-2 text-sm">
              {[
                ['Pathway', learner.pathway === 'pm' ? 'Product Management' : 'Business Analysis'],
                ['Tier', learner.tier === 'premium' ? 'Premium' : 'Standard'],
                ['Country', learner.country || '—'],
                ['Cohort', 'Cohort 1 · 2026'],
                ['Contact', 'info@upthrustdigital.com'],
              ].map(([key, val]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-paper/50">{key}</span>
                  <span className="text-paper font-medium text-xs">{val}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
