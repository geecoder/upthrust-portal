-- =============================================================================
-- PRODUCTION SCHEMA AS ACTUALLY OBSERVED  —  Upthrust Portal
-- Project: qzpuvectpqxmtbitmtlm.supabase.co   Captured: 2026-09-12
-- =============================================================================
-- PROVENANCE AND LIMITS — READ THIS BEFORE TRUSTING ANYTHING BELOW.
--
-- Captured READ-ONLY over PostgREST (HTTP GET/HEAD only) using the service-role
-- key. No SQL was executed against the database. No writes of any kind.
--
-- PostgREST exposes only the `public` schema. It CANNOT expose information_schema,
-- pg_constraint, pg_policies or pg_indexes, and this project has no RPC function
-- that would allow arbitrary SQL. Therefore:
--
--   OBTAINED : table list, column names, data types, nullability, column defaults,
--              primary keys, foreign-key targets, row counts, and the set of values
--              actually present in every CHECK-constrained column.
--
--   NOT OBTAINED : CHECK constraint definitions, UNIQUE constraint definitions,
--              constraint names, RLS policy definitions, which tables have RLS
--              enabled or disabled, indexes, triggers, functions.
--
-- The CHECK constraints written below are NOT read from the database. They are
-- inferred from the values observed in each column and are marked "OBSERVED VALUES".
-- An observed value proves the constraint permits it. It does NOT prove the
-- constraint forbids anything else. Run docs/INTROSPECT.sql to close this gap.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- learners  —  38 columns, 7 rows in production
-- anon-key SELECT probe: HTTP 200, 0 rows visible of 7
-- -----------------------------------------------------------------------------
CREATE TABLE public.learners (
  id                         uuid DEFAULT extensions.uuid_generate_v4() NOT NULL /* PK */,
  clerk_user_id              text,
  email                      text NOT NULL,
  first_name                 text NOT NULL,
  last_name                  text,
  country                    text,
  phone                      text,
  pathway                    text DEFAULT 'Undecided',
  tier                       text DEFAULT 'Standard',
  cohort                     text DEFAULT 'Cohort 1',
  enrollment_status          text DEFAULT 'Active',
  attendance_pct             numeric DEFAULT 0,
  assignment_completion_pct  numeric DEFAULT 0,
  avg_score                  numeric DEFAULT 0,
  risk_status                text DEFAULT 'Green',
  passport_eligibility       text DEFAULT 'Not Eligible',
  passport_issued            boolean DEFAULT false,
  passport_issued_at         timestamp with time zone,
  portfolio_status           text DEFAULT 'Not Started',
  capstone_status            text DEFAULT 'Not Started',
  notes                      text,
  linkedin_url               text,
  avatar_url                 text,
  created_at                 timestamp with time zone DEFAULT now(),
  updated_at                 timestamp with time zone DEFAULT now(),
  onboarding_complete        boolean DEFAULT false,
  onboarding_completed_at    timestamp with time zone,
  passport_id                text,
  career_goal                text,
  current_job_role           text,
  employer_visible           boolean DEFAULT false,
  preferred_roles            text,
  work_preference            text,
  availability               text,
  cv_url                     text,
  bio                        text,
  portfolio_url              text,
  facilitator_note           text
);
-- OBSERVED VALUES learners.pathway: 'BA' x5, 'PM' x2
-- OBSERVED VALUES learners.tier: 'Standard' x1, 'Premium' x6
-- OBSERVED VALUES learners.enrollment_status: 'Active' x7
-- OBSERVED VALUES learners.risk_status: 'Green' x7
-- OBSERVED VALUES learners.passport_eligibility: 'Not Eligible' x6, 'Approved' x1
-- OBSERVED VALUES learners.portfolio_status: 'Not Started' x7
-- OBSERVED VALUES learners.capstone_status: 'Not Started' x7
-- OBSERVED VALUES learners.work_preference: '<NULL>' x7
-- OBSERVED VALUES learners.availability: '<NULL>' x7
-- OBSERVED VALUES learners.cohort: 'Cohort 1' x7

