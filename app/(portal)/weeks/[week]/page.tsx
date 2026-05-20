'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { Card, Badge, Button, SubmissionStatusBadge, Spinner, SectionHeader, PhaseBadge } from '@/components/ui';
import { ChevronLeft, Send, ExternalLink, CheckCircle2, BookOpen, Beaker, Film, Star } from 'lucide-react';
import Link from 'next/link';

export default function WeekPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const weekNumber = parseInt(params.week as string);

  const [week, setWeek] = useState<any>(null);
  const [submission, setSubmission] = useState<any>(null);
  const [learner, setLearner] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissionUrl, setSubmissionUrl] = useState('');
  const [submissionNote, setSubmissionNote] = useState('');
  const [activeTab, setActiveTab] = useState<'content' | 'assignment' | 'feedback'>('content');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch(`/api/weeks/${weekNumber}`)
      .then(r => r.json())
      .then(data => {
        setWeek(data.week);
        setSubmission(data.submission);
        setLearner(data.learner);
        setLoading(false);
      });
  }, [weekNumber, user]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!submissionUrl.trim()) { setError('Please enter your submission URL'); return; }
    setSubmitting(true);
    setError('');

    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ weekNumber, submissionUrl, submissionNote }),
    });

    if (res.ok) {
      const data = await res.json();
      setSubmission(data.submission);
      setSuccess(true);
    } else {
      const err = await res.json();
      setError(err.error || 'Failed to submit. Please try again.');
    }
    setSubmitting(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner size={32} color="var(--ink)" />
    </div>
  );

  if (!week) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
      <p className="font-serif text-xl text-ink mb-2">Week not found or not yet unlocked</p>
      <Link href="/weeks" className="text-amber-deep text-sm font-medium">← Back to all weeks</Link>
    </div>
  );

  const pathway = learner?.pathway || 'pm';
  const assignment = pathway === 'pm' ? week.pm_assignment : week.ba_assignment;

  return (
    <div className="animate-fade-up">
      {/* Back link */}
      <Link href="/weeks" className="flex items-center gap-1 text-sm text-ink-muted hover:text-ink mb-6 transition-colors">
        <ChevronLeft size={14} /> All weeks
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-sm font-bold tracking-wider uppercase text-ink-muted">Week {week.week_number}</span>
            <PhaseBadge phase={week.phase} />
            {submission && <SubmissionStatusBadge status={submission.status} />}
          </div>
          <h1 className="font-serif text-3xl font-medium text-ink tracking-tight">{week.title}</h1>
          <p className="text-ink-muted mt-1">{week.dates} · Live session: {week.live_session_date}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-paper-line mb-6">
        {[
          { id: 'content', icon: BookOpen, label: 'Session Content' },
          { id: 'assignment', icon: Send, label: `Your Assignment${assignment ? ` — ${assignment.title}` : ''}` },
          ...(submission?.feedback_text ? [{ id: 'feedback', icon: Star, label: 'Feedback' }] : []),
        ].map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setActiveTab(id as any)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-all ${
              activeTab === id ? 'border-ink text-ink' : 'border-transparent text-ink-muted hover:text-ink'
            }`}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {/* Content tab */}
      {activeTab === 'content' && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            {/* Concept topics */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <BookOpen size={16} className="text-amber" />
                <h3 className="font-semibold text-ink">Concept Class</h3>
              </div>
              <ol className="space-y-2">
                {week.concept_topics?.map((topic: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-ink text-paper text-xs flex items-center justify-center font-bold mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-ink-soft">{topic}</span>
                  </li>
                ))}
              </ol>
            </Card>

            {/* Real-world case */}
            {week.case_study && (
              <Card className="p-6 border-l-4 border-l-amber">
                <div className="flex items-center gap-2 mb-3">
                  <Film size={16} className="text-amber" />
                  <h3 className="font-semibold text-ink">Real-World Case Study</h3>
                </div>
                <p className="text-sm text-ink-soft leading-relaxed">{week.case_study}</p>
              </Card>
            )}

            {/* Practical lab */}
            {week.lab_exercise && (
              <Card className="p-6 bg-paper-soft">
                <div className="flex items-center gap-2 mb-3">
                  <Beaker size={16} className="text-moss" />
                  <h3 className="font-semibold text-ink">Practical Lab</h3>
                </div>
                <p className="text-sm text-ink-soft leading-relaxed">{week.lab_exercise}</p>
              </Card>
            )}

            {/* Reflection prompt */}
            {week.reflection_prompt && (
              <Card className="p-6">
                <h3 className="font-semibold text-sm text-ink mb-2">📝 Reflection Prompt</h3>
                <p className="text-sm text-ink-muted italic">"{week.reflection_prompt}"</p>
                <p className="text-xs text-ink-muted mt-3">Add your reflection to your Interview Story Bank in your Learner Home.</p>
              </Card>
            )}
          </div>

          {/* Side panel */}
          <div className="space-y-4">
            {assignment && (
              <Card className="p-4 border-t-4 border-t-amber">
                <h3 className="font-semibold text-sm text-ink mb-2">This Week's Assignment</h3>
                <p className="text-sm font-medium text-amber-deep">{assignment.title}</p>
                <p className="text-xs text-ink-muted mt-1">Due: {assignment.dueDate}</p>
                <Button size="sm" className="mt-3 w-full" onClick={() => setActiveTab('assignment')}>
                  View brief & submit →
                </Button>
              </Card>
            )}

            {/* Resources */}
            {week.resources?.length > 0 && (
              <Card className="p-4">
                <h3 className="font-semibold text-sm text-ink mb-3">Resources</h3>
                <div className="space-y-2">
                  {week.resources.map((r: any, i: number) => (
                    <a key={i} href={r.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-2 text-xs text-amber-deep hover:text-ink transition-colors">
                      <ExternalLink size={10} /> {r.title}
                    </a>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* Assignment tab */}
      {activeTab === 'assignment' && assignment && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-6">
            {/* Assignment brief */}
            <Card className="p-6">
              <p className="eyebrow mb-3">{pathway === 'pm' ? 'PM Pathway' : 'BA Pathway'} Assignment</p>
              <h2 className="font-serif text-2xl font-medium text-ink mb-4">{assignment.title}</h2>
              <div className="prose prose-sm max-w-none">
                <p className="text-ink-soft leading-relaxed">{assignment.brief}</p>
              </div>
              <div className="mt-4 p-3 bg-paper-soft border border-paper-line">
                <p className="text-xs font-bold tracking-wider uppercase text-ink-muted mb-1">Deliverable format</p>
                <p className="text-sm text-ink">{assignment.deliverableFormat}</p>
              </div>
              <div className="mt-3 p-3 bg-amber/5 border border-amber/20">
                <p className="text-xs font-bold tracking-wider uppercase text-amber-deep mb-1">Due date</p>
                <p className="text-sm font-semibold text-ink">{assignment.dueDate}</p>
              </div>
            </Card>

            {/* Grading rubric */}
            {assignment.rubric?.length > 0 && (
              <Card className="p-6">
                <h3 className="font-semibold text-ink mb-4">Grading Rubric</h3>
                <div className="space-y-3">
                  {assignment.rubric.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-paper-soft">
                      <span className="text-sm text-ink-soft">{item.criterion}</span>
                      <span className="text-sm font-bold text-ink ml-4 flex-shrink-0">{item.points} pts</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between p-3 bg-ink text-paper">
                    <span className="text-sm font-bold">Total</span>
                    <span className="text-sm font-bold">
                      {assignment.rubric.reduce((sum: number, r: any) => sum + r.points, 0)} pts
                    </span>
                  </div>
                </div>
              </Card>
            )}

            {/* Submission form */}
            {submission ? (
              <Card className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CheckCircle2 size={20} className="text-moss" />
                  <div>
                    <p className="font-semibold text-ink">Submitted</p>
                    <p className="text-sm text-ink-muted">
                      {new Date(submission.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="ml-auto">
                    <SubmissionStatusBadge status={submission.status} />
                  </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-paper-soft">
                  <a href={submission.submission_url} target="_blank" rel="noopener noreferrer"
                    className="text-sm text-amber-deep hover:text-ink flex items-center gap-1 transition-colors">
                    <ExternalLink size={12} /> View your submission
                  </a>
                </div>
                {submission.score !== null && (
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 bg-paper-soft p-3 text-center">
                      <p className="text-2xl font-bold text-ink font-serif">{submission.score}</p>
                      <p className="text-xs text-ink-muted">out of 100</p>
                    </div>
                  </div>
                )}
                {submission.status === 'needs_revision' && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-red-600 mb-2">Revision required</p>
                    <p className="text-sm text-ink-muted">Please review the feedback tab, revise your work, and resubmit.</p>
                    <Button variant="secondary" size="sm" className="mt-3" onClick={() => { setSubmission(null); setSuccess(false); }}>
                      Resubmit
                    </Button>
                  </div>
                )}
              </Card>
            ) : (
              <Card className="p-6">
                <h3 className="font-semibold text-ink mb-2">Submit Your Work</h3>
                <p className="text-sm text-ink-muted mb-4">
                  Complete your work in Google Drive, then paste the shareable link below. Make sure sharing is set to "Anyone with the link can comment."
                </p>
                {success ? (
                  <div className="flex items-center gap-3 p-4 bg-moss/10 border border-moss/20">
                    <CheckCircle2 size={20} className="text-moss" />
                    <div>
                      <p className="font-semibold text-moss">Submitted successfully!</p>
                      <p className="text-sm text-moss/80">Genesis will review your work within 48 hours.</p>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold tracking-wider uppercase text-ink-muted mb-2">
                        Submission URL *
                      </label>
                      <input
                        type="url"
                        placeholder="https://docs.google.com/..."
                        value={submissionUrl}
                        onChange={e => setSubmissionUrl(e.target.value)}
                        required
                        className="w-full px-4 py-3 border border-paper-line bg-white text-ink text-sm focus:outline-none focus:border-ink transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold tracking-wider uppercase text-ink-muted mb-2">
                        Note for reviewer (optional)
                      </label>
                      <textarea
                        placeholder="Any context about your submission, areas you're unsure about..."
                        value={submissionNote}
                        onChange={e => setSubmissionNote(e.target.value)}
                        rows={3}
                        className="w-full px-4 py-3 border border-paper-line bg-white text-ink text-sm focus:outline-none focus:border-ink transition-colors resize-none"
                      />
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <Button type="submit" loading={submitting} size="lg" className="w-full">
                      Submit Assignment
                    </Button>
                  </form>
                )}
              </Card>
            )}
          </div>

          {/* Side hints */}
          <div className="space-y-4">
            <Card className="p-4 bg-amber/5 border-amber/20">
              <p className="text-xs font-bold tracking-wider uppercase text-amber-deep mb-2">Submission checklist</p>
              <ul className="space-y-1.5 text-xs text-ink-muted">
                {[
                  'Title includes your name + week + assignment title',
                  'Google Drive sharing set to "Anyone with link can comment"',
                  'Work is in final draft (not in progress)',
                  'You have checked the rubric criteria',
                  'Reflection prompt added to your story bank',
                ].map(item => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="text-amber mt-0.5 flex-shrink-0">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {/* Feedback tab */}
      {activeTab === 'feedback' && submission?.feedback_text && (
        <div className="max-w-2xl">
          <Card className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="eyebrow mb-1">Facilitator Feedback</p>
                <p className="text-sm text-ink-muted">
                  Reviewed by Genesis · {submission.feedback_at ? new Date(submission.feedback_at).toLocaleDateString() : ''}
                </p>
              </div>
              {submission.score !== null && (
                <div className="text-center">
                  <p className="font-serif text-3xl font-medium text-ink">{submission.score}</p>
                  <p className="text-xs text-ink-muted">out of 100</p>
                </div>
              )}
            </div>
            <div className="p-4 bg-paper-soft border-l-4 border-amber">
              <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{submission.feedback_text}</p>
            </div>
            {submission.status === 'needs_revision' && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200">
                <p className="text-sm font-semibold text-red-700">Action required: revision needed</p>
                <p className="text-sm text-red-600 mt-1">Please revise your work based on this feedback and resubmit.</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
