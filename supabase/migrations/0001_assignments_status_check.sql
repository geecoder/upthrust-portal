-- =============================================================================
-- 0001_assignments_status_check.sql
-- Make assignments.status permit the full set the application actually writes.
-- =============================================================================
-- Finding: F-16 (revision loop). Branch: fix/pre-launch-stabilisation.
--
-- RUN THIS MANUALLY in the Supabase SQL Editor. It was not executed by the
-- agent that wrote it.
--
-- WHY THIS IS PROBABLY A NO-OP, AND WHY IT IS STILL WORTH RUNNING
--
-- The audit (F-16) claimed three of the four review-queue buttons write status
-- values the CHECK constraint forbids. Evidence gathered on 2026-09-12 says the
-- constraint in production has ALREADY been widened at least as far as
-- 'Resubmission Requested':
--
--   * notifications contains a row titled '↩ Revision requested — Week 1'
--     (2026-06-04). That exact title is written only by
--     app/api/admin/data/route.ts:242, inside review_feedback, AFTER the status
--     UPDATE at :230 — and :234 returns 500 early if that UPDATE errors.
--     So the UPDATE to 'Resubmission Requested' succeeded.
--   * 23 of 25 assignments have ai_feedback set. That column is written by the
--     same single UPDATE statement that sets status = 'AI Reviewed'
--     (app/api/submit-assignment/route.ts:275-280), so that value was almost
--     certainly accepted too.
--
-- It could not be read directly: PostgREST cannot expose pg_constraint and this
-- project has no RPC that runs SQL. Run docs/INTROSPECT.sql query 1 to see the
-- real definition.
--
-- This migration therefore does two things regardless of the current state:
--   1. makes the permitted set EXPLICIT and recorded in the ledger, instead of
--      resting on an undocumented dashboard edit nobody wrote down;
--   2. guarantees 'Human Reviewed' is permitted — the one value in the set that
--      no production row and no notification proves has ever been accepted,
--      and the value behind the "Save Draft" button.
--
-- It is non-destructive: the permitted set is a strict SUPERSET of both the
-- original schema list and every value currently stored, so no existing row can
-- be invalidated. The one 'Needs Revision' row is explicitly preserved.
-- =============================================================================

BEGIN;

-- Fail loudly rather than silently corrupting, if a value we are about to
-- forbid somehow exists. (It cannot, given the list below is a superset of all
-- observed values — this is a guard against the schema having drifted further
-- since capture on 2026-09-12.)
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
      'Resubmission Requested', 'Approved', 'Portfolio Ready'
    );
  IF stray IS NOT NULL THEN
    RAISE EXCEPTION
      'Aborting: assignments.status contains values not in the new allowed set: %. Widen the list in this migration before re-running.', stray;
  END IF;
END $$;

-- Drop whatever CHECK currently constrains assignments.status, by discovery
-- rather than by assumed name. Postgres names an inline column CHECK
-- `assignments_status_check`, but this project's schema has been edited by hand
-- and the name cannot be assumed.
DO $$
DECLARE
  con record;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t   ON t.oid = c.conrelid
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

-- Recreate with the reconciled set.
--
--   Written by the application:
--     Not Started              column default
--     Submitted                submit-assignment:196,218 ; submissions:48,64
--     AI Reviewed              submit-assignment:278
--     Human Reviewed           admin/reviews:292  ("Save Draft")
--     Resubmission Requested   admin/reviews:288  ("Request Resubmission")
--     Approved                 admin/reviews:280  ("Approve")
--     Portfolio Ready          admin/reviews:284  ("Approve + Portfolio Ready")
--     In Review                ai-feedback:175    (route currently has no caller)
--
--   Retained for existing data and backward compatibility:
--     In Progress              original schema value, no writer
--     Needs Revision           original schema value, 1 live row set by hand
--
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
    'Portfolio Ready'
  ));

COMMIT;

-- Verify after running:
--   SELECT pg_get_constraintdef(c.oid)
--   FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
--   WHERE t.relname = 'assignments' AND c.conname = 'assignments_status_check';
