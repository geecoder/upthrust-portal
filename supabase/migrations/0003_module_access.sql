-- =============================================================================
-- 0003_module_access.sql
-- Module access control: which product modules a learner can reach.
-- =============================================================================
-- Milestone 1 of the learner-surface-rework brief.
-- Branch: feat/learner-surface-rework.
--
-- RUN THIS MANUALLY in the Supabase SQL Editor. It was not executed by the
-- agent that wrote it.
--
-- RUN ORDER — these two are still outstanding and must go FIRST:
--     1. supabase/migrations/0001_assignments_status_check.sql   (presumed unrun)
--     2. supabase/migrations/0002_app_settings.sql               (CONFIRMED unrun —
--        public.app_settings returns 404 PGRST205 in production today)
--     3. THIS FILE
--
-- WHY
-- Four separate items in the brief — remove Notifications, remove Community,
-- reduce the AI Practice Lab to Stakeholder Sim, and lock Capstone until an
-- admin opens it — are the same mechanism wearing four hats. This table is that
-- mechanism. Nothing else in the brief needs a second one.
--
-- SAFETY — THIS MIGRATION CANNOT MUTATE ANY EXISTING ROW
-- It CREATEs two new tables and INSERTs seed rows into one of them. There is no
-- UPDATE, no ALTER and no DROP against any pre-existing object anywhere below.
-- All 7 learners, 25 assignments, 13 weeks and 1 passport are untouched.
--
-- ROLLBACK
--     DROP TABLE IF EXISTS public.module_access_audit;
--     DROP TABLE IF EXISTS public.module_access;
-- Nothing else references these tables, so the drop is clean and loses only the
-- flag state and its audit history. The application fails CLOSED when the table
-- is absent, so a rollback disables every gated module rather than exposing one.
-- That is the intended direction of failure. See lib/module-access.ts.
-- =============================================================================

BEGIN;

-- ── The flag table ───────────────────────────────────────────────────────────
-- SCOPE MODEL: global default, with an optional per-cohort override.
--
--   cohort IS NULL      the global default for this module
--   cohort = 'Cohort 2' an override that applies to Cohort 2 only
--
-- Resolution is most-specific-wins: a row matching the learner's cohort beats
-- the global row; if neither exists the module is treated as DISABLED.
--
-- Deliberately NOT per-learner and NOT per-programme. Reasoning is recorded in
-- lib/module-access.ts — in short, per-learner turns a six-row settings screen
-- into a permissions matrix and makes the flag cache learner-keyed, and there
-- is exactly one programme, so a programme dimension would be a column with one
-- value in it. The one scope that earns its place is cohort, because Cohort 2
-- starts 2026-09-26 and will reach the capstone while a later cohort is still
-- in week 1.
CREATE TABLE IF NOT EXISTS public.module_access (
  id          uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  module_key  text        NOT NULL,
  cohort      text,
  enabled     boolean     NOT NULL DEFAULT false,
  note        text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text
);

COMMENT ON TABLE public.module_access IS
  'Which product modules learners can reach. cohort IS NULL is the global default; a row with a cohort overrides it for that cohort only. Read server-side only — the application resolves flags and sends booleans to the client.';
COMMENT ON COLUMN public.module_access.module_key IS
  'Stable module identifier, e.g. capstone, community, ai_lab.stakeholder_sim. Not a display label — never rename one of these in place.';
COMMENT ON COLUMN public.module_access.cohort IS
  'NULL = global default. Non-NULL = override for that cohort label, matched against learners.cohort.';
COMMENT ON COLUMN public.module_access.updated_by IS
  'Clerk user id of the admin who last wrote this row. Full change history is in module_access_audit.';

-- Uniqueness needs TWO partial indexes, not one UNIQUE(module_key, cohort).
-- In Postgres, NULLs are distinct for uniqueness purposes, so a plain
-- UNIQUE(module_key, cohort) would happily allow two global rows for the same
-- module and the resolver would then have to pick one arbitrarily.
CREATE UNIQUE INDEX IF NOT EXISTS module_access_global_uniq
  ON public.module_access (module_key) WHERE cohort IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS module_access_cohort_uniq
  ON public.module_access (module_key, cohort) WHERE cohort IS NOT NULL;

-- The resolver loads the whole table in one query (it is a handful of rows), so
-- this index serves admin filtering rather than the hot path.
CREATE INDEX IF NOT EXISTS module_access_module_key_idx
  ON public.module_access (module_key);


