export const dynamic = 'force-dynamic';

/**
 * Clerk webhook — auto account linking
 * 
 * When a learner signs up via Clerk, this webhook fires and:
 * 1. Looks up their email in the learners table
 * 2. If found, links their Clerk user ID to their record
 * 3. If not found, creates a pending record so they see "Access Pending"
 *
 * Setup in Clerk Dashboard:
 * - Webhooks → Add Endpoint
 * - URL: https://upthrust-portal-qj18.vercel.app/api/webhook/clerk
 * - Events: user.created, user.updated
 * - Copy Signing Secret → add as CLERK_WEBHOOK_SECRET in Vercel env vars
 */

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

// Verify the webhook came from Clerk using svix signature
async function verifyClerkWebhook(req: Request): Promise<{ event: string; data: any } | null> {
  const svixId = req.headers.get('svix-id');
  const svixTimestamp = req.headers.get('svix-timestamp');
  const svixSignature = req.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.log('[Clerk Webhook] Missing svix headers — rejecting');
    return null;
  }

  const body = await req.text();

  // If no webhook secret set, skip signature verification (dev mode)
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.log('[Clerk Webhook] No CLERK_WEBHOOK_SECRET — skipping signature check');
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }

  // Verify with svix
  try {
    const { Webhook } = await import('svix');
    const wh = new Webhook(secret);
    const payload = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as { type: string; data: any };
    return { event: payload.type, data: payload.data };
  } catch (err) {
    console.error('[Clerk Webhook] Signature verification failed:', err);
    return null;
  }
}

export async function POST(req: Request) {
  console.log('[Clerk Webhook] Received request');

  const payload = await verifyClerkWebhook(req.clone());

  if (!payload) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[Clerk Webhook] Signature verified — event: ${payload.event}`);

  const { event, data } = payload;
  const db = createAdminClient();

  // ── user.created — new signup ────────────────────────────────
  if (event === 'user.created') {
    const clerkUserId = data.id;
    const email = data.email_addresses?.[0]?.email_address;
    const firstName = data.first_name || '';
    const lastName = data.last_name || '';

    if (!email) {
      console.log('[Clerk Webhook] user.created — no email address on account, skipping');
      return NextResponse.json({ message: 'No email — skipping' });
    }

    console.log(`[Clerk Webhook] user.created — clerkUserId: ${clerkUserId}, email: ${email}`);

    // Check if this email already exists in learners (manually added by Genesis)
    const { data: existing } = await db
      .from('learners')
      .select('id, clerk_user_id, first_name, email')
      .ilike('email', email)
      .maybeSingle();

    console.log(`[Clerk Webhook] Learner lookup result: ${existing ? `found id=${existing.id}, already_linked=${!!existing.clerk_user_id}` : 'no match — will create pending record'}`);

    if (existing) {
      if (existing.clerk_user_id && existing.clerk_user_id !== clerkUserId) {
        // Already linked to a different Clerk account — log and skip
        console.log(`[Clerk Webhook] Email ${email} already linked to different Clerk ID`);
        return NextResponse.json({ message: 'Already linked' });
      }

      if (!existing.clerk_user_id) {
        // Link this Clerk ID to the existing learner record
        const { error: updateError } = await db
          .from('learners')
          .update({
            clerk_user_id: clerkUserId,
            first_name: firstName || existing.first_name,
            last_name: lastName || undefined,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`[Clerk Webhook] Update failed for learner ${existing.id}:`, updateError.message);
          return NextResponse.json({ error: 'Update failed' }, { status: 500 });
        }
        console.log(`[Clerk Webhook] Linked ${email} → ${clerkUserId} (learner: ${existing.id})`);
        return NextResponse.json({ message: 'Linked successfully', learnerId: existing.id });
      }

      return NextResponse.json({ message: 'Already linked to this Clerk ID' });
    }

    // No existing record — learner signed up before Genesis added them
    // Create a pending record so they see "Access Pending" screen
    await db.from('learners').insert({
      clerk_user_id: clerkUserId,
      email,
      first_name: firstName || email.split('@')[0],
      last_name: lastName || undefined,
      pathway: 'PM', // default — Genesis updates this
      tier: 'Standard',
      cohort: 'Cohort 1',
      enrollment_status: 'Pending',
      attendance_pct: 0,
      assignment_completion_pct: 0,
      avg_score: 0,
      risk_status: 'Green',
      passport_eligibility: 'Not Eligible',
      passport_issued: false,
      portfolio_status: 'Not Started',
      capstone_status: 'Not Started',
      onboarding_complete: false,
    });

    console.log(`[Clerk Webhook] Created pending record for ${email}`);
    return NextResponse.json({ message: 'Pending record created', email });
  }

  // ── user.updated — profile change or email change ────────────
  if (event === 'user.updated') {
    const clerkUserId = data.id;
    const email = data.email_addresses?.[0]?.email_address;

    if (email) {
      // Keep email in sync
      await db
        .from('learners')
        .update({ email, updated_at: new Date().toISOString() })
        .eq('clerk_user_id', clerkUserId);

      console.log(`[Clerk Webhook] Updated email for ${clerkUserId}`);
    }

    return NextResponse.json({ message: 'Updated' });
  }

  return NextResponse.json({ message: `Event ${event} not handled` });
}
