export const dynamic = 'force-dynamic';

/**
 * Route gate for Stakeholder Sim.
 *
 * Same shape and reasoning as the Community gate: the decision is made on the
 * SERVER, in a layout, because the page below is a client component. The gated
 * page is never rendered and never reaches the browser.
 *
 * Presentation is 'absent' — no nav item, no teaser, and this route redirects to
 * the dashboard. This is the one AI tool the cohort keeps, so in normal
 * operation the flag is on and this gate never fires; it exists so the switch
 * means something if it is ever turned off.
 */

import { redirect } from 'next/navigation';
import { gateModule } from '@/lib/module-gate';

export default async function SimulationLayout({ children }: { children: React.ReactNode }) {
  const gate = await gateModule('ai_lab.stakeholder_sim');
  if (!gate.allowed) redirect('/portal');
  return <>{children}</>;
}