-- -----------------------------------------------------------------------------
-- weeks  —  34 columns, 13 rows in production
-- anon-key SELECT probe: HTTP 206, 13 rows visible of 13
-- -----------------------------------------------------------------------------
CREATE TABLE public.weeks (
  id                         uuid DEFAULT extensions.uuid_generate_v4() NOT NULL /* PK */,
  week_number                integer NOT NULL,
  title                      text NOT NULL,
  phase                      text,
  start_date                 date,
  end_date                   date,
  session_date               date,
  is_published               boolean DEFAULT false,
  learning_goals             text,
  concept_topics             text,
  case_study                 text,
  lab_exercise               text,
  session_notes              text,
  recording_url              text,
  pm_assignment_title        text,
  pm_assignment_brief        text,
  pm_deliverable             text,
  pm_rubric                  text,
  pm_due_date                date,
  ba_assignment_title        text,
  ba_assignment_brief        text,
  ba_deliverable             text,
  ba_rubric                  text,
  ba_due_date                date,
  reflection_prompt          text,
  resources                  text,
  created_at                 timestamp with time zone DEFAULT now(),
  updated_at                 timestamp with time zone DEFAULT now(),
  why_it_matters             text,
  pre_work                   text,
  outcomes                   text,
  zoom_link                  text,
  session_slides_url         text,
  ai_practice_type           text
);
-- OBSERVED VALUES weeks.phase: 'Foundation' x3, 'Delivery' x2, 'Capstone' x4, 'Core Skills' x4

-- -----------------------------------------------------------------------------
-- assignments  —  24 columns, 25 rows in production
-- anon-key SELECT probe: HTTP 200, 0 rows visible of 25
-- -----------------------------------------------------------------------------
CREATE TABLE public.assignments (
  id                         uuid DEFAULT extensions.uuid_generate_v4() NOT NULL /* PK */,
  learner_id                 uuid /* FK -> learners(id) */,
  week_number                integer NOT NULL,
  pathway                    text NOT NULL,
  submission_url             text,
  submission_notes           text,
  submitted_at               timestamp with time zone,
  status                     text DEFAULT 'Not Started',
  score                      numeric,
  feedback                   text,
  feedback_by                text,
  feedback_at                timestamp with time zone,
  is_portfolio_ready         boolean DEFAULT false,
  created_at                 timestamp with time zone DEFAULT now(),
  updated_at                 timestamp with time zone DEFAULT now(),
  ai_feedback                text,
  ai_feedback_at             timestamp with time zone,
  ai_score                   numeric,
  ai_quality_rating          text,
  resubmission_count         integer DEFAULT 0,
  is_late                    boolean DEFAULT false,
  extension_granted          boolean DEFAULT false,
  portfolio_approved         boolean DEFAULT false,
  portfolio_approved_at      timestamp with time zone
);
-- OBSERVED VALUES assignments.status: 'Approved' x12, 'Needs Revision' x1, 'Portfolio Ready' x12
-- OBSERVED VALUES assignments.pathway: 'BA' x24, 'PM' x1
-- OBSERVED VALUES assignments.ai_quality_rating: '<NULL>' x25

-- -----------------------------------------------------------------------------
-- attendance  —  8 columns, 62 rows in production
-- anon-key SELECT probe: HTTP 200, 0 rows visible of 62
-- -----------------------------------------------------------------------------
CREATE TABLE public.attendance (
  id                         uuid DEFAULT extensions.uuid_generate_v4() NOT NULL /* PK */,
  learner_id                 uuid /* FK -> learners(id) */,
  week_number                integer NOT NULL,
  attended                   boolean DEFAULT false,
  notes                      text,
  recorded_at                timestamp with time zone DEFAULT now(),
  arrival                    text,
  session_date               text
);
-- OBSERVED VALUES attendance.arrival: 'On Time' x61, 'Late' x1

-- -----------------------------------------------------------------------------
-- capability_scores  —  9 columns, 41 rows in production
-- anon-key SELECT probe: HTTP 200, 0 rows visible of 41
-- -----------------------------------------------------------------------------
CREATE TABLE public.capability_scores (
  id                         uuid DEFAULT extensions.uuid_generate_v4() NOT NULL /* PK */,
  learner_id                 uuid /* FK -> learners(id) */,
  capability                 text NOT NULL,
  level                      text DEFAULT 'Not Started',
  score                      numeric DEFAULT 0,
  evidence                   text,
  last_assessed_at           timestamp with time zone,
  created_at                 timestamp with time zone DEFAULT now(),
  updated_at                 timestamp with time zone DEFAULT now()
);
-- OBSERVED VALUES capability_scores.level: 'Advanced' x11, 'Not Started' x30

