-- =============================================================================
-- INTROSPECTION — run this in the Supabase SQL Editor and paste results back.
-- =============================================================================
-- Every statement here is READ-ONLY (SELECT only). Nothing is created, altered
-- or dropped. Safe to run against production at any time.
--
-- WHY THIS EXISTS
-- docs/PROD_SCHEMA_ACTUAL.sql was captured over PostgREST, which can only see
-- the `public` schema's tables and columns. It cannot see constraints, RLS
-- policies or indexes. These five queries return exactly what is missing.
--
-- Query 1 is the one that unblocks the most work: it returns the real CHECK
-- constraint on assignments.status, which Task 4 (F-16) depends on.
-- =============================================================================


-- ── 1. ALL CONSTRAINTS (CHECK, UNIQUE, PK, FK) ───────────────────────────────
-- This answers: what status values does assignments.status actually permit?
SELECT
  rel.relname                AS table_name,
  con.conname                AS constraint_name,
  CASE con.contype
    WHEN 'c' THEN 'CHECK' WHEN 'u' THEN 'UNIQUE'
    WHEN 'p' THEN 'PRIMARY KEY' WHEN 'f' THEN 'FOREIGN KEY'
    ELSE con.contype::text END AS constraint_type,
  pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace ns ON ns.oid = rel.relnamespace
WHERE ns.nspname = 'public'
ORDER BY rel.relname, con.contype, con.conname;


-- ── 2. RLS: which tables have it ENABLED, and every policy ───────────────────
-- 2a. RLS on/off per table. Any row with rls_enabled = false is readable and
--     writable by anyone holding the anon key, which ships in the JS bundle.
SELECT
  c.relname                  AS table_name,
  c.relrowsecurity           AS rls_enabled,
  c.relforcerowsecurity      AS rls_forced,
  (SELECT count(*) FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = c.relname) AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY c.relrowsecurity, c.relname;

-- 2b. Every policy definition.
SELECT schemaname, tablename, policyname, permissive, roles, cmd,
       qual AS using_expression, with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;


-- ── 3. INDEXES ───────────────────────────────────────────────────────────────
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;


-- ── 4. COLUMNS (authoritative version of PROD_SCHEMA_ACTUAL.sql) ─────────────
SELECT table_name, ordinal_position, column_name, data_type,
       is_nullable, column_default, character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;


-- ── 5. TRIGGERS AND FUNCTIONS ────────────────────────────────────────────────
SELECT event_object_table AS table_name, trigger_name, action_timing,
       event_manipulation, action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

SELECT p.proname AS function_name, pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;
