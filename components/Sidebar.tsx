'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';

const LEARNER_NAV = [
  { href: '/portal', label: 'Dashboard', icon: '◈', exact: true },
  { href: '/portal/week', label: 'Weekly Content', icon: '📅' },
  { href: '/portal/assignments', label: 'Assignments', icon: '📝' },
  { href: '/portal/portfolio', label: 'My Portfolio', icon: '💼' },
  { href: '/portal/passport', label: 'Capability Passport', icon: '🏆' },
  { href: '/portal/community', label: 'Community', icon: '💬' },
  { href: '/portal/resources', label: 'Resources', icon: '📚' },
];

const AI_NAV = [
  { href: '/portal/simulation', label: 'Stakeholder Sim', icon: '🎭' },
  { href: '/portal/interview', label: 'Interview Coach', icon: '💼' },
  { href: '/portal/writing-check', label: 'Writing Checker', icon: '✍️' },
];

const ADMIN_NAV = [
  { href: '/admin', label: 'Dashboard', icon: '📊', exact: true },
  { href: '/admin/reviews', label: 'Review Queue', icon: '📬' },
  { href: '/admin/attendance', label: 'Attendance', icon: '📋' },
  { href: '/admin/learners', label: 'All Learners', icon: '👥' },
  { href: '/admin/content', label: 'Manage Content', icon: '✏️' },
  { href: '/admin/cohort', label: 'Cohort Settings', icon: '⚙️' },
];

interface SidebarProps {
  learnerName?: string;
  pathway?: string;
  tier?: string;
  isAdmin?: boolean;
  currentWeek?: number;
}

export default function Sidebar({
  learnerName,
  pathway,
  tier,
  isAdmin,
  currentWeek = 0,
}: SidebarProps) {
  const pathname = usePathname();

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
          padding: 10px 20px;
          font-size: 0.9rem;
          font-weight: 400;
          text-decoration: none;
          color: rgba(250,247,241,0.55);
          background: transparent;
          border-left: 2px solid transparent;
          transition: color 150ms, background 150ms, border-color 150ms;
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
        .sidebar-icon {
          font-size: 1rem;
          line-height: 1;
          flex-shrink: 0;
        }
      `}</style>

      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(250,247,241,0.1)' }}>
        <Link href="/portal" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <path d="M4 22 L14 6 L24 22 M9 18 L19 18"
              stroke="#FAF7F1" strokeWidth="2.2" strokeLinecap="square" />
          </svg>
          <span style={{
            fontFamily: 'Fraunces, serif', fontSize: '1.125rem',
            fontWeight: 500, color: '#FAF7F1', letterSpacing: '-0.02em',
          }}>
            Upthrust
          </span>
        </Link>

        {/* Pathway + tier badges */}
        {(pathway || tier) && (
          <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {pathway && (
              <span style={{
                fontSize: '0.5625rem', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '2px 6px', borderRadius: 2,
                background: 'rgba(197,116,58,0.2)', color: '#F1DEC4',
              }}>
                {pathway}
              </span>
            )}
            {tier && (
              <span style={{
                fontSize: '0.5625rem', fontWeight: 700,
                letterSpacing: '0.1em', textTransform: 'uppercase',
                padding: '2px 6px', borderRadius: 2,
                background: 'rgba(250,247,241,0.08)', color: 'rgba(250,247,241,0.6)',
              }}>
                {tier}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Current week */}
      <div style={{
        padding: '10px 20px',
        background: 'rgba(197,116,58,0.1)',
        borderBottom: '1px solid rgba(250,247,241,0.08)',
      }}>
        <p style={{
          fontSize: '0.5625rem', fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase',
          color: 'rgba(250,247,241,0.4)', marginBottom: 2,
        }}>
          Current
        </p>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1DEC4' }}>
          Week {currentWeek} · Cohort 1
        </p>
      </div>

      {/* Learner navigation */}
      <nav style={{ padding: '10px 0', flex: 1 }}>
        {LEARNER_NAV.map(({ href, label, icon, exact }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-link${isActive(href, exact) ? ' active' : ''}`}
          >
            <span className="sidebar-icon">{icon}</span>
            {label}
          </Link>
        ))}

        {/* AI Practice Lab */}
        <div style={{ height: 1, background: 'rgba(250,247,241,0.1)', margin: '10px 20px' }} />
        <p style={{
          padding: '4px 20px 6px',
          fontSize: '0.5625rem', fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase',
          color: 'rgba(250,247,241,0.3)',
        }}>
          AI Practice Lab
        </p>
        {AI_NAV.map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className={`sidebar-link${isActive(href) ? ' active' : ''}`}
          >
            <span className="sidebar-icon">{icon}</span>
            {label}
          </Link>
        ))}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div style={{
              height: 1,
              background: 'rgba(250,247,241,0.1)',
              margin: '12px 20px',
            }} />
            <p style={{
              padding: '4px 20px 8px',
              fontSize: '0.5625rem', fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase',
              color: 'rgba(250,247,241,0.3)',
            }}>
              Admin
            </p>
            {ADMIN_NAV.map(({ href, label, icon, exact }) => (
              <Link
                key={href}
                href={href}
                className={`sidebar-link${isActive(href, exact) ? ' active' : ''}`}
              >
                <span className="sidebar-icon">{icon}</span>
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* User section */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid rgba(250,247,241,0.1)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <UserButton afterSignOutUrl="/auth/sign-in" />
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <p style={{
            fontSize: '0.875rem', fontWeight: 600, color: '#FAF7F1',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {learnerName || 'My Account'}
          </p>
          <p style={{ fontSize: '0.6875rem', color: 'rgba(250,247,241,0.45)' }}>
            Cohort 1
          </p>
        </div>
      </div>
    </aside>
  );
}