-- -----------------------------------------------------------------------------
-- notifications  —  8 columns, 50 rows in production
-- anon-key SELECT probe: HTTP 200, 0 rows visible of 50
-- -----------------------------------------------------------------------------
CREATE TABLE public.notifications (
  id                         uuid DEFAULT extensions.uuid_generate_v4() NOT NULL /* PK */,
  learner_id                 uuid /* FK -> learners(id) */,
  type                       text NOT NULL,
  title                      text NOT NULL,
  message                    text NOT NULL,
  is_read                    boolean DEFAULT false,
  related_assignment_id      uuid,
  created_at                 timestamp with time zone DEFAULT now()
);
-- OBSERVED VALUES notifications.type: 'feedback_ready' x44, 'resubmission_required' x2, 'inactivity_nudge' x4

-- -----------------------------------------------------------------------------
-- ai_practice_attempts  —  13 columns, 0 rows in production
-- anon-key SELECT probe: HTTP 200, 0 rows visible of 0
-- -----------------------------------------------------------------------------
CREATE TABLE public.ai_practice_attempts (
  id                         uuid DEFAULT extensions.uuid_generate_v4() NOT NULL /* PK */,
  learner_id                 uuid /* FK -> learners(id) */,
  practice_type              text NOT NULL,
  character_id               text,
  question_id                text,
  document_type              text,
  transcript                 text,
  score                      numeric,
  feedback                   text,
  capability_areas           text,
  duration_seconds           integer,
  completed                  boolean DEFAULT false,
  created_at                 timestamp with time zone DEFAULT now()
);
-- OBSERVED VALUES ai_practice_attempts.practice_type: (no rows)

-- -----------------------------------------------------------------------------
-- community_posts  —  14 columns, 1 rows in production
-- anon-key SELECT probe: HTTP 200, 1 rows visible of 1
-- -----------------------------------------------------------------------------
CREATE TABLE public.community_posts (
  id                         uuid DEFAULT extensions.uuid_generate_v4() NOT NULL /* PK */,
  learner_id                 uuid /* FK -> learners(id) */,
  author_name                text NOT NULL,
  author_avatar              text,
  category                   text DEFAULT 'General',
  content                    text NOT NULL,
  pathway_tag                text,
  week_tag                   integer,
  is_pinned                  boolean DEFAULT false,
  is_from_genesis            boolean DEFAULT false,
  likes_count                integer DEFAULT 0,
  replies_count              integer DEFAULT 0,
  created_at                 timestamp with time zone DEFAULT now(),
  updated_at                 timestamp with time zone DEFAULT now()
);
-- OBSERVED VALUES community_posts.category: 'General' x1
-- OBSERVED VALUES community_posts.pathway_tag: '<NULL>' x1

