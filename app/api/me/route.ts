export const dynamic = 'force-dynamic';

// app/api/me/route.ts
// ─────────────────────────────────────────────────────────────────────────────
// The signed-in learner's own row, for client components.
//
// ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
// Ten client components read `learners` directly through the browser (anon)
// Supabase client, and RLS shows the anon key 0 of 7 rows
// (docs/SCHEMA_DRIFT.md §4). Every one of those reads has always returned
// null. The visible consequences ranged from cosmetic to total:
//
//   /portal/profile      the form rendered empty for everyone
//   /portal/simulation   learner.pathway was never known
//   /portal/resources    pathway filtering silently fell back to 'PM'
//   /portal/onboarding    learner was null, which sent completeOnboarding()
//                        down a branch that could not work — see below
//
// The fix is one server endpoint rather than ten converted pages: these are
// large client components, and the defect is the DATA PATH, not their
// structure. Read server-side with the service-role client, scoped to the
// caller, and hand back JSON.
//
// ── WHAT IT WILL NOT SERVE ──────────────────────────────────────────────────
// The service-role client bypasses RLS, so `select('*')` here would publish
// every column on the row to the browser — including the staff-authored
// `notes` and `facilitator_note`, and `risk_status`, which is an assessment
// written about the learner for colleagues. The column list is therefore an
// explicit allowlist, LEARNER_SELF_READABLE, and the reasoning for each
// exclusion is recorded beside it in lib/request-fields.ts.
//
// Scoping is by the Clerk user id from auth() and never from anything the
// caller sends. There is no `?learnerId=` parameter, deliberately: an endpoint
// that takes an id is an endpoint that has to prove the id belongs to the
// caller, and the simplest way to never get that wrong is to not accept one.
// ─────────────────────────────────────────────────────────────────────────────
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { LEARNER_SELF_READABLE } from '@/lib/request-fields';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from('learners')
      .select(LEARNER_SELF_READABLE.join(','))
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[api/me] learner lookup failed:', error.message);
      return NextResponse.json({ error: 'Could not load your account.' }, { status: 500 });
    }

    // 200 with learner: null, not 404. An admin signed in without a learner row
    // is a normal state, and so is a learner whose Clerk account is not linked
    // yet — a caller should be able to tell "no row" from "request failed",
    // which a 404 for both would not let them do.
    return NextResponse.json({ learner: data ?? null });
  } catch (err) {
    console.error('[api/me] threw:', err);
    return NextResponse.json({ error: 'Could not load your account.' }, { status: 500 });
  }
}
