// lib/cohort.ts
// ─────────────────────────────────────────────────────────────────────────────
// The single source of truth for "which cohort do new learners join?".
//
// Before this, three code paths each hardcoded the literal 'Cohort 1' —
// app/api/webhook/clerk/route.ts:126, app/admin/learners/add/page.tsx:49, and
// the learners.cohort column default — and nothing in the product could change
// any of them.
//
// This resolves the active cohort, in order:
//   1. app_settings.active_cohort   admin-settable, the intended source
//   2. ACTIVE_COHORT env var        bootstrap, and a working fallback if
//                                   migration 0002 has not been run yet
//   3. DEFAULT_COHORT constant      last-resort fallback so enrolment never
//                                   breaks on a settings lookup
//
// Deliberately NOT handled here: the ~46 'Cohort 1' display literals in
// headings, email footers and the sidebar. Those are cosmetic and belong to the
// rebuild — see docs/DEFERRED.md D-18.
// ─────────────────────────────────────────────────────────────────────────────
import type { SupabaseClient } from '@supabase/supabase-js';

/** Last-resort fallback. Matches what every learner in production is on today. */
export const DEFAULT_COHORT = 'Cohort 1';

export const ACTIVE_COHORT_SETTING_KEY = 'active_cohort';

/**
 * Resolve the cohort that newly enrolled learners should be stamped with.
 *
 * Never throws. A missing table, a missing row, or a failed query all fall
 * through to the env var and then to DEFAULT_COHORT, because failing to enrol a
 * learner is a worse outcome than stamping a stale cohort that an admin can
 * correct afterwards.
 *
 * @param db a service-role Supabase client (app_settings has RLS with no policy)
 */
export async function getActiveCohort(db: SupabaseClient): Promise<string> {
  try {
    const { data, error } = await db
      .from('app_settings')
      .select('value')
      .eq('key', ACTIVE_COHORT_SETTING_KEY)
      .maybeSingle();

    if (error) {
      // Most likely cause: migration 0002 has not been run yet.
      console.warn('[cohort] app_settings lookup failed, falling back:', error.message);
    } else if (data?.value && String(data.value).trim()) {
      return String(data.value).trim();
    }
  } catch (err) {
    console.warn('[cohort] app_settings lookup threw, falling back:', err);
  }

  const fromEnv = process.env.ACTIVE_COHORT?.trim();
  if (fromEnv) return fromEnv;

  return DEFAULT_COHORT;
}

/**
 * Validate a cohort label an admin is trying to set.
 * Intentionally permissive about naming — it only rejects empty and absurd
 * values. Note that app/api/passport-issue/route.ts:136 extracts the cohort
 * NUMBER by regex (/\d+/), so a label with no digit in it will be treated as
 * cohort 1 when building a passport id.
 */
export function validateCohortLabel(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (typeof raw !== 'string') return { ok: false, error: 'Cohort must be text.' };
  const value = raw.trim();
  if (!value) return { ok: false, error: 'Cohort cannot be empty.' };
  if (value.length > 60) return { ok: false, error: 'Cohort must be 60 characters or fewer.' };
  if (!/\d/.test(value)) {
    return {
      ok: false,
      error: 'Cohort label must contain a number — passport IDs are built from it (e.g. "Cohort 2").',
    };
  }
  return { ok: true, value };
}