-- -----------------------------------------------------------------------------
-- community_replies  —  8 columns, 0 rows in production
-- anon-key SELECT probe: HTTP 200, 0 rows visible of 0
-- -----------------------------------------------------------------------------
CREATE TABLE public.community_replies (
  id                         uuid DEFAULT extensions.uuid_generate_v4() NOT NULL /* PK */,
  post_id                    uuid /* FK -> community_posts(id) */,
  learner_id                 uuid /* FK -> learners(id) */,
  author_name                text NOT NULL,
  author_avatar              text,
  content                    text NOT NULL,
  is_from_genesis            boolean DEFAULT false,
  created_at                 timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- announcements  —  7 columns, 0 rows in production
-- anon-key SELECT probe: HTTP 200, 0 rows visible of 0
-- -----------------------------------------------------------------------------
CREATE TABLE public.announcements (
  id                         uuid DEFAULT extensions.uuid_generate_v4() NOT NULL /* PK */,
  title                      text NOT NULL,
  content                    text NOT NULL,
  priority                   text DEFAULT 'Normal',
  target_pathway             text DEFAULT 'All',
  is_published               boolean DEFAULT true,
  created_at                 timestamp with time zone DEFAULT now()
);
-- OBSERVED VALUES announcements.priority: (no rows)
-- OBSERVED VALUES announcements.target_pathway: (no rows)

-- -----------------------------------------------------------------------------
-- portfolio_items  —  11 columns, 0 rows in production
-- anon-key SELECT probe: HTTP 200, 0 rows visible of 0
-- -----------------------------------------------------------------------------
CREATE TABLE public.portfolio_items (
  id                         uuid DEFAULT extensions.uuid_generate_v4() NOT NULL /* PK */,
  learner_id                 uuid /* FK -> learners(id) */,
  week_number                integer,
  title                      text NOT NULL,
  description                text,
  artefact_type              text,
  url                        text,
  status                     text DEFAULT 'Draft',
  feedback                   text,
  created_at                 timestamp with time zone DEFAULT now(),
  updated_at                 timestamp with time zone DEFAULT now()
);
-- OBSERVED VALUES portfolio_items.status: (no rows)

-- -----------------------------------------------------------------------------
-- resources  —  21 columns, 84 rows in production
-- anon-key SELECT probe: HTTP 206, 64 rows visible of 84
-- -----------------------------------------------------------------------------
CREATE TABLE public.resources (
  id                         uuid DEFAULT extensions.uuid_generate_v4() NOT NULL /* PK */,
  title                      text NOT NULL,
  description                text,
  resource_type              text NOT NULL,
  pathway                    text DEFAULT 'Both',
  week_number                integer,
  assignment_context         text,
  external_url               text,
  example_url                text,
  is_featured                boolean DEFAULT false,
  is_active                  boolean DEFAULT true,
  tags                       text,
  created_at                 timestamp with time zone DEFAULT now(),
  notion_url                 text,
  youtube_url                text,
  file_url                   text,
  link_type                  text DEFAULT 'url',
  content_level              text DEFAULT 'All Levels',
  content_type               text DEFAULT 'Resource',
  duration_mins              integer,
  thumbnail_url              text
);
-- OBSERVED VALUES resources.resource_type: 'Template' x32, 'Reading' x5, 'Tool' x4, 'Case Study' x9, 'Framework' x6, 'Guide' x3, 'AI Prompt' x1, 'Session Material' x12, 'Slides' x2, 'Recording' x8, 'Video' x2
-- OBSERVED VALUES resources.pathway: 'BA' x33, 'PM' x8, 'Both' x43
-- OBSERVED VALUES resources.content_level: 'All Levels' x55, 'Foundation' x3, 'Intermediate' x13, 'Delivery' x5, 'Capstone' x1, 'Core Skills' x7
-- OBSERVED VALUES resources.link_type: 'url' x16, 'notion' x55, 'youtube' x13

-- -----------------------------------------------------------------------------
-- sessions  —  9 columns, 7 rows in production
-- anon-key SELECT probe: HTTP 206, 7 rows visible of 7
-- -----------------------------------------------------------------------------
CREATE TABLE public.sessions (
  id                         uuid DEFAULT gen_random_uuid() NOT NULL /* PK */,
  title                      text NOT NULL,
  week_number                integer,
  session_date               date,
  start_time                 text,
  zoom_link                  text,
  description                text,
  recording_url              text,
  created_at                 timestamp with time zone DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- passports  —  20 columns, 1 rows in production
-- anon-key SELECT probe: HTTP 200, 0 rows visible of 1
-- -----------------------------------------------------------------------------
CREATE TABLE public.passports (
  id                         uuid DEFAULT gen_random_uuid() NOT NULL /* PK */,
  passport_id                text NOT NULL,
  learner_id                 uuid NOT NULL,
  full_name                  text,
  country                    text,
  pathway                    text NOT NULL,
  track                      text NOT NULL,
  cohort                     text NOT NULL,
  overall_score              numeric NOT NULL,
  rating                     text,
  readiness_level            text,
  capability_breakdown       jsonb,
  evidence                   jsonb,
  portfolio_url              text,
  facilitator_note           text,
  issued_at                  date DEFAULT CURRENT_DATE NOT NULL,
  signature                  text NOT NULL,
  status                     text DEFAULT 'issued' NOT NULL,
  revoked_at                 timestamp with time zone,
  created_at                 timestamp with time zone DEFAULT now() NOT NULL
);
-- OBSERVED VALUES passports.status: 'issued' x1
-- OBSERVED VALUES passports.pathway: 'BA' x1
-- OBSERVED VALUES passports.track: 'PM' x1
-- OBSERVED VALUES passports.cohort: 'Cohort 1' x1


-- =============================================================================
-- RECAPTURE — 2026-09-17 · branch feat/learner-surface-rework
-- =============================================================================
-- Method identical to the 2026-09-12 capture: read-only over PostgREST, HTTP
-- GET/HEAD only, service-role and anon keys. No SQL executed. No writes.
--
-- The schema above was re-verified column-for-column and is UNCHANGED, with one
-- addition and one correction recorded below. Full narrative and the answers to
-- the three Milestone 0 confirmations are in docs/SCHEMA_DRIFT.md, "ADDENDUM —
-- Milestone 0 recapture, 2026-09-17".
-- =============================================================================

-- ── NEW: app_settings is ABSENT from production ──────────────────────────────
-- GET /rest/v1/app_settings -> HTTP 404 PGRST205
--   "Could not find the table 'public.app_settings' in the schema cache"
--
-- supabase/migrations/0002_app_settings.sql declares this table and says
-- "RUN THIS MANUALLY in the Supabase SQL Editor". It was never run.
-- Migration 0001 is presumed unrun for the same reason (it alters only a CHECK
-- constraint, which is not readable over PostgREST, so it cannot be confirmed).
--
-- Both migrations remain PENDING and must be applied before any migration added
-- on this branch.

-- ── CORRECTION: capability_scores has no `pathway` column ────────────────────
-- Probing capability_scores.pathway returns 42703 "column does not exist".
-- The table list above is correct; this note exists only because audit finding
-- F-1 is phrased as "pathway CHECK constraints on every table", which implies a
-- pathway column exists more widely than it does. It exists on exactly three
-- tables: learners, assignments, passports.

-- ── ROW COUNTS — 2026-09-17 (service role) ───────────────────────────────────
-- learners               7      community_posts        1
-- assignments           25      community_replies      0
-- attendance            62      resources             84   (anon sees 64)
-- capability_scores     41      weeks                 13   (anon sees 13)
-- notifications         50      portfolio_items        0
-- passports              1      announcements          0
-- sessions               7      ai_practice_attempts   0   (anon sees 7 on sessions)
-- app_settings       ABSENT
--
-- Identical to 2026-09-12 on every table. Production has not been written to in
-- five days.

-- ── OBSERVED VALUES refreshed ────────────────────────────────────────────────
-- learners.pathway      : 'BA' x5, 'PM' x2
-- assignments.pathway   : 'BA' x24, 'PM' x1
-- passports.pathway     : 'BA' x1        (passports.track = 'PM' on that row)
-- assignments.status    : 'Approved' x12, 'Portfolio Ready' x12,
--                         'Needs Revision' x1
-- assignments.week_number in use: 0,1,2,3,5,6,7,8   (week 4 has no rows)
-- weeks.is_published    : true x13
-- weeks.lab_exercise    : populated on 0 of 13 rows   (confirms F-5)
--
-- assignments uniqueness, empirical: 25 rows, 25 distinct
-- (learner_id, week_number, pathway) triples, 0 duplicates. CONSISTENT WITH
-- UNIQUE(learner_id, week_number, pathway) but NOT PROOF of it — see
-- docs/SCHEMA_DRIFT.md A3(a).

-- ── STILL NOT OBTAINED ───────────────────────────────────────────────────────
-- CHECK constraint definitions, UNIQUE constraint definitions, constraint names,
-- RLS policy definitions, RLS enabled/disabled per table, indexes, triggers,
-- functions.
--
-- No route to these exists from this environment: PostgREST cannot expose
-- pg_catalog, the project has no SQL-executing RPC, there is no Postgres
-- connection string in the environment, and psql is not installed.
-- Run docs/INTROSPECT.sql in the Supabase SQL Editor to close the gap.
-- =============================================================================

-- =============================================================================
-- APPENDIX A — CONSTRAINTS, RLS, INDEXES, TRIGGERS  (captured 2026-09-17)
-- =============================================================================
-- THIS CLOSES THE GAP the original capture could not reach.
--
-- Obtained via the Supabase Management API (POST /v1/projects/<ref>/database/query)
-- using a personal access token supplied by the owner. These are READ-ONLY
-- SELECTs against pg_catalog — exactly the queries in docs/INTROSPECT.sql.
--
-- Everything below is READ FROM THE DATABASE. Nothing here is inferred.
-- =============================================================================

-- ── CONSTRAINTS ─────────────────────────────────────────────────────────────

-- ai_practice_attempts
--   [FK    ] ai_practice_attempts_learner_id_fkey
--            FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
--   [PK    ] ai_practice_attempts_pkey
--            PRIMARY KEY (id)

-- announcements
--   [CHECK ] announcements_priority_check
--            CHECK ((priority = ANY (ARRAY['Normal'::text, 'Important'::text, 'Urgent'::text])))
--   [CHECK ] announcements_target_pathway_check
--            CHECK ((target_pathway = ANY (ARRAY['PM'::text, 'BA'::text, 'Both'::text, 'All'::text])))
--   [PK    ] announcements_pkey
--            PRIMARY KEY (id)

-- app_settings
--   [PK    ] app_settings_pkey
--            PRIMARY KEY (key)

-- assignments
--   [CHECK ] assignments_pathway_check
--            CHECK ((pathway = ANY (ARRAY['PM'::text, 'BA'::text])))
--   [CHECK ] assignments_status_check
--            CHECK ((status = ANY (ARRAY['Not Started'::text, 'In Progress'::text, 'Submitted'::text, 'In Review'::text, 'AI Reviewed'::text, 'Human Reviewed'::text, 'Needs Revision'::text, 'Resubmission Requested'::text, 'Approved'::text, 'Portfolio Ready'::text])))
--   [FK    ] assignments_learner_id_fkey
--            FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
--   [PK    ] assignments_pkey
--            PRIMARY KEY (id)
--   [UNIQUE] assignments_learner_id_week_number_pathway_key
--            UNIQUE (learner_id, week_number, pathway)

-- attendance
--   [FK    ] attendance_learner_id_fkey
--            FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
--   [PK    ] attendance_pkey
--            PRIMARY KEY (id)
--   [UNIQUE] attendance_learner_id_week_number_key
--            UNIQUE (learner_id, week_number)

-- capability_scores
--   [FK    ] capability_scores_learner_id_fkey
--            FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
--   [PK    ] capability_scores_pkey
--            PRIMARY KEY (id)
--   [UNIQUE] capability_scores_learner_id_capability_key
--            UNIQUE (learner_id, capability)

-- community_posts
--   [CHECK ] community_posts_category_check
--            CHECK ((category = ANY (ARRAY['Question'::text, 'Win'::text, 'Portfolio Review'::text, 'General'::text])))
--   [CHECK ] community_posts_pathway_tag_check
--            CHECK ((pathway_tag = ANY (ARRAY['PM'::text, 'BA'::text, 'Both'::text])))
--   [FK    ] community_posts_learner_id_fkey
--            FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
--   [PK    ] community_posts_pkey
--            PRIMARY KEY (id)

-- community_replies
--   [FK    ] community_replies_learner_id_fkey
--            FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
--   [FK    ] community_replies_post_id_fkey
--            FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE
--   [PK    ] community_replies_pkey
--            PRIMARY KEY (id)

-- learners
--   [CHECK ] learners_portfolio_status_check
--            CHECK ((portfolio_status = ANY (ARRAY['Not Started'::text, 'Drafting'::text, 'Submitted'::text, 'Reviewed'::text, 'Ready'::text])))
--   [CHECK ] learners_risk_status_check
--            CHECK ((risk_status = ANY (ARRAY['Green'::text, 'Amber'::text, 'Red'::text])))
--   [CHECK ] learners_tier_check
--            CHECK ((tier = ANY (ARRAY['Standard'::text, 'Premium'::text, 'VIP'::text, 'Corporate'::text])))
--   [CHECK ] learners_passport_eligibility_check
--            CHECK ((passport_eligibility = ANY (ARRAY['Not Eligible'::text, 'Pending Review'::text, 'Approved'::text, 'Withheld'::text, 'Needs Revision'::text])))
--   [CHECK ] learners_enrollment_status_check
--            CHECK ((enrollment_status = ANY (ARRAY['Pending'::text, 'Active'::text, 'Completed'::text, 'Withdrawn'::text])))
--   [CHECK ] learners_capstone_status_check
--            CHECK ((capstone_status = ANY (ARRAY['Not Started'::text, 'In Progress'::text, 'Submitted'::text, 'Presented'::text, 'Approved'::text])))
--   [CHECK ] learners_pathway_check
--            CHECK ((pathway = ANY (ARRAY['PM'::text, 'BA'::text, 'Design'::text, 'Undecided'::text])))
--   [PK    ] learners_pkey
--            PRIMARY KEY (id)
--   [UNIQUE] learners_clerk_user_id_key
--            UNIQUE (clerk_user_id)

-- module_access
--   [PK    ] module_access_pkey
--            PRIMARY KEY (id)

-- module_access_audit
--   [PK    ] module_access_audit_pkey
--            PRIMARY KEY (id)

-- notifications
--   [FK    ] notifications_learner_id_fkey
--            FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
--   [PK    ] notifications_pkey
--            PRIMARY KEY (id)

-- passports
--   [PK    ] passports_pkey
--            PRIMARY KEY (id)
--   [UNIQUE] passports_passport_id_key
--            UNIQUE (passport_id)

-- portfolio_items
--   [CHECK ] portfolio_items_status_check
--            CHECK ((status = ANY (ARRAY['Draft'::text, 'Submitted'::text, 'Approved'::text, 'Featured'::text])))
--   [FK    ] portfolio_items_learner_id_fkey
--            FOREIGN KEY (learner_id) REFERENCES learners(id) ON DELETE CASCADE
--   [PK    ] portfolio_items_pkey
--            PRIMARY KEY (id)

-- resources
--   [PK    ] resources_pkey
--            PRIMARY KEY (id)

-- schema_migrations
--   [PK    ] schema_migrations_pkey
--            PRIMARY KEY (filename)

-- sessions
--   [PK    ] sessions_pkey
--            PRIMARY KEY (id)

-- weeks
--   [CHECK ] weeks_phase_check
--            CHECK ((phase = ANY (ARRAY['Foundation'::text, 'Core Skills'::text, 'Delivery'::text, 'Capstone'::text])))
--   [PK    ] weeks_pkey
--            PRIMARY KEY (id)
--   [UNIQUE] weeks_week_number_key
--            UNIQUE (week_number)

-- ── RLS POLICIES ────────────────────────────────────────────────────────────

-- ai_practice_attempts
--   ai_practice_insert_own  [INSERT] roles={public}
--     USING: —
--     WITH CHECK: (learner_id = ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))
--   ai_practice_select_own  [SELECT] roles={public}
--     USING: (learner_id = ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))

