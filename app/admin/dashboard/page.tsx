import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, ProgressBar, Badge, RiskDot, SectionHeader } from '@/components/ui';
import { Users, TrendingUp, Award, AlertTriangle, ChevronRight } from 'lucide-react';

export default async function AdminDashboardPage() {
  const { userId } = await auth();
  if (!userId || userId !== process.env.ADMIN_USER_ID) redirect('/dashboard');

  const db = createServiceClient();

  const { data: learners } = await db
    .from('learners')
    .select('*')
    .eq('cohort', 'cohort-1')
    .order('first_name');

  const allLearners = learners || [];

  // Cohort stats
  const stats = {
    total: allLearners.length,
    pm: allLearners.filter(l => l.pathway === 'pm').length,
    ba: allLearners.filter(l => l.pathway === 'ba').length,
    premium: allLearners.filter(l => l.tier === 'premium').length,
    standard: allLearners.filter(l => l.tier === 'standard').length,
    green: allLearners.filter(l => l.risk_status === 'green').length,
    amber: allLearners.filter(l => l.risk_status === 'amber').length,
    red: allLearners.filter(l => l.risk_status === 'red').length,
    passportEligible: allLearners.filter(l => l.passport_eligible).length,
    avgAttendance: allLearners.length ? Math.round(allLearners.reduce((s, l) => s + l.attendance_percent, 0) / allLearners.length) : 0,
    avgAssignments: allLearners.length ? Math.round(allLearners.reduce((s, l) => s + l.assignment_completion_percent, 0) / allLearners.length) : 0,
  };

  // Recent submissions
  const { data: recentSubmissions } = await db
    .from('submissions')
    .select('*, learners(first_name, last_name)')
    .eq('status', 'submitted')
    .order('submitted_at', { ascending: false })
    .limit(8);

  const { data: unlockedWeeks } = await db
    .from('weeks')
    .select('week_number, title')
    .eq('is_unlocked', true)
    .order('week_number', { ascending: false })
    .limit(1);

  const currentWeek = unlockedWeeks?.[0];

  return (
    <div className="animate-fade-up">
      <SectionHeader
        eyebrow="Genesis — Admin View"
        title="Cohort 1 Command Centre"
        description="Your real-time view of the cohort. Green = no action needed. Amber = check in. Red = call them."
      />

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Learners', value: stats.total, sub: `${stats.pm} PM · ${stats.ba} BA`, icon: Users, color: 'bg-ink' },
          { label: 'Avg Attendance', value: `${stats.avgAttendance}%`, sub: 'Target: 75%', icon: TrendingUp, color: stats.avgAttendance >= 75 ? 'bg-moss' : 'bg-amber' },
          { label: 'Avg Assignments', value: `${stats.avgAssignments}%`, sub: 'Target: 80%', icon: TrendingUp, color: stats.avgAssignments >= 80 ? 'bg-moss' : 'bg-amber' },
          { label: 'Passport Eligible', value: stats.passportEligible, sub: `of ${stats.total} learners`, icon: Award, color: 'bg-moss' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <Card key={label} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-8 h-8 rounded flex items-center justify-center ${color}`}>
                <Icon size={14} className="text-paper" />
              </div>
            </div>
            <p className="font-serif text-2xl font-medium text-ink">{value}</p>
            <p className="text-xs font-bold tracking-wider uppercase text-ink-muted mt-1">{label}</p>
            <p className="text-xs text-ink-muted mt-0.5">{sub}</p>
          </Card>
        ))}
      </div>

      {/* Risk summary */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { status: 'green' as const, label: 'On Track', count: stats.green, desc: 'No action needed', action: 'Encourage and leave alone' },
          { status: 'amber' as const, label: 'Needs Support', count: stats.amber, desc: 'Check in within 24 hours', action: 'Send personal message today' },
          { status: 'red' as const, label: 'At Risk', count: stats.red, desc: 'Immediate action required', action: 'Call within 48 hours' },
        ].map(({ status, label, count, desc, action }) => (
          <Card key={status} className={`p-5 ${status === 'red' && stats.red > 0 ? 'border-red-300 bg-red-50' : ''}`}>
            <div className="flex items-center gap-2 mb-2">
              <RiskDot status={status} />
              <span className="font-semibold text-sm text-ink">{label}</span>
              <span className="font-serif text-2xl font-medium text-ink ml-auto">{count}</span>
            </div>
            <p className="text-xs text-ink-muted">{desc}</p>
            <p className="text-xs font-semibold mt-1" style={{
              color: status === 'green' ? '#4F6A4A' : status === 'amber' ? '#A05A26' : '#B3382C'
            }}>
              → {action}
            </p>
          </Card>
        ))}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Learner list */}
        <div className="col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-ink">All Learners</h2>
            <Link href="/admin/learners" className="text-sm text-amber-deep hover:text-ink font-medium">
              Manage all →
            </Link>
          </div>

          {allLearners.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-ink-muted">No learners enrolled yet</p>
              <p className="text-sm text-ink-muted mt-1">Add learners via the Manage Learners page</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {allLearners.map(learner => (
                <Link key={learner.id} href={`/admin/learners/${learner.id}`}>
                  <Card hover className="px-4 py-3 flex items-center gap-4">
                    <div className="w-8 h-8 rounded-full bg-amber/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-amber-deep font-bold text-xs">
                        {learner.first_name[0]}{learner.last_name[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-ink">{learner.first_name} {learner.last_name}</p>
                      <p className="text-xs text-ink-muted">{learner.email}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <Badge color={learner.pathway === 'pm' ? 'blue' : 'green'}>
                        {learner.pathway?.toUpperCase()}
                      </Badge>
                      <Badge color={learner.tier === 'premium' ? 'purple' : 'default'}>
                        {learner.tier}
                      </Badge>
                      <div className="text-right min-w-[80px]">
                        <p className="text-xs text-ink-muted">{learner.attendance_percent}% att</p>
                        <p className="text-xs text-ink-muted">{learner.assignment_completion_percent}% asgn</p>
                      </div>
                      <RiskDot status={learner.risk_status} />
                      <ChevronRight size={14} className="text-ink-muted" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div className="space-y-6">
          {/* Pending reviews */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-sm text-ink">Awaiting Review</h2>
              {(recentSubmissions?.length || 0) > 0 && (
                <span className="w-5 h-5 rounded-full bg-amber text-paper text-xs flex items-center justify-center font-bold">
                  {recentSubmissions?.length}
                </span>
              )}
            </div>
            {(recentSubmissions || []).length === 0 ? (
              <Card className="p-4 text-center">
                <p className="text-xs text-ink-muted">No pending reviews</p>
              </Card>
            ) : (
              <div className="space-y-2">
                {(recentSubmissions || []).map(sub => (
                  <Link key={sub.id} href={`/admin/learners/${sub.learner_id}`}>
                    <Card hover className="p-3">
                      <p className="font-semibold text-xs text-ink">
                        {(sub as any).learners?.first_name} {(sub as any).learners?.last_name}
                      </p>
                      <p className="text-xs text-ink-muted">{sub.assignment_title}</p>
                      <p className="text-xs text-amber-deep font-medium mt-1">Week {sub.week_number} · Submitted</p>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Current week */}
          <Card className="p-4 bg-ink">
            <p className="text-xs font-bold tracking-widest uppercase text-paper/50 mb-2">Active Week</p>
            {currentWeek ? (
              <>
                <p className="font-serif text-lg font-medium text-paper">Week {currentWeek.week_number}</p>
                <p className="text-sm text-paper/70">{currentWeek.title}</p>
              </>
            ) : (
              <p className="text-sm text-paper/60">No weeks unlocked yet</p>
            )}
            <Link href="/admin/content" className="block mt-3 text-xs font-semibold text-amber-soft hover:text-paper transition-colors">
              Manage week unlocks →
            </Link>
          </Card>

          {/* Monday checklist */}
          <Card className="p-4">
            <h3 className="font-semibold text-sm text-ink mb-3">Monday Checklist</h3>
            <div className="space-y-2">
              {[
                'Update attendance % for all learners',
                'Review submitted assignments (48hr SLA)',
                'Flag amber/red learners and reach out',
                'Send weekly session reminder',
                'Unlock next week if session has run',
              ].map((item, i) => (
                <label key={i} className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" className="mt-0.5 flex-shrink-0" />
                  <span className="text-xs text-ink-muted">{item}</span>
                </label>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
