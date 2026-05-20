'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { PROGRAM } from '@/lib/types';

const NAV_ITEMS = [
  { href: '/portal', label: 'Dashboard', icon: '◈' },
  { href: '/portal/week', label: 'Weekly Content', icon: '📅' },
  { href: '/portal/assignments', label: 'Assignments', icon: '📝' },
  { href: '/portal/portfolio', label: 'My Portfolio', icon: '💼' },
  { href: '/portal/passport', label: 'Capability Passport', icon: '🏆' },
  { href: '/portal/community', label: 'Community', icon: '💬' },
  { href: '/portal/resources', label: 'Resources', icon: '📚' },
];

interface SidebarProps {
  learnerName?: string;
  pathway?: string;
  tier?: string;
  isAdmin?: boolean;
  currentWeek?: number;
}

export default function Sidebar({ learnerName, pathway, tier, isAdmin, currentWeek = 0 }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="portal-sidebar">
      {/* Logo */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(250,247,241,0.1)' }}>
        <Link href="/portal" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <path d="M4 22 L14 6 L24 22 M9 18 L19 18" stroke="#FAF7F1" strokeWidth="2.2" strokeLinecap="square"/>
          </svg>
          <span style={{ fontFamily: 'Fraunces, serif', fontSize: '1.125rem', fontWeight: 500, color: '#FAF7F1', letterSpacing: '-0.02em' }}>
            Upthrust
          </span>
        </Link>
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          {pathway && (
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', background: 'rgba(197,116,58,0.2)', color: '#F1DEC4', borderRadius: 2 }}>
              {pathway}
            </span>
          )}
          {tier && (
            <span style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', background: 'rgba(250,247,241,0.08)', color: 'rgba(250,247,241,0.6)', borderRadius: 2 }}>
              {tier}
            </span>
          )}
        </div>
      </div>

      {/* Current week indicator */}
      <div style={{ padding: '12px 20px', background: 'rgba(197,116,58,0.12)', borderBottom: '1px solid rgba(250,247,241,0.08)' }}>
        <p style={{ fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(250,247,241,0.5)', marginBottom: 2 }}>Current</p>
        <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#F1DEC4' }}>Week {currentWeek} · {PROGRAM.cohort}</p>
      </div>

      {/* Navigation */}
      <nav style={{ padding: '12px 0', flex: 1 }}>
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href || (href !== '/portal' && pathname.startsWith(href));
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 20px',
              color: isActive ? '#FAF7F1' : 'rgba(250,247,241,0.55)',
              background: isActive ? 'rgba(250,247,241,0.1)' : 'transparent',
              borderLeft: isActive ? '2px solid #C5743A' : '2px solid transparent',
              fontSize: '0.9rem', fontWeight: isActive ? 600 : 400,
              transition: 'all 150ms',
              textDecoration: 'none',
            }}>
              <span style={{ fontSize: '1rem', lineHeight: 1 }}>{icon}</span>
              {label}
            </Link>
          );
        })}

        {/* Admin section */}
        {isAdmin && (
          <>
            <div style={{ height: 1, background: 'rgba(250,247,241,0.1)', margin: '12px 20px' }} />
            <p style={{ padding: '4px 20px 8px', fontSize: '0.5625rem', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(250,247,241,0.3)' }}>
              Admin
            </p>
            {[
              { href: '/admin', label: 'All Learners', icon: '👥' },
              { href: '/admin/content', label: 'Manage Content', icon: '✏️' },
              { href: '/admin/cohort', label: 'Cohort Settings', icon: '⚙️' },
            ].map(({ href, label, icon }) => {
              const isActive = pathname === href || pathname.startsWith(href);
              return (
                <Link key={href} href={href} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 20px',
                  color: isActive ? '#FAF7F1' : 'rgba(250,247,241,0.55)',
                  background: isActive ? 'rgba(250,247,241,0.1)' : 'transparent',
                  borderLeft: isActive ? '2px solid #C5743A' : '2px solid transparent',
                  fontSize: '0.9rem', fontWeight: isActive ? 600 : 400,
                  transition: 'all 150ms',
                  textDecoration: 'none',
                }}>
                  <span style={{ fontSize: '1rem' }}>{icon}</span>
                  {label}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* User section */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(250,247,241,0.1)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <UserButton afterSignOutUrl="/auth/sign-in" />
        <div style={{ overflow: 'hidden' }}>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#FAF7F1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {learnerName || 'My Account'}
          </p>
          <p style={{ fontSize: '0.6875rem', color: 'rgba(250,247,241,0.45)' }}>Cohort 1</p>
        </div>
      </div>
    </aside>
  );
}
