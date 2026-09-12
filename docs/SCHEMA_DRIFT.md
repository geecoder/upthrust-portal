# Schema Drift — repo `.sql` files vs production

**Captured:** 2026-09-12 · **Project:** `qzpuvectpqxmtbitmtlm.supabase.co` · **Branch:** `fix/pre-launch-stabilisation`

Compares the four loose files at repo root — `supabase-schema.sql`, `supabase-additions.sql`, `supabase-weeks-seed.sql`, `passports.sql` — against production as observed read-only over PostgREST. Method and limits: `docs/PROD_SCHEMA_ACTUAL.sql`.

**What I could not read:** CHECK/UNIQUE constraint definitions, RLS policy definitions, which tables have RLS enabled, indexes, triggers. PostgREST cannot expose them and this project has no RPC that would run SQL. `docs/INTROSPECT.sql` contains the five queries that close the gap. **Section 3 below is materially incomplete until those are run.**

**Headline:** production has drifted from all four files in both directions. Fourteen tables exist; one (`sessions`) was never in any file. Nine columns exist that no file declares; four declared columns were never created; three types differ. The `weeks` table's live content matches **neither** seed file.

---

## 1. Columns in production that no `.sql` file declares

| Table | Column | Prod type | Default | Written by | Read by |
|---|---|---|---|---|---|
| `resources` | `notion_url` | text | — | `app/api/admin/data/route.ts:394` | `app/portal/resources/page.tsx`, `app/admin/resources/page.tsx` |
| `resources` | `youtube_url` | text | — | `app/api/admin/data/route.ts:395` | same |
| `resources` | `link_type` | text | `'url'` | `app/api/admin/data/route.ts:392` | same |
| `resources` | `content_level` | text | `'All Levels'` | `app/api/admin/data/route.ts:391` | same |
| `resources` | `duration_mins` | integer | — | `app/api/admin/data/route.ts:397` | `lib/types.ts:161` calls it **`duration_minutes`** — see §3 |
| `resources` | `file_url` | text | — | **nothing** — `app/admin/resources/page.tsx:150` computes a public URL but `save_resource` never sends it | `lib/types.ts:158` |
| `resources` | `content_type` | text | `'Resource'` | **nothing** | **nothing** |
| `resources` | `thumbnail_url` | text | — | **nothing** | **nothing** |
| `learners` | `portfolio_url` | text | — | **nothing** | `app/api/passport-issue/route.ts:186` |
| `learners` | `facilitator_note` | text | — | **nothing** | `app/api/passport-issue/route.ts:187` |

`learners.portfolio_url` and `facilitator_note` *are* declared — in `passports.sql:41-42`, not in the two schema files. Listed here because they are easy to miss.

**Whole table undeclared:**

| Table | Columns | Rows | Declared anywhere? |
|---|---|---|---|
| **`sessions`** | `id` uuid PK, `title` text NOT NULL, `week_number` int, `session_date` date, `start_time` text, `zoom_link` text, `description` text, `recording_url` text, `created_at` timestamptz | **7** | **No.** No `CREATE TABLE sessions` in any file |

Written by `app/api/admin/data/route.ts:262,271,285`; read by `:490` and `app/portal/sessions/page.tsx:34`. **The anon key can read all 7 rows** (see §4), so either RLS was never enabled on it or a permissive policy exists.

**Verdict:** the `resources` and `sessions` work was done directly in the Supabase dashboard. Audit finding F-32 predicted this; it is confirmed. The `save_resource` handler is **not** broken in production — the repo's SQL is simply out of date. `file_url`, `content_type` and `thumbnail_url` are columns someone created and never wired up.

---

## 2. Columns declared in a `.sql` file but absent from production

| Table | Column | Declared at | Consequence |
|---|---|---|---|
| `attendance` | `session_title` | `supabase-additions.sql:34` | Never created. Not written by any code path, so no live impact |
| `attendance` | `missed_session_task_sent` | `supabase-additions.sql:37` | Never created. Not written by any code path (audit F-34), so no live impact |
| `weeks` | `pm_rubric_json` | `supabase-additions.sql:44` | Never created. Never read or written (audit F-34), so no live impact |
| `weeks` | `ba_rubric_json` | `supabase-additions.sql:45` | Never created. Same |
| `portfolio_items` | `submitted_at` | **nowhere** — but written by code | **LIVE DEFECT, see §3** |

The four genuinely-absent columns are all from `supabase-additions.sql`, all after line 33. Combined with the duplicate-policy error at `supabase-additions.sql:213` noted in the audit (F-63), the likely explanation is that **`supabase-additions.sql` was only partially applied** — it was run statement-by-statement or aborted partway, and nobody recorded which statements landed.

---

## 3. Type and constraint mismatches

