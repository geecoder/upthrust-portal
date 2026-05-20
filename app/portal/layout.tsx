export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import type { Learner } from '@/lib/types';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/auth/sign-in');

  const adminClient = createAdminClient();
  const isAdmin = userId === process.env.ADMIN_USER_ID;

  // Get learner data
  const { data: learner } = await adminClient
    .from('learners')
    .select('*')
    .eq('clerk_user_id', userId)
    .single();

  // If not Genesis and no learner record — show pending page
  if (!isAdmin && !learner) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper-soft)', padding: 24 }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, background: 'var(--ink)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: '1.75rem' }}>🔒</div>
          <h1 style={{ fontFamily: 'Fraunces, serif', fontSize: '1.75rem', marginBottom: 12 }}>Access Pending</h1>
          <p style={{ color: 'var(--ink-muted)', lineHeight: 1.6, marginBottom: 24 }}>
            Your Upthrust portal account is being set up. This usually happens within a few hours of enrollment confirmation. If you believe this is an error, email <strong>info@upthrustdigital.com</strong>.
          </p>
          <a href="mailto:info@upthrustdigital.com" className="btn btn-primary">Contact Support</a>
        </div>
      </div>
    );
  }

  const typedLearner = learner as Learner | null;
  const currentWeek = getCurrentWeek();

  return (
    <div className="portal-layout">
      <Sidebar
        learnerName={isAdmin ? 'Genesis (Admin)' : `${typedLearner?.first_name || ''} ${typedLearner?.last_name || ''}`.trim()}
        pathway={isAdmin ? undefined : typedLearner?.pathway}
        tier={isAdmin ? undefined : typedLearner?.tier}
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
  const diffDays = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.min(Math.floor(diffDays / 7), 12);
}
