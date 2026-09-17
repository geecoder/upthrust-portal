export const dynamic = 'force-dynamic';

/**
 * Route gate for Writing Checker.
 *
 * Same shape and reasoning as the Community gate: the decision is made on the
 * SERVER, in a layout, because the page below is a client component. The gated
 * page is never rendered and never reaches the browser.
 *
 * Presentation is 'absent', and paired with a guard on /api/writing-check for
 * the same reason as Interview Coach: the cost is in the endpoint, not the
 * page, so hiding the page alone would not switch the module off.
 */

import { redirect } from 'next/navigation';
import { gateModule } from '@/lib/module-gate';

export default async function WritingCheckLayout({ children }: { children: React.ReactNode }) {
  const gate = await gateModule('ai_lab.writing_checker');
  if (!gate.allowed) redirect('/portal');
  return <>{children}</>;
}