-- announcements
--   ann_read_all  [SELECT] roles={public}
--     USING: (is_published = true)
--   announcements_select_all  [SELECT] roles={public}
--     USING: (is_published = true)

-- assignments
--   assignments_insert_own  [INSERT] roles={public}
--     USING: —
--     WITH CHECK: (learner_id IN ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))
--   assignments_select_own  [SELECT] roles={public}
--     USING: (learner_id IN ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))
--   assignments_update_own  [UPDATE] roles={public}
--     USING: (learner_id IN ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))

-- attendance
--   attendance_select_own  [SELECT] roles={public}
--     USING: (learner_id IN ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))

-- capability_scores
--   capability_select_own  [SELECT] roles={public}
--     USING: (learner_id = ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))

-- community_posts
--   community_posts_select_all  [SELECT] roles={public}
--     USING: true
--   posts_read_all  [SELECT] roles={public}
--     USING: true

-- community_replies
--   community_replies_insert_own  [INSERT] roles={public}
--     USING: —
--     WITH CHECK: (learner_id = ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))
--   community_replies_select_all  [SELECT] roles={public}
--     USING: true
--   replies_read_all  [SELECT] roles={public}
--     USING: true

-- notifications
--   notif_select_own  [SELECT] roles={public}
--     USING: (learner_id IN ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))
--   notif_update_own  [UPDATE] roles={public}
--     USING: (learner_id IN ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))
--   notifications_select_own  [SELECT] roles={public}
--     USING: (learner_id = ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))
--   notifications_update_own  [UPDATE] roles={public}
--     USING: (learner_id = ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))

