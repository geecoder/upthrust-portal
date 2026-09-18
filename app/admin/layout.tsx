export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import { getModuleAccess } from '@/lib/module-access';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/auth/sign-in');
  if (userId !== process.env.ADMIN_USER_ID) redirect('/portal');

  const currentWeek = getCurrentWeek();

  // The admin screens share the learner sidebar, so it needs the same resolved
  // access. Global state — no cohort and no learner — is the right view here:
  // an admin working in /admin is looking at the product, not at one cohort's
  // or one learner's experience.
  const access = await getModuleAccess();

  return (
    <div className="portal-layout">
      <Sidebar
        learnerName="Genesis (Admin)"
        isAdmin
        currentWeek={currentWeek}
        access={access}
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