| # | Object | Repo file says | Production has | Consequence |
|---|---|---|---|---|
| **D-1** | `passports.learner_id` | **`bigint`** (`passports.sql:12`) | **`uuid`** | **The audit was wrong.** F-24 is not a live defect. Production matches `learners.id`. The file is stale — someone corrected the type before or after running it. See §5 |
| **D-2** | `portfolio_items.submitted_at` | not declared in any file | **does not exist** | **LIVE DEFECT.** `app/api/admin/data/route.ts:96` writes `submitted_at` on every `portfolio_add`. Every "Add portfolio artefact" fails. `portfolio_items` has **0 rows** in production, which is exactly what a permanently-failing insert looks like. Confirms audit F-33 |
| **D-3** | `learners.clerk_user_id` | `TEXT UNIQUE NOT NULL` (`supabase-schema.sql:8`) | **nullable** | NOT NULL was dropped (or never applied). This is why "Add learner first, link later" works. Resolves audit F-64: not a defect. Whether UNIQUE survives is unknown — needs `INTROSPECT.sql` query 1 |
| **D-4** | `learners.enrollment_status` default | `'Pending'` (`supabase-schema.sql:17`) | **`'Active'`** | Changed in production. The Clerk webhook writes `'Pending'` explicitly (`app/api/webhook/clerk/route.ts:127`) so it is unaffected, but any insert omitting the column now lands **Active**. All 7 live learners are `Active` |
| **D-5** | `attendance.session_date` | `DATE` (`supabase-additions.sql:35`) | **`text`** | Changed in production to accommodate the code: `app/admin/attendance/page.tsx:81` sends `WEEK_DATES.find(...)?.session`, which is a display string like `'Sat June 14'`, not a date. The column was widened to text rather than the code fixed |
| **D-6** | `resources.duration_mins` | `lib/types.ts:161` declares `duration_minutes` | column is **`duration_mins`** | The **TypeScript type is wrong**, not the route handler. `app/api/admin/data/route.ts:397` writes `duration_mins`, which matches production. `Resource.duration_minutes` in `lib/types.ts` can never be populated |
| **D-7** | `resources.resource_type` CHECK | 7 values (`supabase-additions.sql:69`) | **at least 11 in use** | Production contains `Session Material` (12), `Recording` (8), `Framework` (6), `Case Study` (9), `Slides` (2) — none of which are in the file's CHECK list. The constraint **was widened in production**. `lib/types.ts:9-22`'s 13 values are closer to reality than the SQL file |
| **D-8** | `community_replies` | declared **twice**, conflicting (`supabase-schema.sql:111` CASCADE + `author_avatar`; `supabase-additions.sql:201` SET NULL, no `author_avatar`) | has **`author_avatar`** | The `supabase-schema.sql` version won; the `supabase-additions.sql` copy was a silent no-op, as predicted. FK delete behaviour needs `INTROSPECT.sql` query 1 to confirm |
| **D-9** | `assignments.status` CHECK | 7 values (`supabase-schema.sql:73`) | **UNKNOWN — could not read** | See §5. This is the Task 4 blocker |

---

## 4. RLS — what the anon key can actually see

Empirical probe: same `SELECT ... LIMIT 1` issued with the service-role key and with the anon key. Read-only.

| Table | Rows (service) | Rows visible to anon | Reading |
|---|---|---|---|
| `learners` | 7 | **0** | RLS blocking. Confirmed |
| `assignments` | 25 | **0** | RLS blocking. Confirmed |
| `attendance` | 62 | **0** | RLS blocking. Confirmed |
| `capability_scores` | 41 | **0** | RLS blocking. Confirmed |
| `notifications` | 50 | **0** | RLS blocking. Confirmed |
| `passports` | 1 | **0** | RLS blocking. Correct and intended (`passports.sql:44-51`) |
| `community_posts` | 1 | **1** | `USING (TRUE)` policy. As declared |
| `resources` | 84 | **64** | `USING (is_active = TRUE)` policy. 20 inactive rows correctly hidden |
| `weeks` | 13 | **13** | Consistent with `USING (is_published = TRUE)` — **all 13 are published**, so this does not distinguish a working policy from no RLS |
| **`sessions`** | **7** | **7** | **No RLS, or a permissive policy.** The table has no DDL in any file, so `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` was almost certainly never run. Zoom links and session metadata are readable by anyone holding the anon key, which ships in the client bundle |
| `portfolio_items`, `community_replies`, `announcements`, `ai_practice_attempts` | 0 | 0 | **Indeterminate** — the tables are empty, so a zero result proves nothing |

Six tables give hard confirmation that RLS blocks the anon key, which confirms audit finding F-22 / RLS-2: the client-side Supabase calls in 14 files cannot read learner-scoped data. **`sessions` is the one new finding here** and it is a real exposure. It is out of scope for this run — logged in `docs/DEFERRED.md`.

---

## 5. `passports.learner_id` — the specific question

**Confirmed: production has `learner_id uuid NOT NULL`, not `bigint`.**

