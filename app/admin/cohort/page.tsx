'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import type { Learner } from '@/lib/types';
import { WEEK_DATES } from '@/lib/types';

type TabId = 'announcement' | 'session_reminder' | 'inactivity' | 'custom';

export default function CohortCommunicationsPage() {
  const [tab, setTab] = useState<TabId>('announcement');
  const [learners, setLearners] = useState<Learner[]>([]);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success?: string; error?: string } | null>(null);

  // Announcement form
  const [announcement, setAnnouncement] = useState({ title: '', content: '', priority: 'Normal', target: 'All' });

  // Session reminder form
  const [reminderWeek, setReminderWeek] = useState(0);

  // Inactivity form
  const [inactivityMessage, setInactivityMessage] = useState('');
  const [inactivityTargets, setInactivityTargets] = useState<string[]>([]);

  // Custom email form
  const [customEmail, setCustomEmail] = useState({ subject: '', content: '', targetLearners: 'all' as 'all' | 'pm' | 'ba' | string[] });
  const [extraEmails, setExtraEmails] = useState('');

  // Past announcements (activity log)
  const [pastAnnouncements, setPastAnnouncements] = useState<any[]>([]);

  const db = createBrowserClient();

  async function loadData() {
    // Load active learners through the admin API (bypasses RLS)
    const [lRes, aRes] = await Promise.all([
      fetch('/api/admin/data?resource=active_learners'),
      fetch('/api/admin/data?resource=announcements'),
    ]);
    const lData = await lRes.json();
    const aData = await aRes.json();
    if (lRes.ok) setLearners((lData.learners || []) as Learner[]);
    if (aRes.ok) setPastAnnouncements(aData.announcements || []);
  }

  useEffect(() => { loadData(); }, []);

  function toggleInactivityTarget(id: string) {
    setInactivityTargets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  function parseExtraEmails(): string[] {
    return extraEmails.split(/[,;\n]/).map(e => e.trim()).filter(e => e.includes('@'));
  }

  async function postAnnouncement() {
    if (!announcement.title || !announcement.content) return;
    setSending(true);
    setResult(null);

    // Save announcement + create in-portal notifications via admin API
    const res = await fetch('/api/admin/data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'post_announcement',
        title: announcement.title,
        content: announcement.content,
        priority: announcement.priority,
        target: announcement.target,
      }),
    });
    const data = await res.json();
    if (!res.ok) { setResult({ error: data.error || 'Could not post announcement.' }); setSending(false); return; }

    // Email targeted learners (non-blocking best-effort)
    const targets = learners.filter(l => announcement.target === 'All' || l.pathway === announcement.target);
    let sent = 0;
    for (const l of targets) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'announcement',
          learnerId: l.id,
          customMessage: { title: announcement.title, content: announcement.content, subject: `[Upthrust] ${announcement.title}` },
        }),
      }).then(r => r.ok && sent++).catch(() => {});
    }

    setResult({ success: `Announcement posted. ${data.notified} learner${data.notified !== 1 ? 's' : ''} notified in-portal, ${sent} emailed.` });
    setAnnouncement({ title: '', content: '', priority: 'Normal', target: 'All' });
    await loadData();
    setSending(false);
  }

  async function sendSessionReminder() {
    setSending(true);
    setResult(null);
    if (learners.length === 0) { setResult({ error: 'No active learners found.' }); setSending(false); return; }
    let sent = 0;
    for (const l of learners) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'session_reminder', learnerId: l.id, weekNumber: reminderWeek }),
      }).then(r => r.ok && sent++).catch(() => {});
    }
    // Also create in-portal notifications
    await fetch('/api/admin/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_notifications',
        learnerIds: learners.map(l => l.id),
        type: 'session_reminder',
        title: `📅 Session reminder — Week ${reminderWeek}`,
        message: `Your Week ${reminderWeek} live session is coming up. See you there!`,
      }),
    }).catch(() => {});
    setResult({ success: `Session reminder sent to ${sent}/${learners.length} learners.` });
    setSending(false);
  }

  async function sendInactivityNudges() {
    if (inactivityTargets.length === 0) { setResult({ error: 'Select at least one learner to nudge.' }); return; }
    if (!inactivityMessage.trim()) { setResult({ error: 'Write a nudge message first.' }); return; }
    setSending(true);
    setResult(null);
    // In-portal notifications via admin API
    await fetch('/api/admin/data', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_notifications',
        learnerIds: inactivityTargets,
        type: 'inactivity_nudge',
        title: '👋 A nudge from Genesis',
        message: inactivityMessage,
      }),
    }).catch(() => {});
    // Email best-effort
    let sent = 0;
    for (const id of inactivityTargets) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'inactivity_nudge', learnerId: id, customMessage: inactivityMessage }),
      }).then(r => r.ok && sent++).catch(() => {});
    }
    setResult({ success: `Nudge sent to ${inactivityTargets.length} learner${inactivityTargets.length !== 1 ? 's' : ''}.` });
    setInactivityTargets([]);
    setInactivityMessage('');
    setSending(false);
  }

  async function sendCustomEmail() {
    if (!customEmail.subject || !customEmail.content) { setResult({ error: 'Subject and content required.' }); return; }
    setSending(true);
    setResult(null);
    const targets = typeof customEmail.targetLearners === 'string'
      ? learners.filter(l => customEmail.targetLearners === 'all' || l.pathway === (customEmail.targetLearners as string).toUpperCase())
      : learners.filter(l => (customEmail.targetLearners as string[]).includes(l.id));

    let sent = 0;
    for (const l of targets) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'announcement',
          learnerId: l.id,
          customMessage: { title: customEmail.subject, content: customEmail.content, subject: customEmail.subject },
        }),
      }).then(r => r.ok && sent++).catch(() => {});
    }

    // Additional manual email addresses
    const extras = parseExtraEmails();
    for (const email of extras) {
      await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'announcement',
          directEmail: email,
          customMessage: { title: customEmail.subject, content: customEmail.content, subject: customEmail.subject },
        }),
      }).then(r => r.ok && sent++).catch(() => {});
    }

    setResult({ success: `Email sent to ${sent} recipient${sent !== 1 ? 's' : ''} (${targets.length} learners${extras.length ? ` + ${extras.length} extra` : ''}).` });
    setCustomEmail({ subject: '', content: '', targetLearners: 'all' });
    setExtraEmails('');
    setSending(false);
  }

  const TABS: { id: TabId; label: string; icon: string; desc: string }[] = [
    { id: 'announcement', label: 'Announcement', icon: '📣', desc: 'Post to portal + email all' },
    { id: 'session_reminder', label: 'Session Reminder', icon: '📅', desc: 'Bulk reminder for live session' },
    { id: 'inactivity', label: 'Inactivity Nudge', icon: '⚡', desc: 'Target at-risk learners' },
    { id: 'custom', label: 'Custom Email', icon: '✉️', desc: 'Any message to any group' },
  ];

  const riskLearners = learners.filter(l => l.risk_status === 'Red' || l.risk_status === 'Amber');

  return (
    <div className="portal-content" style={{ maxWidth: 800 }}>
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Cohort Communications</h1>
        <p style={{ color: 'var(--ink-muted)', marginTop: 4 }}>
          {learners.length} active learners · Emails sent via Resend · In-portal notifications created automatically
        </p>
      </div>

      {result && (
        <div style={{ padding: '12px 16px', background: result.success ? 'rgba(5,150,105,0.08)' : 'rgba(179,56,44,0.08)', border: `1px solid ${result.success ? 'rgba(5,150,105,0.25)' : 'rgba(179,56,44,0.25)'}`, borderRadius: 6, marginBottom: 20, color: result.success ? 'var(--moss)' : 'var(--red)', fontWeight: 600 }}>
          {result.success ? `✓ ${result.success}` : `⚠ ${result.error}`}
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 24 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => { setTab(t.id); setResult(null); }} style={{
            padding: '14px', border: `1.5px solid ${tab === t.id ? 'var(--ink)' : 'var(--paper-line)'}`,
            borderRadius: 6, cursor: 'pointer', textAlign: 'left',
            background: tab === t.id ? 'var(--ink)' : 'var(--white)',
            transition: 'all 150ms',
          }}>
            <div style={{ fontSize: '1.25rem', marginBottom: 6 }}>{t.icon}</div>
            <p style={{ fontWeight: 700, fontSize: '0.875rem', color: tab === t.id ? 'var(--paper)' : 'var(--ink)', marginBottom: 3 }}>{t.label}</p>
            <p style={{ fontSize: '0.6875rem', color: tab === t.id ? 'rgba(250,247,241,0.55)' : 'var(--ink-muted)' }}>{t.desc}</p>
          </button>
        ))}
      </div>

      {/* Announcement */}
      {tab === 'announcement' && (
        <div className="card">
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 20 }}>Post Cohort Announcement</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div className="form-group" style={{ gridColumn: '1/-1', marginBottom: 0 }}>
              <label className="form-label">Title *</label>
              <input className="form-input" placeholder="Important update for all learners..." value={announcement.title} onChange={e => setAnnouncement({ ...announcement, title: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Priority</label>
              <select className="form-input" value={announcement.priority} onChange={e => setAnnouncement({ ...announcement, priority: e.target.value })}>
                {['Normal', 'Important', 'Urgent'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Send to</label>
              <select className="form-input" value={announcement.target} onChange={e => setAnnouncement({ ...announcement, target: e.target.value })}>
                <option value="All">All Learners ({learners.length})</option>
                <option value="PM">PM Pathway only ({learners.filter(l => l.pathway === 'PM').length})</option>
                <option value="BA">BA Pathway only ({learners.filter(l => l.pathway === 'BA').length})</option>
              </select>
            </div>
            <div className="form-group" style={{ gridColumn: '1/-1', marginBottom: 0 }}>
              <label className="form-label">Message *</label>
              <textarea className="form-input form-textarea" style={{ minHeight: 120 }} placeholder="Write your announcement here. Be clear and direct — learners will receive this by email and see it on their dashboard." value={announcement.content} onChange={e => setAnnouncement({ ...announcement, content: e.target.value })} />
            </div>
          </div>
          <button onClick={postAnnouncement} disabled={sending || !announcement.title || !announcement.content} className="btn btn-primary">
            {sending ? 'Sending...' : `📣 Post & Email ${announcement.target === 'All' ? 'All' : announcement.target} Learners`}
          </button>

          {/* Activity log — past announcements */}
          {pastAnnouncements.length > 0 && (
            <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--paper-line)' }}>
              <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 14 }}>
                Recent announcements ({pastAnnouncements.length})
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pastAnnouncements.slice(0, 10).map((a: any) => (
                  <div key={a.id} style={{ padding: '12px 16px', background: 'var(--paper-soft)', borderRadius: 6, borderLeft: '3px solid var(--amber)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                      <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{a.title}</p>
                      <span style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)' }}>
                        {a.created_at ? new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                        {a.target_pathway && a.target_pathway !== 'All' ? ` · ${a.target_pathway}` : ' · All'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--ink-muted)', lineHeight: 1.5 }}>
                      {a.content?.length > 140 ? a.content.substring(0, 140) + '…' : a.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Session Reminder */}
      {tab === 'session_reminder' && (
        <div className="card">
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 8 }}>Send Session Reminder</h2>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
            Sends a reminder to all active learners: "Your Week X session is tomorrow." Best sent the day before the Saturday session.
          </p>
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Which session?</label>
            <select className="form-input" value={reminderWeek} onChange={e => setReminderWeek(parseInt(e.target.value))} style={{ width: 'auto' }}>
              {WEEK_DATES.map(w => <option key={w.week} value={w.week}>Week {w.week} — {w.session}</option>)}
            </select>
          </div>
          <div style={{ padding: '14px 16px', background: 'var(--paper-soft)', borderRadius: 6, marginBottom: 20 }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 4 }}>Preview email subject</p>
            <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', fontStyle: 'italic' }}>
              "Reminder: Live session Week {reminderWeek} — tomorrow"
            </p>
          </div>
          <button onClick={sendSessionReminder} disabled={sending} className="btn btn-primary">
            {sending ? 'Sending...' : `📅 Send to All ${learners.length} Learners`}
          </button>
        </div>
      )}

      {/* Inactivity Nudge */}
      {tab === 'inactivity' && (
        <div className="card">
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 8 }}>Send Inactivity Nudge</h2>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginBottom: 20 }}>
            Target specific learners who haven't engaged recently. Each receives a personalised nudge.
          </p>

          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label">Custom message (optional)</label>
            <textarea className="form-input form-textarea" style={{ minHeight: 80 }} placeholder="Leave blank to use the default message about falling behind. Or customise: 'We noticed you missed last week's session. Here's what you need to catch up on...'" value={inactivityMessage} onChange={e => setInactivityMessage(e.target.value)} />
          </div>

          <label className="form-label" style={{ display: 'block', marginBottom: 12 }}>
            Select learners to nudge
            {riskLearners.length > 0 && (
              <button onClick={() => setInactivityTargets(riskLearners.map(l => l.id))} style={{ marginLeft: 10, fontSize: '0.75rem', color: 'var(--amber-deep)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }}>
                Select all at-risk ({riskLearners.length})
              </button>
            )}
          </label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20, maxHeight: 240, overflowY: 'auto' }}>
            {learners.map(l => (
              <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: inactivityTargets.includes(l.id) ? 'var(--paper-soft)' : 'transparent', borderRadius: 4, cursor: 'pointer', border: `1px solid ${inactivityTargets.includes(l.id) ? 'var(--amber)' : 'var(--paper-line)'}` }}>
                <input type="checkbox" checked={inactivityTargets.includes(l.id)} onChange={() => toggleInactivityTarget(l.id)} style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--amber)' }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: '0.875rem' }}>{l.first_name} {l.last_name}</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--ink-muted)' }}>{l.pathway} · {l.email}</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 100, background: l.risk_status === 'Red' ? 'rgba(179,56,44,0.1)' : l.risk_status === 'Amber' ? 'rgba(197,116,58,0.1)' : 'rgba(79,106,74,0.1)', color: l.risk_status === 'Red' ? 'var(--red)' : l.risk_status === 'Amber' ? 'var(--amber-deep)' : 'var(--moss)' }}>
                    {l.risk_status}
                  </span>
                  <span style={{ fontSize: '0.5625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 100, background: 'var(--paper-soft)', color: 'var(--ink-muted)' }}>
                    {l.assignment_completion_pct || 0}%
                  </span>
                </div>
              </label>
            ))}
          </div>
          <button onClick={sendInactivityNudges} disabled={sending || inactivityTargets.length === 0} className="btn btn-primary">
            {sending ? 'Sending...' : `⚡ Nudge ${inactivityTargets.length} Learner${inactivityTargets.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      )}

      {/* Custom Email */}
      {tab === 'custom' && (
        <div className="card">
          <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 8 }}>Custom Email</h2>
          <p style={{ color: 'var(--ink-muted)', fontSize: '0.9rem', marginBottom: 20 }}>Send any message to all learners, a pathway group, or a specific learner.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Send to</label>
              <select className="form-input" value={typeof customEmail.targetLearners === 'string' ? customEmail.targetLearners : 'custom'} onChange={e => setCustomEmail({ ...customEmail, targetLearners: e.target.value as 'all' | 'pm' | 'ba' })}>
                <option value="all">All {learners.length} active learners</option>
                <option value="pm">PM Pathway ({learners.filter(l => l.pathway === 'PM').length} learners)</option>
                <option value="ba">BA Pathway ({learners.filter(l => l.pathway === 'BA').length} learners)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Subject *</label>
              <input className="form-input" placeholder="[Upthrust] Week 3 update" value={customEmail.subject} onChange={e => setCustomEmail({ ...customEmail, subject: e.target.value })} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Message *</label>
              <textarea className="form-input form-textarea" style={{ minHeight: 160 }} placeholder="Write your email. Use plain language — this will be formatted with Upthrust branding automatically." value={customEmail.content} onChange={e => setCustomEmail({ ...customEmail, content: e.target.value })} />
            </div>
            <button onClick={sendCustomEmail} disabled={sending || !customEmail.subject || !customEmail.content} className="btn btn-primary">
              {sending ? 'Sending...' : '✉️ Send Email'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
