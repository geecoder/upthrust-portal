export const dynamic = 'force-dynamic';

/**
 * Route gate for Capstone — the one module with the 'locked' presentation.
 *
 * Unlike the Community and Notifications gates, this one does NOT redirect. A
 * learner who opens a closed capstone gets a screen telling them when it opens,
 * because a capstone they cannot see at all is a worse experience than one they
 * can see coming. This is the case gateModule() returns a decision for rather
 * than acting on: a helper that redirected internally could not express it.
 *
 * The gated content is still never rendered. The locked screen replaces
 * `children`, so the brief, the deliverables and the learner's submission state
 * are not fetched, not serialised and not sent — the page below never runs.
 */

import { gateModule } from '@/lib/module-gate';
import LockedModule, { AdminOverrideNotice } from '@/components/LockedModule';

export default async function CapstoneLayout({ children }: { children: React.ReactNode }) {
  const gate = await gateModule('capstone');

  if (!gate.allowed) return <LockedModule moduleKey="capstone" />;

  return (
    <>
      {gate.adminOverride && <AdminOverrideNotice moduleKey="capstone" />}
      {children}
    </>
  );
}