-- portfolio_items
--   portfolio_select_own  [SELECT] roles={public}
--     USING: (learner_id IN ( SELECT learners.id
   FROM learners
  WHERE (learners.clerk_user_id = ((current_setting('request.jwt.claims'::text, true))::json ->> 'sub'::text))))

-- resources
--   resources_read_all  [SELECT] roles={public}
--     USING: (is_active = true)

-- sessions
--   sessions_read_all  [SELECT] roles={public}
--     USING: true

-- weeks
--   weeks_select_published  [SELECT] roles={public}
--     USING: (is_published = true)

-- ── INDEXES ─────────────────────────────────────────────────────────────────

-- ai_practice_attempts
--   CREATE UNIQUE INDEX ai_practice_attempts_pkey ON public.ai_practice_attempts USING btree (id)

-- announcements
--   CREATE UNIQUE INDEX announcements_pkey ON public.announcements USING btree (id)

-- app_settings
--   CREATE UNIQUE INDEX app_settings_pkey ON public.app_settings USING btree (key)

-- assignments
--   CREATE UNIQUE INDEX assignments_learner_id_week_number_pathway_key ON public.assignments USING btree (learner_id, week_number, pathway)
--   CREATE UNIQUE INDEX assignments_pkey ON public.assignments USING btree (id)

