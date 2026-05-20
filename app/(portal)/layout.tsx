import { auth } from '@clerk/nextjs/server';
import Sidebar from '@/components/portal/Sidebar';

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { userId } = await auth();
  const isAdmin = userId === process.env.ADMIN_USER_ID;

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--paper-soft)' }}>
      <Sidebar isAdmin={isAdmin} />
      <main className="flex-1 ml-64 min-h-screen">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
