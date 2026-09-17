export const dynamic = 'force-dynamic';

/**
 * Retired route. Milestone 4 replaced the Portfolio surface with Capstone.
 *
 * Kept as a redirect rather than deleted, because this path is in learners'
 * browser history, in the onboarding copy and in at least one email template. A
 * 404 on a link somebody was given is a worse outcome than a redirect.
 *
 * Nothing is lost in the move. What the old page tried to show — required
 * artefacts per week, and a learner's own added evidence — is on the capstone
 * page, sourced from the live curriculum instead of a hardcoded list. Worth
 * recording that the old page had never actually worked: it read `learners`
 * through the browser anon client, which RLS shows nothing, so its early
 * `if (!l) return` fired on every load for every learner (same root cause as
 * docs/DEFERRED.md D-22). The replacement reads on the server.
 *
 * NOTE: /portal/capstone is gated by the `capstone` module flag. With the flag
 * off, a learner following this redirect lands on the locked screen. That is
 * the intended consequence of the two surfaces merging, and it means enabling
 * `capstone` in /admin/modules is now a prerequisite for learners reaching
 * their evidence at all.
 */

import { redirect } from 'next/navigation';

export default function RetiredPortfolioPage() {
  redirect('/portal/capstone');
}
