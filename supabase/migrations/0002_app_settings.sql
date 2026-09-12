-- =============================================================================
-- 0002_app_settings.sql
-- A single key/value settings table, seeded with the active cohort.
-- =============================================================================
-- Finding: F-12 (cohort is not a real field). Branch: fix/pre-launch-stabilisation.
--
-- RUN THIS MANUALLY in the Supabase SQL Editor. It was not executed by the
-- agent that wrote it.
--
-- WHY
-- `cohort` is free text on learners, written by three separate code paths that
-- each hardcode the literal 'Cohort 1', with a matching column default. Nothing
-- in the product can change it. Cohort 2 starts 2026-09-26 and every learner
-- enrolled after that date would land in Cohort 1's bucket.
--
-- This is the minimum viable fix, not the rebuild. It gives the app ONE place to
-- read the current cohort from and one admin-writable place to set it. It does
-- not model cohorts as entities, does not add a cohorts table, and does not
-- change how cohort is stored on learners.
--
-- SAFETY — THIS MIGRATION CANNOT MUTATE EXISTING LEARNERS
-- It only CREATEs a new table and INSERTs one row into it. There is no UPDATE
-- and no ALTER against `learners` anywhere below. All 7 existing learners stay
-- on 'Cohort 1'. The seeded value is deliberately 'Cohort 1' — the current
-- truth — so applying this migration changes no behaviour until an admin
-- explicitly changes the setting.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.app_settings (
  key         text PRIMARY KEY,
  value       text NOT NULL,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);

COMMENT ON TABLE public.app_settings IS
  'Small key/value store for operational settings that change between cohorts. Read server-side only.';

-- Seed the current cohort. ON CONFLICT DO NOTHING so re-running is safe and so
-- this can never overwrite a value an admin has already set.
INSERT INTO public.app_settings (key, value, description)
VALUES (
  'active_cohort',
  'Cohort 1',
  'Cohort stamped on learners created from now on. Changing this does not move existing learners.'
)
ON CONFLICT (key) DO NOTHING;

-- Row level security: this table is read and written only through server routes
-- using the service-role client, which bypasses RLS. Enable RLS with no policy
-- so the anon key — which ships in the browser bundle — cannot read or write it.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verify after running:
--   SELECT key, value FROM public.app_settings;
--   -- expect exactly: active_cohort | Cohort 1
--
--   SELECT cohort, count(*) FROM public.learners GROUP BY cohort;
--   -- expect exactly: Cohort 1 | 7   (unchanged)


-- =============================================================================
-- OPTIONAL, AND NOT PART OF THIS MIGRATION — run only at cohort rollover.
-- =============================================================================
-- The learners.cohort column default is still 'Cohort 1'. Both application
-- write paths now supply the cohort explicitly, so the default is only a
-- backstop for inserts that omit the column. If you want the backstop to track
-- the active cohort too, run this at rollover:
--
--   ALTER TABLE public.learners ALTER COLUMN cohort SET DEFAULT 'Cohort 2';
--
-- Changing a column default is metadata-only in Postgres. It does NOT rewrite
-- or touch any existing row.
-- =============================================================================
