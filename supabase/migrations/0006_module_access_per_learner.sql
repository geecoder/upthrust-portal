-- =============================================================================
-- 0006_module_access_per_learner.sql
-- Add a per-learner scope to module access, below the existing cohort scope.
-- =============================================================================
-- Branch: feat/learner-surface-rework.
--
-- Apply with the runner, not by hand:
--   node --experimental-strip-types scripts/migrate.ts --apply
--
-- ── WHY, AND WHY MIGRATION 0003 SAID NOT TO ─────────────────────────────────
-- 0003 deliberately stopped at two scopes and lib/module-access.ts recorded the
-- reasoning: "Why not per-learner: nothing in the brief needs it. It would turn
-- a six-row settings screen into a learners x modules permissions matrix, and —
-- the real cost — it would make the flag cache learner-keyed, so the cache would
-- hold one entry per learner instead of one entry for the whole product."
--
-- The first half no longer holds: the owner now needs to open a module for some
-- learners in a cohort and not others.
--
-- The second half turns out to have been wrong, and it is worth saying so
-- plainly rather than quietly reversing course. The cache holds RAW ROWS, not
-- resolved maps — loadRows() fetches the whole table in one query and
-- resolveFromRows() is a pure function applied per request. So the cache stays
-- exactly one entry no matter how many scopes exist; only the row count grows,
-- and it grows by at most one row per learner per module they are singled out
-- for. At 7 learners and 6 modules the ceiling is 42 rows, and a cohort of 200
-- would reach 1,200 — still one query, still resolved in memory.
--
-- ── THE SCOPE MODEL, NOW THREE DEEP ─────────────────────────────────────────
--   learner_id IS NOT NULL                  this learner only  (most specific)
--   cohort IS NOT NULL, learner_id IS NULL  that cohort
--   both NULL                               the global default (least specific)
--
-- Most specific wins; a module with no applicable row at all stays DENIED.
-- A learner row carries NO cohort: the learner's cohort is on their own record,
-- and duplicating it here would create a second copy to keep in step and a
-- question about which one counts if they disagree. A learner moved between
-- cohorts keeps their own override, which is the intended behaviour — the
-- override is about the person, not about where they sit.
--
-- ── SAFETY ──────────────────────────────────────────────────────────────────
-- Purely additive. A nullable column plus one partial unique index; every
-- existing row keeps learner_id NULL and therefore keeps resolving exactly as
-- it does today. The resolver change that reads the column ships in the same
-- commit, and it treats a NULL learner_id as "not a learner row", so applying
-- this migration before deploying is safe in either order.
-- =============================================================================

BEGIN;

-- ── 1. The column ───────────────────────────────────────────────────────────
-- ON DELETE CASCADE: an override is meaningless once the learner is gone, and
-- leaving orphans would let a future learner inherit a stranger's exception if
-- an id were ever reused.
ALTER TABLE public.module_access
  ADD COLUMN IF NOT EXISTS learner_id uuid REFERENCES public.learners(id) ON DELETE CASCADE;

COMMENT ON COLUMN public.module_access.learner_id IS
  'NULL = this row applies to a cohort or globally. Non-NULL = override for one learner, which beats both. A learner row leaves cohort NULL; the learner''s cohort lives on their own record.';

-- ── 2. Uniqueness for the new scope ─────────────────────────────────────────
-- A third partial index, for the same reason 0003 needed two: NULLs are
-- distinct for uniqueness in Postgres, so one learner must not be able to hold
-- two rows for the same module and leave the resolver picking arbitrarily.
CREATE UNIQUE INDEX IF NOT EXISTS module_access_learner_uniq
  ON public.module_access (module_key, learner_id) WHERE learner_id IS NOT NULL;

-- The two existing indexes must now also exclude learner rows, or a learner
-- override would collide with the global row for the same module. Recreated
-- rather than left alone: module_access_global_uniq as written is
-- UNIQUE (module_key) WHERE cohort IS NULL, and a learner row has cohort NULL.
DROP INDEX IF EXISTS public.module_access_global_uniq;
CREATE UNIQUE INDEX module_access_global_uniq
  ON public.module_access (module_key) WHERE cohort IS NULL AND learner_id IS NULL;

DROP INDEX IF EXISTS public.module_access_cohort_uniq;
CREATE UNIQUE INDEX module_access_cohort_uniq
  ON public.module_access (module_key, cohort) WHERE cohort IS NOT NULL AND learner_id IS NULL;

-- ── 3. Forbid the meaningless combination ───────────────────────────────────
-- A row with both a cohort and a learner_id would be ambiguous: it reads as
-- "this learner, but only while they are in that cohort", which is not a rule
-- anyone asked for and not one the resolver implements. Rejected at the
-- database rather than trusted to every future caller.
ALTER TABLE public.module_access
  DROP CONSTRAINT IF EXISTS module_access_scope_check;
ALTER TABLE public.module_access
  ADD CONSTRAINT module_access_scope_check
  CHECK (learner_id IS NULL OR cohort IS NULL);

-- ── 4. The audit log gains the same dimension ───────────────────────────────
ALTER TABLE public.module_access_audit
  ADD COLUMN IF NOT EXISTS learner_id uuid;

COMMENT ON COLUMN public.module_access_audit.learner_id IS
  'Which learner an override change applied to, or NULL for a cohort/global change. Deliberately NOT a foreign key: the audit log is history and must survive the learner being deleted.';

-- `old_enabled` was already nullable, meaning "no row existed before". The new
-- value needs the same, because clearing an override deletes its row and there
-- is then no new value to record.
ALTER TABLE public.module_access_audit
  ALTER COLUMN new_enabled DROP NOT NULL;

COMMENT ON COLUMN public.module_access_audit.new_enabled IS
  'The value after the change, or NULL when the row was CLEARED and the scope now inherits from the level above.';

-- ── 5. Prove the shape inside the transaction ───────────────────────────────
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'module_access' AND column_name = 'learner_id';
  IF n <> 1 THEN
    RAISE EXCEPTION 'Aborting: module_access.learner_id was not created.';
  END IF;

  SELECT count(*) INTO n
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename = 'module_access'
    AND indexname IN ('module_access_global_uniq', 'module_access_cohort_uniq', 'module_access_learner_uniq');
  IF n <> 3 THEN
    RAISE EXCEPTION 'Aborting: expected 3 uniqueness indexes on module_access, found %.', n;
  END IF;

  -- No existing row may violate the new scope rule.
  SELECT count(*) INTO n
  FROM public.module_access
  WHERE learner_id IS NOT NULL AND cohort IS NOT NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Aborting: % row(s) carry both a cohort and a learner_id.', n;
  END IF;
END $$;

COMMIT;

-- Verify after running:
--   SELECT module_key, cohort, learner_id, enabled FROM public.module_access
--     ORDER BY module_key, cohort NULLS FIRST, learner_id NULLS FIRST;
--   SELECT indexname FROM pg_indexes
--    WHERE tablename = 'module_access' AND indexname LIKE '%uniq';
-- =============================================================================
