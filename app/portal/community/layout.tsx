export const dynamic = 'force-dynamic';

/**
 * Route gate for Community.
 *
 * A layout rather than a check inside the page, because the page is a client
 * component and the decision has to be made on the SERVER. This way the gated
 * content is never rendered, never serialised, and never reaches the browser —
 * rather than being sent and hidden with CSS.
 *
 * Community's disabled presentation is 'absent': the module is gone, so a
 * learner who arrives here by bookmark or old link is sent to the dashboard
 * rather than shown a locked screen. Nothing is deleted; an admin can turn it
 * back on from /admin/modules and this route starts working again.
 */

import { redirect } from 'next/navigation';
import { gateModule } from '@/lib/module-gate';

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const gate = await gateModule('community');
  if (!gate.allowed) redirect('/portal');
  return <>{children}</>;
}
