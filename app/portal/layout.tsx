export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import type { Learner } from '@/lib/types';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/auth/sign-in');

  const isAdmin = userId === process.env.ADMIN_USER_ID;
  const currentWeek = getCurrentWeek();

  // Fetch learner data — wrapped in try/catch so a DB error doesn't crash the layout
  let learner: Learner | null = null;
  try {
    const db = createAdminClient();
    const { data } = await db
      .from('learners')
      .select('*')
      .eq('clerk_user_id', userId)
      .maybeSingle(); // maybeSingle returns null instead of error when no row found
    learner = data as Learner | null;
  } catch (err) {
    console.error('Portal layout: failed to fetch learner', err);
  }

  // Not admin and no learner record → show pending page
  if (!isAdmin && !learner) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--paper-soft)', padding: 24,
      }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{
            width: 64, height: 64, background: 'var(--ink)', borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', fontSize: '1.75rem',
          }}>
            🔒
          </div>
          <h1 style={{
            fontFamily: 'Fraunces, serif', fontSize: '1.75rem',
            fontWeight: 400, marginBottom: 12,
          }}>
            Access Pending
          </h1>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.65, marginBottom: 8 }}>
            Your Upthrust portal account is being activated. This usually happens within
            a few hours of enrollment confirmation.
          </p>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.65, marginBottom: 24, fontSize: '0.9375rem' }}>
            If you believe this is an error, email{' '}
            <a href="mailto:info@upthrustdigital.com" style={{ color: 'var(--amber-deep)', fontWeight: 600 }}>
              info@upthrustdigital.com
            </a>
          </p>
          <a href="mailto:info@upthrustdigital.com" className="btn btn-primary">
            Contact Support
          </a>
        </div>
      </div>
    );
  }

  const displayName = isAdmin
    ? 'Genesis (Admin)'
    : `${learner?.first_name || ''} ${learner?.last_name || ''}`.trim() || 'Learner';

  return (
    <div className="portal-layout">
      <Sidebar
        learnerName={displayName}
        pathway={isAdmin ? undefined : learner?.pathway}
        tier={isAdmin ? undefined : learner?.tier}
        isAdmin={isAdmin}
        currentWeek={currentWeek}
      />
      <main className="portal-main">
        {children}
      </main>
    </div>
  );
}

function getCurrentWeek(): number {
  const now = new Date();
  const start = new Date('2026-06-06');
  if (now < start) return 0;
  const diffDays = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  );
  return Math.min(Math.floor(diffDays / 7), 12);
}
