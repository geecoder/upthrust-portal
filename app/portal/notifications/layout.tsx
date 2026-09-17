export const dynamic = 'force-dynamic';

/**
 * Route gate for Notifications.
 *
 * Same shape and same reasoning as the Community gate — the decision is made on
 * the server so the gated page is never rendered or sent.
 *
 * Notifications' disabled presentation is 'absent'. The owner asked for it to
 * be removed from the learner experience entirely, so there is no nav item, no
 * unread badge and no polling. It remains a flag rather than a deletion so the
 * decision is reversible, and the notifications table and every row in it are
 * untouched.
 */

import { redirect } from 'next/navigation';
import { gateModule } from '@/lib/module-gate';

export default async function NotificationsLayout({ children }: { children: React.ReactNode }) {
  const gate = await gateModule('notifications');
  if (!gate.allowed) redirect('/portal');
  return <>{children}</>;
}
