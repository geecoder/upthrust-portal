export const dynamic = 'force-dynamic';

/**
 * Fallback onboarding completion API
 * Uses the admin (service role) Supabase client to bypass RLS.
 * Called only if the browser-client updates both fail.
 * Authenticated via Clerk — only works if the user is logged in.
 */

import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const db = createAdminClient();

  // Find the learner by Clerk user ID
  const { data: learner, error: findError } = await db
    .from('learners')
    .select('id')
    .eq('clerk_user_id', userId)
    .maybeSingle();

  if (findError) {
    return NextResponse.json({ error: findError.message }, { status: 500 });
  }

  if (!learner) {
    // Learner record not linked yet — create a minimal pending record
    // so onboarding_complete can be set when they are added properly
    return NextResponse.json({ 
      error: 'No learner record found for your account. Contact info@upthrustdigital.com.',
      clerk_user_id: userId,
    }, { status: 404 });
  }

  // Update using admin client — bypasses all RLS
  const { error: updateError } = await db
    .from('learners')
    .update({
      onboarding_complete: true,
      onboarding_completed_at: new Date().toISOString(),
      career_goal: body.career_goal || null,
      current_job_role: body.current_job_role || null,
      bio: body.bio || null,
      linkedin_url: body.linkedin_url || null,
      work_preference: body.work_preference || null,
    })
    .eq('id', learner.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, learnerId: learner.id });
}
