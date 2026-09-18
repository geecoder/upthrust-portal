// lib/module-gate.ts
// ─────────────────────────────────────────────────────────────────────────────
// The ROUTE layer of module access: deciding whether the signed-in person may
// see a gated page, for use in server components and layouts.
//
// The API layer is guardModule() in ./module-access, which returns a 403 body.
// This is its counterpart for pages, and it deliberately RETURNS A DECISION
// rather than acting on it, because the two gated presentations differ:
//
//     community, notifications   redirect('/portal')     — the module is gone
//     capstone                   render a locked state   — the module is coming
//
// A helper that redirected internally could only express the first. See
// LockedPresentation in ./module-access-rules.
//
// The learner lookup is wrapped in React's cache(), so a portal layout, a
// nested route layout and the page itself all share ONE query per request
// instead of issuing three.
// ─────────────────────────────────────────────────────────────────────────────
import 'server-only';

import { cache } from 'react';
import { auth } from '@clerk/nextjs/server';
import { createAdminClient } from './supabase';
import {
  getModuleAccess,
  moduleDisabledResponse,
  type ModuleAccessMap,
  type ModuleKey,
} from './module-access';
import type { NextResponse } from 'next/server';

export interface GateLearner {
  id: string;
  cohort: string | null;
  pathway: string | null;
  first_name: string | null;
  last_name: string | null;
  tier: string | null;
  onboarding_complete: boolean | null;
}

/**
 * The signed-in learner, or null. Deduped per request.
 *
 * Returns null for an admin with no learner row, which is the normal case —
 * ADMIN_USER_ID is a Clerk id that has never been enrolled.
 */
export const getCurrentLearner = cache(async (): Promise<GateLearner | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from('learners')
      .select('id, cohort, pathway, first_name, last_name, tier, onboarding_complete')
      .eq('clerk_user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('[module-gate] learner lookup failed:', error.message);
      return null;
    }
    return (data as GateLearner | null) ?? null;
  } catch (err) {
    console.error('[module-gate] learner lookup threw:', err);
    return null;
  }
});

/** Resolved access for the signed-in person. Deduped per request. */
export const getAccessForCurrentUser = cache(async (): Promise<ModuleAccessMap> => {
  const learner = await getCurrentLearner();
  // Both scopes: the learner's own override beats their cohort's setting.
  return getModuleAccess({
    cohort: learner?.cohort ?? null,
    learnerId: learner?.id ?? null,
  });
});

export const currentUserIsAdmin = cache(async (): Promise<boolean> => {
  const { userId } = await auth();
  return !!userId && !!process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID;
});

export interface ModuleGate {
  /** True when this person may see the module's real content. */
  allowed: boolean;
  /** True when the module is off but the viewer is an admin inspecting it. */
  adminOverride: boolean;
  isAdmin: boolean;
  learner: GateLearner | null;
  access: ModuleAccessMap;
}

/**
 * Decide whether the signed-in person may see a gated page.
 *
 * Admins are allowed through a disabled module, matching the API guard: the
 * flag governs the LEARNER experience, and an admin who has just switched
 * something on needs to be able to go and look at it. When that happens
 * `adminOverride` is true so the page can say so rather than silently
 * presenting a learner view that is not what learners actually get.
 *
 * Fails closed: any failure resolving the flags leaves `allowed` false for a
 * non-admin, because getModuleAccess() returns all-disabled on error.
 */
export async function gateModule(moduleKey: ModuleKey): Promise<ModuleGate> {
  const [learner, access, isAdmin] = await Promise.all([
    getCurrentLearner(),
    getAccessForCurrentUser(),
    currentUserIsAdmin(),
  ]);

  const enabled = access[moduleKey] === true;
  return {
    allowed: enabled || isAdmin,
    adminOverride: !enabled && isAdmin,
    isAdmin,
    learner,
    access,
  };
}

/**
 * The guard for a route handler that serves a gated module to the SIGNED-IN
 * learner, when the handler has not loaded the learner row itself.
 *
 *     const denied = await guardModuleForCurrentUser('ai_lab.interview_coach');
 *     if (denied) return denied;
 *
 * Use guardModule()/guardModuleForLearner() from ./module-access instead when
 * the cohort is already in hand — those cost no extra lookup.
 *
 * Differs from guardModule() in one way, deliberately: an admin is let through,
 * so the page gate and the API behind it agree. gateModule() lets an admin open
 * a disabled page; if the fetches on that page came back 403 the admin would be
 * looking at a broken screen and learn nothing about the module they just
 * switched on.
 *
 * Returns null to proceed, or a ready-to-return 403. Callers that have already
 * resolved a gate for the same request should prefer reading `gate.allowed`.
 */
export async function guardModuleForCurrentUser(
  moduleKey: ModuleKey
): Promise<NextResponse | null> {
  const gate = await gateModule(moduleKey);
  return gate.allowed ? null : moduleDisabledResponse(moduleKey);
}
