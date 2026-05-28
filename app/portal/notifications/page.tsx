'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { createBrowserClient } from '@/lib/supabase';
import type { Notification } from '@/lib/types';
import Link from 'next/link';

const TYPE_ICON: Record<string, string> = {
  feedback_ready: '💬',
  resubmission_required: '↩',
  assignment_due: '📝',
  session_reminder: '📅',
  passport_approved: '🏆',
  announcement: '📣',
  inactivity_nudge: '⚡',
};

const TYPE_COLOR: Record<string, string> = {
  feedback_ready: '#2563EB',
  resubmission_required: '#DC2626',
  assignment_due: '#D97706',
  session_reminder: '#0F1A2E',
  passport_approved: '#C5743A',
  announcement: '#4F6A4A',
  inactivity_nudge: '#7C3AED',
};

const TYPE_HREF: Record<string, string> = {
  feedback_ready: '/portal/assignments',
  resubmission_required: '/portal/assignments',
  assignment_due: '/portal/assignments',
  session_reminder: '/portal/sessions',
  passport_approved: '/portal/passport',
  announcement: '/portal',
  inactivity_nudge: '/portal',
};

export default function NotificationsPage() {
  const { user } = useUser();
  const [learner, setLearner] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const db = createBrowserClient();

  useEffect(() => {
    if (!user) return;
    async function load() {
      const { data: l } = await db.from('learners').select('*').eq('clerk_user_id', user!.id).maybeSingle();
      setLearner(l);
      if (!l) { setLoading(false); return; }
      const { data: n } = await db
        .from('notifications')
        .select('*')
        .eq('learner_id', l.id)
        .order('created_at', { ascending: false });
      setNotifications((n || []) as Notification[]);
      setLoading(false);
    }
    load();
  }, [user]);

  async function markRead(id: string) {
    await db.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  async function markAllRead() {
    if (!learner) return;
    setMarkingAll(true);
    await db.from('notifications').update({ is_read: true }).eq('learner_id', learner.id).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setMarkingAll(false);
  }

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div className="portal-content" style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--ink-muted)', marginBottom: 6 }}>Your Activity</p>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', fontWeight: 400 }}>Notifications</h1>
          {unreadCount > 0 && (
            <p style={{ color: 'var(--amber-deep)', fontWeight: 600, marginTop: 4 }}>{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <button onClick={markAllRead} disabled={markingAll} className="btn btn-outline btn-sm">
            {markingAll ? 'Marking...' : 'Mark all as read'}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--paper-line)', borderTopColor: 'var(--ink)', borderRadius: '50%', animation: 'spin 700ms linear infinite', margin: '0 auto 16px' }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ color: 'var(--ink-muted)' }}>Loading notifications...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ padding: '64px', textAlign: 'center', background: 'var(--white)', borderRadius: 8, border: '1px solid var(--paper-line)' }}>
          <p style={{ fontSize: '3rem', marginBottom: 16 }}>🔔</p>
          <p style={{ fontFamily: 'Fraunces, serif', fontSize: '1.25rem', marginBottom: 8 }}>No notifications yet</p>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6 }}>
            Notifications appear here when Genesis reviews your work, when assignments are due, or when there are cohort announcements.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notifications.map(n => (
            <Link
              key={n.id}
              href={TYPE_HREF[n.type] || '/portal'}
              onClick={() => markRead(n.id)}
              style={{
                display: 'flex', gap: 16, alignItems: 'flex-start',
                padding: '16px 20px',
                background: n.is_read ? 'var(--white)' : 'rgba(15,26,46,0.03)',
                border: `1px solid ${n.is_read ? 'var(--paper-line)' : 'rgba(15,26,46,0.12)'}`,
                borderLeft: `4px solid ${n.is_read ? 'transparent' : TYPE_COLOR[n.type] || 'var(--ink)'}`,
                borderRadius: 6,
                textDecoration: 'none',
                transition: 'background 150ms',
              }}
            >
              {/* Icon */}
              <div style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: n.is_read ? 'var(--paper-soft)' : `${TYPE_COLOR[n.type] || 'var(--ink)'}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.125rem',
              }}>
                {TYPE_ICON[n.type] || '🔔'}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                  <p style={{
                    fontWeight: n.is_read ? 500 : 700,
                    fontSize: '0.9375rem',
                    color: n.is_read ? 'var(--ink-soft)' : 'var(--ink)',
                  }}>
                    {n.title}
                  </p>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {!n.is_read && (
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLOR[n.type] || 'var(--ink)', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: '0.6875rem', color: 'var(--ink-muted)', whiteSpace: 'nowrap' }}>
                      {timeAgo(n.created_at)}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '0.875rem', color: 'var(--ink-muted)', lineHeight: 1.55 }}>
                  {n.message}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