-- attendance
--   CREATE UNIQUE INDEX attendance_learner_id_week_number_key ON public.attendance USING btree (learner_id, week_number)
--   CREATE UNIQUE INDEX attendance_pkey ON public.attendance USING btree (id)

-- capability_scores
--   CREATE UNIQUE INDEX capability_scores_learner_id_capability_key ON public.capability_scores USING btree (learner_id, capability)
--   CREATE UNIQUE INDEX capability_scores_pkey ON public.capability_scores USING btree (id)

-- community_posts
--   CREATE UNIQUE INDEX community_posts_pkey ON public.community_posts USING btree (id)

-- community_replies
--   CREATE UNIQUE INDEX community_replies_pkey ON public.community_replies USING btree (id)

-- learners
--   CREATE UNIQUE INDEX learners_clerk_user_id_key ON public.learners USING btree (clerk_user_id)
--   CREATE UNIQUE INDEX learners_pkey ON public.learners USING btree (id)

-- module_access
--   CREATE UNIQUE INDEX module_access_cohort_uniq ON public.module_access USING btree (module_key, cohort) WHERE (cohort IS NOT NULL)
--   CREATE UNIQUE INDEX module_access_global_uniq ON public.module_access USING btree (module_key) WHERE (cohort IS NULL)
--   CREATE INDEX module_access_module_key_idx ON public.module_access USING btree (module_key)
--   CREATE UNIQUE INDEX module_access_pkey ON public.module_access USING btree (id)

