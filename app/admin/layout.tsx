export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  if (!userId) redirect('/auth/sign-in');
  if (userId !== process.env.ADMIN_USER_ID) redirect('/portal');

  const currentWeek = Math.min(Math.floor((new Date().getTime() - new Date('2026-06-06').getTime()) / (1000 * 60 * 60 * 24 * 7)), 12);

  return (
    <div className="portal-layout">
      <Sidebar learnerName="Genesis (Admin)" isAdmin currentWeek={Math.max(0, currentWeek)} />
      <main className="portal-main">{children}</main>
    </div>
  );
}