-- ── The audit log ────────────────────────────────────────────────────────────
-- Append-only. One row per toggle, recording actor, module, old value, new
-- value and timestamp, as required by the brief.
CREATE TABLE IF NOT EXISTS public.module_access_audit (
  id           bigserial PRIMARY KEY,
  module_key   text        NOT NULL,
  cohort       text,
  old_enabled  boolean,
  new_enabled  boolean     NOT NULL,
  actor        text        NOT NULL,
  changed_at   timestamptz NOT NULL DEFAULT now(),
  source       text
);

COMMENT ON TABLE public.module_access_audit IS
  'Append-only history of module access changes. old_enabled is NULL when the row did not previously exist. Never exposed to the client — it carries admin actor ids.';

CREATE INDEX IF NOT EXISTS module_access_audit_changed_at_idx
  ON public.module_access_audit (changed_at DESC);

CREATE INDEX IF NOT EXISTS module_access_audit_module_key_idx
  ON public.module_access_audit (module_key, changed_at DESC);


-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Both tables: RLS ENABLED, and deliberately NO POLICIES AT ALL.
--
-- A table with RLS enabled and no policy denies every request that is subject
-- to RLS. The service-role key bypasses RLS, so the server can still read and
-- write. The anon key — which ships in the browser bundle — gets nothing.
--
-- This is TIGHTER than the brief's "learners may read enabled-state only", and
-- deliberately so. No client ever needs to query these tables: every read
-- happens in a server component or route handler, which resolves the flags and
-- sends the client only the resolved booleans it needs to render. Granting the
-- browser a SELECT would also expose module_access.updated_by, which is an
-- admin's Clerk user id, for no gain.
--
-- If a future client-side need appears, add a SELECT policy over a VIEW that
-- projects only (module_key, cohort, enabled) — do not open the base table.
ALTER TABLE public.module_access       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_access_audit ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.module_access       FROM anon, authenticated;
REVOKE ALL ON public.module_access_audit FROM anon, authenticated;


-- ── Seed ─────────────────────────────────────────────────────────────────────
-- FILL-ONLY AND IDEMPOTENT. Each row is inserted only if that (module, global)
-- pair is absent. Re-running this file inserts nothing and changes nothing —
-- in particular it will NOT revert a module an admin has since toggled.
--
-- This is the specific mistake that F-10 found in supabase-weeks-seed.sql,
-- which uses ON CONFLICT ... DO UPDATE and silently overwrites live state on
-- every run. Written as INSERT ... WHERE NOT EXISTS rather than
-- ON CONFLICT DO NOTHING because the uniqueness here lives in a PARTIAL index,
-- and conflict inference against a partial index is easy to get subtly wrong.
--
-- Default state per the brief: stakeholder_sim ON, everything else OFF.
INSERT INTO public.module_access (module_key, cohort, enabled, note, updated_by)
SELECT v.module_key, NULL, v.enabled, v.note, 'seed:0003'
FROM (VALUES
  ('capstone',                false, 'Capstone surface. Locked until an admin opens it for the cohort. Learners see a warm locked state, not a 403.'),
  ('notifications',           false, 'Learner-facing notifications. Removed from the learner experience by owner decision; kept as a flag so it is reversible.'),
  ('community',               false, 'Community feed and replies. Removed from the learner experience; admin-toggleable.'),
  ('ai_lab.stakeholder_sim',  true,  'AI Practice Lab — Stakeholder Sim. The one AI tool learners keep.'),
  ('ai_lab.writing_checker',  false, 'AI Practice Lab — Writing Checker. Hidden from learners; admin-toggleable.'),
  ('ai_lab.interview_coach',  false, 'AI Practice Lab — Interview Coach. Hidden from learners; admin-toggleable.')
) AS v(module_key, enabled, note)
WHERE NOT EXISTS (
  SELECT 1 FROM public.module_access m
  WHERE m.module_key = v.module_key AND m.cohort IS NULL
);

COMMIT;


-- =============================================================================
-- VERIFY — run this after the migration. Expect 6 rows, one enabled.
-- =============================================================================
-- SELECT module_key, cohort, enabled, note FROM public.module_access
-- ORDER BY module_key;
--
-- Expected:
--   ai_lab.interview_coach   NULL  false
--   ai_lab.stakeholder_sim   NULL  true     <-- the only enabled module
--   ai_lab.writing_checker   NULL  false
--   capstone                 NULL  false
--   community                NULL  false
--   notifications            NULL  false
--
-- IDEMPOTENCY CHECK — run the whole file a second time, then re-run the SELECT.
-- It must still return exactly 6 rows with the same enabled values. If you
-- toggle something in the admin console first and then re-run this file, your
-- toggle must survive. That is the point.
-- =============================================================================
