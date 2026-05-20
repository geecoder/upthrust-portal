'use client';
import { useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';
import { PROGRAM } from '@/lib/types';

export default function CohortPage() {
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [priority, setPriority] = useState<'Normal' | 'Important' | 'Urgent'>('Normal');
  const [saving, setSaving] = useState(false);

  async function postAnnouncement() {
    if (!announcementTitle || !announcementContent) return;
    setSaving(true);
    const db = createBrowserClient();
    await db.from('announcements').insert({ title: announcementTitle, content: announcementContent, priority, is_published: true });
    setAnnouncementTitle('');
    setAnnouncementContent('');
    setSaving(false);
    alert('Announcement posted!');
  }

  return (
    <div className="portal-content">
      <div style={{ marginBottom: 28 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Admin</p>
        <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Cohort Settings</h1>
      </div>

      {/* Program info */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 16 }}>Program Configuration</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[
            { label: 'Cohort', value: PROGRAM.cohort },
            { label: 'Start Date', value: PROGRAM.start },
            { label: 'End Date', value: PROGRAM.end },
            { label: 'Demo Day', value: PROGRAM.demoDay },
            { label: 'Enrollment Closes', value: PROGRAM.enrollmentClose },
            { label: 'Contact Email', value: PROGRAM.contact },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</p>
              <p style={{ fontWeight: 600 }}>{value}</p>
            </div>
          ))}
        </div>
        <p style={{ marginTop: 16, fontSize: '0.8125rem', color: 'var(--ink-muted)' }}>To update these values, edit <code>lib/types.ts</code> in the codebase.</p>
      </div>

      {/* Post announcement */}
      <div className="card">
        <h2 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, marginBottom: 16 }}>Post Announcement</h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', marginBottom: 16 }}>Announcements appear at the top of every learner's dashboard.</p>
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" type="text" placeholder="e.g. Week 3 session moved to Sunday" value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Message</label>
          <textarea className="form-input form-textarea" placeholder="Full announcement text..." value={announcementContent} onChange={e => setAnnouncementContent(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Priority</label>
          <select className="form-input" value={priority} onChange={e => setPriority(e.target.value as any)}>
            <option value="Normal">Normal</option>
            <option value="Important">Important</option>
            <option value="Urgent">🔴 Urgent</option>
          </select>
        </div>
        <button className="btn btn-primary" disabled={!announcementTitle || !announcementContent || saving} onClick={postAnnouncement}>
          {saving ? 'Posting...' : 'Post to All Learners'}
        </button>
      </div>
    </div>
  );
}
