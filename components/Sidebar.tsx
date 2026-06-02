'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@/lib/supabase';

const LEARNER_NAV = [
  { href: '/portal', label: 'Dashboard', icon: '◈', exact: true },
  { href: '/portal/week', label: 'Weekly Content', icon: '📅' },
  { href: '/portal/sessions', label: 'Live Sessions', icon: '🎥' },
  { href: '/portal/assignments', label: 'Assignments', icon: '📝' },
  { href: '/portal/portfolio', label: 'My Portfolio', icon: '💼' },
  { href: '/portal/passport', label: 'Capability Passport', icon: '🏆' },
  { href: '/portal/community', label: 'Community', icon: '💬' },
  { href: '/portal/resources', label: 'Resources', icon: '📚' },
];

const AI_NAV = [
  { href: '/portal/simulation', label: 'Stakeholder Sim', icon: '🎭' },
  { href: '/portal/interview', label: 'Interview Coach', icon: '💬' },
  { href: '/portal/writing-check', label: 'Writing Checker', icon: '✍️' },
];

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
  { href: '/admin/reviews', label: 'Review Queue', icon: '📬' },
  { href: '/admin/attendance', label: 'Attendance', icon: '📋' },
  { href: '/admin/sessions', label: 'Live Sessions', icon: '🎥' },
  { href: '/admin/learners', label: 'All Learners', icon: '👥' },
  { href: '/admin/content', label: 'Week Content', icon: '✏️' },
  { href: '/admin/resources', label: 'Resource Library', icon: '📚' },
  { href: '/admin/cohort', label: 'Cohort Settings', icon: '⚙️' },
];

interface SidebarProps {
  learnerName?: string;
  learnerId?: string;
  pathway?: string;
  tier?: string;
  isAdmin?: boolean;
  currentWeek?: number;
}

export default function Sidebar({ learnerName, learnerId, pathway, tier, isAdmin, currentWeek = 0 }: SidebarProps) {
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  // Load unread notification count
  useEffect(() => {
    if (!learnerId || isAdmin) return;
    const db = createBrowserClient();
    db.from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('learner_id', learnerId)
      .eq('is_read', false)
      .then(({ count }) => setUnreadCount(count || 0));
  }, [learnerId, isAdmin]);

  function isActive(href: string, exact?: boolean) {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + '/') || (href !== '/portal' && pathname.startsWith(href));
  }

  return (
    <aside className="portal-sidebar">
      <style>{`
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 9px 20px;
          font-size: 0.875rem;
          font-weight: 400;
          text-decoration: none;
          color: rgba(250,247,241,0.55);
          background: transparent;
          border: none;
          border-left: 2px solid transparent;
          transition: color 150ms, background 150ms, border-color 150ms;
          position: relative;
          cursor: pointer;
          width: 100%;
          text-align: left;
        }
        .sidebar-link:hover {
          color: rgba(250,247,241,0.9);
          background: rgba(250,247,241,0.06);
        }
        .sidebar-link.active {
          color: #FAF7F1;
          font-weight: 600;
          background: rgba(250,247,241,0.1);
          border-left-color: #C5743A;
        }
        .sidebar-icon { font-size: 0.9375rem; line-height: 1; flex-shrink: 0; }
        .sidebar-section {
          font-size: 0.5rem;
          font-weight: 800;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(250,247,241,0.25);
          padding: 10px 20px 5px;
        }
        .notif-badge {
          background: #DC2626;
          color: #FAF7F1;
          font-size: 0.5rem;
          font-weight: 800;
          min-width: 16px;
          height: 16px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
          margin-left: auto;
          flex-shrink: 0;
        }
      `}</style>

      {/* Logo */}
      <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(250,247,241,0.08)' }}>
        <Link href="/portal" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <path d="M4 22 L14 6 L24 22 M9 18 L19 18" stroke="#FAF7F1" strokeWidth="2.2" strokeLinecap="square"/>
          </svg>
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.0625rem', fontWeight: 400, color: '#FAF7F1', letterSpacing: '-0.02em' }}>
            Upthrust
          </span>
        </Link>
        {(pathway || tier) && (
          <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
            {pathway && (
              <span style={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 2, background: 'rgba(197,116,58,0.18)', color: '#F1DEC4' }}>
                {pathway}
              </span>
            )}
            {tier && (
              <span style={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 2, background: 'rgba(250,247,241,0.07)', color: 'rgba(250,247,241,0.5)' }}>
                {tier}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Current week */}
      <div style={{ padding: '9px 20px', background: 'rgba(197,116,58,0.08)', borderBottom: '1px solid rgba(250,247,241,0.06)' }}>
        <p style={{ fontSize: '0.5rem', fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(250,247,241,0.35)', marginBottom: 1 }}>Current</p>
        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#F1DEC4' }}>Week {currentWeek} · Cohort 1</p>
      </div>

      {/* Main nav */}
      <nav style={{ flex: 1, overflowY: 'auto', paddingTop: 8, paddingBottom: 8 }}>

        <div className="sidebar-section">Main</div>
        {LEARNER_NAV.map(({ href, label, icon, exact }) => (
          <Link key={href} href={href} className={`sidebar-link${isActive(href, exact) ? ' active' : ''}`}>
            <span className="sidebar-icon">{icon}</span>
            <span style={{ flex: 1 }}>{label}</span>
            {href === '/portal/notifications' && unreadCount > 0 && (
              <span className="notif-badge">{unreadCount}</span>
            )}
          </Link>
        ))}

        {/* Notifications link */}
        <Link href="/portal/notifications" className={`sidebar-link${isActive('/portal/notifications') ? ' active' : ''}`}>
          <span className="sidebar-icon">🔔</span>
          <span style={{ flex: 1 }}>Notifications</span>
          {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </Link>

        {/* Profile link */}
        <Link href="/portal/profile" className={`sidebar-link${isActive('/portal/profile') ? ' active' : ''}`}>
          <span className="sidebar-icon">👤</span>
          Profile Settings
        </Link>

        {/* AI Practice Lab */}
        <div className="sidebar-section" style={{ marginTop: 8 }}>AI Practice Lab</div>
        {AI_NAV.map(({ href, label, icon }) => (
          <Link key={href} href={href} className={`sidebar-link${isActive(href) ? ' active' : ''}`}>
            <span className="sidebar-icon">{icon}</span>
            {label}
          </Link>
        ))}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div className="sidebar-section" style={{ marginTop: 8 }}>Admin</div>
            {ADMIN_NAV.map(({ href, label, icon, exact }) => (
              <Link key={href} href={href} className={`sidebar-link${isActive(href, exact) ? ' active' : ''}`}>
                <span className="sidebar-icon">{icon}</span>
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User footer */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(250,247,241,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <UserButton afterSignOutUrl="/auth/sign-in" />
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#FAF7F1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {learnerName || 'My Account'}
          </p>
          <p style={{ fontSize: '0.625rem', color: 'rgba(250,247,241,0.4)', letterSpacing: '0.06em' }}>Cohort 1</p>
        </div>
      </div>
    </aside>
  );
}
