-- =============================================================================
-- 0004_capstone_status_rename.sql
-- Rename the assignment status 'Portfolio Ready' to 'Capstone Ready'.
-- =============================================================================
-- Milestone 4. Branch: feat/learner-surface-rework.
--
-- Apply with the runner, not by hand:
--   node --experimental-strip-types scripts/migrate.ts --apply
--
-- WHY
-- M4 replaces the Portfolio surface with Capstone. 'Portfolio Ready' is the
-- status an admin sets from the review queue's "Approve + Portfolio Ready"
-- button, and it is shown to learners as a badge on their own work. Leaving the
-- stored vocabulary naming a surface that no longer exists is the precise kind
-- of drift docs/SCHEMA_DRIFT.md exists to record, so the value moves with the
-- product rather than being left behind as a puzzle for whoever reads the
-- table next.
--
-- SCOPE — read from production on 2026-09-17, not assumed
--   assignments.status            'Portfolio Ready' x12  -> RENAMED HERE
--                                 'Approved' x12, 'Needs Revision' x1 (untouched)
--   assignments.ai_quality_rating all 25 rows NULL, column has NO CHECK.
--                                 The same phrase appears as a rating in the
--                                 admin review UI, so it is renamed in CODE
--                                 only. No data to migrate, nothing to
--                                 constrain, so nothing for this file to do.
--   capability_scores.level       holds 'Advanced' x11 and 'Not Started' x30.
--                                 It does NOT contain 'Portfolio Ready' despite
--                                 the CapabilityLevel type listing it — and
--                                 'Advanced' is a value that type does not
--                                 allow. Out of scope here and logged as a new
--                                 drift finding; renaming a value that no row
--                                 holds would be a no-op dressed up as a
--                                 migration.
--   portfolio_items               0 rows. Not renamed, not dropped — see the
--                                 note at the bottom.
--
-- SAFETY
-- One table, one column, one value. The UPDATE runs while no CHECK constrains
-- the column, so it cannot be rejected halfway; the constraint is then rebuilt
-- around the new vocabulary. Both the old and the new value are permitted by
-- the guard that runs first, so re-running after a partial failure is safe.
-- =============================================================================

BEGIN;

-- ── 1. Refuse to run against a database we do not recognise ─────────────────
-- If some value has appeared since capture, stop rather than rebuild a CHECK
-- that would invalidate it. Note 'Capstone Ready' is permitted here so that a
-- re-run after a partial apply is not treated as drift.
DO $$
DECLARE
  stray text;
BEGIN
  SELECT string_agg(DISTINCT status, ', ')
    INTO stray
  FROM public.assignments
  WHERE status IS NOT NULL
    AND status NOT IN (
      'Not Started', 'In Progress', 'Submitted', 'In Review',
      'AI Reviewed', 'Human Reviewed', 'Needs Revision',
      'Resubmission Requested', 'Approved', 'Portfolio Ready',
      'Capstone Ready'
    );
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION
      'Aborting: assignments.status contains unexpected values: %. Reconcile before renaming.', stray;
  END IF;
END $$;

-- ── 2. Drop the CHECK by discovery, not by assumed name ─────────────────────
-- 0001 created it as assignments_status_check, but this schema has been edited
-- by hand before and the name is not worth trusting.
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t     ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'assignments'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%status%'
  LOOP
    EXECUTE format('ALTER TABLE public.assignments DROP CONSTRAINT %I', con.conname);
    RAISE NOTICE 'Dropped existing CHECK constraint: %', con.conname;
  END LOOP;
END $$;

-- ── 3. Rename the value ─────────────────────────────────────────────────────
DO $$
DECLARE
  moved integer;
BEGIN
  UPDATE public.assignments
     SET status = 'Capstone Ready'
   WHERE status = 'Portfolio Ready';

  GET DIAGNOSTICS moved = ROW_COUNT;
  RAISE NOTICE 'Renamed % assignment row(s) from Portfolio Ready to Capstone Ready (12 expected).', moved;
END $$;

-- ── 4. Rebuild the CHECK around the new vocabulary ──────────────────────────
-- 'Portfolio Ready' is deliberately NOT retained. Keeping it permitted would
-- leave the old value writable, and the whole point is that nothing can write
-- it again — the review queue button that used to is renamed in the same
-- commit. Step 3 has already emptied it, and step 1 guards the rest.
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_status_check
  CHECK (status IN (
    'Not Started',
    'In Progress',
    'Submitted',
    'In Review',
    'AI Reviewed',
    'Human Reviewed',
    'Needs Revision',
    'Resubmission Requested',
    'Approved',
    'Capstone Ready'
  ));

-- ── 5. Prove it landed, inside the transaction ──────────────────────────────
-- A migration that reports success while leaving a row behind is the failure
-- mode Milestone 0 was created to make impossible. This raises, which rolls the
-- whole thing back.
DO $$
DECLARE
  leftover integer;
BEGIN
  SELECT count(*) INTO leftover
  FROM public.assignments
  WHERE status = 'Portfolio Ready';

  IF leftover > 0 THEN
    RAISE EXCEPTION 'Aborting: % row(s) still hold the old status after the rename.', leftover;
  END IF;
END $$;

COMMIT;

-- =============================================================================
-- NOT DONE HERE, deliberately
--
-- public.portfolio_items is left exactly as it is: 0 rows, not renamed, not
-- dropped. The learner-facing Portfolio page is replaced by Capstone in this
-- milestone, and the table's insert path has never worked (docs/DEFERRED.md
-- D-15 — it writes a submitted_at column that does not exist, which is why the
-- table is empty). Dropping a table is not reversible by a later migration and
-- nothing needs it gone for M4 to be correct, so the decision is left to the
-- M6 data-model rebuild, which is where new tables are being designed anyway.
--
-- Verify after running:
--   SELECT status, count(*) FROM public.assignments GROUP BY status ORDER BY status;
--   SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c
--     JOIN pg_class t ON t.oid = c.conrelid
--    WHERE t.relname = 'assignments' AND c.conname = 'assignments_status_check';
-- =============================================================================
