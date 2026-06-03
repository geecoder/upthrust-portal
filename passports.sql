-- ============================================================================
-- Upthrust Capability Passport — schema migration
-- Idempotent: safe to run multiple times. Run in Supabase → SQL Editor.
-- ============================================================================

-- 1) The passports table: an immutable snapshot of verified facts at issuance.
create table if not exists public.passports (
  id                   uuid primary key default gen_random_uuid(),
  passport_id          text unique not null,            -- e.g. UPT-PM-C1-2026-001
  learner_id           bigint not null,                 -- FK → learners.id (match your type)
  full_name            text,
  country              text,
  pathway              text not null,                   -- 'Product Management' | 'Business Analysis'
  track                text not null,                   -- 'PM' | 'BA'
  cohort               text not null,
  overall_score        numeric not null,
  rating               text,                            -- Exceptional / Advanced / ...
  readiness_level      text,                            -- Associate Work-Ready / ...
  capability_breakdown jsonb default '[]'::jsonb,        -- [{domain, score, level}]
  evidence             jsonb default '[]'::jsonb,        -- [{title, score, reviewer}]
  portfolio_url        text,
  facilitator_note     text,
  issued_at            date not null default current_date,
  signature            text not null,                   -- HMAC-SHA256 (base64url)
  status               text not null default 'issued',  -- issued | revoked | superseded
  revoked_at           timestamptz,
  created_at           timestamptz not null default now()
);

-- 2) Indexes for fast public lookup + admin queries.
create index if not exists idx_passports_passport_id on public.passports (passport_id);
create index if not exists idx_passports_learner     on public.passports (learner_id);
create index if not exists idx_passports_status      on public.passports (status);
create index if not exists idx_passports_cohort_track on public.passports (cohort, track);

-- 3) Mirror columns on learners (no-ops if they already exist).
alter table public.learners add column if not exists passport_issued boolean default false;
alter table public.learners add column if not exists passport_id text;
-- These may already exist in your schema; the IF NOT EXISTS makes this safe:
alter table public.learners add column if not exists passport_eligibility text;   -- 'Approved' gate
alter table public.learners add column if not exists portfolio_url text;
alter table public.learners add column if not exists facilitator_note text;

-- 4) Row Level Security.
--    The verify page and issuance route both use the SERVICE ROLE client, which
--    bypasses RLS. We enable RLS and add NO public policies, so the anon key
--    cannot read passports directly from the browser — all access goes through
--    your server (verify page / API). This prevents enumeration via the anon key.
alter table public.passports enable row level security;

-- (Intentionally no anon/select policy. Service role bypasses RLS.)

-- 5) Optional: enforce one issued passport per learner at a time.
create unique index if not exists uniq_passport_issued_per_learner
  on public.passports (learner_id)
  where status = 'issued';

-- Done.
