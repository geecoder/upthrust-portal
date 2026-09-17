-- =============================================================================
-- 0005_sessions_rls.sql
-- Stop the anon key reading public.sessions. Fixes docs/DEFERRED.md D-2.
-- =============================================================================
-- Branch: feat/learner-surface-rework.
--
-- Apply with the runner, not by hand:
--   node --experimental-strip-types scripts/migrate.ts --apply
--
-- ── THE EXPOSURE ────────────────────────────────────────────────────────────
-- RLS is enabled on public.sessions, and one policy defeats it:
--
--     sessions_read_all   SELECT   roles={public}   USING (true)
--
-- The anon key is subject to that policy and therefore reads all 7 rows. That
-- key ships inside the client JavaScript bundle, so it is public. Measured on
-- 2026-09-17 with the anon key alone:
--
--     GET /rest/v1/sessions?select=* -> HTTP 200, 7 rows, including
--     zoom_link = https://us06web.zoom.us/j/876...?pwd=NB6PbBk6q2LDDIsRQqZ...
--
-- D-2 called this "low severity (the content is semi-public by nature)". That
-- was too generous: these are live Zoom join links with the password embedded
-- in the query string. Anyone who views source on the portal can read the anon
-- key, list every session, and join any of them uninvited. It is a live
-- meeting-access leak, not metadata.
--
-- ── WHY THIS IS SAFE TO DROP ────────────────────────────────────────────────
-- Nothing reads sessions with the anon key. Both readers use the service-role
-- client, which bypasses RLS entirely and is unaffected:
--
--     app/portal/sessions/page.tsx:34   createAdminClient(), server component
--     app/api/admin/data/route.ts:569   createAdminClient(), route handler
--
-- Verified by listing every createBrowserClient() call site in the repo: none
-- of them touches `sessions`. So this changes what an outsider can read and
-- nothing about what the product can do.
--
-- After this migration the table has RLS enabled and NO policies, which is
-- deny-all for anon and authenticated — the same shape migration 0003 chose
-- deliberately for module_access, and the same shape `learners`, `passports`
-- and `app_settings` already have.
--
-- ── NOT DONE HERE, and why ──────────────────────────────────────────────────
-- public.weeks has the sibling policy `weeks_select_published`
-- USING (is_published = true). All 13 weeks are published, so the anon key
-- reads every week row, and those rows carry `recording_url` (8 YouTube links)
-- and `session_slides_url` (Google Slides and a Notion capstone brief). No
-- `weeks.zoom_link` is populated, so no meeting credential leaks this way —
-- which is why it is a smaller problem than sessions.
--
-- It is NOT dropped because something does depend on it:
-- app/admin/content/page.tsx reads `weeks` through createBrowserClient(), so
-- tightening this policy breaks the admin content editor. Fixing it properly
-- means moving that read server-side first, which is the same work D-23
-- covers for the learner pages. Logged as a follow-up rather than half-done
-- here.
-- =============================================================================

BEGIN;

-- Drop by discovery rather than by assumed name, and only SELECT policies that
-- grant unconditionally. A policy added since capture with a real predicate is
-- left alone rather than silently removed.
DO $$
DECLARE
  pol record;
  dropped integer := 0;
BEGIN
  FOR pol IN
    SELECT p.polname
    FROM pg_policy p
    JOIN pg_class c     ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'sessions'
      AND p.polcmd = 'r'                                  -- SELECT
      AND coalesce(pg_get_expr(p.polqual, p.polrelid), 'true') = 'true'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.sessions', pol.polname);
    RAISE NOTICE 'Dropped permissive SELECT policy on sessions: %', pol.polname;
    dropped := dropped + 1;
  END LOOP;

  IF dropped = 0 THEN
    RAISE NOTICE 'No unconditional SELECT policy found on sessions — already fixed.';
  END IF;
END $$;

-- Belt and braces: RLS was already on, but assert it rather than assume it.
-- Without this the policy drop would have the opposite effect of the one
-- intended, since a table with RLS off ignores policies and grants everything.
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Prove it inside the transaction: no policy may remain that grants
-- unconditional SELECT.
DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT count(*) INTO remaining
  FROM pg_policy p
  JOIN pg_class c     ON c.oid = p.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'sessions'
    AND p.polcmd = 'r'
    AND coalesce(pg_get_expr(p.polqual, p.polrelid), 'true') = 'true';

  IF remaining > 0 THEN
    RAISE EXCEPTION 'Aborting: % unconditional SELECT policy(ies) still on sessions.', remaining;
  END IF;
END $$;

COMMIT;

-- Verify after running — the second query must return 0 rows:
--   SELECT polname, pg_get_expr(polqual, polrelid) FROM pg_policy p
--     JOIN pg_class c ON c.oid = p.polrelid WHERE c.relname = 'sessions';
--   -- and with the ANON key, not the service key:
--   --   GET /rest/v1/sessions?select=id  ->  [] (HTTP 200, zero rows)
-- =============================================================================
