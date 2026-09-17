export const dynamic = 'force-dynamic';

/**
 * Route gate for Interview Coach.
 *
 * Same shape and reasoning as the Community gate: the decision is made on the
 * SERVER, in a layout, because the page below is a client component. The gated
 * page is never rendered and never reaches the browser.
 *
 * Presentation is 'absent'. The page itself is cheap, but everything it does
 * costs Anthropic API calls, so the gate is paired with a guard on
 * /api/interview — hiding the page while leaving the endpoint open would leave
 * a billable surface reachable by URL.
 */

import { redirect } from 'next/navigation';
import { gateModule } from '@/lib/module-gate';

export default async function InterviewLayout({ children }: { children: React.ReactNode }) {
  const gate = await gateModule('ai_lab.interview_coach');
  if (!gate.allowed) redirect('/portal');
  return <>{children}</>;
}
