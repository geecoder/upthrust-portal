'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase';
import { UpthrustLogo } from '@/components/UpthrustLogo';

const STEPS = [
  { id: 'welcome',      sub: 'Your 12-week journey starts here',   title: 'Welcome to Upthrust' },
  { id: 'profile',      sub: 'Help us personalise your experience', title: 'Tell us about yourself' },
  { id: 'pathway',      sub: 'Set your learning intention',         title: 'Your pathway & goals' },
  { id: 'setup',        sub: 'Tools you need before Week 0',        title: 'Get set up' },
  { id: 'expectations', sub: 'What this program requires of you',   title: 'The commitment' },
];

function CheckItem({ item, href }: { item: string; href: string }) {
  const [ticked, setTicked] = useState(false);
  return (
    <div onClick={() => setTicked(t => !t)} style={{
      display: 'flex', gap: 12, alignItems: 'flex-start', padding: '12px 14px',
      background: ticked ? 'rgba(79,106,74,0.07)' : 'var(--paper-soft)', borderRadius: 6,
      cursor: 'pointer', border: `1px solid ${ticked ? 'rgba(79,106,74,0.25)' : 'transparent'}`,
      transition: 'all 150ms',
    }}>
      <span style={{ color: ticked ? 'var(--moss)' : 'var(--ink-muted)', fontSize: '1.125rem', flexShrink: 0, marginTop: 1 }}>
        {ticked ? '☑' : '□'}
      </span>
      <div>
        <p style={{ fontSize: '0.9rem', fontWeight: 500, textDecoration: ticked ? 'line-through' : 'none', color: ticked ? 'var(--ink-muted)' : 'var(--ink)' }}>
          {item}
        </p>
        {href !== '#' && !ticked && (
          <a href={href} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
            style={{ fontSize: '0.75rem', color: 'var(--amber-deep)', fontWeight: 600 }}>Set up →</a>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const { user } = useUser();
  const router = useRouter();

  const [learner, setLearner] = useState<any>(null);
  const [loadingLearner, setLoadingLearner] = useState(true);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [debugInfo, setDebugInfo] = useState('');

  const [form, setForm] = useState({
    career_goal: '', current_job_role: '', bio: '', linkedin_url: '', work_preference: 'Remote',
  });

  useEffect(() => {
    if (!user) return;
    const db = createBrowserClient();
    db.from('learners')
      .select('*')
      .eq('clerk_user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        setLoadingLearner(false);
        if (error) { console.error('Onboarding DB error:', error); return; }
        if (!data) {
          setDebugInfo(`No learner record found for Clerk ID: ${user.id}`);
          return;
        }
        setLearner(data);
        setForm({
          career_goal: data.career_goal || '',
          current_job_role: data.current_job_role || '',
          bio: data.bio || '',
          linkedin_url: data.linkedin_url || '',
          work_preference: data.work_preference || 'Remote',
        });
        // Already completed — go straight to dashboard
        if (data.onboarding_complete) {
          window.location.replace('/portal');
        }
      });
  }, [user]);

  async function completeOnboarding() {
    setSaveError('');
    setSaving(true);
    setDebugInfo('');

    try {
      const db = createBrowserClient();

      // Attempt 1: update by learner UUID (requires RLS to allow it)
      if (learner?.id) {
        const { error: updateError } = await db.from('learners').update({
          career_goal: form.career_goal || null,
          current_job_role: form.current_job_role || null,
          bio: form.bio || null,
          linkedin_url: form.linkedin_url || null,
          work_preference: form.work_preference || null,
          onboarding_complete: true,
          onboarding_completed_at: new Date().toISOString(),
        }).eq('id', learner.id);

        if (updateError) {
          // Attempt 2: update by clerk_user_id (different RLS path)
          console.warn('Update by id failed, trying clerk_user_id:', updateError.message);
          const { error: updateError2 } = await db.from('learners').update({
            onboarding_complete: true,
            onboarding_completed_at: new Date().toISOString(),
            career_goal: form.career_goal || null,
            current_job_role: form.current_job_role || null,
            bio: form.bio || null,
            linkedin_url: form.linkedin_url || null,
            work_preference: form.work_preference || null,
          }).eq('clerk_user_id', user?.id || '');

          if (updateError2) {
            // Attempt 3: use API route to bypass RLS entirely (admin client server-side)
            console.warn('Update by clerk_user_id failed too, trying API route:', updateError2.message);
            const res = await fetch('/api/complete-onboarding', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ ...form }),
            });
            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              throw new Error(err.error || `API returned ${res.status}`);
            }
          }
        }
      } else {
        // No learner record at all — try by clerk_user_id
        if (user?.id) {
          const { error } = await db.from('learners').update({
            onboarding_complete: true,
            onboarding_completed_at: new Date().toISOString(),
          }).eq('clerk_user_id', user.id);
          if (error) throw new Error(error.message);
        }
      }

      // Navigate to portal — use location.href for hard nav past middleware
      window.location.href = '/portal';

    } catch (err: any) {
      console.error('Onboarding complete error:', err);
      setSaveError(`Could not save: ${err.message}. Please try again or contact support.`);
      setDebugInfo(`Error: ${err.message}`);
      setSaving(false);
    }
  }

  const firstName = learner?.first_name || user?.firstName || '';
  const pathway: 'PM' | 'BA' | null =
    learner?.pathway === 'BA' ? 'BA' : learner?.pathway === 'PM' ? 'PM' : null;
  const isLast = step === STEPS.length - 1;

  if (loadingLearner) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid rgba(250,247,241,0.1)', borderTopColor: 'var(--amber)', borderRadius: '50%', animation: 'spin 700ms linear infinite', margin: '0 auto 16px' }} />
          <p style={{ color: 'rgba(250,247,241,0.5)', fontSize: '0.875rem' }}>Loading your account...</p>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 620 }}>

        {/* Logo + progress */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <UpthrustLogo size={26} wordmarkColor="#FAF7F1" />
          </div>
          <div style={{ height: 2, background: 'rgba(250,247,241,0.1)', borderRadius: 1, margin: '0 auto 8px', width: 320, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${((step + 1) / STEPS.length) * 100}%`, background: 'var(--amber)', borderRadius: 1, transition: 'width 400ms ease' }} />
          </div>
          <p style={{ fontSize: '0.6875rem', color: 'rgba(250,247,241,0.35)', letterSpacing: '0.12em' }}>{step + 1} of {STEPS.length}</p>
        </div>

        {/* Card */}
        <div style={{ background: '#FAF7F1', borderRadius: 10, padding: '40px 44px', boxShadow: '0 24px 48px -12px rgba(0,0,0,0.4)' }}>
          <p style={{ fontSize: '0.5625rem', fontWeight: 800, letterSpacing: '0.22em', textTransform: 'uppercase', color: 'var(--amber-deep)', marginBottom: 10 }}>{STEPS[step].sub}</p>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.875rem', fontWeight: 400, letterSpacing: '-0.025em', marginBottom: 28, lineHeight: 1.1 }}>{STEPS[step].title}</h1>

          {/* Step 0 — Welcome */}
          {step === 0 && (
            <div>
              <p style={{ fontSize: '1.0625rem', lineHeight: 1.7, color: 'var(--ink-soft)', marginBottom: 16 }}>
                Welcome to Cohort 1{firstName ? `, ${firstName}` : ''}. You've chosen the{' '}
                <strong>{pathway === 'BA' ? 'Business Analysis' : pathway === 'PM' ? 'Product Management' : ''}</strong>{' '}
                pathway{learner?.tier ? ` on the ${learner.tier} tier` : ''}.
              </p>
              <p style={{ fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--ink-soft)', marginBottom: 20 }}>
                Over the next 12 weeks you will produce real product work, receive expert feedback, build a portfolio, and earn a Capability Passport that employers can verify.
              </p>
              <div style={{ padding: '18px 20px', background: 'var(--paper-soft)', borderRadius: 6, borderLeft: '3px solid var(--amber)' }}>
                <p style={{ fontWeight: 700, marginBottom: 10 }}>Your cohort at a glance</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    ['Cohort',        'Cohort 1 · 2026'],
                    ['Pathway',       pathway === 'BA' ? 'Business Analysis' : pathway === 'PM' ? 'Product Management' : '—'],
                    ['Starts',        'Saturday June 6, 2026'],
                    ['Ends',          'Friday August 29, 2026'],
                    ['Demo Day',      'Saturday August 30, 2026'],
                    ['Live sessions', 'Every Saturday'],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', gap: 8 }}>
                      <span style={{ color: 'var(--ink-muted)' }}>{k}</span>
                      <span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 1 — Profile */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Current role or background</label>
                <input className="form-input" placeholder="e.g. Business Analyst at Zenith Bank" value={form.current_job_role} onChange={e => setForm({ ...form, current_job_role: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Short bio <span style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>(2–3 sentences)</span></label>
                <textarea className="form-input form-textarea" style={{ minHeight: 90 }} placeholder="Tell Genesis and the cohort a little about who you are..." value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">LinkedIn URL <span style={{ fontWeight: 400, color: 'var(--ink-muted)' }}>(optional)</span></label>
                <input className="form-input" type="url" placeholder="https://linkedin.com/in/..." value={form.linkedin_url} onChange={e => setForm({ ...form, linkedin_url: e.target.value })} />
              </div>
            </div>
          )}

          {/* Step 2 — Pathway & goals */}
          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {!pathway ? (
                <div style={{ padding: '16px 18px', background: 'var(--paper-soft)', borderRadius: 6, borderTop: '3px solid var(--amber-deep)' }}>
                  <p style={{ fontWeight: 700, marginBottom: 6, fontSize: '1rem' }}>Pathway not set</p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', lineHeight: 1.6 }}>
                    Your pathway hasn't been assigned yet. Please email info@upthrustdigital.com so we can set this correctly before you continue.
                  </p>
                </div>
              ) : (
                <div style={{ padding: '16px 18px', background: 'var(--paper-soft)', borderRadius: 6, borderTop: `3px solid ${pathway === 'BA' ? 'var(--moss)' : 'var(--ink)'}` }}>
                  <p style={{ fontWeight: 700, marginBottom: 6, fontSize: '1rem' }}>
                    {pathway === 'BA' ? '📊 Business Analysis' : '📋 Product Management'} Pathway
                  </p>
                  <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', lineHeight: 1.6 }}>
                    {pathway === 'BA'
                      ? 'You will build: BRDs, stakeholder maps, process maps, elicitation interview notes, UAT packs, business cases, and a full capstone.'
                      : 'You will build: PRDs, product strategy canvases, user journey maps, sprint backlogs, metrics plans, and a full capstone.'}
                  </p>
                </div>
              )}
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">What is your main career goal from this program?</label>
                <textarea className="form-input form-textarea" style={{ minHeight: 90 }}
                  placeholder={pathway === 'BA'
                    ? 'e.g. Transition into a BA role at a fintech company by Q1 2027...'
                    : 'e.g. Move from operations into a PM role at a tech company by end of 2026...'}
                  value={form.career_goal} onChange={e => setForm({ ...form, career_goal: e.target.value })} />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Preferred work style</label>
                <select className="form-input" value={form.work_preference} onChange={e => setForm({ ...form, work_preference: e.target.value })}>
                  {['Remote', 'Hybrid', 'Onsite', 'Flexible'].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Step 3 — Setup */}
          {step === 3 && (
            <div>
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 18 }}>
                Before Week 0, set up the following tools. Click each to tick it off — you can finish them later.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { item: 'Google account (for Docs, Sheets, Drive)', href: 'https://accounts.google.com' },
                  { item: 'Miro account (for process maps and journey maps)', href: 'https://miro.com/signup' },
                  { item: 'Zoom installed and tested', href: 'https://zoom.us/download' },
                  ...(pathway === 'BA'
                    ? [{ item: 'draw.io or Lucidchart account (for process diagrams)', href: 'https://diagrams.net' }]
                    : [{ item: 'Trello account (for sprint backlogs)', href: 'https://trello.com/signup' }]),
                  { item: 'Join the cohort WhatsApp group (link in your welcome email)', href: '#' },
                ].map(({ item, href }) => <CheckItem key={item} item={item} href={href} />)}
              </div>
            </div>
          )}

          {/* Step 4 — Expectations */}
          {step === 4 && (
            <div>
              <p style={{ fontSize: '0.9375rem', color: 'var(--ink-soft)', lineHeight: 1.7, marginBottom: 20 }}>
                This program is not passive. Here is what the Capability Passport requires and what the program expects of you.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { title: 'Attend ≥75% of live Saturday sessions', detail: 'If you miss one, watch the recording within 48 hours and notify Genesis.' },
                  { title: 'Submit ≥80% of required assignments', detail: 'Late submissions accepted within 72 hours with a message to Genesis.' },
                  { title: 'Achieve an average score of ≥70/100', detail: 'Revise your work when resubmission is requested. Revision is part of the process.' },
                  { title: 'Submit and present your capstone on Demo Day', detail: 'Your Week 12 capstone is the evidence that underpins your Passport.' },
                  { title: 'Build at least 8 approved portfolio artefacts', detail: 'Every assignment is a portfolio piece. Quality over quantity.' },
                  { title: 'Engage in the cohort community', detail: 'Ask questions, share your work, support other learners.' },
                ].map((exp, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12 }}>
                    <span style={{ color: 'var(--amber)', fontWeight: 700, flexShrink: 0, marginTop: 2 }}>→</span>
                    <div>
                      <p style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 3 }}>{exp.title}</p>
                      <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', lineHeight: 1.55 }}>{exp.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
              {saveError && (
                <div style={{ marginTop: 20, padding: '12px 14px', background: 'rgba(179,56,44,0.08)', border: '1px solid rgba(179,56,44,0.25)', borderRadius: 6, color: 'var(--red)', fontSize: '0.875rem', fontWeight: 600 }}>
                  ⚠ {saveError}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {step > 0
              ? <button onClick={() => setStep(s => s - 1)} className="btn btn-ghost" disabled={saving}>← Back</button>
              : <div />}

            {isLast ? (
              <button onClick={completeOnboarding} disabled={saving} className="btn btn-primary"
                style={{ minWidth: 200, opacity: saving ? 0.75 : 1 }}>
                {saving
                  ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(250,247,241,0.3)', borderTopColor: '#FAF7F1', borderRadius: '50%', animation: 'spin 600ms linear infinite' }} />
                      Setting up...
                    </span>
                  : "I'm ready — Enter Portal →"}
              </button>
            ) : (
              <button onClick={() => setStep(s => s + 1)} className="btn btn-primary">Continue →</button>
            )}
          </div>
        </div>

        {/* Debug info — only visible in dev or when there's an issue */}
        {debugInfo && (
          <p style={{ marginTop: 16, textAlign: 'center', fontSize: '0.6875rem', color: 'rgba(250,247,241,0.25)', fontFamily: 'monospace' }}>{debugInfo}</p>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
