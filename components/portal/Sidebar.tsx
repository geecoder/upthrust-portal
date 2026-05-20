'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useClerk, useUser } from '@clerk/nextjs';
import {
  LayoutDashboard, BookOpen, FileText, Briefcase, Award,
  Users, Library, Settings, LogOut, ChevronRight,
} from 'lucide-react';
import clsx from 'clsx';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/weeks', icon: BookOpen, label: 'Weekly Content' },
  { href: '/assignments', icon: FileText, label: 'Assignments' },
  { href: '/portfolio', icon: Briefcase, label: 'Portfolio' },
  { href: '/passport', icon: Award, label: 'Capability Passport' },
  { href: '/community', icon: Users, label: 'Community' },
  { href: '/resources', icon: Library, label: 'Resources' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ isAdmin }: { isAdmin?: boolean }) {
  const pathname = usePathname();
  const { signOut } = useClerk();
  const { user } = useUser();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-64 bg-ink flex flex-col z-50" style={{ background: 'var(--ink)' }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <path d="M4 22 L14 6 L24 22 M9 18 L19 18" stroke="#FAF7F1" strokeWidth="2.2" strokeLinecap="square"/>
        </svg>
        <div>
          <p className="font-serif text-base font-medium text-paper leading-tight">Upthrust</p>
          <p className="text-xs text-paper/50 leading-tight">Cohort 1 Portal</p>
        </div>
      </div>

      {/* User info */}
      <div className="px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-amber/20 flex items-center justify-center flex-shrink-0">
            <span className="text-amber-soft text-xs font-bold">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </span>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-paper truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-paper/50 truncate">{user?.primaryEmailAddress?.emailAddress}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-0.5">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-white/10 text-paper'
                    : 'text-paper/60 hover:bg-white/5 hover:text-paper'
                )}
              >
                <Icon size={16} className="flex-shrink-0" />
                <span>{label}</span>
                {active && <ChevronRight size={12} className="ml-auto opacity-50" />}
              </Link>
            );
          })}
        </div>

        {/* Admin link */}
        {isAdmin && (
          <>
            <div className="my-4 border-t border-white/10" />
            <p className="px-3 mb-2 text-xs font-bold tracking-widest uppercase text-paper/30">Admin</p>
            {[
              { href: '/admin/dashboard', label: 'Cohort Overview' },
              { href: '/admin/learners', label: 'Manage Learners' },
              { href: '/admin/content', label: 'Manage Content' },
            ].map(({ href, label }) => (
              <Link key={href} href={href} className={clsx(
                'flex items-center gap-3 px-3 py-2.5 text-sm font-medium transition-all duration-150',
                pathname.startsWith(href) ? 'bg-amber/20 text-amber-soft' : 'text-paper/60 hover:bg-white/5 hover:text-paper'
              )}>
                <span className="w-1.5 h-1.5 rounded-full bg-amber flex-shrink-0" />
                {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      {/* Sign out */}
      <div className="px-3 pb-4 border-t border-white/10 pt-3">
        <button
          onClick={() => signOut({ redirectUrl: '/auth/login' })}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-sm font-medium text-paper/60 hover:text-paper hover:bg-white/5 transition-all duration-150"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
