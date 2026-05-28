'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';

const PREFERRED_ROLES_PM = ['Junior PM', 'Associate PM', 'Product Owner', 'Product Analyst', 'Growth PM', 'Technical PM'];
const PREFERRED_ROLES_BA = ['Junior BA', 'Associate BA', 'Business Analyst', 'Systems Analyst', 'Product Owner', 'Requirements Analyst'];
const WORK_PREFS = ['Remote', 'Hybrid', 'Onsite', 'Flexible'];
const AVAILABILITY = ['Full-time', 'Internship', 'Project Placement', 'Freelance', 'Not Available'];

export default function ProfilePage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    country: '',
    current_role: '',
    career_goal: '',
    bio: '',
    linkedin_url: '',
    cv_url: '',
    work_preference: 'Remote',
    availability: 'Full-time',
    preferred_roles: [] as string[],
    employer_visible: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState<'personal' | 'career' | 'visibility'>('personal');

  const db = createBrowserClient();

  useEffect(() => {
    if (!user) return;
    db.from('learners').select('*').eq('clerk_user_id', user.id).maybeSingle().then(({ data }) => {
      setLearner(data);
      if (data) {
        setForm({
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.phone || '',
          country: data.country || '',
          current_role: data.current_role || '',
          career_goal: data.career_goal || '',
          bio: data.bio || '',
          linkedin_url: data.linkedin_url || '',
          cv_url: data.cv_url || '',
          work_preference: data.work_preference || 'Remote',
          availability: data.availability || 'Full-time',
          preferred_roles: data.preferred_roles ? data.preferred_roles.split(',') : [],
          employer_visible: data.employer_visible || false,
        });
      }
    });
  }, [user]);

  async function handleSave() {
    if (!learner) return;
    setSaving(true);
    const { error } = await db.from('learners').update({
      first_name: form.first_name,
      last_name: form.last_name,
      phone: form.phone,
      country: form.country,
      current_role: form.current_role,
      career_goal: form.career_goal,
      bio: form.bio,
      linkedin_url: form.linkedin_url,
      cv_url: form.cv_url,
      work_preference: form.work_preference,
      availability: form.availability,
      preferred_roles: form.preferred_roles.join(','),
      employer_visible: form.employer_visible,
    }).eq('id', learner.id);

    setSaving(false);
    if (!error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  }

  function toggleRole(role: string) {
    setForm(prev => ({
      ...prev,
      preferred_roles: prev.preferred_roles.includes(role)
        ? prev.preferred_roles.filter(r => r !== role)
        : [...prev.preferred_roles, role],
    }));
  }

  const pathway = learner?.pathway || 'PM';
  const roleOptions = pathway === 'PM' ? PREFERRED_ROLES_PM : PREFERRED_ROLES_BA;

  const TABS = [
    { id: 'personal' as const, label: 'Personal Info', icon: '👤' },
    { id: 'career' as const, label: 'Career Goals', icon: '🎯' },
    { id: 'visibility' as const, label: 'Employer Visibility', icon: '👔' },
  ];

  return (
    <div className="portal-content" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>My Account</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Profile Settings</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
          {learner?.pathway} Pathway · {learner?.tier} · {learner?.cohort}
        </p>
      </div>

      {saved && (
        <div style={{ padding: '12px 16px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.25)', borderRadius: 6, marginBottom: 20, color: 'var(--moss)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>✓</span> Profile saved successfully
        </div>
      )}

      {/* Tab navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--paper-line)', marginBottom: 28 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            padding: '12px 20px', border: 'none', cursor: 'pointer',
            background: 'transparent',
            fontWeight: activeTab === tab.id ? 700 : 400,
            fontSize: '0.9rem',
            color: activeTab === tab.id ? 'var(--ink)' : 'var(--ink-muted)',
            borderBottom: activeTab === tab.id ? '2px solid var(--ink)' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 7,
            transition: 'all 150ms',
          }}>
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Personal Info */}
      {activeTab === 'personal' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">First Name *</label>
              <input className="form-input" value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Last Name</label>
              <input className="form-input" value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Phone</label>
              <input className="form-input" type="tel" placeholder="+234 800 000 0000" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Country</label>
              <input className="form-input" placeholder="Nigeria, UK, Canada..." value={form.country} onChange={e => setForm({ ...form, country: e.target.value })} />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">Current Role or Background</label>
            <input className="form-input" placeholder="e.g. Operations Analyst at Access Bank" value={form.current_role} onChange={e => setForm({ ...form, current_role: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">Short Bio</label>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: 8 }}>2–3 sentences. Used in community and employer profile.</p>
            <textarea className="form-input form-textarea" style={{ minHeight: 90 }} placeholder="Tell the cohort and potential employers who you are..." value={form.bio} onChange={e => setForm({ ...form, bio: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">LinkedIn URL</label>
            <input className="form-input" type="url" placeholder="https://linkedin.com/in/yourname" value={form.linkedin_url} onChange={e => setForm({ ...form, linkedin_url: e.target.value })} />
          </div>
        </div>
      )}

      {/* Career Goals */}
      {activeTab === 'career' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">Career Goal from this Program</label>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: 8 }}>Be specific. What role, at what kind of company, by when?</p>
            <textarea className="form-input form-textarea" style={{ minHeight: 90 }} placeholder="e.g. Transition into a BA role at a fintech or tech-forward company in London by Q1 2027..." value={form.career_goal} onChange={e => setForm({ ...form, career_goal: e.target.value })} />
          </div>

          <div className="form-group" style={{ marginBottom: 18 }}>
            <label className="form-label">CV / Portfolio Link</label>
            <input className="form-input" type="url" placeholder="https://drive.google.com/... or your portfolio URL" value={form.cv_url} onChange={e => setForm({ ...form, cv_url: e.target.value })} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Work Preference</label>
              <select className="form-input" value={form.work_preference} onChange={e => setForm({ ...form, work_preference: e.target.value })}>
                {WORK_PREFS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Current Availability</label>
              <select className="form-input" value={form.availability} onChange={e => setForm({ ...form, availability: e.target.value })}>
                {AVAILABILITY.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Preferred Roles (select all that apply)</label>
            <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)', marginBottom: 10 }}>Used for employer matching after the program.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {roleOptions.map(role => (
                <button key={role} onClick={() => toggleRole(role)} style={{
                  padding: '7px 14px', borderRadius: 100, cursor: 'pointer',
                  border: `1.5px solid ${form.preferred_roles.includes(role) ? 'var(--ink)' : 'var(--paper-line)'}`,
                  background: form.preferred_roles.includes(role) ? 'var(--ink)' : 'transparent',
                  color: form.preferred_roles.includes(role) ? 'var(--paper)' : 'var(--ink-muted)',
                  fontSize: '0.875rem', fontWeight: form.preferred_roles.includes(role) ? 600 : 400,
                  transition: 'all 150ms',
                }}>
                  {form.preferred_roles.includes(role) ? '✓ ' : ''}{role}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Employer Visibility */}
      {activeTab === 'visibility' && (
        <div>
          <div style={{ padding: '20px 22px', background: 'var(--paper-soft)', border: '1px solid var(--paper-line)', borderRadius: 6, marginBottom: 20 }}>
            <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 8 }}>Employer Discovery</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--ink-soft)', lineHeight: 1.65 }}>
              After Cohort 1 Demo Day, Upthrust will open an employer portal where verified companies can discover graduates. You choose whether your profile is visible.
            </p>
          </div>

          <div style={{ padding: '20px 22px', background: form.employer_visible ? 'rgba(5,150,105,0.06)' : 'var(--white)', border: `1px solid ${form.employer_visible ? 'rgba(5,150,105,0.25)' : 'var(--paper-line)'}`, borderRadius: 6, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>
                  {form.employer_visible ? '✅ Visible to employers' : '🔒 Hidden from employers'}
                </p>
                <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', lineHeight: 1.55 }}>
                  {form.employer_visible
                    ? 'Approved employers can view your capability snapshot, selected portfolio artefacts, and preferred roles. Your email is not shared unless you explicitly consent.'
                    : 'Your profile is private. Employers cannot discover you unless you enable visibility.'}
                </p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 0, cursor: 'pointer', flexShrink: 0 }}>
                <input type="checkbox" checked={form.employer_visible} onChange={e => setForm({ ...form, employer_visible: e.target.checked })}
                  style={{ appearance: 'none', width: 48, height: 26, background: form.employer_visible ? 'var(--moss)' : 'var(--paper-line)', borderRadius: 13, position: 'relative', cursor: 'pointer', transition: 'background 200ms' }}
                />
                <style>{`
                  input[type=checkbox]::after {
                    content: '';
                    position: absolute;
                    width: 20px; height: 20px;
                    background: white;
                    border-radius: 50%;
                    top: 3px;
                    left: ${form.employer_visible ? '25px' : '3px'};
                    transition: left 200ms;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                  }
                `}</style>
              </label>
            </div>
          </div>

          {form.employer_visible && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--ink-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                What employers will see
              </p>
              {[
                ['✓ Visible', 'Your name and career pathway'],
                ['✓ Visible', 'Your capability passport summary (once issued)'],
                ['✓ Visible', 'Portfolio artefacts you mark as employer-visible'],
                ['✓ Visible', 'Preferred roles, work preference, availability'],
                ['✓ Visible', 'Your bio'],
                ['✗ Hidden', 'Your email — only shared if you explicitly consent'],
                ['✗ Hidden', 'Your assignment scores and internal feedback'],
                ['✗ Hidden', 'Your AI practice session transcripts'],
              ].map(([status, desc]) => (
                <div key={desc} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 7px', borderRadius: 3, background: status.startsWith('✓') ? 'rgba(5,150,105,0.1)' : 'rgba(107,114,128,0.1)', color: status.startsWith('✓') ? 'var(--moss)' : 'var(--ink-muted)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {status}
                  </span>
                  <p style={{ fontSize: '0.875rem', color: 'var(--ink-soft)', lineHeight: 1.5 }}>{desc}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Save button */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid var(--paper-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>
          Changes are saved to your learner record immediately.
        </p>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary" style={{ minWidth: 120 }}>
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