The audit's F-24 was based on `passports.sql:12`, which does say `bigint`. That file does not reflect what was run. `learners.id` is `uuid`, so production is internally consistent and **the type mismatch is not a live defect.** `passports.sql` should be treated as unreliable.

**Has `passports` ever held a row? Yes — it holds exactly one, right now.**

| Field | Value |
|---|---|
| `passport_id` | `UPT-PM-C1-2026-001` |
| `pathway` | `BA` |
| `track` | **`PM`** |
| `cohort` | `Cohort 1` |
| `status` | `issued` |
| `issued_at` | `2026-06-03` |
| `overall_score` | **`0`** |
| `capability_breakdown` | 10 entries |
| `evidence` | **0 entries** |

Three things are wrong with this row, and together they say it was **not** produced by `/api/passport-issue` as that route is currently written:

1. **`overall_score` is 0.** `app/api/passport-issue/route.ts:93` refuses to issue when `overallScore <= 0`, with no override. This row could not pass that gate.
2. **`track = 'PM'` while `pathway = 'BA'`.** This is audit finding F-3 materialised in live data: `/business/i.test('BA')` is `false`, so the regex at `lib/passport.ts:145` assigns `PM`. The learner is on the BA pathway and their credential ID says PM. Anyone verifying it sees a contradiction.
3. **`evidence` is empty** — consistent with audit F-25 (the issuer selects `title`, `reviewer`, `reviewed_by` from `assignments`, none of which exist, and discards the error).
4. `issued_at` is **2026-06-03**, three days before the cohort started.

Most likely this row was inserted by hand, or by an earlier version of the route. Either way it is a real, live, internally inconsistent credential.

**This matters for Task 7.** Making `/verify/[passportId]` public will make this row publicly readable at `/verify/UPT-PM-C1-2026-001`. It will render as a valid issued passport showing an overall score of 0 and a PM credential ID for a BA learner. Task 7 unblocks the route; it does not and cannot fix the data. **Recommend correcting or revoking this row before the verify route is deployed publicly.** Flagged in the final summary.

---

## 6. Content drift — `weeks`

Not a schema issue, but the most operationally dangerous drift found, and it directly changes Task 6.

Production week titles:

| # | Production title | `supabase-schema.sql` | `supabase-weeks-seed.sql` |
|---|---|---|---|
| 0 | Orientation & Setup | Onboarding & Diagnostic | Orientation & Setup |
| 1 | What BAs and PMs Actually Do | Digital Product Foundations | The Role of PM/BA — What Does Great Look Like? |
| 2 | Business & Product Fundamentals | Problem Discovery | Problem Framing — From Vague Requests to Clear Briefs |
| 3 | **Track Week 3** | Product Strategy & Business Context | Product Strategy — From Problem to Direction |
| 4 | **Track Week 4** | Requirements & Scope | Requirements — Writing What Gets Built |
| 5 | **Track Week 5** | Journey, Workflow & Process Design | User Research — Talking to Users |
| 6 | **Track Week 6** | UX & Product Design Foundations | Design Collaboration |
| 7 | **Track Week 7** | Prototyping & Design Systems | Design Review |
| 8 | **Track Week 8** | Agile Delivery & Backlog | Delivery & Agile — Working in Sprints |
| 9 | Capstone Kickoff | Stakeholder Management | Stakeholder Management — Influence Without Authority |
| 10 | Capstone Build | Testing, UAT & Launch Readiness | Launch Planning — Getting to Production |
| 11 | Capstone Refinement | Metrics & Continuous Improvement | Metrics & Post-Launch |
| 12 | Capstone Presentation & Graduation | Capstone Defence & Portfolio Review | Capstone Presentations — Demo Day |

**The live curriculum matches neither file.** It is a third, newer structure — weeks 3–8 are pathway-specific ("Track Week N") and the capstone arc starts at week 9 rather than week 12.

`supabase-weeks-seed.sql:156-171` is an `INSERT ... ON CONFLICT (week_number) DO UPDATE SET` that overwrites `title`, `phase`, `session_date`, `why_it_matters`, `pre_work`, `outcomes`, all eight `pm_*`/`ba_*` assignment fields, and `is_published`.

**Re-running that file today would destroy the entire live curriculum**, not merely republish it. The audit (F-10) described this as "reverting manual unpublishes". It is worse than that: it is silent content loss across all 13 weeks. All 13 weeks are currently published, so the republish half of the risk is presently moot — the content half is not.

---

## 7. What to do with the four root `.sql` files

They are not a schema definition. They are four historical scripts, partially applied, in unknown order, superseded by undocumented dashboard edits.

`supabase/migrations/0000_baseline.sql` now records the observed state as the starting point of a real ledger. The four root files should be treated as read-only history and never re-run. **`supabase-weeks-seed.sql` is actively dangerous** (§6) — Task 6 addresses it.
