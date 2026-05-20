import { auth } from '@clerk/nextjs/server';
import { createServiceClient } from '@/lib/supabase';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, PhaseBadge, SectionHeader } from '@/components/ui';
import { Lock, CheckCircle2, ChevronRight, Play } from 'lucide-react';

export default async function WeeksPage() {
  const { userId } = await auth();
  if (!userId) redirect('/auth/login');

  const db = createServiceClient();

  const { data: learner } = await db
    .from('learners').select('id, pathway').eq('clerk_user_id', userId).single();

  const { data: weeks } = await db
    .from('weeks').select('*').order('week_number');

  const { data: progress } = learner ? await db
    .from('learner_progress').select('*').eq('learner_id', learner.id) : { data: [] };

  const weeksData = weeks || [];
  const progressMap = new Map((progress || []).map(p => [p.week_number, p]));

  const phaseGroups = [
    { phase: 'foundation', label: 'Phase 1 — Foundation', weeks: [0, 1, 2, 3] },
    { phase: 'core', label: 'Phase 2 — Core Skills', weeks: [4, 5, 6, 7] },
    { phase: 'delivery', label: 'Phase 3 — Delivery', weeks: [8, 9, 10, 11] },
    { phase: 'capstone', label: 'Phase 4 — Capstone', weeks: [12] },
  ];

  return (
    <div className="animate-fade-up">
      <SectionHeader
        eyebrow="12-Week Curriculum"
        title="Weekly Content"
        description="Each week contains a concept class, real-world case study, practical lab, and your assignment. Weeks unlock as the program progresses."
      />

      <div className="space-y-8">
        {phaseGroups.map(({ phase, label, weeks: weekNums }) => {
          const phaseWeeks = weeksData.filter(w => weekNums.includes(w.week_number));
          return (
            <div key={phase}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="font-semibold text-ink">{label}</h2>
                <PhaseBadge phase={phase} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {phaseWeeks.map(week => {
                  const prog = progressMap.get(week.week_number);
                  const submitted = prog?.assignment_submitted;
                  const attended = prog?.attended;

                  return (
                    <Card key={week.week_number} hover={week.is_unlocked}
                      className={`overflow-hidden ${!week.is_unlocked ? 'opacity-60' : ''}`}>
                      <div className={`h-1 ${phase === 'foundation' ? 'bg-blue-400' : phase === 'core' ? 'bg-amber' : phase === 'delivery' ? 'bg-moss' : 'bg-ink'}`} />
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="text-xs font-bold tracking-wider uppercase text-ink-muted">
                              Week {week.week_number}
                            </span>
                            <h3 className="font-serif text-lg font-medium text-ink mt-0.5 leading-tight">
                              {week.title}
                            </h3>
                            <p className="text-xs text-ink-muted mt-1">{week.dates}</p>
                          </div>
                          <div className="flex-shrink-0 ml-3">
                            {!week.is_unlocked ? (
                              <div className="w-8 h-8 rounded-full bg-paper-line flex items-center justify-center">
                                <Lock size={14} className="text-ink-muted" />
                              </div>
                            ) : submitted ? (
                              <div className="w-8 h-8 rounded-full bg-moss/10 flex items-center justify-center">
                                <CheckCircle2 size={14} className="text-moss" />
                              </div>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-amber/10 flex items-center justify-center">
                                <Play size={14} className="text-amber" />
                              </div>
                            )}
                          </div>
                        </div>

                        <p className="text-sm text-ink-muted mb-4 line-clamp-2">
                          {week.concept_topics?.slice(0, 2).join(' · ')}
                          {week.concept_topics?.length > 2 && ` · +${week.concept_topics.length - 2} more`}
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex gap-3 text-xs">
                            {attended !== undefined && (
                              <span className={attended ? 'text-moss font-medium' : 'text-ink-muted'}>
                                {attended ? '✓ Attended' : '○ Not yet attended'}
                              </span>
                            )}
                            {submitted !== undefined && (
                              <span className={submitted ? 'text-moss font-medium' : 'text-ink-muted'}>
                                {submitted ? '✓ Submitted' : '○ Assignment pending'}
                              </span>
                            )}
                          </div>
                          {week.is_unlocked && (
                            <Link href={`/weeks/${week.week_number}`}
                              className="flex items-center gap-1 text-xs font-semibold text-amber-deep hover:text-ink transition-colors">
                              Open <ChevronRight size={12} />
                            </Link>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