-- module_access_audit
--   CREATE INDEX module_access_audit_changed_at_idx ON public.module_access_audit USING btree (changed_at DESC)
--   CREATE INDEX module_access_audit_module_key_idx ON public.module_access_audit USING btree (module_key, changed_at DESC)
--   CREATE UNIQUE INDEX module_access_audit_pkey ON public.module_access_audit USING btree (id)

-- notifications
--   CREATE UNIQUE INDEX notifications_pkey ON public.notifications USING btree (id)

-- passports
--   CREATE INDEX idx_passports_cohort_track ON public.passports USING btree (cohort, track)
--   CREATE INDEX idx_passports_learner ON public.passports USING btree (learner_id)
--   CREATE INDEX idx_passports_passport_id ON public.passports USING btree (passport_id)
--   CREATE INDEX idx_passports_status ON public.passports USING btree (status)
--   CREATE UNIQUE INDEX passports_passport_id_key ON public.passports USING btree (passport_id)
--   CREATE UNIQUE INDEX passports_pkey ON public.passports USING btree (id)
--   CREATE UNIQUE INDEX uniq_passport_issued_per_learner ON public.passports USING btree (learner_id) WHERE (status = 'issued'::text)

-- portfolio_items
--   CREATE UNIQUE INDEX portfolio_items_pkey ON public.portfolio_items USING btree (id)

-- resources
--   CREATE UNIQUE INDEX resources_pkey ON public.resources USING btree (id)

-- schema_migrations
--   CREATE UNIQUE INDEX schema_migrations_pkey ON public.schema_migrations USING btree (filename)

-- sessions
--   CREATE UNIQUE INDEX sessions_pkey ON public.sessions USING btree (id)

-- weeks
--   CREATE UNIQUE INDEX weeks_pkey ON public.weeks USING btree (id)
--   CREATE UNIQUE INDEX weeks_week_number_key ON public.weeks USING btree (week_number)

-- ── TRIGGERS ────────────────────────────────────────────────────────────────
--   assignments: update_assignments_updated_at BEFORE UPDATE
--   learners: update_learners_updated_at BEFORE UPDATE
--   weeks: update_weeks_updated_at BEFORE UPDATE

-- =============================================================================
