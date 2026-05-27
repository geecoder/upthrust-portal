'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';

const STEPS = [
  { id: 'welcome', title: 'Welcome to Upthrust', sub: 'Your 12-week journey starts here' },
  { id: 'profile', title: 'Tell us about yourself', sub: 'Help us personalise your experience' },
  { id: 'pathway', title: 'Your pathway & goals', sub: 'Set your learning intention' },
  { id: 'setup', title: 'Get set up', sub: 'Tools you need before Week 0' },
  { id: 'expectations', title: 'The commitment', sub: 'What this program requires of you' },
];

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();
  const [learner, setLearner] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    career_goal: '',
    current_role: '',
    bio: '',
    linkedin_url: '',
    work_preference: 'Remote',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    const db = createBrowserClient();
    db.from('learners').select('*').eq('clerk_user_id', user.id).maybeSingle().then(({ data }) => {
      setLearner(data);
      if (data) setForm(prev => ({
        ...prev,
        career_goal: data.career_goal || '',
        current_role: data.current_role || '',
        bio: data.bio || '',
        linkedin_url: data.linkedin_url || '',
        work_preference: data.work_preference || 'Remote',
      }));
      if (data?.onboarding_complete) router.replace('/portal');
    });
  }, [user]);

  async function completeOnboarding() {
    if (!learner || !user) return;
    setSaving(true);
    const db = createBrowserClient();
    await db.from('learners').update({
      ...form,
      onboarding_complete: true,
      onboarding_completed_at: new Date().toISOString(),
    }).eq('id', learner.id);
    router.replace('/portal');
  }

  const pathway = learner?.pathway || 'PM';
  const isLast = step === STEPS.length - 1;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 600 }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M4 22 L14 6 L24 22 M9 18 L19 18" stroke="#FAF7F1" strokeWidth="2.2" strokeLinecap="square"/>
            </svg>
            <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.375rem', color: '#FAF7F1', letterSpacing: '-0.02em' }}>Upthrust</span>
          </div>

          {/* Progress bar */}
          <div style={{ height: 2, background: 'rgba(250,247,241,0.1)', borderRadius: 1, margin: '0 auto', width: 280 }}>
            <div style={{ height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`, background: 'var(--amber)', borderRadius: 1, transition: 'width 300ms ease' }} />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'rgba(250,247,241,0.4)', marginTop: 8, letterSpacing: '0.1em' }}>
            {step + 1} of {STEPS.length}
          </p>
        </div>

        {/* Card */}
        <div style={{ background: '#FAF7F1', borderRadius: 8, padding: '40px 44px' }}>
          <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--amber-deep)', marginBottom: 10 }}>
            {STEPS[step].sub}
          </p>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400, letterSpacing: '-0.02em', marginBottom: 28 }}>
            {STEPS[step].title}
          </h1>

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div>
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.7, color: 'var(--ink-soft)', marginBottom: 20 }}>
                Welcome to Cohort 1, <strong>{learner?.first_name || 'learner'}</strong>. You've chosen the <strong>{pathway === 'PM' ? 'Product Management' : 'Business Analysis'}</strong> pathway on the {learner?.tier} tier.
              </p>
              <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--ink-soft)', marginBottom: 20 }}>
                Over the next 12 weeks you will produce real product work, receive expert feedback, build a portfolio, and earn a Capability Passport that employers can verify.
              </p>
              <div style={{ padding: '18px 20px', background: 'var(--paper-soft)', borderRadius: 6, borderLeft: '3px solid var(--amber)' }}>
                <p style={{ fontWeight: 700, marginBottom: 8 }}>Your cohort at a glance</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {[
                    ['Cohort', 'Cohort 1 · 2026'],
                    ['Pathway', `${pathway === 'PM' ? 'Product Management' : 'Business Analysis'}`],
                    ['Starts', 'Saturday June 6, 2026'],
                    ['Ends', 'Friday August 29, 2026'],
                    ['Demo Day', 'Saturday August 30, 2026'],
                    ['Live sessions', 'Every Saturday'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                      <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 1: Profile */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Current role or background</label>
                <input className="form-input" placeholder="e.g. Business Analyst at Zenith Bank" value={form.current_role} onChange={e => setForm({ ...form, current_role: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Short bio (2–3 sentences)</label>
                <textarea className="form-input form-textarea" style={{ minHeight: 80 }} placeholder="Tell Genesis and the cohort a little about who you are..." value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">LinkedIn URL (optional)</label>
                <input className="form-input" type="url" placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => setForm({ ...form, linkedin_url: e.target.value })} />
              </div>
            </div>
          )}

          {/* Step 2: Pathway & Goals */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ padding: '16px 18px', background: 'var(--paper-soft)', borderRadius: 6, borderTop: `2px solid ${pathway === 'PM' ? 'var(--ink)' : 'var(--amber)'}` }}>
                <p style={{ fontWeight: 700, marginBottom: 4 }}>{pathway === 'PM' ? '📋 Product Management' : '📊 Business Analysis'} Pathway</p>
                <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)' }}>
                  {pathway === 'PM'
                    ? 'You will build: PRDs, product strategy canvases, user journey maps, sprint backlogs, metrics plans, and a full capstone.'
                    : 'You will build: BRDs, stakeholder maps, process maps, elicitation notes, UAT packs, business cases, and a full capstone.'}
                </p>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">What is your main career goal from this program?</label>
                <textarea className="form-input form-textarea" style={{ minHeight: 80 }} placeholder="e.g. Transition from operations into a BA role at a fintech by end of 2026..." value={form.career_goal} onChange={e => setForm({ ...form, career_goal: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Preferred work style</label>
                <select className="form-input" value={form.work_preference} onChange={e => setForm({ ...form, work_preference: e.target.value })}>
                  {['Remote', 'Hybrid', 'Onsite', 'Flexible'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Setup */}
          {step === 3 && (
            <div>
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 20 }}>
                Before Week 0, please make sure you have these set up. Tick each one as you go.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { item: 'Google account (for Docs, Sheets, Drive)', href: 'https://accounts.google.com' },
                  { item: 'Miro account (for process maps and journey maps)', href: 'https://miro.com/signup' },
                  { item: 'Zoom installed and tested', href: 'https://zoom.us/download' },
                  ...(pathway === 'PM'
                    ? [{ item: 'Trello account (for sprint backlogs)', href: 'https://trello.com/signup' }]
                    : [{ item: 'draw.io or Lucidchart account (for process diagrams)', href: 'https://diagrams.net' }]),
                  { item: 'Join the cohort WhatsApp group (link in your welcome email)', href: '#' },
                ].map(({ item, href }) => (
                  <div key={item} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px', background: 'var(--paper-soft)', borderRadius: 6 }}>
                    <span style={{ color: 'var(--moss)', fontSize: '1rem', flexShrink: 0, marginTop: 2 }}>□</span>
                    <div>
                      <p style={{ fontSize: '0.9rem', fontWeight: 500 }}>{item}</p>
                      {href !== '#' && <a href={href} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--amber-deep)', fontWeight: 600 }}>Set up →</a>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Expectations */}
          {step === 4 && (
            <div>
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 20 }}>
                This program is not passive. Here is what the Capability Passport requires and what the program expects of you.
              </p>
              {[
                { title: 'Attend ≥75% of live Saturday sessions', detail: 'If you miss one, watch the recording within 48 hours and notify Genesis.' },
                { title: 'Submit ≥80% of required assignments', detail: 'Late submissions accepted within 72 hours with a message to Genesis.' },
                { title: 'Achieve an average score of ≥70/100', detail: 'Revise your work when resubmission is requested. Revision is part of the process.' },
                { title: 'Submit and present your capstone on Demo Day', detail: 'Your Week 12 capstone is the evidence that underpins your Passport.' },
                { title: 'Build at least 8 approved portfolio artefacts', detail: 'Every assignment is a portfolio piece. Quality over quantity.' },
                { title: 'Engage in the cohort community', detail: 'Ask questions, share your work, support other learners.' },
              ].map((exp, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
                  <span style={{ color: 'var(--amber)', fontWeight: 700, flexShrink: 0, fontSize: '1rem' }}>→</span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{exp.title}</p>
                    <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', marginTop: 2, lineHeight: 1.5 }}>{exp.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {step > 0
              ? <button onClick={() => setStep(s => s - 1)} className="btn btn-ghost">← Back</button>
              : <div />}
            {isLast ? (
              <button onClick={completeOnboarding} className="btn btn-primary" disabled={saving} style={{ minWidth: 160 }}>
                {saving ? 'Setting up...' : "I'm ready — Enter Portal →"}
              </button>
            ) : (
              <button onClick={() => setStep(s => s + 1)} className="btn btn-primary">
                Continue →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
