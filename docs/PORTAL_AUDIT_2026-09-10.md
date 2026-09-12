# Upthrust Portal — Reconnaissance Audit

**Repo:** `upthrust-portal` (`https://github.com/geecoder/upthrust-portal.git`)
**Commit audited:** `afc21f3b0911890b67c87c1eec2e40a88afe6872` — 2026-06-12 18:37:13 +0100 — *"fix(interview): fix Get Feedback for all categories; harden API and UI error paths"*
**Branch:** `master`. Working tree clean at audit time.
**Audit date:** 2026-09-10

Confirmed as the learner portal, not the marketing site: `@clerk/nextjs` in `package.json:12`, `SUPABASE_SERVICE_ROLE_KEY` in `lib/supabase.ts:17`, `Learner` interface in `lib/types.ts:34`, `app/portal/**` route tree.

## Method and one standing caveat

Everything below is read from the files at that commit. No writes, no migrations, no Supabase queries.

**There is no `supabase/migrations/` directory.** The schema exists as three loose SQL files at repo root (`supabase-schema.sql`, `supabase-additions.sql`, `passports.sql`) whose headers instruct a human to paste them into the Supabase SQL Editor by hand (`supabase-schema.sql:2`, `supabase-additions.sql:3`, `passports.sql:3`). There is no applied-migration ledger, so **the repo cannot prove what the production database actually contains.** Every schema claim in Section 2 is a claim about *the SQL in this repo*, which is the only written record that exists. Where a runtime code path contradicts that SQL, I flag the contradiction — it means either the code is broken in production or the production schema has drifted away from the only file documenting it. The audit cannot tell you which without database access. See Section 9, Q1.

---

# 1. Repository and app shape

## Stack and versions

| Item | Value | Evidence |
|---|---|---|
| Package manager | npm (`package-lock.json`, lockfileVersion 3; no yarn/pnpm lock) | `package-lock.json` |
| Node version | **NOT FOUND** — no `engines` field, no `.nvmrc`, no `.node-version` | `package.json` (no `engines` key); root listing |
| Next | `^15.3.2` | `package.json:14` |
| React / React DOM | `^19.0.0` | `package.json:15-16` |
| TypeScript | `^5` (dev) | `package.json:21` |
| `@clerk/nextjs` | `^6.12.0` | `package.json:12` |
| `@supabase/supabase-js` | `^2.43.4` | `package.json:13` |
| `svix` | `^1.95.1` | `package.json:17` |
| Tailwind | `^3.4.19` | `package.json:18` |
| Anthropic SDK | **not a dependency** — all calls are raw `fetch` to `https://api.anthropic.com/v1/messages` | `package.json:11-19`; §4 AI |
| Resend SDK | **not a dependency** — raw `fetch` to `https://api.resend.com/emails` | `app/api/notify/route.ts:30` |
| Test framework | **none** | `package.json:5-9` has only `dev`/`build`/`start`/`lint` |
| Deploy | Vercel, framework `nextjs` | `vercel.json` |
| Dev port | 3001 | `package.json:6` |

Total: **9 runtime dependencies, 4 dev.** A very small dependency surface for the amount of product surface — almost everything is hand-rolled.

## Directory tree (depth 3, excluding `node_modules`, `.next`, `.git`)

```
.claude/                      settings.json, settings.local.json  (gitignored)
.env.local                    (gitignored, present locally)
.env.local.example            (TRACKED — see §6 secrets)
app/
  admin/
    attendance/  cohort/  content/  learners/  resources/  reviews/  sessions/
    layout.tsx  page.tsx
  api/
    admin/  ai-feedback/  complete-onboarding/  interview/  notify/
    passport-issue/  passport-pdf/  simulation/  submissions/
    submit-assignment/  webhook/  webhooks/  weeks/  writing-check/
  auth/
    login/  register/  sign-in/  sign-up/  verify/
  portal/
    assignments/  community/  interview/  notifications/  onboarding/
    passport/  portfolio/  profile/  resources/  sessions/  simulation/
    week/  writing-check/
    layout.tsx  page.tsx
  verify/[passportId]/
  globals.css  layout.tsx  not-found.tsx  page.tsx
components/                   PassportControls.tsx  Sidebar.tsx  UpthrustLogo.tsx
lib/                          ai-models.ts  passport.ts  qr.ts  supabase-admin.ts
                              supabase-url.ts  supabase.ts  types.ts
                              upthrust-logo-base64.ts
public/                       EMPTY
scripts/                      prep-light-and-sig.js  prep-logo.js
types/                        EMPTY
{app,components,lib,types}/   EMPTY — artefact of a failed shell brace-expansion
middleware.ts  next.config.js  postcss.config.js  tailwind.config.js  tsconfig.json
passports.sql  supabase-additions.sql  supabase-schema.sql  supabase-weeks-seed.sql
tsconfig.tsbuildinfo          (gitignored, 636 KB, present locally)
```

**Seven directories are empty on disk with nothing tracked:** `app/api/webhooks/`, `app/auth/login/`, `app/auth/register/`, `app/auth/verify/`, `public/`, `types/`, and the literal directory named `{app,components,lib,types}`.

`public/` being empty means **there is no favicon and no brand asset file in the portal repo.** All brand imagery is inline SVG (`components/UpthrustLogo.tsx`) or base64 in `lib/upthrust-logo-base64.ts` (dead — §6).

`app/api/webhooks/` (plural, empty) matters: it is the path the middleware exempts from auth. See W-1.

## Route inventory

Auth column: `MW` = protected by `middleware.ts` `auth.protect()`; `LAYOUT` = additionally gated in a layout; `ADMIN` = additionally requires `userId === ADMIN_USER_ID`.

| Path | Kind | Server/Client | Auth-gated | File |
|---|---|---|---|---|
| `/` | page | Server | MW | `app/page.tsx` |
| *(root layout)* | layout | Server | — | `app/layout.tsx:13` |
| `/not-found` | page | Server | MW | `app/not-found.tsx` |
| `/auth/sign-in` | page | Server | **public** (`/auth/(.*)`) | `app/auth/sign-in/page.tsx` |
| `/auth/sign-up` | page | Server | **public** (`/auth/(.*)`) | `app/auth/sign-up/page.tsx` |
| `/verify/[passportId]` | page | Server | **MW — see V-1** | `app/verify/[passportId]/page.tsx` |
| *(portal layout)* | layout | Server | MW + LAYOUT | `app/portal/layout.tsx:10-11` |
| `/portal` | page | Server | MW + LAYOUT | `app/portal/page.tsx:30-34` |
| `/portal/onboarding` | page | **Client** | MW | `app/portal/onboarding/page.tsx` |
| `/portal/week` | page | Server | MW | `app/portal/week/page.tsx` |
| `/portal/week/[weekNum]` | page | Server | MW | `app/portal/week/[weekNum]/page.tsx` |
| `/portal/sessions` | page | Server | MW | `app/portal/sessions/page.tsx` |
| `/portal/assignments` | page | Server | MW | `app/portal/assignments/page.tsx:75-76` |
| `/portal/portfolio` | page | **Client** | MW | `app/portal/portfolio/page.tsx` |
| `/portal/passport` | page | Server | MW | `app/portal/passport/page.tsx` |
| `/portal/community` | page | **Client** | MW | `app/portal/community/page.tsx` |
| `/portal/resources` | page | **Client** | MW | `app/portal/resources/page.tsx` |
| `/portal/notifications` | page | **Client** | MW | `app/portal/notifications/page.tsx` |
| `/portal/profile` | page | **Client** | MW | `app/portal/profile/page.tsx` |
| `/portal/simulation` | page | **Client** | MW | `app/portal/simulation/page.tsx` |
| `/portal/interview` | page | **Client** | MW | `app/portal/interview/page.tsx` |
| `/portal/writing-check` | page | **Client** | MW | `app/portal/writing-check/page.tsx` |
| *(admin layout)* | layout | Server | MW + ADMIN | `app/admin/layout.tsx:12-14` |
| `/admin` | page | Server | MW + ADMIN (re-checked in page) | `app/admin/page.tsx:25` |
| `/admin/reviews` | page | **Client** | MW + ADMIN (layout only) | `app/admin/reviews/page.tsx` |
| `/admin/attendance` | page | **Client** | MW + ADMIN (layout only) | `app/admin/attendance/page.tsx` |
| `/admin/sessions` | page | **Client** | MW + ADMIN (layout only) | `app/admin/sessions/page.tsx` |
| `/admin/learners` | page | Server | MW + ADMIN (re-checked) | `app/admin/learners/page.tsx:12` |
| `/admin/learners/add` | page | **Client** | MW + ADMIN (layout only) | `app/admin/learners/add/page.tsx` |
| `/admin/learners/[learnerId]` | page | Server | MW + ADMIN (re-checked) | `app/admin/learners/[learnerId]/page.tsx:14` |
| `/admin/content` | page | **Client** | MW + ADMIN (layout only) | `app/admin/content/page.tsx` |
| `/admin/resources` | page | **Client** | MW + ADMIN (layout only) | `app/admin/resources/page.tsx` |
| `/admin/cohort` | page | **Client** | MW + ADMIN (layout only) | `app/admin/cohort/page.tsx` |

Non-page client components: `components/Sidebar.tsx`, `components/PassportControls.tsx`, `app/portal/assignments/AssignmentSubmitPanel.tsx`, `app/admin/learners/[learnerId]/PathwayEditor.tsx`, `app/admin/learners/[learnerId]/ClerkLinkForm.tsx`.

**Every page except the two Clerk auth screens carries `export const dynamic = 'force-dynamic'`.** Nothing is statically rendered or cached. `next.config.js:4` sets `output: undefined` with the comment "all pages are dynamic (required for Clerk auth)". No ISR, no `revalidate`, no `unstable_cache`. Every page load is a fresh set of Supabase round-trips.

## API handler inventory

| Route | Methods | What it does | Admin client? | Input validated? |
|---|---|---|---|---|
| `app/api/admin/data/route.ts` | POST, GET | 19-action dispatcher: profile update, learner enrolment edit, portfolio CRUD, community post/reply/like, announcements, notifications, review feedback, session CRUD, attendance (single/bulk/note), resource CRUD. GET serves 7 read resources. | Yes (`:44`, `:445`) | **Partial and inconsistent** — see below |
| `app/api/admin/save-week/route.ts` | POST | Updates any column on one `weeks` row. | Yes (`:14`) | Only `id` presence (`:13`). **`fields` spread unvalidated into `.update()`** (`:12,15`) |
| `app/api/admin/publish-week/route.ts` | POST | Toggles `weeks.is_published`. | Yes (`:13`) | Only `weekId` presence (`:12`); `isPublished` unchecked |
| `app/api/ai-feedback/route.ts` | POST | Anthropic call → writes `assignments.ai_feedback` + `status='In Review'`. | Yes (`:169`) | `assignmentId`, `submissionUrl` presence (`:121`) |
| `app/api/complete-onboarding/route.ts` | POST | RLS-bypass fallback that sets `onboarding_complete`. | Yes (`:22`) | No — 5 body fields written with only `\|\| null` (`:50-54`) |
| `app/api/interview/route.ts` | POST, GET | Serves a hardcoded PM/BA question bank; POST `mode='evaluate'` scores an answer via Anthropic. | No | `questionId` must exist in bank (`:178`); `userAnswer` **unchecked — no length or type guard** (`:213`) |
| `app/api/notify/route.ts` | POST, GET | Resend email + in-portal notification, 6 templates. GET fans out session reminders. | Yes (`:135`, `:270`) | `type` switch with `default → 400` (`:236`); `directEmail` **not validated as an email** (`:145`) |
| `app/api/passport-issue/route.ts` | POST | Issue / re-issue / revoke a signed passport snapshot. | Yes (`:45`) | Yes — `action`+`learnerId` required (`:41`), eligibility gate (`:78`), hard graded-work gate (`:93`) |
| `app/api/passport-pdf/route.ts` | GET | Returns passport as printable HTML (not a PDF). | Yes (`:500`) | `learnerId` param admin-only (`:504`); eligibility gate (`:517`) |
| `app/api/simulation/route.ts` | POST, GET | 5 hardcoded stakeholder characters; conversation + debrief via Anthropic. | No | `characterId` must exist (`:335`); **`messages` array shape unchecked** (`:339`, `:376`) |
| `app/api/submissions/route.ts` | POST, GET | Upsert an assignment submission; list own assignments. | Yes (`:21`, `:84`) | `weekNumber` + `submissionUrl` presence (`:14-19`). No URL format or week-range check |
| `app/api/submit-assignment/route.ts` | POST | Upsert submission **and** generate AI feedback in one call. | Yes (`:162`) | **BROKEN — see A-1** (`:158`) |
| `app/api/webhook/clerk/route.ts` | POST | Clerk `user.created`/`user.updated` → link or create learner row. | Yes (`:69`) | Svix signature **conditionally** (`:36`) — see W-3 |
| `app/api/weeks/[week]/route.ts` | GET | One published week + the caller's assignment. | Yes (`:22`) | Yes — `0..12` range check (`:18`) |
| `app/api/writing-check/route.ts` | POST | Anthropic writing-quality review. | No | `text` ≥ 50 chars (`:14`); truncated to 3000 (`:60`) |

### `admin/data` authorisation, action by action

Signed-in-only (any learner can call): `update_profile` (`:54`), `portfolio_add` (`:84`), `portfolio_edit` (`:102`), `portfolio_delete` (`:117`), `community_post` (`:129`), `community_reply` (`:148`), **`community_like` (`:167`)**.

Admin-gated via `isAdmin()`: `admin_update_learner` (`:68`), `post_announcement` (`:178`), `create_notifications` (`:213`), `review_feedback` (`:228`), `save_session` (`:255`), `delete_session` (`:283`), `mark_attendance` (`:295`), `mark_all_attendance` (`:332`), `update_attendance_note` (`:365`), `save_resource` (`:383`), `delete_resource` (`:414`), `toggle_resource` (`:422`).

GET resources — admin-gated: `active_learners`, `all_learners`, `attendance`, `review_queue`, `resources`. Not admin-gated: `announcements` (`:484`), `sessions` (`:489`) — correct, learners need these.

`isAdmin()` is `!!process.env.ADMIN_USER_ID && userId === process.env.ADMIN_USER_ID` (`:36-38`). The `!!` guard is correct: if the env var is unset, nobody is admin. This is the right pattern and worth keeping.

## Middleware

`middleware.ts` in full (14 lines of logic):

```ts
const isPublicRoute = createRouteMatcher([
  '/auth/(.*)',
  '/api/webhooks/(.*)',
]);
export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) { await auth.protect(); }
});
export const config = { matcher: [
  '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
] };
```

**Lets through:** `/auth/*`, `/api/webhooks/*` (a path with no handler), Next static assets, and any request whose path ends in an image extension.

**Protects:** everything else — including two things that must not be protected.

**W-1 — the Clerk webhook is behind auth and cannot be called by Clerk.** The public matcher is `/api/webhooks/(.*)` (plural). The handler lives at `app/api/webhook/clerk/route.ts` → `/api/webhook/clerk`, **singular**. The route's own docblock states the endpoint as `.../api/webhook/clerk` (`app/api/webhook/clerk/route.ts:13`). Svix POSTs carry no Clerk session cookie, so `auth.protect()` rejects them before the handler runs. `app/api/webhooks/` exists as an empty directory — the plural path was scaffolded, the handler written at the singular path. Consequence: automatic learner↔Clerk account linking never fires; every learner must be linked by hand. Two places in the UI already hedge on exactly this: `app/admin/learners/[learnerId]/page.tsx:63` ("Or set up the Clerk webhook to automate this") and `app/admin/learners/add/page.tsx:185` ("if webhook is set up").

**V-1 — the public verification page is not public.** `app/verify/[passportId]/page.tsx` is documented in its own header as "PUBLIC verification page (no auth)" (`:3`) and its footer tells the reader they are "Verified at app.upthrustdigital.com/verify" (`:227`). It is not in `isPublicRoute`. An employer scanning a QR or opening a verify link is redirected to Clerk sign-in. The entire external value proposition of the Capability Passport is unreachable by its intended audience.

**W-2 — image-extension bypass.** The matcher's `.*\\.(?:svg|png|jpg|jpeg|gif|webp)$` negative lookahead exempts *any* route path ending in those strings, not just static files. No current route ends that way, so this is latent, not live.

## Size

| Metric | Value |
|---|---|
| Total TS/TSX lines (`app`, `components`, `lib`, `types`, `scripts`) | **12,715** |
| `app/globals.css` | 400 lines |
| SQL at root | 507 lines across 4 files |
| Tracked files total | 80 |

Ten largest files by line count:

| Lines | File |
|---|---|
| 567 | `app/admin/resources/page.tsx` |
| 533 | `app/api/passport-pdf/route.ts` |
| 506 | `app/api/admin/data/route.ts` |
| 436 | `app/api/simulation/route.ts` |
| 433 | `app/portal/simulation/page.tsx` |
| 399 | `app/admin/cohort/page.tsx` |
| 371 | `app/portal/page.tsx` |
| 371 | `app/portal/assignments/page.tsx` |
| 367 | `app/portal/community/page.tsx` |
| 364 | `app/portal/onboarding/page.tsx` |

By bytes the largest file in the repo is `lib/upthrust-logo-base64.ts` at 90,679 bytes across 9 lines — four base64 PNG data URLs, **zero import sites** (§6).

---

# 2. Data model

## Schema as written in the repo

Source files, applied by hand in this order: `supabase-schema.sql` (base), `supabase-additions.sql` (ALTERs + new tables), `supabase-weeks-seed.sql` (content), `passports.sql` (passports table).

### `learners` — `supabase-schema.sql:6-32`, extended `supabase-additions.sql:7-18`, `passports.sql:37-42`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` | PK |
| `clerk_user_id` | TEXT | NO | — | UNIQUE. **See L-1** |
| `email` | TEXT | NO | — | not unique |
| `first_name` | TEXT | NO | — | |
| `last_name`, `country`, `phone` | TEXT | YES | — | |
| `pathway` | TEXT | YES | `'Undecided'` | CHECK `IN ('PM','BA','Design','Undecided')` |
| `tier` | TEXT | YES | `'Standard'` | CHECK `IN ('Standard','Premium','VIP','Corporate')` |
| `cohort` | TEXT | YES | **`'Cohort 1'`** | free text, no FK |
| `enrollment_status` | TEXT | YES | `'Pending'` | CHECK `IN ('Pending','Active','Completed','Withdrawn')` |
| `attendance_pct`, `assignment_completion_pct`, `avg_score` | NUMERIC(5,2) | YES | `0` | |
| `risk_status` | TEXT | YES | `'Green'` | CHECK `IN ('Green','Amber','Red')` |
| `passport_eligibility` | TEXT | YES | `'Not Eligible'` | CHECK `IN ('Not Eligible','Pending Review','Approved','Withheld','Needs Revision')`. **`passports.sql:40` re-adds this column with NO check constraint** |
| `passport_issued` | BOOLEAN | YES | `FALSE` | |
| `passport_issued_at` | TIMESTAMPTZ | YES | — | |
| `portfolio_status` | TEXT | YES | `'Not Started'` | CHECK `IN ('Not Started','Drafting','Submitted','Reviewed','Ready')` |
| `capstone_status` | TEXT | YES | `'Not Started'` | CHECK `IN ('Not Started','In Progress','Submitted','Presented','Approved')` |
| `notes`, `linkedin_url`, `avatar_url` | TEXT | YES | — | |
| `created_at`, `updated_at` | TIMESTAMPTZ | YES | `NOW()` | trigger `update_learners_updated_at` (`:226`) |
| `onboarding_complete` | BOOLEAN | YES | `FALSE` | additions `:8` |
| `onboarding_completed_at` | TIMESTAMPTZ | YES | — | additions `:9` |
| `passport_id` | TEXT | YES | — | additions `:10`. **not unique** |
| `career_goal`, `current_job_role`, `preferred_roles`, `cv_url`, `bio` | TEXT | YES | — | additions `:11-18` |
| `employer_visible` | BOOLEAN | YES | `FALSE` | additions `:13` |
| `work_preference` | TEXT | YES | — | CHECK `IN ('Remote','Hybrid','Onsite','Flexible')` additions `:15` |
| `availability` | TEXT | YES | — | CHECK `IN ('Internship','Project Placement','Full-time','Freelance','Not Available')` additions `:16` |
| `portfolio_url`, `facilitator_note` | TEXT | YES | — | `passports.sql:41-42` |

**L-1 — `clerk_user_id` is `NOT NULL UNIQUE` but the app creates learners without it.** `app/admin/learners/add/page.tsx:41-64` inserts a learner with no `clerk_user_id` (the whole point: add first, link later). Against the schema as written that insert violates NOT NULL. `app/admin/learners/[learnerId]/page.tsx:59` renders a "not linked yet" branch on `!typedLearner.clerk_user_id`, i.e. the app expects NULLs in a NOT NULL column. Either production dropped the constraint or Add Learner has never worked.

**L-2 — no FK or lookup for `cohort`.** Free text, literal default `'Cohort 1'`. Nothing enforces spelling. `app/api/passport-issue/route.ts:136` extracts the cohort *number* by regex — `String(cohort).match(/\d+/)?.[0] || '1'` — so `"Cohort 1"`, `"cohort 1"` and `"C1 2026"` all yield `1`, and a cohort named without a digit silently becomes `1`.

### `weeks` — `supabase-schema.sql:34-63`, extended `supabase-additions.sql:40-48` and `supabase-weeks-seed.sql:9-15`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` |
| `week_number` | INTEGER | NO | — (UNIQUE) |
| `title` | TEXT | NO | — |
| `phase` | TEXT | YES | CHECK `IN ('Foundation','Core Skills','Delivery','Capstone')` |
| `start_date`, `end_date`, `session_date` | DATE | YES | — |
| `is_published` | BOOLEAN | YES | `FALSE` |
| `learning_goals`, `concept_topics`, `case_study`, `lab_exercise`, `session_notes`, `recording_url` | TEXT | YES | — |
| **`pm_assignment_title`, `pm_assignment_brief`, `pm_deliverable`, `pm_rubric`, `pm_due_date`** | TEXT / DATE | YES | — |
| **`ba_assignment_title`, `ba_assignment_brief`, `ba_deliverable`, `ba_rubric`, `ba_due_date`** | TEXT / DATE | YES | — |
| `reflection_prompt`, `resources` | TEXT | YES | — |
| `why_it_matters`, `pre_work`, `outcomes` | TEXT | YES | additions `:41-43` |
| **`pm_rubric_json`, `ba_rubric_json`** | TEXT | YES | additions `:44-45` |
| `ai_practice_type`, `zoom_link`, `session_slides_url` | TEXT | YES | additions `:46-48` |
| `created_at`, `updated_at` | TIMESTAMPTZ | YES | `NOW()`; trigger `:228` |

**W-4 — the pathway is baked into the column names.** Twelve columns are `pm_*` / `ba_*` pairs. A third pathway means twelve more columns and an edit to every one of the ~30 read sites in the sweep below. This is the highest-leverage schema fact in the audit. `resources` and `outcomes` are comma-joined strings in TEXT columns, split in the UI (`app/portal/week/[weekNum]/page.tsx:62-63`) — so no outcome or resource may contain a comma. There is a `lab_exercise` TEXT column (`supabase-schema.sql:46`), rendered as a read-only paragraph (`app/portal/week/[weekNum]/page.tsx:149-158`). That is the entire extent of "lab" in the data model.

### `assignments` — `supabase-schema.sql:65-82`, extended `supabase-additions.sql:21-30`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | NO | `uuid_generate_v4()` | PK |
| `learner_id` | UUID | YES | — | **FK → `learners(id)` ON DELETE CASCADE** |
| `week_number` | INTEGER | NO | — | **no FK to `weeks`** |
| `pathway` | TEXT | NO | — | **CHECK `IN ('PM','BA')`** — only two values allowed |
| `submission_url`, `submission_notes` | TEXT | YES | — | |
| `submitted_at` | TIMESTAMPTZ | YES | — | |
| `status` | TEXT | YES | `'Not Started'` | **CHECK `IN ('Not Started','In Progress','Submitted','In Review','Needs Revision','Approved','Portfolio Ready')`** — see A-2 |
| `score` | NUMERIC(5,2) | YES | — | no 0–100 range check |
| `feedback`, `feedback_by` | TEXT | YES | — | |
| `feedback_at` | TIMESTAMPTZ | YES | — | |
| `is_portfolio_ready` | BOOLEAN | YES | `FALSE` | **written nowhere; `portfolio_approved` used instead** |
| `ai_feedback` | TEXT | YES | — | additions `:22` |
| `ai_feedback_at` | TIMESTAMPTZ | YES | — | additions `:23` |
| `ai_score` | NUMERIC(5,2) | YES | — | additions `:24`. **written nowhere** |
| `ai_quality_rating` | TEXT | YES | — | CHECK `IN ('Needs Work','Developing','Good','Portfolio Ready')` additions `:25`. **written nowhere** |
| `resubmission_count` | INTEGER | YES | `0` | additions `:26` |
| `is_late`, `extension_granted` | BOOLEAN | YES | `FALSE` | additions `:27-28`. **written nowhere** |
| `portfolio_approved` | BOOLEAN | YES | `FALSE` | additions `:29`. **read in 6 places, written nowhere** |
| `portfolio_approved_at` | TIMESTAMPTZ | YES | — | additions `:30`. **written nowhere** |
| `created_at`, `updated_at` | TIMESTAMPTZ | YES | `NOW()`; trigger `:227` | |
| — | — | — | — | `UNIQUE(learner_id, week_number, pathway)` (`:81`) |

**A-2 — the status vocabulary has three incompatible definitions, and the app writes values the database forbids.**

| Value | DB CHECK (`supabase-schema.sql:73`) | `lib/types.ts:6` `AssignmentStatus` | Written by |
|---|---|---|---|
| `Not Started` | yes | yes | default |
| `In Progress` | yes | yes | nothing |
| `Submitted` | yes | yes | `submissions:48,64`; `submit-assignment:196,218` |
| `In Review` | yes | **no** | `ai-feedback/route.ts:175` |
| `Needs Revision` | yes | **no** | nothing |
| `AI Reviewed` | **no** | yes | `submit-assignment/route.ts:278` |
| `Human Reviewed` | **no** | yes | `admin/reviews/page.tsx:44,292` |
| `Resubmission Requested` | **no** | yes | `admin/reviews/page.tsx:44,288`; read at `submit-assignment:184` |
| `Approved` | yes | yes | `admin/reviews/page.tsx:280` |
| `Portfolio Ready` | yes | yes | `admin/reviews/page.tsx:284` |

Against the schema as written, **three of the four buttons in the admin review queue write a value the CHECK constraint rejects**: "Request Resubmission" (`Resubmission Requested`), "Save Draft" (`Human Reviewed`), and separately the auto-status after AI feedback (`AI Reviewed`). Only "Approve" and "Approve + Portfolio Ready" use legal values. `review_feedback` surfaces the error (`app/api/admin/data/route.ts:234` → 500 → `alert()` at `app/admin/reviews/page.tsx:58`). The `AI Reviewed` write at `app/api/submit-assignment/route.ts:272-281` has **no error check at all**, so it fails silently and the AI feedback just generated is never persisted.

This is the mechanism by which the revision loop is dead: the status that triggers resubmission cannot be stored.

### `attendance` — `supabase-schema.sql:84-92`, extended `supabase-additions.sql:33-37`

`id` UUID PK; `learner_id` UUID FK → `learners(id)` CASCADE; `week_number` INTEGER NOT NULL (no FK); `attended` BOOLEAN default FALSE; `notes` TEXT; `recorded_at` TIMESTAMPTZ default NOW(); `UNIQUE(learner_id, week_number)`. Additions: `session_title` TEXT, `session_date` DATE, `arrival` TEXT CHECK `IN ('On Time','Late','Absent','Excused')` default `'Absent'`, `missed_session_task_sent` BOOLEAN default FALSE (**written nowhere**).

### `community_posts` — `supabase-schema.sql:94-109`

`id`; `learner_id` FK CASCADE; `author_name` TEXT NOT NULL; `author_avatar`; `category` CHECK `IN ('Question','Win','Portfolio Review','General')` default `'General'`; **`pathway_tag` CHECK `IN ('PM','BA','Both')`** (written nowhere); `week_tag` INTEGER (written nowhere); `is_pinned` BOOLEAN (written FALSE only, never toggled); `is_from_genesis` BOOLEAN; `likes_count`, `replies_count` INTEGER default 0; timestamps.

### `community_replies` — **defined twice, differently**

`supabase-schema.sql:111-120`: `learner_id` FK **ON DELETE CASCADE**, has `author_avatar`, has `is_from_genesis`.
`supabase-additions.sql:201-209`: `learner_id` FK **ON DELETE SET NULL**, **no `author_avatar`**.

Both use `CREATE TABLE IF NOT EXISTS`, so whichever ran first wins and the second is a silent no-op. Whether replies survive learner deletion depends on execution order that nothing records. Worse: `CREATE POLICY "community_replies_select_all"` is issued twice (`supabase-schema.sql:220` and `supabase-additions.sql:213`) — the second **raises a duplicate-policy error**, aborting the rest of `supabase-additions.sql` unless run statement-by-statement. Everything after line 213 in that file (`community_replies_insert_own`) may never have been applied.

### `portfolio_items` — `supabase-schema.sql:122-134`

`id`; `learner_id` FK CASCADE; `week_number` INTEGER; `title` TEXT NOT NULL; `description`; `artefact_type`; `url`; `status` CHECK `IN ('Draft','Submitted','Approved','Featured')` default `'Draft'`; `feedback`; timestamps.

**P-1 — the insert writes a column that does not exist.** `app/api/admin/data/route.ts:96` writes `submitted_at: new Date().toISOString()`. There is no `submitted_at` column on `portfolio_items` in any SQL file. Against the schema as written, **every "Add portfolio artefact" call fails.** The error is returned (`:98`) and surfaced as an `alert()` (`app/portal/portfolio/page.tsx:82`), so learners see a failure rather than silence.

### `announcements` — `supabase-schema.sql:136-144`

`id`; `title`, `content` TEXT NOT NULL; `priority` CHECK `IN ('Normal','Important','Urgent')` default `'Normal'`; **`target_pathway` CHECK `IN ('PM','BA','Both','All')`** default `'All'`; `is_published` BOOLEAN default TRUE; `created_at`.

### `capability_scores` — `supabase-additions.sql:51-62`

`id`; `learner_id` FK CASCADE; `capability` TEXT NOT NULL; `level` CHECK `IN ('Not Started','Emerging','Developing','Competent','Portfolio Ready')` default `'Not Started'`; `score` NUMERIC(5,2) default 0; `evidence` TEXT; `last_assessed_at`; timestamps; `UNIQUE(learner_id, capability)`; trigger `:196`.

**C-1 — nothing ever updates a capability score.** The only write in the codebase is the seed at `app/admin/learners/add/page.tsx:78-82`, which inserts ten rows at `level: 'Not Started', score: 0`. No code path anywhere raises a level or sets a score. Consequences: the learner-facing Capability Areas panel (`app/portal/passport/page.tsx:173-196`) permanently reads "Not Started" for all ten areas; and the passport snapshot's per-domain breakdown falls back to the overall score for every domain (`app/api/passport-issue/route.ts:115` — `capMap.has(d) ? capMap.get(d)! : overallScore`), so **every issued passport shows ten identical domain scores**. `evidence` and `last_assessed_at` are never written.

### `resources` — `supabase-additions.sql:65-79`

`id`; `title` TEXT NOT NULL; `description`; `resource_type` TEXT NOT NULL CHECK `IN ('Template','Example','Reading','Tool','Video','Guide','AI Prompt')`; **`pathway` CHECK `IN ('PM','BA','Both','Career')`** default `'Both'`; `week_number` INTEGER; `assignment_context`; `external_url`; `example_url`; `is_featured` BOOLEAN default FALSE; `is_active` BOOLEAN default TRUE; `tags` TEXT; `created_at`.

**R-1 — the resource save path writes five columns the schema does not have.** `app/api/admin/data/route.ts:385-401` writes `content_level`, `link_type`, `notion_url`, `youtube_url` — none present in any SQL file — plus **`duration_mins`**, where `lib/types.ts:161` calls the field `duration_minutes` and the SQL has neither. And `lib/types.ts:9-22` defines 13 `ResourceType` values against the schema's 7 (`Session Material`, `Recording`, `Slides`, `Worksheet`, `Case Study`, `Framework` are extra), while `lib/types.ts:24-30` defines a `ContentLevel` union for a column that does not exist. Against the schema as written, **saving any resource fails.** Since `/admin/resources` is 567 lines of working-looking UI built entirely around those fields, the production table has almost certainly been altered by hand in the Supabase dashboard and no file records it. See Section 9, Q1.

### `notifications` — `supabase-additions.sql:82-91`

`id`; `learner_id` FK CASCADE; `type` TEXT NOT NULL CHECK `IN ('feedback_ready','resubmission_required','assignment_due','session_reminder','passport_approved','announcement','inactivity_nudge')`; `title`, `message` TEXT NOT NULL; `is_read` BOOLEAN default FALSE; `related_assignment_id` UUID (**no FK — a dangling reference by design**); `created_at`.

### `ai_practice_attempts` — `supabase-additions.sql:94-108`

`id`; `learner_id` FK CASCADE; `practice_type` TEXT NOT NULL CHECK `IN ('Stakeholder Sim','Interview Coach','Writing Checker','Assignment Review','Portfolio Coach','Capstone Coach')`; `character_id`, `question_id`, `document_type`, `transcript` TEXT; `score` NUMERIC(5,2); `feedback`, `capability_areas` TEXT; `duration_seconds` INTEGER; `completed` BOOLEAN default FALSE; `created_at`.

**AI-1 — this table is read-only. Nothing ever inserts into it.** The single reference in the entire codebase is a SELECT at `app/portal/passport/page.tsx:50`. The three AI routes (`interview`, `simulation`, `writing-check`) generate output and return it to the browser without persisting anything. So every AI practice session is lost on page reload; the "AI Practice Contributions" card at `app/portal/passport/page.tsx:235-253` never renders; the `AI-enabled Professional Practice` capability area it claims to feed (`:250`) has no data source; and there is **no record anywhere of what a learner practised.** Learner-side history exists only in React state (`app/portal/interview/page.tsx:27`, `app/portal/writing-check/page.tsx:18`).

### `passports` — `passports.sql:7-28`

| Column | Type | Null | Default |
|---|---|---|---|
| `id` | uuid | NO | `gen_random_uuid()` |
| `passport_id` | text | NO | — (UNIQUE) |
| **`learner_id`** | **bigint** | NO | — |
| `full_name`, `country` | text | YES | — |
| `pathway` | text | NO | — (comment: `'Product Management' \| 'Business Analysis'`) |
| `track` | text | NO | — (comment: `'PM' \| 'BA'`) |
| `cohort` | text | NO | — |
| `overall_score` | numeric | NO | — |
| `rating`, `readiness_level` | text | YES | — |
| `capability_breakdown` | jsonb | YES | `'[]'::jsonb` |
| `evidence` | jsonb | YES | `'[]'::jsonb` |
| `portfolio_url`, `facilitator_note` | text | YES | — |
| `issued_at` | date | NO | `current_date` |
| `signature` | text | NO | — |
| `status` | text | NO | `'issued'` — **no CHECK constraint** despite the comment listing three values |
| `revoked_at` | timestamptz | YES | — |
| `created_at` | timestamptz | NO | `now()` |

Indexes `:31-34`; partial unique index `uniq_passport_issued_per_learner` on `(learner_id) WHERE status='issued'` (`:54-56`).

**PP-1 — `passports.learner_id` is `bigint`; `learners.id` is `uuid`.** The comment on `passports.sql:12` even says "FK → learners.id (match your type)" — the match was never made, and no FK constraint was declared. `app/api/passport-issue/route.ts:157,177` passes the UUID string straight into that column. Against the schema as written, **every passport insert fails on type coercion.** It also breaks the signature: `canonicalString` includes `String(p.learner_id)` (`lib/passport.ts:98`), so if the DB ever did coerce the value, the round-tripped form would differ from the signed form and verification would fail.

**PP-2 — the passport issuer selects columns that do not exist on `assignments`.** `app/api/passport-issue/route.ts:123` requests `title, score, status, reviewer, reviewed_by, submitted_at, week_number`. `assignments` has no `title`, no `reviewer`, no `reviewed_by` (it has `feedback_by`). The result's error is not checked (`:121` destructures only `data`), so `assignmentRows` is null and the fallback at `:126` yields `evidence: []`. **Every issued passport carries an empty Evidence Portfolio**, and the verify page's Evidence section is conditional on `evidence.length > 0` (`app/verify/[passportId]/page.tsx:182`), so it silently does not render.

### `sessions` — **NO DDL EXISTS**

Read at `app/api/admin/data/route.ts:490` and `app/portal/sessions/page.tsx:34`; written at `:262` (update) and `:271` (insert); deleted at `:285`. Columns referenced: `id`, `title`, `week_number`, `session_date`, `start_time`, `zoom_link`, `description`, `recording_url`. **No `CREATE TABLE sessions` appears in any file in the repo.** The entire Live Sessions feature — one learner page (216 lines) and one admin CRUD page (208 lines) — sits on an undocumented table.

### Supabase Storage — **NO CONFIG EXISTS**

`app/admin/resources/page.tsx:145` uploads to `db.storage.from('content')` and `:150` calls `getPublicUrl`. No bucket definition, no policy, no config file anywhere in the repo. The upload uses the **anon** client (`:76`). Files are made publicly readable by URL. The 10 MB cap is enforced client-side only (`:140`).

## RLS policies, per table

Read from `supabase-schema.sql:205-220`, `supabase-additions.sql:156-188,211-219`, `passports.sql:49`.

| Table | RLS | Policies | Effect for a browser (anon-key) client |
|---|---|---|---|
| `learners` | **ENABLED** (`schema:205`) | **NONE** | No SELECT, INSERT, UPDATE or DELETE possible |
| `assignments` | **ENABLED** (`schema:206`) | **NONE** | Totally inaccessible |
| `attendance` | **ENABLED** (`schema:207`) | **NONE** | Totally inaccessible |
| `portfolio_items` | **ENABLED** (`schema:210`) | **NONE** | Totally inaccessible |
| `weeks` | ENABLED (`schema:212`) | `weeks_select_published` SELECT `USING (is_published = TRUE)` (`:215`) | Published weeks readable; **drafts invisible** |
| `announcements` | ENABLED (`schema:211`) | `announcements_select_all` SELECT `USING (is_published = TRUE)` (`:217`) | Published readable |
| `community_posts` | ENABLED (`schema:208`) | `community_posts_select_all` SELECT `USING (TRUE)` (`:219`) | **All posts readable by any holder of the anon key** |
| `community_replies` | ENABLED (`schema:209`, `additions:211`) | `select_all USING (TRUE)` ×2 (duplicate → error); `insert_own` (`additions:216`) | Read-all; insert gated on a JWT claim that is never set |
| `capability_scores` | ENABLED (`additions:156`) | `capability_select_own` (`:175`) — JWT-claim based | **Never matches — see RLS-1** |
| `resources` | ENABLED (`additions:157`) | `resources_read_all` SELECT `USING (is_active = TRUE)` (`:162`) | Active resources readable |
| `notifications` | ENABLED (`additions:158`) | `notifications_select_own` (`:165`), `notifications_update_own` (`:169`) — JWT-claim based | **Never match — see RLS-1** |
| `ai_practice_attempts` | ENABLED (`additions:159`) | `ai_practice_select_own` (`:181`), `ai_practice_insert_own` (`:185`) — JWT-claim based | Never match |
| `passports` | ENABLED (`passports.sql:49`) | **NONE, deliberately** (`:51` "Intentionally no anon/select policy") | Server-only. **This one is correct and well-reasoned** |
| `sessions` | **UNKNOWN** — no DDL | — | Cannot be determined from the repo |

**No table has RLS disabled.** Four tables (`learners`, `assignments`, `attendance`, `portfolio_items`) have RLS enabled with zero policies — a hard deny for anything but the service role.

**RLS-1 — the six "own row" policies can never match, because no Clerk→Supabase JWT bridge exists.** All of them resolve the caller via:

```sql
current_setting('request.jwt.claims', true)::json->>'sub'
```

(`supabase-additions.sql:167`, `:171`, `:177`, `:183`, `:187`, `:218`). That claim is populated only when the client sends a Supabase-verifiable JWT. `lib/supabase.ts:9-13` creates the browser client with the bare anon key — no `accessToken` callback, no `global.headers.Authorization`, no Clerk third-party-auth integration, and no such wiring anywhere else in the repo. So `request.jwt.claims` is null, the subselect returns NULL, and every one of those policies evaluates to NULL → deny.

**RLS-2 — the practical consequence: browser-side Supabase calls in 14 files cannot succeed.** `lib/supabase.ts:9` `createBrowserClient()` is used in 14 files. Against the RLS above:

| Call site | Table | Op | Observable behaviour |
|---|---|---|---|
| `components/Sidebar.tsx:55-59` | `notifications` | SELECT count | Unread badge is **permanently 0** |
| `app/portal/notifications/page.tsx:52` | `learners` | SELECT | `learner` null → renders empty state |
| `app/portal/notifications/page.tsx:55-59` | `notifications` | SELECT | List **always empty** |
| `app/portal/notifications/page.tsx:67`, `:74` | `notifications` | UPDATE | Mark-read is local-state only; **no error handling** — lost on reload |
| `app/portal/profile/page.tsx:39` | `learners` | SELECT | Form loads blank; header shows `undefined Pathway` (`:118`) |
| `app/portal/portfolio/page.tsx:64,68-69,83,95,111` | `learners`, `portfolio_items`, `assignments` | SELECT | Page reads nothing; writes go via the API then re-read via anon → list never refreshes |
| `app/portal/community/page.tsx:37` | `learners` | SELECT | Posting blocked at `:69`'s learner check |
| `app/portal/community/page.tsx:38,50,98-99` | `community_posts`, `community_replies` | SELECT | **These work** — `USING (TRUE)` |
| `app/portal/resources/page.tsx:210` | `learners` | SELECT | Pathway filter falls back to `'PM'` (`:223`) |
| `app/portal/resources/page.tsx:211` | `resources` | SELECT | **Works** — `is_active = TRUE` |
| `app/portal/onboarding/page.tsx:61,97,110,137` | `learners` | SELECT/UPDATE | See O-1 |
| `app/portal/interview/page.tsx:34`, `simulation:37`, `writing-check:24` | `learners` | SELECT | Pathway unknown → coerced to PM |
| `app/admin/content/page.tsx:44` | `weeks` | SELECT | **Admin cannot see unpublished weeks** — the policy is `is_published = TRUE`, and editing drafts is this page's entire job |
| `app/admin/learners/add/page.tsx:41`, `:78` | `learners`, `capability_scores` | INSERT | **Add Learner cannot work** |
| `app/admin/learners/[learnerId]/ClerkLinkForm.tsx:16` | `learners` | UPDATE | **Manual account linking cannot work** — and this is the documented fallback for the broken webhook (W-1) |
| `app/admin/resources/page.tsx:145,150` | Storage `content` | upload | Depends on bucket policy, undocumented |

The architecture the code *describes* is correct and is stated in three separate docblocks — `app/api/admin/data/route.ts:4-6` ("Every write (and RLS-sensitive read) routes through here so the browser anon client is never blocked by row-level security"), `app/api/complete-onboarding/route.ts:5`, `app/portal/assignments/page.tsx:5`. **The migration to that architecture was left half-finished.** Server components and API routes use `createAdminClient()`; fourteen client components were never converted.

**O-1 — onboarding works only by accident.** `app/portal/onboarding/page.tsx:96-133` implements a three-attempt cascade: update by `learners.id` → on failure update by `clerk_user_id` → on failure POST `/api/complete-onboarding`. Attempts 1 and 2 use the anon client and cannot succeed. Attempt 3 uses the service role and does. So the flow completes, always via the fallback, after two guaranteed-failed round-trips that log warnings (`:109`, `:122`). Note the ordering bug: attempt 3 only runs if `learner?.id` was truthy (`:96`); if the initial anon SELECT at `:61` returned nothing — which it also cannot succeed at — the code takes the `else` branch at `:134` and tries attempt 2 only, with no API fallback. A learner whose record exists but was unreadable gets stuck.

## Enums and check constraints, verbatim

There are **no Postgres `ENUM` types**. Every enumeration is a `TEXT` column with an inline `CHECK`, plus a parallel TypeScript union that does not always agree.

```sql
-- supabase-schema.sql
:14   pathway TEXT CHECK (pathway IN ('PM','BA','Design','Undecided')) DEFAULT 'Undecided'
:15   tier TEXT CHECK (tier IN ('Standard','Premium','VIP','Corporate')) DEFAULT 'Standard'
:17   enrollment_status TEXT CHECK (enrollment_status IN ('Pending','Active','Completed','Withdrawn')) DEFAULT 'Pending'
:21   risk_status TEXT CHECK (risk_status IN ('Green','Amber','Red')) DEFAULT 'Green'
:22   passport_eligibility TEXT CHECK (passport_eligibility IN ('Not Eligible','Pending Review','Approved','Withheld','Needs Revision')) DEFAULT 'Not Eligible'
:25   portfolio_status TEXT CHECK (portfolio_status IN ('Not Started','Drafting','Submitted','Reviewed','Ready')) DEFAULT 'Not Started'
:26   capstone_status TEXT CHECK (capstone_status IN ('Not Started','In Progress','Submitted','Presented','Approved')) DEFAULT 'Not Started'
:38   phase TEXT CHECK (phase IN ('Foundation','Core Skills','Delivery','Capstone'))
:69   pathway TEXT CHECK (pathway IN ('PM','BA')) NOT NULL
:73   status TEXT CHECK (status IN ('Not Started','In Progress','Submitted','In Review','Needs Revision','Approved','Portfolio Ready')) DEFAULT 'Not Started'
:99   category TEXT CHECK (category IN ('Question','Win','Portfolio Review','General')) DEFAULT 'General'
:101  pathway_tag TEXT CHECK (pathway_tag IN ('PM','BA','Both'))
:130  status TEXT CHECK (status IN ('Draft','Submitted','Approved','Featured')) DEFAULT 'Draft'
:140  priority TEXT CHECK (priority IN ('Normal','Important','Urgent')) DEFAULT 'Normal'
:141  target_pathway TEXT CHECK (target_pathway IN ('PM','BA','Both','All')) DEFAULT 'All'

-- supabase-additions.sql
:15   work_preference TEXT CHECK (work_preference IN ('Remote','Hybrid','Onsite','Flexible'))
:16   availability TEXT CHECK (availability IN ('Internship','Project Placement','Full-time','Freelance','Not Available'))
:25   ai_quality_rating TEXT CHECK (ai_quality_rating IN ('Needs Work','Developing','Good','Portfolio Ready'))
:36   arrival TEXT CHECK (arrival IN ('On Time','Late','Absent','Excused')) DEFAULT 'Absent'
:55   level TEXT CHECK (level IN ('Not Started','Emerging','Developing','Competent','Portfolio Ready')) DEFAULT 'Not Started'
:69   resource_type TEXT CHECK (resource_type IN ('Template','Example','Reading','Tool','Video','Guide','AI Prompt')) NOT NULL
:70   pathway TEXT CHECK (pathway IN ('PM','BA','Both','Career')) DEFAULT 'Both'
:85   type TEXT CHECK (type IN ('feedback_ready','resubmission_required','assignment_due','session_reminder','passport_approved','announcement','inactivity_nudge')) NOT NULL
:97   practice_type TEXT CHECK (practice_type IN ('Stakeholder Sim','Interview Coach','Writing Checker','Assignment Review','Portfolio Coach','Capstone Coach')) NOT NULL
```

`passports.sql` declares **no CHECK constraints at all** — `status`, `pathway` and `track` are unconstrained text with the intended values written only as SQL comments (`:13`, `:14`, `:17`, `:18`, `:24`).

## Pathway representation

**A pathway is not a table, not an enum, and not one thing.** It has six mutually incompatible representations:

| # | Representation | Definition | File |
|---|---|---|---|
| 1 | TEXT column + CHECK, 4 values | `pathway TEXT CHECK (pathway IN ('PM','BA','Design','Undecided')) DEFAULT 'Undecided'` | `supabase-schema.sql:14` |
| 2 | TEXT column + CHECK, **2 values** | `pathway TEXT CHECK (pathway IN ('PM','BA')) NOT NULL` | `supabase-schema.sql:69` (`assignments`) |
| 3 | TEXT column + CHECK, 4 different values | `pathway TEXT CHECK (pathway IN ('PM','BA','Both','Career')) DEFAULT 'Both'` | `supabase-additions.sql:70` (`resources`) |
| 4 | TEXT column + CHECK, 4 other values | `target_pathway TEXT CHECK (target_pathway IN ('PM','BA','Both','All')) DEFAULT 'All'` | `supabase-schema.sql:141` (`announcements`) |
| 5 | TS union, short codes | `export type Pathway = 'PM' \| 'BA' \| 'Design' \| 'Undecided';` | **`lib/types.ts:1`** |
| 6 | TS union, **long names** | `export type Pathway = 'Product Management' \| 'Business Analysis';` | **`lib/passport.ts:37`** |

Two exported types share the name `Pathway` with disjoint value sets. The passport subsystem bridges them by regex — `/business/i.test(pathway) ? 'BA' : 'PM'` (`lib/passport.ts:40`, `:145`; `app/api/passport-issue/route.ts:141`) — so **any pathway whose name does not contain "business" is silently classified as Product Management.** "Product Design", "Payment Operations" and "AI Product Builder" would all become PM passports with PM capability domains. "BA for AI & Automation" would become BA. The 5-week intensives would be indistinguishable from the 12-week tracks on the credential.

Column names are the deeper problem: twelve `pm_*` / `ba_*` columns on `weeks`, plus a `pathway` discriminator on `assignments` restricted to exactly two values.

There is **no representation of programme length anywhere in the schema.** No `programmes` table, no `weeks_total`, no `programme_id`. Length exists only as the literal `12`/`13` in code and as the row count in `weeks`.

## The hardcoding sweep

Every location where a programme identifier or a programme length is baked into logic, types, routing, copy, or a database default. Ordered by revamp blast radius. "Breaks under" refers to targets **A** (six programmes), **B** (Lab surface), **C** (visual rebuild), **D** (per-cohort facts).

### Tier 1 — schema and shared types (changing these forces changes everywhere else)

| # | File:line | What is hardcoded | Kind | Breaks under |
|---|---|---|---|---|
| H-1 | `supabase-schema.sql:49-58` | `pm_assignment_title`, `pm_assignment_brief`, `pm_deliverable`, `pm_rubric`, `pm_due_date`, `ba_assignment_title`, `ba_assignment_brief`, `ba_deliverable`, `ba_rubric`, `ba_due_date` — **pathway encoded in ten column names** | DB schema | **A** |
| H-2 | `supabase-additions.sql:44-45` | `pm_rubric_json`, `ba_rubric_json` — two more | DB schema | **A** |
| H-3 | `supabase-schema.sql:69` | `assignments.pathway CHECK IN ('PM','BA')` — a third pathway cannot be inserted | DB constraint | **A**, **B** |
| H-4 | `supabase-schema.sql:14` | `learners.pathway CHECK IN ('PM','BA','Design','Undecided')` | DB constraint | **A** |
| H-5 | `supabase-additions.sql:70` | `resources.pathway CHECK IN ('PM','BA','Both','Career')` | DB constraint | **A** |
| H-6 | `supabase-schema.sql:141` | `announcements.target_pathway CHECK IN ('PM','BA','Both','All')` | DB constraint | **A** |
| H-7 | `supabase-schema.sql:101` | `community_posts.pathway_tag CHECK IN ('PM','BA','Both')` | DB constraint | **A** |
| H-8 | `supabase-schema.sql:16` | `learners.cohort TEXT DEFAULT 'Cohort 1'` | DB default | **D** |
| H-9 | `lib/types.ts:1` | `export type Pathway = 'PM' \| 'BA' \| 'Design' \| 'Undecided'` | TS type | **A** |
| H-10 | `lib/types.ts:113` | `Assignment.pathway: 'PM' \| 'BA'` | TS type | **A**, **B** |
| H-11 | `lib/types.ts:240` | `Announcement.target_pathway: 'PM' \| 'BA' \| 'Both' \| 'All'` | TS type | **A** |
| H-12 | `lib/passport.ts:37` | `export type Pathway = 'Product Management' \| 'Business Analysis'` — **a second, conflicting `Pathway`** | TS type | **A** |
| H-13 | `lib/passport.ts:10-21` | `PM_DOMAINS` — 10 capability domains, PM only | Logic/data | **A** |
| H-14 | `lib/passport.ts:23-35` | `BA_DOMAINS` — 11 capability domains, BA only | Logic/data | **A** |
| H-15 | `lib/passport.ts:40` | `domainsFor()`: `/business/i.test(pathway) ? BA_DOMAINS : PM_DOMAINS` — **everything non-BA gets PM domains** | Logic | **A** |
| H-16 | `lib/passport.ts:145` | `buildPassportId()`: `const track = /business/i.test(opts.pathway) ? 'BA' : 'PM'` — canonical IDs can only ever say PM or BA | Logic / ID format | **A** |
| H-17 | `lib/types.ts:312` | `PROGRAM.totalWeeks: 13` | Config | **A**, **D** |
| H-18 | `lib/types.ts:305-318` | `PROGRAM` block: `cohort: 'Cohort 1'`, `start: '2026-06-06'`, `end: '2026-08-29'`, `demoDay: '2026-08-30'`, `enrollmentClose: '2026-06-03'`, `name: 'Career Capability Accelerator'` | Config | **D** |
| H-19 | `lib/types.ts:320-334` | `WEEK_DATES` — 13 hardcoded session dates, weeks 0–12, ending `'Sat Aug 30 — DEMO DAY'` | Config | **A**, **D** |
| H-20 | `lib/types.ts:255-266` | `CAPABILITY_AREAS` — 10 areas, PM/BA-shaped (includes "Business Analysis" as an area) | Config | **A** |

### Tier 2 — programme length in logic

| # | File:line | What is hardcoded | Kind | Breaks under |
|---|---|---|---|---|
| H-21 | `app/portal/layout.tsx:66-71` | `getCurrentWeek()`: `new Date('2026-06-06')`, `Math.min(..., 12)` | Logic | **A**, **D** |
| H-22 | `app/admin/layout.tsx:32-40` | `getCurrentWeek()` — **duplicate 2**, different arithmetic, same literals | Logic | **A**, **D** |
| H-23 | `app/portal/page.tsx:23-27` | `getCurrentWeek()` — **duplicate 3** | Logic | **A**, **D** |
| H-24 | `app/admin/page.tsx:328-330` | `getCurrentWeek()` — **duplicate 4** | Logic | **A**, **D** |
| H-25 | `app/portal/week/page.tsx:56-59` | `getCurrentWeek()` — **duplicate 5** | Logic | **A**, **D** |
| H-26 | `app/portal/sessions/page.tsx:9-13` | `getCurrentWeek()` — **duplicate 6**, returns `-1` before start where the other seven return `0` | Logic | **A**, **D** |
| H-27 | `app/portal/resources/page.tsx:45-48` | `getCurrentWeek()` — **duplicate 7** | Logic | **A**, **D** |
| H-28 | `app/admin/attendance/page.tsx:9-11` | `getCurrentWeek()` — **duplicate 8** | Logic | **A**, **D** |
| H-29 | `app/api/weeks/[week]/route.ts:18` | `weekNumber < 0 \|\| weekNumber > 12` — the API rejects week 13+ | Routing/validation | **A** |
| H-30 | `app/portal/week/[weekNum]/page.tsx:14` | `weekNumber < 0 \|\| weekNumber > 12` → `notFound()` | Routing | **A** |
| H-31 | `app/portal/week/[weekNum]/page.tsx:307` | `weekNumber < 12 &&` gates the "next week" nav link | Logic | **A** |
| H-32 | `app/portal/passport/page.tsx:60` | `const totalExpected = 13` | Logic | **A** |
| H-33 | `app/api/passport-pdf/route.ts:439` | `<span class="stat-value">12</span>` / `Weeks Completed` — **the literal 12 is printed on the credential** | Copy on credential | **A** |
| H-34 | `app/api/passport-pdf/route.ts:463` | `Capstone Defence — Week 12 Assessment` | Copy on credential | **A** |
| H-35 | `app/portal/page.tsx:171` | `${submittedCount}/${currentWeek + 1}` — denominator assumes weeks 0..N | Logic | **A** |
| H-36 | `app/admin/page.tsx:51` | `expectedSubmissions = active.length * (currentWeek + 1)` | Logic | **A** |
| H-37 | `app/admin/page.tsx:210` | `(submitted / (currentWeek + 1)) * 100` | Logic | **A** |
| H-38 | `app/api/admin/data/route.ts:321` | `const sessionsHeld = Math.max(weekNumber + 1, 1)` — attendance-% denominator | Logic | **A** |
| H-39 | `app/api/admin/data/route.ts:343` | `const sessionsHeld = Math.max(weekNumber + 1, 1)` — **duplicate** in the bulk path | Logic | **A** |
| H-40 | `app/portal/sessions/page.tsx:15-23` | `isSessionPast()` — **a second full table of 13 hardcoded session dates**, duplicating `WEEK_DATES` | Logic | **A**, **D** |

### Tier 3 — pathway branching in application logic

Each of these is an `if PM else BA` fork that silently routes any third pathway into one of the two.

| # | File:line | What is hardcoded | Kind | Breaks under |
|---|---|---|---|---|
| H-41 | `app/portal/page.tsx:75` | `pathway === 'PM' \|\| === 'BA' ? pathway : 'PM'` — **coerces to PM** | Logic | **A** |
| H-42 | `app/portal/page.tsx:218` | `pathway === 'PM' ? pm_assignment_title : ba_assignment_title` | Logic | **A** |
| H-43 | `app/portal/week/[weekNum]/page.tsx:42` | `pathway === 'BA' ? 'BA' : 'PM'` — **coerces to PM** | Logic | **A** |
| H-44 | `app/portal/week/[weekNum]/page.tsx:56-59` | 4 ternaries selecting `pm_*` vs `ba_*` title / brief / deliverable / due date | Logic | **A** |
| H-45 | `app/portal/assignments/page.tsx:126` | `pathway === 'BA' ? 'BA' : 'PM'` | Logic | **A** |
| H-46 | `app/portal/assignments/page.tsx:224-227` | 4 ternaries selecting `pm_*` vs `ba_*` | Logic | **A** |
| H-47 | `app/portal/assignments/page.tsx:107` | `if (learner.pathway !== 'PM' && learner.pathway !== 'BA')` → blocking gate. **The one honest handling in the codebase** — it refuses rather than guessing | Logic | **A** |
| H-48 | `app/portal/sessions/page.tsx:124-126` | `pathway = learner?.pathway \|\| 'PM'`; 2 `pm_*`/`ba_*` ternaries | Logic | **A** |
| H-49 | `app/portal/portfolio/page.tsx:117-118` | `pathway === 'BA' ? 'BA' : 'PM'`; picks one of two artefact lists | Logic | **A** |
| H-50 | `app/portal/portfolio/page.tsx:11-23` | `REQUIRED_ARTEFACTS_PM` — **12 hardcoded artefacts, weeks 1–12**, incl. the capstone name `'Sendr'` | Logic/data | **A**, **B** |
| H-51 | `app/portal/portfolio/page.tsx:25-38` | `REQUIRED_ARTEFACTS_BA` — 12 hardcoded artefacts, weeks 1–12, incl. `'Onbara Bank'` | Logic/data | **A**, **B** |
| H-52 | `app/portal/profile/page.tsx:103-104` | `pathway = learner?.pathway \|\| 'PM'`; `pathway === 'PM' ? PREFERRED_ROLES_PM : PREFERRED_ROLES_BA` | Logic | **A** |
| H-53 | `app/portal/profile/page.tsx:8-9` | `PREFERRED_ROLES_PM` / `PREFERRED_ROLES_BA` — 6 roles each, PM/BA only | Data | **A** |
| H-54 | `app/portal/resources/page.tsx:223` | `pathway = learner?.pathway \|\| 'PM'` | Logic | **A** |
| H-55 | `app/portal/simulation/page.tsx:135` | `pathway = learner?.pathway \|\| 'PM'` | Logic | **A** |
| H-56 | `app/portal/interview/page.tsx:66-68` | `id.startsWith('ba-') ? 'BA' : startsWith('pm-') ? 'PM' : (learner.pathway === 'BA' ? 'BA' : 'PM')` — pathway derived from a question-ID prefix | Logic | **A** |
| H-57 | `app/portal/interview/page.tsx:106` | `pathway === 'BA' ? 'BA' : === 'PM' ? 'PM' : null` | Logic | **A** |
| H-58 | `app/portal/writing-check/page.tsx:37` | `pathway: learner?.pathway === 'BA' ? 'BA' : 'PM'` | Logic | **A** |
| H-59 | `app/portal/onboarding/page.tsx:157-158` | `pathway: 'PM' \| 'BA' \| null` derived by ternary | Logic | **A** |
| H-60 | `app/api/interview/route.ts:172` | `QUESTION_BANKS[pathway === 'PM' ? 'PM' : 'BA']` — **anything not "PM" gets BA questions** | Logic | **A** |
| H-61 | `app/api/interview/route.ts:256,259` | `searchParams.get('pathway') \|\| 'PM'`; same coercion | Logic | **A** |
| H-62 | `app/api/interview/route.ts:7-155` | `QUESTION_BANKS` — **148 lines of question bank keyed literally `PM:` and `BA:`**, 9 PM + 9 BA questions | Logic/data | **A** |
| H-63 | `app/api/submissions/route.ts:31` | `pathway \|\| learner.pathway \|\| 'PM'` — **defaults a submission's pathway to PM** | Logic | **A** |
| H-64 | `app/api/weeks/[week]/route.ts:48` | `.eq('pathway', learner.pathway \|\| 'PM')` | Query | **A** |
| H-65 | `app/api/admin/data/route.ts:71` | `if (fields.pathway === 'PM' \|\| fields.pathway === 'BA')` — **an admin cannot set any other pathway** | Logic/allowlist | **A** |
| H-66 | `app/api/passport-issue/route.ts:103` | `learner.pathway \|\| learner.track \|\| 'Product Management'` | Logic | **A** |
| H-67 | `app/api/passport-issue/route.ts:141` | `const track = /business/i.test(pathway) ? 'BA' : 'PM'` | Logic / ID | **A** |
| H-68 | `app/api/passport-pdf/route.ts:21-35` | `learner.pathway === 'PM' ? [6 PM capability labels] : [6 BA labels]` — **a third capability taxonomy**, with scores computed as `avg_score` × fudge factors (1.05, 0.98, 1.02, 0.95, 1.0, 0.97) | Logic/data | **A** |
| H-69 | `app/api/passport-pdf/route.ts:412` | `pathway === 'PM' ? 'Product Management' : 'Business Analysis'` printed on the credential | Copy on credential | **A** |
| H-70 | `app/api/passport-pdf/route.ts:465` | Fallback capstone note: 4 nested PM/BA ternaries writing paragraphs of pathway-specific prose onto the credential | Copy on credential | **A** |
| H-71 | `app/api/simulation/route.ts:29,88,147,207,273` | `pathway: 'Both'` ×4, `pathway: 'PM'` ×1 (`amara`) — character eligibility | Data | **A** |
| H-72 | `app/api/ai-feedback/route.ts:92` | `"The learner is studying Product Management or Business Analysis."` in the default system prompt | Prompt copy | **A** |
| H-73 | `app/api/ai-feedback/route.ts:9-112` | `FEEDBACK_PROMPTS` keyed `'Product Teardown'`, `'Problem Brief'`, `'PRD'`, `'BRD'` — PM/BA deliverables only | Logic/data | **A**, **B** |
| H-74 | `app/api/submit-assignment/route.ts:15-142` | `FEEDBACK_PROMPTS` — **a near-duplicate of the above** plus `'Stakeholder'`; same PM/BA deliverable keys | Logic/data | **A**, **B** |
| H-75 | `app/api/writing-check/route.ts:56` | `Pathway: ${pathway \|\| 'PM/BA'}` in the user message | Prompt copy | **A** |
| H-76 | `app/portal/passport/page.tsx:9-20` | `CAPABILITY_ASSIGNMENT_MAP` — 10 areas mapped to hardcoded `'Week 1 Teardown'`, `'Week 4 PRD/BRD'`, `'Week 12 Capstone'` etc. | Logic/data | **A**, **B** |
| H-77 | `app/admin/reviews/page.tsx:85` | `pathway === 'PM' ? pm_rubric : ba_rubric` | Logic | **A** |
| H-78 | `app/admin/reviews/page.tsx:202` | `pathway === 'PM' ? (...) : (...)` in the review pane | Logic | **A** |
| H-79 | `app/admin/content/page.tsx:163-164` | Completeness badges hardcoded `label: 'PM'`, `label: 'BA'` | UI | **A** |
| H-80 | `app/admin/learners/page.tsx:19-20` | `pm = active.filter(l => l.pathway === 'PM').length`; same for `ba` | Logic | **A** |
| H-81 | `app/admin/learners/page.tsx:75` | Badge colour: `pathway === 'PM' ? navy : amber` — **a two-value colour scheme** | UI | **A** |
| H-82 | `app/admin/page.tsx:196` | Same two-colour pathway badge | UI | **A** |
| H-83 | `app/admin/attendance/page.tsx:216` | Same two-colour pathway badge | UI | **A** |
| H-84 | `app/admin/cohort/page.tsx:258-259` | `<option value="PM">` / `<option value="BA">` announcement targeting | UI | **A** |
| H-85 | `app/admin/cohort/page.tsx:379-380` | `<option value="pm">` / `<option value="ba">` — **lowercase here, uppercase 120 lines earlier in the same file** | UI | **A** |
| H-86 | `app/admin/resources/page.tsx:505-506` | `<option value="PM">PM only` / `<option value="BA">BA only` | UI | **A** |
| H-87 | `app/admin/learners/add/page.tsx:154-155` | `<option value="PM">Product Management (PM)` / `<option value="BA">Business Analysis (BA)` — **the only two pathways a learner can be enrolled on** | UI | **A** |
| H-88 | `app/admin/learners/[learnerId]/PathwayEditor.tsx:48-49` | Same two options — the only way to correct a pathway | UI | **A** |
| H-89 | `app/admin/learners/add/page.tsx:39` | `passport_id = \`UP-C1-${rand4}-${form.pathway}\`` — **cohort number and pathway baked into the ID at creation** | ID format | **A**, **D** |
| H-90 | `supabase-additions.sql:192` | `SET passport_id = 'UP-C1-' \|\| LPAD(...) \|\| '-' \|\| COALESCE(pathway,'PM')` — same format, in SQL | DB data | **A**, **D** |
| H-91 | `lib/passport.ts:138-147` | `buildPassportId` produces `UPT-<PM\|BA>-C<n>-<year>-<seq>` — **a third, incompatible ID format** | ID format | **A**, **D** |
| H-92 | `supabase-additions.sql:111-127` | Capability-framework seed: 10 areas cross-joined onto `WHERE l.enrollment_status = 'Active'` | DB seed | **A** |
| H-93 | `supabase-additions.sql:130-153` | 21 seeded resources, each tagged `'PM'`/`'BA'`/`'Both'` with hardcoded `week1`..`week12` tags | DB seed | **A**, **D** |
| H-94 | `lib/types.ts:257` | `'Business Analysis'` as a *capability area* name — collides conceptually with the pathway of the same name | Data | **A** |
| H-95 | `app/admin/learners/add/page.tsx:10-15` | `CAPABILITY_AREAS` — a **local copy** duplicating `lib/types.ts:255-266`, including `'Business Analysis'` | Data | **A** |
| H-96 | `passports.sql:13-14` | `pathway text not null, -- 'Product Management' \| 'Business Analysis'` and `track text not null, -- 'PM' \| 'BA'` — the two-pathway assumption written into the credential table's own documentation | DB schema/docs | **A** |

### Tier 4 — cohort and date copy

| # | File:line | What is hardcoded | Kind | Breaks under |
|---|---|---|---|---|
| H-97 | `app/layout.tsx:9` | `title: 'Upthrust Portal — Cohort 1'` — the browser tab | Copy | **D** |
| H-98 | `app/layout.tsx:10` | `description: 'The Upthrust Career Capability Accelerator learner portal.'` | Copy | **A**, **D** |
| H-99 | `components/Sidebar.tsx:148` | `Week {currentWeek} · Cohort 1` | Copy | **D** |
| H-100 | `components/Sidebar.tsx:208` | `Cohort 1` in the user footer | Copy | **D** |
| H-101 | `app/auth/sign-in/page.tsx:13` | `Cohort 1 · Career Capability Accelerator` | Copy | **A**, **D** |
| H-102 | `app/portal/page.tsx:126` | `Week {currentWeek} of 12` | Copy | **A**, **D** |
| H-103 | `app/portal/page.tsx:87` | `'Program starts June 6'` | Copy | **D** |
| H-104 | `app/portal/page.tsx:236` | `'Program starts June 6, 2026'` | Copy | **D** |
| H-105 | `app/admin/page.tsx:68` | `Cohort 1 — Command Centre` | Copy | **D** |
| H-106 | `app/admin/page.tsx:70` | `Week {currentWeek} of 12` | Copy | **A**, **D** |
| H-107 | `app/admin/learners/page.tsx:27` | `All Learners — Cohort 1` | Copy | **D** |
| H-108 | `app/admin/learners/add/page.tsx:49` | `cohort: 'Cohort 1'` **written into every manually created learner row** | Data write | **D** |
| H-109 | `app/admin/learners/add/page.tsx:98` | `Add Learner to Cohort 1` | Copy | **D** |
| H-110 | `app/api/webhook/clerk/route.ts:126` | `cohort: 'Cohort 1'` **written into every webhook-created learner** | Data write | **D** |
| H-111 | `app/api/passport-issue/route.ts:135` | `const cohort = learner.cohort \|\| 'Cohort 1'` | Logic | **D** |
| H-112 | `app/api/notify/route.ts:113` | `Cohort 1 · Upthrust Career Capability Accelerator` in **every email footer** | Copy | **A**, **D** |
| H-113 | `app/api/notify/route.ts:87` | `Career Capability Accelerator` in every email header | Copy | **A**, **D** |
| H-114 | `app/portal/onboarding/page.tsx:11` | `'Your 12-week journey starts here'` | Copy | **A** |
| H-115 | `app/portal/onboarding/page.tsx:197` | `Welcome to Cohort 1` | Copy | **D** |
| H-116 | `app/portal/onboarding/page.tsx:202` | `'Over the next 12 weeks you will produce real product work...'` | Copy | **A** |
| H-117 | `app/portal/onboarding/page.tsx:208-213` | Cohort facts table: `'Cohort 1 · 2026'`, `'Saturday June 6, 2026'`, `'Friday August 29, 2026'`, `'Saturday August 30, 2026'`, `'Every Saturday'` | Copy | **D** |
| H-118 | `app/portal/onboarding/page.tsx:313` | `'Your Week 12 capstone is the evidence that underpins your Passport.'` | Copy | **A** |
| H-119 | `app/portal/community/page.tsx:133` | `Cohort 1` section eyebrow | Copy | **D** |
| H-120 | `app/portal/profile/page.tsx:242` | `'After Cohort 1 Demo Day, Upthrust will open an employer portal...'` | Copy | **D** |
| H-121 | `app/portal/passport/page.tsx:66` | `detail: 'Week 12 Demo Day'` | Copy | **A**, **D** |
| H-122 | `app/portal/passport/page.tsx:103` | `'Genesis reviews and issues after Demo Day (Aug 30).'` | Copy | **D** |
| H-123 | `app/portal/sessions/page.tsx:74` | `Every Saturday · June 6 – August 30, 2026 · 10:00 AM WAT / 9:00 AM BST` | Copy | **D** |
| H-124 | `app/portal/sessions/page.tsx:110` | `'Zoom link coming soon — Genesis will add it before June 6.'` | Copy | **D** |
| H-125 | `app/portal/week/[weekNum]/page.tsx:256` | `10:00 WAT / 9:00 BST` — session time, **not read from the DB** despite `sessions.start_time` existing | Copy | **D** |
| H-126 | `app/portal/assignments/page.tsx:210` | `'Week 0 assignments will appear here on June 6. Check back then.'` | Copy | **D** |
| H-127 | `app/portal/assignments/page.tsx:165` | `'Genesis reviews within 48 hours.'` — an SLA stated in copy | Copy | — |
| H-128 | `app/portal/assignments/page.tsx:176`, `app/api/notify/route.ts:184` | `'resubmit within 72 hours'` | Copy | — |
| H-129 | `app/api/passport-pdf/route.ts:477` | `Verify at: upthrustdigital.com/verify/${passport_id \|\| 'UP-C1-XXXX'}` | Copy/URL | **D** |
| H-130 | `app/api/passport-pdf/route.ts:468` | `'Facilitator sign-off · Genesis Nneji Enwenyeokwu · CBAP · Product Lead, Rova'` | Copy | — |
| H-131 | `app/verify/[passportId]/page.tsx:197` | Default facilitator note naming `'Upthrust Career Capability Accelerator'` | Copy | **A** |
| H-132 | `app/verify/[passportId]/page.tsx:200` | `'Genesis Nneji Enwenyeokwu · Founder & Lead Facilitator, Upthrust'` | Copy | — |
| H-133 | `app/api/admin/data/route.ts:136,156` | `author_name: 'Genesis (Upthrust)'` for admin posts | Copy | — |
| H-134 | `app/api/admin/data/route.ts:232` | `feedback_by: 'Genesis'` — **a person's name written into every graded row** | Data write | — |
| H-135 | `app/portal/layout.tsx:46`, `app/admin/layout.tsx:21` | `'Genesis (Admin)'` display name | Copy | — |
| H-136 | `app/api/notify/route.ts:170,182` | `'Genesis has reviewed your...'` in email bodies | Copy | — |
| H-137 | `app/api/passport-issue/route.ts:131` | `reviewer: ... \|\| 'Mentor Panel'` fallback | Copy | — |
| H-138 | `supabase-schema.sql:150-201` | Week seed: 13 weeks of `'2026-06-06'`..`'2026-08-30'` dates and due dates | DB seed | **D** |
| H-139 | `supabase-schema.sql:153` | `'...what do I want to build over 12 weeks?'` in seeded reflection copy | DB seed copy | **A** |
| H-140 | `supabase-weeks-seed.sql:4-5,17` | `'Seeds all 13 weeks (W0–W12)'` and `-- Upsert all 13 weeks` | DB seed | **A** |
| H-141 | `supabase-weeks-seed.sql:26-154` | 13 week rows with hardcoded 2026 session dates and due dates | DB seed | **D** |
| H-142 | `app/portal/week/[weekNum]/page.tsx:291` | `Find templates, examples, and tools for Week {weekNumber}` → links `?week=N` | Copy/routing | **A** |

**Count: 142 distinct locations.** 96 encode a pathway identifier; 40 encode programme length or the 13-week calendar; 46 encode cohort/date facts (categories overlap). **Not one of them reads from a shared source that could be changed in a single place** — `WEEK_DATES` and `PROGRAM` in `lib/types.ts` come closest, but the eight `getCurrentWeek()` copies, the second date table in `app/portal/sessions/page.tsx:15-23`, and every `> 12` bound bypass them.

## Where cohort/date/status truth lives

**Five sources. They disagree.**

| Source | What it claims | File |
|---|---|---|
| 1. `lib/types.ts` `PROGRAM` + `WEEK_DATES` | 13 weeks; start `2026-06-06`; end `2026-08-29`; demo day `2026-08-30`; week 1 session `Sat June 14` | `lib/types.ts:305-334` |
| 2. `supabase-schema.sql` week seed | Week 1 titled **`'Digital Product Foundations'`**; week 1 `pm_due_date` **`2026-06-20`**; per-week `start_date`/`end_date`; all weeks except 0 `is_published = FALSE` | `supabase-schema.sql:147-202` |
| 3. `supabase-weeks-seed.sql` | Week 1 titled **`'The Role of PM/BA — What Does Great Look Like?'`**; week 1 `pm_due_date` **`2026-06-18`**; **all 13 weeks `is_published = true`**; upserts with `ON CONFLICT DO UPDATE` so it **overwrites** source 2 | `supabase-weeks-seed.sql:26-171` |
| 4. `app/portal/sessions/page.tsx` `isSessionPast()` | A second inline map of all 13 session dates | `app/portal/sessions/page.tsx:15-23` |
| 5. Eight copies of `getCurrentWeek()` | `2026-06-06` start, cap 12 — seven return `0` before start, one returns `-1` | H-21..H-28 |

**Concrete disagreements:**

- **Week titles.** Source 2 week 1 = "Digital Product Foundations"; source 3 week 1 = "The Role of PM/BA — What Does Great Look Like?". Source 2 week 5 = "Journey, Workflow & Process Design"; source 3 week 5 = "User Research — Talking to Users" (comment `supabase-weeks-seed.sql:76`). Whichever SQL ran last wins, and source 3's `ON CONFLICT DO UPDATE SET title = EXCLUDED.title` (`supabase-weeks-seed.sql:157`) guarantees it clobbers source 2.
- **Due dates.** Week 0: source 2 = `2026-06-06`, source 3 = `2026-06-10`. Week 1: source 2 = `2026-06-20`, source 3 = `2026-06-18`. Week 12: source 2 = `2026-08-29`, source 3 = `2026-08-28`.
- **Publication.** Source 2 publishes only week 0. Source 3 publishes **all thirteen** (`supabase-weeks-seed.sql:34,44,54,64,74,84,94,104,114,124,134,144,154`) and its `ON CONFLICT` clause includes `is_published = EXCLUDED.is_published` (`:171`). So **re-running the content seed unlocks the entire curriculum**, silently reversing every manual unpublish an admin made via `/admin/content`.
- **Week count.** `PROGRAM.totalWeeks = 13` (H-17) and `totalExpected = 13` (H-32) count weeks 0–12 inclusive; 40 other sites cap or label at `12`. Both are "right" about a 13-row table describing a 12-week programme, which is exactly why the off-by-one shows up in `submittedCount/(currentWeek+1)` (H-35) and `expectedSubmissions` (H-36).
- **Session start time** is `10:00 WAT / 9:00 BST` in two places in code (H-123, H-125) and in **no** database column, though `sessions.start_time` is written by the admin session editor (`app/api/admin/data/route.ts:264`) and never read back into the week view.
- **A sixth de facto source** is the `weeks` table itself — the only one the runtime reads for content. But the calendar arithmetic (`getCurrentWeek`), every week dropdown (`WEEK_DATES`), and the "is this session past" check all bypass it.

## Seed and fixture data

| Seed | Contents | Reachable in production? |
|---|---|---|
| `supabase-schema.sql:147-202` | 13 `weeks` rows: titles, phases, dates, PM/BA assignment titles, due dates, reflection prompts. `ON CONFLICT (week_number) DO NOTHING` | **Yes** — it is the primary curriculum; runs on schema creation |
| `supabase-weeks-seed.sql:18-171` | 13 `weeks` rows with full briefs, `why_it_matters`, `pre_work`, `outcomes`, deliverables. `ON CONFLICT DO UPDATE` | **Yes, and destructively** — overwrites titles, dates and `is_published` on every run |
| `supabase-weeks-seed.sql:174-185` | 12 `UPDATE weeks SET reflection_prompt` statements, weeks 1–12 | Yes |
| `supabase-additions.sql:111-127` | `capability_scores` cross-join seed, 10 areas × learners `WHERE enrollment_status = 'Active'` | Yes. **Skips `Pending` learners** — the very status the webhook assigns (`app/api/webhook/clerk/route.ts:127`), so webhook-created learners get no capability rows at all |
| `supabase-additions.sql:130-153` | **21 `resources` rows, 12 of them with `external_url = '#'`** | **Yes — this is live placeholder data.** Twelve templates that learners can click and that go nowhere. `app/portal/resources/page.tsx` renders them like any other resource |
| `supabase-additions.sql:191-193` | `UPDATE learners SET passport_id = 'UP-C1-' \|\| random 4 digits \|\| '-' \|\| pathway WHERE passport_id IS NULL` | **Yes.** Assigns a **randomly numbered, non-canonical** passport ID to every learner. Collisions are possible — `passport_id` has no unique index |

There are **no test fixtures.** No seed is marked dev-only, none is gated by an environment check, and all four SQL files carry "run this in the Supabase SQL Editor" instructions aimed at production.

---

# 3. Auth, roles and permissions

## Clerk configuration

| Aspect | Implementation | Evidence |
|---|---|---|
| Provider | `<ClerkProvider>` wraps the whole app | `app/layout.tsx:15-19` |
| Sign-in | Clerk's prebuilt `<SignIn routing="hash" />` | `app/auth/sign-in/page.tsx:15` |
| Sign-up | Clerk's prebuilt `<SignUp routing="hash" />` | `app/auth/sign-up/page.tsx:15` |
| Sign-out | `<UserButton afterSignOutUrl="/auth/sign-in" />` | `components/Sidebar.tsx:203` |
| Redirect URLs | Env-driven: `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `..._SIGN_UP_URL`, `..._AFTER_SIGN_IN_URL`, `..._AFTER_SIGN_UP_URL` | `.env.local.example:4-7` — **read only by the Clerk SDK, never by app code** |
| Session claims | **None configured.** No `sessionClaims`, no custom JWT template, no `publicMetadata`/`privateMetadata` read anywhere | `grep sessionClaims\|publicMetadata\|privateMetadata` → 0 hits |
| Server-side identity | `const { userId } = await auth()` — the only identity primitive used, in 24 places | `app/api/**`, `app/portal/**`, `app/admin/**` |
| Client-side identity | `useUser()` from `@clerk/nextjs` | 9 client pages |
| Supabase integration | **NONE.** No Clerk third-party-auth setup, no JWT template, no `accessToken` callback on the Supabase client | `lib/supabase.ts:9-13`; see RLS-1 |
| Sign-up gating | **None.** `/auth/sign-up` is public and anyone with the URL can create a Clerk account | `middleware.ts:3`; `app/auth/sign-up/page.tsx` |

There is no email-domain allowlist, no invite code, no Clerk "restrictions" config in the repo. An uninvited person can register; they land on the "Access Pending" screen (`app/portal/layout.tsx:26-43`) and see nothing else, so the exposure is a junk row in `learners`, not data access.

### What happens on user creation

Intended flow — `app/api/webhook/clerk/route.ts:72-141`:

1. Clerk fires `user.created`. `verifyClerkWebhook` (`:22-59`) requires `svix-id`, `svix-timestamp`, `svix-signature` headers, else 401 (`:27-30`).
2. If `CLERK_WEBHOOK_SECRET` is set, verify via `svix` (`:46-58`). **If it is not set, verification is skipped and the raw body is parsed and trusted** (`:36-43`).
3. Look up `learners` by email, case-insensitively (`:83-87`).
4. If found and unlinked → set `clerk_user_id` (`:98-106`).
5. If found and linked to a different Clerk ID → log and skip (`:90-94`).
6. If not found → insert a new row with `pathway: null`, `enrollment_status: 'Pending'`, `cohort: 'Cohort 1'`, `onboarding_complete: false` (`:119-137`).

The `pathway: null` decision at `:124` carries the comment *"assigned by admin — never assume PM"*. **That is the correct call and the only place in the codebase that makes it.** Every read site then re-introduces the guess it avoided (H-41 through H-64).

Three defects in this flow:

**W-1 (repeated from §1) — the webhook is unreachable.** Middleware exempts `/api/webhooks/*`; the handler is at `/api/webhook/clerk`. None of steps 1–6 ever run in production.

**W-3 — signature verification is optional and fails open.** `app/api/webhook/clerk/route.ts:36-43`: with no `CLERK_WEBHOOK_SECRET`, any request carrying three arbitrary `svix-*` header values is trusted and its body is used to create or re-link learner rows. `CLERK_WEBHOOK_SECRET` is **not present in `.env.local`** and **not documented in `.env.local.example`**, so the default posture is fail-open. Were W-1 fixed without also setting the secret, this becomes an unauthenticated write endpoint that can link any Clerk ID to any learner email — an account-takeover primitive. The two bugs currently mask each other.

**W-4 — the fail-open path returns the wrong shape.** `:39` does `return JSON.parse(body)`, but the caller destructures `{ event, data }` (`:68`). A Clerk payload has `type` and `data`, not `event`. So even on the fail-open path `event` is `undefined`, no branch matches, and the handler returns `Event undefined not handled` (`:161`). The verified path builds the object correctly (`:54`). So the dev-mode shortcut has never worked either.

**W-5 — `user.deleted` is not handled.** Only `user.created` and `user.updated` (`:72`, `:144`). Deleting a Clerk user orphans the learner row with a stale `clerk_user_id`.

## The complete role model

**There are exactly two roles, and one of them is a single person identified by one environment variable.**

| Role | How determined | Where stored |
|---|---|---|
| **Admin** | `userId === process.env.ADMIN_USER_ID` | A Vercel environment variable. Not in the database, not in Clerk metadata |
| **Learner** | Any authenticated Clerk user who is not the admin | Presence of a `learners` row keyed by `clerk_user_id` |

There is **no facilitator role, no mentor role, no reviewer role, no read-only role, and no multi-admin support.** `ADMIN_USER_ID` is a single scalar compared with `===` in eleven places (`app/admin/layout.tsx:14`, `app/admin/page.tsx:25`, `app/admin/learners/page.tsx:12`, `app/admin/learners/[learnerId]/page.tsx:14`, `app/portal/layout.tsx:13`, `app/portal/page.tsx:33`, `app/portal/week/[weekNum]/page.tsx:17`, `app/api/admin/data/route.ts:37`, `app/api/admin/save-week/route.ts:8`, `app/api/admin/publish-week/route.ts:8`, `app/api/notify/route.ts:128`, `app/api/passport-issue/route.ts:29`, `app/api/passport-pdf/route.ts:499`). Adding a second facilitator requires a code change, not a data change.

`learners.notes` and the `tier` column carry no authorisation meaning. `is_from_genesis` on posts and replies is a display flag derived from `isAdmin` at write time (`app/api/admin/data/route.ts:137`, `:157`), not a stored role.

### Admin — reachable routes and mutations

Routes: all of `/admin/*` (gated at `app/admin/layout.tsx:12-14`, redirect to `/portal` on failure), plus everything a learner can reach. `/portal` immediately redirects an admin to `/admin` (`app/portal/page.tsx:33-34`).

Mutations, with the enforcement point:

| Mutation | Enforced at | Layer |
|---|---|---|
| `admin_update_learner` (pathway, tier, enrollment_status) | `app/api/admin/data/route.ts:68` | **Route handler** |
| `post_announcement` (+ fan-out notifications) | `:178` | Route handler |
| `create_notifications` | `:213` | Route handler |
| `review_feedback` (status, score, feedback) | `:228` | Route handler |
| `save_session` / `delete_session` | `:255`, `:283` | Route handler |
| `mark_attendance` / `mark_all_attendance` / `update_attendance_note` | `:295`, `:332`, `:365` | Route handler |
| `save_resource` / `delete_resource` / `toggle_resource` | `:383`, `:414`, `:422` | Route handler |
| Save week content | `app/api/admin/save-week/route.ts:8` | Route handler |
| Publish/unpublish week | `app/api/admin/publish-week/route.ts:8` | Route handler |
| Send email / fan out reminders | `app/api/notify/route.ts:128`, `:260` | Route handler |
| Issue / re-issue / revoke passport | `app/api/passport-issue/route.ts:34` | Route handler |
| Generate any learner's passport HTML | `app/api/passport-pdf/route.ts:499,504` | Route handler |
| Read all learners / attendance / review queue / resources | `app/api/admin/data/route.ts:452,460,465,474,495` | Route handler |
| Insert learner + seed capability scores | `app/admin/learners/add/page.tsx:41,78` | **RLS only — and RLS denies it** (see AUTH-3) |
| Link a Clerk ID to a learner | `ClerkLinkForm.tsx:16` | **RLS only — and RLS denies it** (see AUTH-3) |
| Read draft (unpublished) weeks | `app/admin/content/page.tsx:44` | **RLS only — and RLS denies it** |
| Upload a file to Storage `content` | `app/admin/resources/page.tsx:145` | **Storage bucket policy — undocumented** |

### Learner — reachable routes and mutations

Routes: `/portal/*`. Gated by `middleware.ts` plus `app/portal/layout.tsx:10-11` (redirect if unauthenticated) and `:26-43` (Access Pending if no `learners` row). `/admin/*` redirects to `/portal` (`app/admin/layout.tsx:14`). `/portal` also force-redirects to `/portal/onboarding` until `onboarding_complete` is true (`app/portal/page.tsx:66`).

Mutations, with enforcement point:

| Mutation | Enforced at | Layer |
|---|---|---|
| Submit / resubmit an assignment | `app/api/submit-assignment/route.ts:152` then learner looked up by `clerk_user_id` (`:168`) | **Route handler — ownership derived from session, not from the request body.** Correct |
| Submit via the older endpoint | `app/api/submissions/route.ts:9`, learner from `clerk_user_id` (`:26`) | Route handler. Correct |
| Update own profile | `app/api/admin/data/route.ts:54-61` | **Route handler, but see AUTH-1** |
| Complete onboarding | `app/api/complete-onboarding/route.ts:15,28` | Route handler. Correct |
| Add / edit / delete own portfolio item | `:84`, `:102`, `:117` — edit and delete additionally `.eq('learner_id', learner.id)` (`:112`, `:121`) | **Route handler with ownership predicate.** Correct |
| Post to community | `:129` | Route handler; author derived from session (`:136`) |
| Reply to a post | `:148` | Route handler; author derived from session (`:156`) |
| **Like a post** | `:167-172` | **Signed-in only, no ownership, no bounds — see AUTH-2** |
| Mark a notification read | `app/portal/notifications/page.tsx:67,74` | **RLS only — and RLS denies it.** Local state only |
| Request AI feedback / interview eval / simulation / writing check | `ai-feedback:116`, `interview:167`, `simulation:329`, `writing-check:9` | Route handler — signed-in check only; **no rate limit, no quota, no per-learner accounting** |
| Download own passport HTML | `app/api/passport-pdf/route.ts:493,508,517` | Route handler with eligibility gate. **But see AUTH-4 for the tier gate** |

## Authorisation that is UI-only

Listed separately, as requested. Each is a control the interface enforces and the server does not.

**AUTH-4 — Premium-tier gate on passport download.** The "Download PDF" button renders only when `issued && isPremium` (`app/portal/passport/page.tsx:108`), and the page shows "Capability Passport requires Premium tier" to everyone else (`:117-124`). The server-side check at `app/api/passport-pdf/route.ts:517` is:

```ts
if (!isAdmin && learner.passport_eligibility !== 'Approved' && !learner.passport_issued)
```

**`tier` is never consulted.** Any Standard-tier learner whose passport is issued or approved can fetch `/api/passport-pdf` directly and receive the full credential HTML. The tier distinction the pricing model rests on exists only in JSX.

**AUTH-5 — Pathway restriction to PM/BA in the admin editor.** `PathwayEditor.tsx:46-50` offers only two `<option>`s and `:23` refuses an empty value. The server allowlist at `app/api/admin/data/route.ts:71` independently restricts to `'PM'`/`'BA'`, so this one *is* enforced server-side. Recorded here because the two lists are separate literals that must be changed together — a UI-only appearance with a real server twin.

**AUTH-6 — `is_pinned` on community posts.** The column exists and the UI sorts by it (`app/portal/community/page.tsx:38`) and renders a pinned treatment. **No route can set it** — `community_post` hardcodes `is_pinned: false` (`app/api/admin/data/route.ts:142`). Not an authorisation hole; a control surface that does not exist.

**AUTH-7 — every client-side admin page relies solely on the layout.** `/admin/reviews`, `/admin/attendance`, `/admin/sessions`, `/admin/content`, `/admin/resources`, `/admin/cohort`, `/admin/learners/add` are `'use client'` components with no auth check of their own. This is **acceptable** because `app/admin/layout.tsx:12-14` runs server-side before them and every mutation they issue is re-checked in `/api/admin/data`. Recorded so a reviewer does not mistake the pattern for a hole. The one real consequence: a non-admin who somehow rendered those pages would see empty data (the GET resources 403) rather than a redirect.

### And the inverse — authorisation that is stronger than the UI suggests

Worth keeping, and worth knowing before the rebuild:

- **Ownership is always derived from the Clerk session, never from the request body.** Every learner-scoped action in `/api/admin/data` calls `getLearner(db, userId)` (`:31-34`) and uses `learner.id`; no endpoint accepts a `learnerId` from a learner. `portfolio_edit`/`portfolio_delete` add a defence-in-depth `.eq('learner_id', learner.id)` predicate (`:112`, `:121`).
- **`isAdmin()` fails closed** if `ADMIN_USER_ID` is unset (`:37`).
- **Passport issuance has a hard data-quality gate no override can bypass** (`app/api/passport-issue/route.ts:85-97`): even an explicitly `Approved` learner cannot be issued a passport with zero graded assignments. That is a deliberate, well-commented integrity control.
- **`passports` RLS is correct**: enabled with no policies, all access through the server, explicitly to prevent anon-key enumeration (`passports.sql:44-51`).

### And two genuine server-side gaps

**AUTH-1 — `update_profile` is an unbounded mass-assignment endpoint (privilege escalation).** `app/api/admin/data/route.ts:54-61`:

```ts
case 'update_profile': {
  const learner = await getLearner(db, userId);
  if (!learner) return NextResponse.json({ error: 'Learner not found' }, { status: 404 });
  const { fields } = body;
  const { error } = await db.from('learners').update(fields).eq('id', learner.id);
```

`fields` is taken from the request body and spread into an `.update()` on the **service-role** client with no allowlist. The UI sends 13 benign profile fields (`app/portal/profile/page.tsx:64-78`), but any signed-in learner can POST any column on their own row. Reachable columns include `avg_score`, `attendance_pct`, `assignment_completion_pct`, `passport_eligibility`, `passport_issued`, `passport_id`, `enrollment_status`, `tier`, `risk_status`, `pathway`, `capstone_status`. A learner can set `passport_eligibility: 'Approved'`, `avg_score: 95`, `tier: 'Premium'` in one request. Combined with AUTH-4, that is a self-service route to a downloadable credential. The passport *issuance* route still blocks them at the graded-work gate (`passport-issue:93`) — but `passport-pdf` does not, and `passport-pdf` is what produces the artefact a learner would show someone. Contrast with `admin_update_learner` twelve lines below (`:70-75`), which builds an explicit `allowed` object — the correct pattern was written, in the same file, and not applied here.

**AUTH-2 — `community_like` accepts an arbitrary count from any signed-in user.** `app/api/admin/data/route.ts:167-172`:

```ts
case 'community_like': {
  const { postId, newCount } = body;
  const { error } = await db.from('community_posts').update({ likes_count: newCount }).eq('id', postId);
```

No admin check, no ownership check, no per-user like ledger, no bounds check, and the client computes the new total (`app/portal/community/page.tsx:105-112`). Any learner can set any post's like count to any value, including negative. Cosmetic, but it is an unauthenticated-in-spirit write to a shared row.

**AUTH-3 — three admin capabilities are enforced by RLS alone, and RLS denies them.** Add Learner (`app/admin/learners/add/page.tsx:41,78`), Clerk account linking (`ClerkLinkForm.tsx:16`) and draft-week reading (`app/admin/content/page.tsx:44`) go through the anon client. Against the schema in the repo these are not "weakly authorised" — they are non-functional. See RLS-2.

## How a learner is bound to a cohort and a pathway, end to end

**Cohort** — three write paths, all writing the same literal:

1. Webhook creation → `cohort: 'Cohort 1'` (`app/api/webhook/clerk/route.ts:126`).
2. Manual creation → `cohort: 'Cohort 1'` (`app/admin/learners/add/page.tsx:49`).
3. Neither path → column default `'Cohort 1'` (`supabase-schema.sql:16`).

Nothing in the UI can change a learner's cohort. `admin_update_learner` accepts only `pathway`, `tier`, `enrollment_status` (`app/api/admin/data/route.ts:71-73`). The cohort is read back in exactly three places: the profile header (`app/portal/profile/page.tsx:118`), the passport snapshot (`app/api/passport-issue/route.ts:135`), and the passport ID sequence query (`:146`). **A second cohort cannot be created through the product.**

**Pathway** — the intended chain:

1. Admin creates the learner with an explicit `pathway` — the form refuses to submit without it (`app/admin/learners/add/page.tsx:32-35`) and offers only PM or BA (`:154-155`). *This write path is blocked by RLS (AUTH-3).*
2. Or the webhook creates the learner with `pathway: null` and a comment refusing to guess (`app/api/webhook/clerk/route.ts:124`). *This path never fires (W-1).*
3. Or the column default applies: `'Undecided'` (`supabase-schema.sql:14`).
4. Admin corrects it later via `PathwayEditor` → `admin_update_learner` → allowlisted to `'PM'`/`'BA'` (`app/api/admin/data/route.ts:71`). **This is the only pathway write that actually works.**
5. Every read site then does its own thing. `app/portal/assignments/page.tsx:107-124` blocks with an explanatory screen — correct. The other twenty-odd sites coerce: `|| 'PM'` (H-48, H-52, H-54, H-55, H-63, H-64), `=== 'BA' ? 'BA' : 'PM'` (H-43, H-45, H-49, H-58), or `=== 'PM' ? 'PM' : 'BA'` (H-60).
6. `assignments.pathway` is then written per-submission from whatever the page computed (`app/api/submit-assignment/route.ts:215`) and constrained to `('PM','BA')` by the DB (H-3).

**The practical consequence:** because paths 1 and 2 are both broken, a learner's realistic starting state is `pathway = 'Undecided'` (or `NULL`) with `enrollment_status = 'Pending'`. In that state `/portal/assignments` correctly shows "Your pathway isn't set yet", and every other pathway-aware surface — dashboard, week detail, portfolio, profile, resources, interview coach, writing checker — **silently shows them Product Management content.** A BA learner who has not been manually corrected sees PM briefs, PM due dates, PM portfolio requirements and PM interview questions, with no indication anything is wrong.

There is no cohort↔pathway relationship in the data model at all: no join table, no per-cohort pathway list, no notion that a cohort might offer a subset of programmes.

---

# 4. Feature inventory

## Onboarding / enrolment — `PARTIAL` (both halves present; the enrolment half is blocked)

| | |
|---|---|
| **Entry** | `/auth/sign-up` → `/portal` → forced redirect to `/portal/onboarding` (`app/portal/page.tsx:66`) |
| **Tables** | `learners` |
| **Files** | `app/portal/onboarding/page.tsx` (364), `app/api/complete-onboarding/route.ts` (63), `app/api/webhook/clerk/route.ts` (162), `app/admin/learners/add/page.tsx` (198), `app/admin/learners/[learnerId]/ClerkLinkForm.tsx` (42), `app/admin/learners/[learnerId]/PathwayEditor.tsx` (65) |
| **State** | Learner-facing 5-step wizard: **IMPLEMENTED**, via the third fallback. Admin-facing enrolment: **PARTIAL — the UI exists, the write is blocked** |

Known-broken:
- **W-1** — Clerk webhook unreachable; no automatic account linking.
- **AUTH-3** — Add Learner (`add/page.tsx:41`) and Clerk linking (`ClerkLinkForm.tsx:16`) use the anon client against RLS-denied tables.
- **O-1** — the onboarding save cascade's first two attempts always fail; the API fallback is unreachable when the initial read fails.
- `app/portal/onboarding/page.tsx:19` — the `CheckItem` "Get set up" checklist holds tick state in local `useState`, persisted nowhere. Reload loses it.
- `:52`, `:69`, `:151` — a `debugInfo` state variable surfaces raw Clerk IDs and error strings into the learner-facing UI.
- The wizard collects 5 fields (`:54-56`) while `/portal/profile` collects 13. `career_goal` is collected in both.

## Curriculum and weekly content delivery — `IMPLEMENTED` (with content-truth drift)

| | |
|---|---|
| **Entry** | `/portal/week`, `/portal/week/[weekNum]`, `/api/weeks/[week]` |
| **Tables** | `weeks` |
| **Files** | `app/portal/week/page.tsx` (60), `app/portal/week/[weekNum]/page.tsx` (318), `app/api/weeks/[week]/route.ts` (54), `app/admin/content/page.tsx` (288), `app/api/admin/save-week/route.ts` (18), `app/api/admin/publish-week/route.ts` (17) |
| **State** | Learner delivery: **IMPLEMENTED** and the best-built read surface in the app. Admin editing: **PARTIAL — cannot see drafts** |

Known-broken:
- `app/admin/content/page.tsx:44` reads `weeks` via the anon client; the RLS policy is `is_published = TRUE`, so **the week editor cannot load unpublished weeks** — which is the only kind worth editing.
- Re-running `supabase-weeks-seed.sql` republishes all 13 weeks (`:171`), reverting manual unpublishes.
- `app/api/admin/save-week/route.ts:12,15` spreads an unvalidated `fields` object into `.update()` on the service-role client — an admin-only but unbounded column write.
- H-29/H-30 cap weeks at 12.
- `app/portal/week/[weekNum]/page.tsx:51` fetches the week's assignment with `.maybeSingle()` and **no pathway filter**, while `assignments` is unique on `(learner_id, week_number, pathway)`. A learner with both a PM and a BA row for one week gets a multiple-rows error.

## Labs, exercises, activities — `STUBBED`. **No dataset-backed exercise surface exists.**

| | |
|---|---|
| **Entry** | None of its own. A read-only paragraph inside `/portal/week/[weekNum]` |
| **Tables** | `weeks.lab_exercise` (single TEXT column, `supabase-schema.sql:46`) |
| **Files** | `app/portal/week/[weekNum]/page.tsx:149-158` — renders `lab_exercise` as a `whiteSpace: pre-wrap` paragraph under the heading "🔬 Practical Lab" |
| **State** | **STUBBED** |

This is the clearest gap against revamp target **B**, so stated plainly:

- `weeks.lab_exercise` is never populated by any seed. `supabase-schema.sql:44-46` declares it; the INSERT at `:147-148` does not list it; `supabase-weeks-seed.sql:18-25` does not list it. It is NULL for all 13 weeks, so the "Practical Lab" card never renders.
- There is **no dataset entity of any kind** — no table, no column, no file, no Storage path holding tabular practice data. Searched for `dataset`, `sheet`, `tab`, `csv`, `xlsx`, `workbook`: the only hits are the file-upload `accept` attribute at `app/admin/resources/page.tsx:477` (`.xls,.xlsx` among 8 extensions) and a `'Google Sheet'` string inside seeded assignment-brief prose.
- There is **no scoping mechanism**. Nothing in the schema can express "learner on pathway X in week N may read data tabs 3, 7 and 12". `resources.week_number` + `resources.pathway` is the closest existing construct, and it points at a URL, not at data.
- There is **no timeboxing**. No `duration_minutes`, `time_limit`, `started_at`, `expires_at` on any assignment-like table. `ai_practice_attempts.duration_seconds` exists (`supabase-additions.sql:105`) and is never written (AI-1).
- There is **no Core/Advanced grading dimension**. `assignments` has one `score` and one `status`; no tier, band, variant or option column. The 64-assignment matrix (4 pathways × 8 weeks × 2 options) has no representation: `assignments` is unique on `(learner_id, week_number, pathway)`, so **a learner cannot have two options for the same week** — the uniqueness constraint forbids it.
- There is **no evidence-citation mechanism**. `submission_url` (one text field) and `submission_notes` (one text field). Nothing links a submission to a data row, tab or cell.

What does exist and is genuinely reusable for B: the submission pipeline (`app/api/submit-assignment/route.ts`), the rubric columns (`pm_rubric`, `ba_rubric`, `pm_rubric_json`, `ba_rubric_json` — the `_json` pair is declared and **never read or written anywhere**), and the review queue UI.

## Submissions, uploads, file storage — `PARTIAL` (submissions work; there is no learner file upload)

| | |
|---|---|
| **Entry** | `/portal/assignments` → `AssignmentSubmitPanel` |
| **Tables** | `assignments` |
| **Files** | `app/portal/assignments/page.tsx` (371), `app/portal/assignments/AssignmentSubmitPanel.tsx` (242), `app/api/submit-assignment/route.ts` (288), `app/api/submissions/route.ts` (101) |
| **State** | URL submission: **IMPLEMENTED**. File upload: **does not exist for learners** |

- **Learners cannot upload a file.** There is exactly one `<input type="file">` in the codebase — `app/admin/resources/page.tsx:477`, admin-only. Every learner submission is a pasted URL, validated only by `new URL(val)` (`AssignmentSubmitPanel.tsx:39-41`), which accepts `javascript:` and `file:` schemes. Google Drive links are the assumed medium throughout the seeded briefs.
- **The only Storage usage is admin resource upload** (`app/admin/resources/page.tsx:145-150`), via the anon client, to an undocumented `content` bucket, made public by `getPublicUrl`.
- **`/api/submissions` is a duplicate of `/api/submit-assignment`** with different behaviour: it sets `status: 'Submitted'` without AI feedback, defaults pathway to `'PM'` (H-63), uses `.single()` where the newer route uses `.maybeSingle()`, and **has no caller anywhere in the app.** Dead route (§6).

Known-broken:
- **A-1** — `app/api/submit-assignment/route.ts:158`: `if (!weekNumber === undefined || !pathway || !submissionUrl)`. `!weekNumber` is a boolean and is never `=== undefined`, so that clause is always `false`. The `weekNumber` guard is a no-op; only `pathway` and `submissionUrl` are actually required. A submission with a missing or `NaN` week number reaches the database.
- **A-2** — the `status: 'AI Reviewed'` write at `:272-281` violates the DB CHECK and has no error handling, so generated AI feedback is silently discarded.
- `:184` reads `existing?.status === 'Resubmission Requested'` to detect a resubmission — a status the database cannot store (A-2), so `isResubmission` is always false and `resubmission_count` is always reset to `0` (`:185`, `:198`).

## Grading, scoring, feedback, revision loops — `PARTIAL`. **The revision loop is broken.**

| | |
|---|---|
| **Entry** | `/admin/reviews` |
| **Tables** | `assignments`, `notifications`, `weeks` (rubrics) |
| **Files** | `app/admin/reviews/page.tsx` (321), `app/api/admin/data/route.ts:227-249`, `app/api/ai-feedback/route.ts` (185), `app/api/notify/route.ts` (289) |
| **State** | Approve / score: **IMPLEMENTED**. Request-resubmission and save-draft: **broken by A-2**. Score aggregation: **does not exist** |

Known-broken:
- **A-2** — "Request Resubmission" writes `Resubmission Requested` and "Save Draft" writes `Human Reviewed`; neither is in the CHECK constraint. Both fail with a 500 and an `alert()`. **The revision loop cannot be initiated.** Every downstream feature that reads that status — the dashboard next-action (`app/portal/page.tsx:90-93`), the resubmission banner (`app/portal/assignments/page.tsx:170-179`), the resubmit button (`AssignmentSubmitPanel.tsx:36`), the review-queue filter (`app/admin/reviews/page.tsx:40`), the notification type selection (`app/api/admin/data/route.ts:240`) — is unreachable code.
- **G-1 — `learners.avg_score` is never recomputed.** It gates passport eligibility (`app/api/passport-issue/route.ts:73,76`), the dashboard's Average Score tile (`app/portal/page.tsx:172`), the passport criteria list (`app/portal/passport/page.tsx:65`) and the admin learner table (`app/admin/learners/page.tsx:93`). `review_feedback` writes `assignments.score` (`app/api/admin/data/route.ts:231`) and **never touches `learners.avg_score`.** Searched: no write to `avg_score` exists outside the `0` initialisers at learner creation. **Grading an assignment does not move the learner's average.** The same holds for `assignment_completion_pct` — read in four places, written nowhere. `attendance_pct` *is* correctly recomputed (`:326`, `:359`), which shows the intent existed and was applied to exactly one of the three metrics.
- **G-2 — `notify` receives no context for its templates.** `app/admin/reviews/page.tsx:62-70` posts `{ type, learnerId, assignmentId }`. Every affected template interpolates `weekNumber` and `pathway` (`app/api/notify/route.ts:167-173`, `:179-184`). Learners receive *"Feedback on your Week undefined assignment is ready"* with *"your undefined assignment for Week undefined"* in the body.
- `app/api/notify/route.ts:236` — the `assignment_due` notification type is declared in the union (`:16`) and in the DB CHECK (`supabase-additions.sql:85`) but has no `case`. It falls to `default` and returns 400. **STUBBED.**
- `/api/ai-feedback` (185 lines) has **no caller** — dead route (§6). Its behaviour also conflicts with `submit-assignment`: it writes `status: 'In Review'` (legal) where the other writes `'AI Reviewed'` (illegal).
- **G-3 — AI feedback is generated without the submission.** Both prompt sets tell the model it cannot see the work: *"Note: You cannot access the link directly, so evaluate based on the assignment context"* (`app/api/ai-feedback/route.ts:136`) and *"Since you cannot access the link, provide guidance based on what the assignment requires"* (`app/api/submit-assignment/route.ts:242`). The learner-facing label is "⚡ AI First-Pass Feedback" presented as review of their submission (`app/portal/assignments/page.tsx:295`, `app/portal/week/[weekNum]/page.tsx:208`). It is generic advice about the assignment type. Honest in the prompt, misleading in the UI.
- `score` has no server-side range validation; the `<input type="number" min="0" max="100">` (`app/admin/reviews/page.tsx:261`) is the only bound, and `parseFloat` (`:54`) accepts anything.

## Attendance — `IMPLEMENTED` (the strongest subsystem in the app)

| | |
|---|---|
| **Entry** | `/admin/attendance`; learner view in `/portal/sessions` |
| **Tables** | `attendance`, `learners.attendance_pct` |
| **Files** | `app/admin/attendance/page.tsx` (282), `app/api/admin/data/route.ts:294-376` |
| **State** | **IMPLEMENTED** |

Correctly built: all reads and writes route through `/api/admin/data` with the admin client; admin-gated at the handler (`:295`, `:332`, `:365`); required-field validation (`:297`, `:334`); manual upsert-by-lookup rather than a blind insert (`:310-318`); individual, bulk and note-only paths; `attendance_pct` recomputed after every write (`:326`, `:359`). This is what the rest of the app was supposed to look like.

Known issues:
- **AT-1 — the percentage denominator is wrong.** `const sessionsHeld = Math.max(weekNumber + 1, 1)` (`:321`, `:343`) assumes every week from 0 to the marked week has been held. Marking week 12 early sets the denominator to 13 for everyone, so a learner with 4 of 4 actual sessions attended reads 31%. It also uses the *marked* week rather than the *current* week, so marking an earlier week retroactively inflates every learner's percentage.
- `:344-360` loops per learner with 3 sequential queries each — 3N round-trips per bulk mark.
- `missed_session_task_sent` never written.
- `arrival: 'Excused'` is a legal DB value (`supabase-additions.sql:36`) but `attended` is computed as `arrival !== 'Absent'` (`:303`, `:348`), so an excused absence counts as attended.

## Capability Passport — `PARTIAL`. **Issuance has no UI; verification requires login; the QR is a placeholder.**

| | |
|---|---|
| **Entry** | Learner: `/portal/passport`. Public: `/verify/[passportId]`. Admin: **none** |
| **Tables** | `passports`, `learners` (mirror columns), `capability_scores`, `assignments` |
| **Files** | `lib/passport.ts` (148), `lib/qr.ts` (295), `app/api/passport-issue/route.ts` (212), `app/api/passport-pdf/route.ts` (533), `app/verify/[passportId]/page.tsx` (252), `app/portal/passport/page.tsx` (262), `components/PassportControls.tsx` (102), `passports.sql` (58), `app/api/passport-pdf/QR_PATCH.md` |
| **State** | **PARTIAL.** Signing logic: IMPLEMENTED and well built. Issuance: **no UI half.** Verification page: IMPLEMENTED but unreachable. QR: **STUBBED.** |

Sub-feature by sub-feature:

**Signing — `IMPLEMENTED`, and the best-written module in the repo.** `lib/passport.ts:79-121`: HMAC-SHA256 over a documented canonical field order (`:95-104`), `base64url` output, `crypto.timingSafeEqual` with a length pre-check (`:114-121`), secret read at call time and throwing if absent (`:79-83`), and a comment recording that the field order must never change once passports exist (`:85`). Correct.

**Issuance — `PARTIAL`: the route is complete, nothing calls it.** **PASS-1: `components/PassportControls.tsx` has zero import sites.** It is a complete, working admin control block — Issue / Re-issue / Preview / Public Verify / Revoke with confirm dialog — and it is never rendered. `app/admin/learners/[learnerId]/page.tsx` imports `ClerkLinkForm` and `PathwayEditor` (`:9-10`) and not `PassportControls`. `/api/passport-issue` therefore has **no caller in the application.** Passports can only be issued by hand-crafting a POST. That is why `/portal/passport` can promise a credential and no learner has one.

Also affecting issuance:
- **PP-1** — `learner_id` bigint vs uuid; every insert fails against the repo schema.
- **PP-2** — the evidence query selects non-existent columns; `evidence` is always `[]`.
- **C-1** — `capability_scores` is never updated, so `capability_breakdown` is ten copies of `avg_score`.
- **G-1** — `avg_score` is never recomputed, so the eligibility gate at `:76` reads a stale `0` and the hard gate at `:93` rejects everyone. **Against the code as written, no passport can be issued at all.**
- Three incompatible ID formats: `UP-C1-XXXX-PM` (H-89, H-90), `UPT-PM-C1-2026-001` (H-91), and the `'UP-C1-XXXX'` literal fallback printed on the PDF (H-129). `passport-issue:149-153` only treats an ID as canonical if it `startsWith('UPT-')`, so every learner created through the admin form or touched by the SQL backfill gets a fresh ID at issuance, invalidating any previously shared link.

**Public verification page — `IMPLEMENTED` but unreachable.** `app/verify/[passportId]/page.tsx` is well built: status checks before rendering (revoked / superseded / not-issued each get a distinct message, `:102-110`), a signature check driving a two-tier badge (`:123-125`, `:137-148`), and a deliberately honest "How to interpret this" panel that refuses to overclaim employer recognition (`:213-222`). Blocked by:
- **V-1** — not in `isPublicRoute`; requires Clerk sign-in.
- **PASS-2 — the `?sig` parameter is decorative.** `cryptoVerified = sigParamValid || storedSigValid` (`:125`), and `storedSigValid` verifies the row's stored signature against the same row's own fields — self-consistent by construction. So any row written by the issuer shows "Verified — cryptographically authenticated" whether or not a `sig` is supplied. The mechanism still detects DB tampering; it does **not** do what the fallback branch's own copy claims ("Open the original QR link for cryptographic verification", `:146`), because that branch is unreachable for a validly issued passport.
- `:129` — `new Date(p.issued_at).toLocaleDateString('en-GB', ...)` with no server locale pinned.

**QR — `STUBBED`.** `lib/qr.ts` is a complete 295-line dependency-free QR encoder (Reed-Solomon tables `:9-20`, all 8 mask patterns with penalty scoring `:260-266`, inline SVG with `role="img"` and an `aria-label` `:294`). **It has zero import sites.** The passport document renders instead:

```html
<div class="qr-placeholder">
  <span>QR<br/>CODE</span>
</div>
```

(`app/api/passport-pdf/route.ts:479-481`, styled `:333-347`). `app/api/passport-pdf/QR_PATCH.md` is a 55-line note-to-self describing exactly the three edits needed to wire it up — imports, signed-URL construction, and the HTML block. **The patch was written and never applied.** Meanwhile `/portal/passport:213` promises the learner a "QR code for employer verification".

**The PDF is not a PDF.** `/api/passport-pdf` returns `Content-Type: text/html` (`:530`) and relies on the browser's print dialog. And it does **not read the `passports` table at all** — it recomputes the credential from `learners` on every request, inventing per-domain scores as `avg_score` × 1.05 / 0.98 / 1.02 / 0.95 / 1.0 / 0.97 (H-68). So the immutable signed snapshot and the document handed to the learner are **two independent computations of different numbers**, over different capability taxonomies (6 labels here, 10–11 in `lib/passport.ts`, 10 in `lib/types.ts`).

**Learner-facing passport page — `IMPLEMENTED` as a status display.** `/portal/passport` correctly computes the 5 criteria and states its own guardrails honestly (`:225-231`: never issued from AI feedback alone, criteria are necessary not sufficient). Affected by C-1 (all areas "Not Started"), AI-1 (the AI-contributions card never renders), AUTH-4 (UI-only tier gate) and the QR/PDF promises above.

## Announcements / community — `PARTIAL`

| | |
|---|---|
| **Entry** | `/portal/community`; `/admin/cohort` for announcements |
| **Tables** | `community_posts`, `community_replies`, `announcements`, `notifications` |
| **Files** | `app/portal/community/page.tsx` (367), `app/admin/cohort/page.tsx` (399), `app/api/admin/data/route.ts:129-207` |
| **State** | Posting/replying: **IMPLEMENTED**. Reading own learner record: **blocked**. Announcements: **IMPLEMENTED**. Likes: **broken** |

- Posts and replies read fine via the anon client — `community_posts` and `community_replies` are the only two tables with `USING (TRUE)` SELECT policies. Note the flip side: **any holder of the anon key can read every community post and reply**, including a signed-out visitor with the publishable key from the JS bundle.
- Writes route correctly through `/api/admin/data`.
- **The learner lookup at `app/portal/community/page.tsx:37` is anon and fails**, so `learner` is null and the guard at `:69` blocks posting for everyone except the admin (who passes via `adminPost`).
- **AUTH-2** — likes are an unbounded write.
- `replies_count` is incremented by a read-then-write with no transaction (`app/api/admin/data/route.ts:162-163`) — lost updates under concurrency.
- `announcements` fan-out (`:190-205`) filters targets with `l.pathway === target`, correctly using `.neq('enrollment_status','Withdrawn')` at `:191`.
- `is_pinned` and `pathway_tag` and `week_tag` are never written (AUTH-6).

## AI features — `IMPLEMENTED` (all three), but nothing is persisted

Every Anthropic call site, with its model string:

| # | File:line | Feature | Model constant | Resolved model | max_tokens |
|---|---|---|---|---|---|
| 1 | `app/api/ai-feedback/route.ts:141-153` (`:149`) | Assignment feedback (**dead route**) | `MODEL_SONNET` | `claude-sonnet-4-6` | 600 |
| 2 | `app/api/submit-assignment/route.ts:244-257` (`:252`) | First-pass feedback on submit | `MODEL_HAIKU` | `claude-haiku-4-5-20251001` | 500 |
| 3 | `app/api/interview/route.ts:217-230` (`:226`) | Interview answer evaluation | `MODEL_SONNET` | `claude-sonnet-4-6` | 800 |
| 4 | `app/api/simulation/route.ts:343-359` (`:351`) | Stakeholder simulation debrief | `MODEL_SONNET` | `claude-sonnet-4-6` | 1000 |
| 5 | `app/api/simulation/route.ts:383-396` (`:391`) | Stakeholder simulation turn | `MODEL_SONNET` | `claude-sonnet-4-6` | 400 |
| 6 | `app/api/writing-check/route.ts:65-78` (`:73`) | Writing quality review | `MODEL_SONNET` | `claude-sonnet-4-6` | 700 |

Model strings are centralised in `lib/ai-models.ts:7,10` with a comment explaining why (`:1-3`) — **correct, and the fix for this was clearly learned the hard way** (commit `9f7d1dd` migrated off a retired model). All six sites import the constant; no route hardcodes a model string.

Every call is a raw `fetch` with `anthropic-version: '2023-06-01'` and `'x-api-key': process.env.ANTHROPIC_API_KEY!`. The `!` non-null assertion means a missing key sends the literal header `undefined` and the failure surfaces as a generic 502.

- **AI-1** — no attempt is ever persisted; `ai_practice_attempts` is write-never.
- No rate limiting, no per-learner quota, no cost accounting, no token-usage logging on any of the six.
- Simulation: 5 hardcoded characters (`app/api/simulation/route.ts:23,82,141,201,267`), well-written prompts with hidden agendas and pressure points. `messages` is passed to the model without shape validation (`:376-381`) — a client can send arbitrary conversation history including forged assistant turns.
- Interview: 18 hardcoded questions with model answers (H-62). Model answers are withheld from the list endpoint and released after submission (`:267-274`) — a deliberate, correct design choice.
- Writing check: `text.substring(0, 3000)` (`:60`) silently truncates without telling the learner.
- **`/api/writing-check` has no `try/catch` around its `fetch`** (`:65`) — a network error is an unhandled rejection, not a 502.
- **XSS-1** — all four AI-output render sites use `dangerouslySetInnerHTML` with only a `**bold**` → `<strong>` replacement and **no HTML escaping**: `app/portal/interview/page.tsx:304`, `app/portal/simulation/page.tsx:402`, `app/portal/writing-check/page.tsx:210`, `app/admin/reviews/page.tsx:231`. The writing-check path is the sharpest: a learner pastes text, the model quotes it back, and the quoted markup executes in their browser. The `/admin/reviews` path renders `ai_feedback` derived from learner-influenced input in the **admin's** session.

## Email (Resend) — `PARTIAL`

| | |
|---|---|
| **Entry** | `/api/notify` (POST and GET); triggered from `/admin/reviews` and `/admin/cohort` |
| **Files** | `app/api/notify/route.ts` (289) |
| **State** | 5 of 7 templates work; 1 is stubbed; the fan-out is unreliable |

| Template | Trigger | State |
|---|---|---|
| `feedback_ready` | `/admin/reviews` after Approve/Portfolio Ready (`app/admin/reviews/page.tsx:66`) | Works, **but G-2** → "Week undefined" |
| `resubmission_required` | `/admin/reviews` Request Resubmission (`:66`) | **Unreachable — A-2 fails the status write before the email is sent** |
| `passport_approved` | `/admin/cohort` (`app/admin/cohort/page.tsx:145-181`) | Works |
| `session_reminder` | `/admin/cohort` and `GET /api/notify?week=N` | Works; includes `NEXT_PUBLIC_ZOOM_LINK` if set (`:209`) |
| `inactivity_nudge` | `/admin/cohort` (`:167`) | Works |
| `announcement` | `post_announcement` → `/api/notify` (`app/admin/cohort/page.tsx:82`) | Works |
| **`assignment_due`** | — | **STUBBED** — declared in the type union (`:16`) and the DB CHECK, no `case`, falls to `default` → 400 (`:236`) |
| *direct email* | `/admin/cohort` custom email (`:105`) | Works. Admin can send to any address; `directEmail` is not validated as an email (`:139-147`) |

One template function, `emailTemplate()` (`:57-124`) — inline-styled HTML table, brand colours hardcoded as hex (not tokens), `Cohort 1 · Upthrust Career Capability Accelerator` in the footer (H-112). Sender is hardcoded `Upthrust <noreply@upthrustdigital.com>` (`:37`).

Known-broken:
- **N-1 — the fan-out endpoint uses the wrong learner filter and miscounts.** `GET /api/notify` selects with `.eq('enrollment_status', 'Active')` (`:274`). Webhook-created learners are `Pending` and the column default is `Pending`, so **the learners most likely to need a session reminder are the ones excluded.** This is the exact anti-pattern the codebase corrects elsewhere — `.neq('enrollment_status','Withdrawn')` is used correctly at `app/api/admin/data/route.ts:191`, `:338`, `:456`, `:468`. Two more instances of the wrong pattern: `app/admin/page.tsx:43` and `app/admin/learners/page.tsx:18` both filter `=== 'Active'`, so **the admin dashboard's "Active Learners" count and submission-rate denominator omit every Pending learner**, and `supabase-additions.sql:126` seeds capability scores only for Active learners.
- **N-2** — the fan-out self-calls its own POST endpoint N times, forwarding the admin's cookie (`:280-284`), and counts `results.filter(r => r.status === 'fulfilled')` (`:288`). `Promise.allSettled` fulfils on any HTTP response, so a run where all N calls return 500 reports `sent: N`.
- No unsubscribe link, no `List-Unsubscribe` header, no bounce or delivery handling. `sendEmail` swallows failures and returns `{sent:false, reason}` (`:44-54`); the POST handler returns that in the body but no caller inspects it (`app/admin/reviews/page.tsx:70` is `.catch(console.error)` on the fetch only).
- The in-portal notification insert is wrapped in `try { } catch { /* non-fatal */ }` with an empty body (`:243-252`) — a failed notification write is completely invisible.

## Admin / facilitator tooling — `PARTIAL`

| Page | Lines | State | Notes |
|---|---|---|---|
| `/admin` dashboard | 331 | **IMPLEMENTED** | Reads via admin client. Active-only filter (N-1) understates counts |
| `/admin/reviews` | 321 | **PARTIAL** | 2 of 4 actions work (A-2) |
| `/admin/attendance` | 282 | **IMPLEMENTED** | The best-built admin surface. AT-1 denominator bug |
| `/admin/sessions` | 208 | **IMPLEMENTED** | Correct routing through the API. Depends on the undocumented `sessions` table |
| `/admin/learners` | 112 | **IMPLEMENTED** | Read-only table |
| `/admin/learners/[id]` | 230 | **PARTIAL** | `PathwayEditor` works; `ClerkLinkForm` blocked (AUTH-3); `PassportControls` never rendered (PASS-1) |
| `/admin/learners/add` | 198 | **BROKEN** | Anon-client insert (AUTH-3) |
| `/admin/content` | 288 | **PARTIAL** | Save/publish work via the API; **cannot load drafts** (RLS-2) |
| `/admin/resources` | 567 | **PARTIAL** | Largest file in the app. Save path writes 5 non-existent columns (R-1); Storage upload undocumented |
| `/admin/cohort` | 399 | **IMPLEMENTED** | Announcements, bulk notifications, session reminders, custom email. No cohort *settings* despite the name — cannot change cohort name, dates or week count |

No facilitator role, no audit log of admin actions, no bulk import, no CSV export anywhere in the codebase.

## Analytics or event tracking — `does not exist`

Searched for `gtag`, `analytics`, `posthog`, `mixpanel`, `segment`, `@vercel/analytics`, `plausible`, `track(`: **zero hits** across `app`, `components`, `lib`. There is no product analytics, no error reporting (no Sentry), no structured logging, and no `<Script>` tag anywhere. The only observability is `console.log` / `console.error` (31 sites), visible in Vercel function logs and nowhere else. There is no way to answer "how many learners opened week 4" from this system.

---

# 5. Design system and UI layer

## Is there a token layer?

Yes — **two of them, defining the same values twice, in two syntaxes.**

### Layer 1 — CSS custom properties, `app/globals.css:3-18` (reproduced in full)

```css
:root {
  --ink: #0F1A2E;
  --ink-soft: #1F2B42;
  --ink-muted: #4A5468;
  --paper: #FAF7F1;
  --paper-soft: #F3EFE6;
  --paper-line: #E7E1D3;
  --amber: #C5743A;
  --amber-deep: #A05A26;
  --amber-soft: #F1DEC4;
  --moss: #4F6A4A;
  --white: #FFFFFF;
  --red: #B3382C;
  --sidebar-w: 260px;
  --header-h: 60px;
}
```

Fourteen variables: eleven colours plus `--red`, and two layout dimensions. **No spacing scale, no radius scale, no type scale, no shadow scale, no z-index scale, no motion scale.**

### Layer 2 — Tailwind theme extension, `tailwind.config.js` (reproduced verbatim, in full)

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0F1A2E',
        'ink-soft': '#1F2B42',
        'ink-muted': '#4A5468',
        paper: '#FAF7F1',
        'paper-soft': '#F3EFE6',
        'paper-line': '#E7E1D3',
        amber: '#C5743A',
        'amber-deep': '#A05A26',
        'amber-soft': '#F1DEC4',
        moss: '#4F6A4A',
        white: '#FFFFFF',
      },
      fontFamily: {
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        serif: ['Fraunces', 'Georgia', 'serif'],
        mono: ['Manrope', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        'display-xl': ['clamp(3rem, 7vw, 6.5rem)', { lineHeight: '1.05', letterSpacing: '-0.035em' }],
        'display-l': ['clamp(2.5rem, 5.5vw, 4.5rem)', { lineHeight: '1.05', letterSpacing: '-0.028em' }],
        'display-m': ['clamp(2rem, 4vw, 3.25rem)', { lineHeight: '1.08', letterSpacing: '-0.022em' }],
        'display-s': ['clamp(1.625rem, 3vw, 2.25rem)', { lineHeight: '1.1', letterSpacing: '-0.018em' }],
      },
    },
  },
  plugins: [],
};
```

**DS-1 — Tailwind is installed, configured, and effectively unused.** The eleven colours duplicate `:root` exactly (`--red: #B3382C` exists only in CSS; `mono` is aliased to the sans stack, which makes the `font-mono` utility a no-op). The four `display-*` sizes are the only genuinely additive tokens — and **all four have zero usage**: `grep -r "display-xl\|display-l\|display-m\|display-s"` across `app` and `components` returns nothing. `plugins: []` — no forms, no typography plugin. Tailwind's build cost is paid on every deploy for a handful of utility classes; the app's actual styling is CSS classes in `globals.css` plus inline `style` objects.

### Layer 3 — hardcoded hex, outside both token layers

The same palette is re-typed as literals in places that cannot reach either layer:

| File:line | Colours |
|---|---|
| `lib/types.ts:269-302` | `ASSIGNMENT_STATUS_COLOR` (8), `ASSIGNMENT_STATUS_BG` (8 rgba), `RISK_COLOR` (3), `PHASE_COLORS` (4) — 23 literals, **partly off-palette**: `#6B7280`, `#D97706`, `#2563EB`, `#7C3AED`, `#1D4ED8`, `#DC2626`, `#059669`, `#047857` are Tailwind-default greys/blues/purples that appear in no token layer |
| `app/verify/[passportId]/page.tsx:22-25` | `NAVY = '#0B1F3A'`, `GOLD = '#C99A3C'`, `INK = '#16243A'`, `MUTE = '#6A727E'` — **a completely separate four-colour palette**; the navy and gold do not match `--ink` or `--amber` |
| `components/PassportControls.tsx:52-53` | `'#0B1F3A'`, `'#C0392B'`, `'#E7B7B0'`, `'#d9d4cb'` — the verify palette again, plus new greys |
| `app/api/passport-pdf/route.ts` | Full brand palette re-typed as hex inside a template string (`#0F1A2E`, `#FAF7F1`, `#C5743A`, `#F1DEC4`, …) |
| `app/api/notify/route.ts:73-114` | Full brand palette re-typed as hex inside the email template (unavoidable — email cannot use CSS vars) |
| `app/portal/passport/page.tsx:22-36` | `LEVEL_COLOR` + `LEVEL_BG` — 10 more literals |
| `app/portal/assignments/page.tsx:52-70` | `STATUS_COLOR` + `STATUS_BG` — **a near-duplicate of `lib/types.ts:269-289`** with different values for the same statuses |
| `app/not-found.tsx:4-9` | `#FAF7F1`, `#4A5468`, `#0F1A2E` — hex, in a file that cannot import CSS |

So: **four independent definitions of the brand palette** (CSS vars, Tailwind config, `lib/types.ts` maps, and the verify/passport `NAVY`/`GOLD` set), plus per-file literals. Changing the brand means finding all of them.

### Type scale

Fonts are loaded by a **CSS `@import` from Google Fonts at the top of `globals.css:1`**:

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,400;9..144,500&family=Manrope:wght@300;400;500;600;700;800&display=swap');
```

This is the render-blocking form — no `<link rel="preconnect">`, no `next/font`, no self-hosting. The same `@import` is repeated inside the passport HTML (`app/api/passport-pdf/route.ts:48`).

There is **no type scale in use.** `globals.css` sets `body { font-size: 1rem }` (`:25`) and gives `h1..h4` the serif face (`:32-37`). Every other size is an inline literal. Distinct `fontSize` values found in inline styles: `0.5rem`, `0.5625rem`, `0.625rem`, `0.6875rem`, `0.75rem`, `0.8125rem`, `0.875rem`, `0.9rem`, `0.9375rem`, `1rem`, `1.0625rem`, `1.125rem`, `1.25rem`, `1.375rem`, `1.5rem`, `1.75rem`, `1.875rem`, `2rem`, `2.25rem`, `2.5rem`, `3rem`, plus `clamp(1.5rem, 3vw, 2rem)` (`app/portal/page.tsx:122`) and pixel sizes in the verify page (`10`, `11`, `12`, `13`, `14`, `15`, `17`, `18`, `22`, `26`, `28`, `34`, `40`). **Roughly 34 distinct font sizes across the app, none named.** The eyebrow-label pattern (`fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase'`) is re-typed by hand at least 30 times.

### Spacing and radius

**No scale is defined.** Radii found as inline literals: `2`, `3`, `4`, `5`, `6`, `8`, `10`, `12`, `13`, `14`, `20`, `100`, `'50%'`, `'0 0 14px 14px'`, `'4px 14px 14px 14px'`. `globals.css` uses `6px` for buttons/inputs, `8px` for cards, `100px` for badges — three unnamed values. Spacing is raw numbers in `gap`, `padding`, `margin` props: `2,3,4,5,6,7,8,9,10,12,14,16,18,20,22,24,26,28,32,36,40,44,48,56` are all present. No 4pt or 8pt grid is observed.

## Component inventory

### Shared directory — `components/` holds exactly three files

| Component | Purpose | Import sites |
|---|---|---|
| `Sidebar.tsx` (213) | The app shell's left navigation: logo, pathway/tier badges, current-week strip, 8 learner links, notifications, profile, 3 AI links, 8 conditional admin links, user footer with `<UserButton>` | **2** — `app/portal/layout.tsx:6`, `app/admin/layout.tsx:5` |
| `UpthrustLogo.tsx` (78) | Two exports: `UpthrustMark` (inline SVG) and `UpthrustLogo` (mark + wordmark) | **3** — `Sidebar.tsx:8`, `app/auth/sign-in/page.tsx:4`, `app/auth/sign-up/page.tsx:4`, `app/portal/onboarding/page.tsx:8` (4 sites; `UpthrustMark` itself has 1, from within its own file) |
| `PassportControls.tsx` (102) | Admin Issue/Re-issue/Preview/Verify/Revoke block | **0 — DEAD (PASS-1)** |

**That is the entire shared component library: two components in use.** There is no `Button`, no `Card`, no `Input`, no `Select`, no `Table`, no `Badge`, no `Modal`, no `Tabs`, no `EmptyState`, no `Spinner`, no `Alert`, no `PageHeader`, no `StatCard`, no `Field`, no `Form`. Every one of those exists as a CSS class in `globals.css` and/or as hand-rolled markup repeated per route.

Two route-local components are shared across exactly one boundary each:

| Component | Purpose | Import sites |
|---|---|---|
| `app/portal/assignments/AssignmentSubmitPanel.tsx` (242) | Client submit/resubmit panel with 4-phase state machine | 1 |
| `app/admin/learners/[learnerId]/PathwayEditor.tsx` (65) | Pathway + tier editor | 1 |
| `app/admin/learners/[learnerId]/ClerkLinkForm.tsx` (42) | Clerk ID paste-and-link form | 1 |

### Components defined inline inside route files and never reused

| Component | Defined at | Reused? |
|---|---|---|
| `ProgressRing` | `app/portal/page.tsx:10-21` | No — one call site (`:305`) |
| `StatCard` | `app/admin/page.tsx:10-21` | No — 5 call sites, all in the same file. **`globals.css:302-329` defines a `.stat-card` class with `.stat-value`/`.stat-label`/`.stat-sub` children that this component does not use** |
| `CheckItem` | `app/portal/onboarding/page.tsx:18-41` | No — same file only |
| `Shell` | `app/verify/[passportId]/page.tsx:27-33` | No |
| `Header` | `app/verify/[passportId]/page.tsx:35-45` | No |
| `NotValid` | `app/verify/[passportId]/page.tsx:47-61` | No |
| `Badge` | `app/verify/[passportId]/page.tsx:63-71` | No. **A second, unrelated `badge` concept from `globals.css:238-248`** |
| `Stat` | `app/verify/[passportId]/page.tsx:235-243` | No |
| `Section` | `app/verify/[passportId]/page.tsx:245-252` | No |
| `ResourceCard` | `app/portal/resources/page.tsx:~140-190` | No |
| `VideoModal` | `app/portal/resources/page.tsx:~60-100` | No |

Eleven inline components, none extracted. The verify page alone defines six of its own primitives because it shares nothing with the rest of the app — a separate palette, a separate `Badge`, a separate `Shell`.

### Dead CSS in `globals.css`

Thirty-one declared classes have **zero uses** anywhere in `app` or `components`:

`portal-header` (the top-bar class — see the layout finding), `card-sm`, `btn-amber`, `badge-green`, `badge-amber`, `badge-red`, `badge-ink`, `badge-blue`, `alert-warning`, `alert-danger`, `alert-success`, `alert-info`, `tab-bar`, `tab-item`, `stat-card` (+ `.stat-value`, `.stat-label`, `.stat-sub`), `modal-card`, `progress-bar`, `progress-bar-fill`, `divider`, `fade-up`, `delay-1`, `delay-2`, `delay-3`, `delay-4`, `phase-foundation`, `phase-core`, `phase-delivery`, `phase-capstone`, `week-card`, `quick-link`, `tool-link`, `progress-ring`, `progress-ring-container`, `status-green`, `status-amber`, `status-red`.

That is a design system that was **written and then bypassed**. `.tab-bar`/`.tab-item` exist (`:281-299`) while `/portal/profile` hand-rolls its tab bar inline (`app/portal/profile/page.tsx:129-145`) with the same visual result. `.alert-*` exist (`:275-278`) while every alert in the app is an inline-styled div. `.phase-*` exist (`:202-205`) while phase colours are looked up from `PHASE_COLORS` and applied inline.

`globals.css` also has two duplicate definitions: `.badge` at `:126-136` and again at `:238-248` (different `font-size` and `padding` — the second wins); `.btn-danger` at `:122` and again at `:233`.

## Ratio of shared to bespoke UI

Measured two ways.

**By styling mechanism:**

| Mechanism | Count |
|---|---|
| Inline `style={{ … }}` object literals | **1,441** |
| `className=` attributes (all kinds, incl. Tailwind + shared classes) | **454** |

**Ratio ≈ 3.2 inline style objects for every className.**

**By shared-class adoption** (precise counts, `className` strings only):

| Shared class | Uses |
|---|---|
| `form-input` | 80 |
| `card` | 77 |
| `btn` + variants | 98 |
| `form-label` | 69 |
| `form-group` | 64 |
| `portal-content` | 30 |
| `alert` | **0** |
| `link` | **0** |
| `empty-state` | 4 |
| `table-wrapper` | 4 |
| `badge` | 2 |
| `spinner` | 4 |

So the shared layer is real for exactly three things — **forms, cards and buttons** — and absent for everything else.

**The answer to the question that predicts revamp cost:** of the 28 route-level screens, **zero are assembled purely from shared primitives.** Every screen is hand-rolled markup that reaches for `card` / `btn` / `form-input` as accents inside a bespoke inline-styled layout. The highest-density files make this unambiguous: `app/portal/page.tsx` is 371 lines carrying **92 inline style objects**; `app/admin/resources/page.tsx` is 567 lines with 83. Only 6 of 36 `.tsx` files have fewer than 10 inline style objects, and 5 of those 6 are the tiny layout/auth/404 files.

**Practical read: roughly 10–15% of the UI is shared primitives, 85–90% is bespoke per-route markup.** A visual rebuild to target **C** does not mean re-theming a component library — there is no component library to re-theme. It means rewriting the markup of 28 screens. Inline `style` objects also cannot carry media queries, pseudo-classes or theme variants, so the dense-console conversion is a rewrite of those 1,441 style objects, not an override of them.

## Component library in use

**None.** No shadcn/ui, no Radix, no Headless UI, no MUI, no Chakra, no Mantine, no Ark. `package.json:11-19` lists nine runtime dependencies and none is a UI library. There is no `components/ui/` directory, no `cn()`/`clsx`/`tailwind-merge` helper, no `class-variance-authority`.

The only third-party UI in the app is **Clerk's prebuilt components** — `<SignIn>`, `<SignUp>`, `<UserButton>` (`app/auth/sign-in/page.tsx:15`, `app/auth/sign-up/page.tsx:15`, `components/Sidebar.tsx:203`). They are used **entirely unstyled** — no `appearance` prop, no `baseTheme`, no CSS-variable override anywhere. So the three auth surfaces render in Clerk's default look, inside an Upthrust-branded wrapper. That is the one visible brand seam a user hits before they see anything else.

Every other interactive control is a native element: `<button>`, `<input>`, `<select>`, `<textarea>`, `<a>`. There are no custom dropdowns, comboboxes, date pickers, tooltips or popovers. Modals are hand-rolled `position: fixed` divs (`app/admin/resources/page.tsx`, `app/admin/sessions/page.tsx`, `app/admin/content/page.tsx`, `app/portal/portfolio/page.tsx`, `app/portal/resources/page.tsx`).

## Layout architecture

**There is a persistent app shell, and it is sidebar-only. There is no top utility bar.**

`globals.css:45-88` defines the shell:

```css
.portal-layout  { display: flex; min-height: 100vh; }
.portal-sidebar { width: var(--sidebar-w); background: var(--ink); position: fixed;
                  top:0; left:0; bottom:0; overflow-y: auto; z-index: 50;
                  display: flex; flex-direction: column; }
.portal-main    { margin-left: var(--sidebar-w); flex: 1; min-height: 100vh; }
.portal-header  { height: var(--header-h); background: var(--white);
                  border-bottom: 1px solid var(--paper-line); position: sticky; top: 0;
                  z-index: 40; display: flex; align-items: center; padding: 0 28px;
                  justify-content: space-between; }
.portal-content { padding: 32px 28px; flex: 1; max-width: 1100px; width: 100%; }
```

`.portal-layout` + `Sidebar` + `.portal-main` are applied by both layouts (`app/portal/layout.tsx:50-61`, `app/admin/layout.tsx:19-28`) — **so the shell genuinely is shared, and this is the single most reusable thing in the codebase.**

**DS-2 — `.portal-header` is defined and never used.** Zero occurrences in any `.tsx` file. The top utility bar was designed in CSS and never built. Consequently every screen renders its own page header inline — an eyebrow label, an `h1`, and a subtitle, hand-typed in 28 files (`app/portal/page.tsx:118-128`, `app/admin/page.tsx:66-72`, `app/portal/assignments/page.tsx:157-167`, and so on). There is no persistent search, no notification bell in a bar, no breadcrumb, no page-level action slot. Target **C**'s "top utility bar" has a CSS class waiting for it and nothing else.

`.portal-content` caps at `max-width: 1100px` and five screens override it inline to 680–800px (`app/portal/community/page.tsx:131`, `app/portal/notifications/page.tsx:91`, `app/portal/profile/page.tsx:113`, `app/admin/cohort/page.tsx:208`, `app/admin/learners/add/page.tsx:92`, `app/portal/simulation/page.tsx:206,378`).

`Sidebar.tsx` also injects a 53-line `<style>` block inline into the component tree (`:69-122`) for `.sidebar-link` and friends, rather than putting them in `globals.css` — so sidebar styling lives in a third place.

## Responsive behaviour

`globals.css` has **three** breakpoint blocks, and the first two conflict:

```css
/* :195-199 */
@media (max-width: 768px) {
  .portal-sidebar { display: none; }
  .portal-main { margin-left: 0; }
  .portal-content { padding: 20px 16px; }
}
/* :378-380 */
@media (max-width: 900px) { :root { --sidebar-w: 220px; } }
/* :381-386 */
@media (max-width: 700px) {
  .portal-layout { flex-direction: column; }
  .portal-sidebar { width: 100%; height: auto; position: relative; }
  .portal-main { margin-left: 0; }
  .portal-content { padding: 20px 16px; }
}
```

**RESP-1 — below 768px there is no navigation at all.** The `768px` block sets `.portal-sidebar { display: none }`. The `700px` block re-declares `width`, `height` and `position` on the same selector but **never resets `display`**, and CSS has no ordering rescue for that — `display: none` from the earlier, wider query still applies. So at ≤700px both blocks match and the sidebar stays hidden. There is **no hamburger, no drawer, no mobile menu, and no bottom tab bar**: `grep -i "hamburger\|menu-toggle\|mobile-nav\|drawer\|aria-expanded\|setMenuOpen"` across `app` and `components` returns **zero hits**. A learner on a phone can reach `/portal` and then cannot navigate anywhere except by typing URLs. Given the cohort geography in the seeded content (Nigeria, UK), this is the most consequential UI defect in the audit.

**RESP-2 — every multi-column layout is a fixed inline grid with no media query.** Inline `style` objects cannot carry media queries, so each of these is unconditionally applied at every viewport width:

| Route | File:line | Grid | Why it breaks below 480px |
|---|---|---|---|
| `/portal` | `app/portal/page.tsx:169` | `repeat(4, 1fr)` | 4 stat cards at ~80px each; `2rem` Fraunces numerals overflow |
| `/portal` | `app/portal/page.tsx:185` | `1fr 320px` | 320px right rail forces ~340px min content → **horizontal page scroll** |
| `/portal/week/[weekNum]` | `app/portal/week/[weekNum]/page.tsx:92` | `1fr 320px` | Same |
| `/portal/passport` | `app/portal/passport/page.tsx:126` | `1fr 340px` | Same, worse — 340px rail |
| `/portal/assignments` | `app/portal/assignments/page.tsx:183` | `repeat(4, 1fr)` | 4 stat cards |
| `/portal/sessions` | `app/portal/sessions/page.tsx:78` | `repeat(3, 1fr)` | 3 stat cards |
| `/portal/writing-check` | `app/portal/writing-check/page.tsx:72` | `repeat(3, 1fr)` | 3 cards |
| `/portal/writing-check` | `app/portal/writing-check/page.tsx:86` | `1fr 1fr` | Editor + results side by side; textarea ~200px wide |
| `/portal/interview` | `app/portal/interview/page.tsx:136` | `280px 1fr` | 280px question list leaves ~200px for the answer textarea |
| `/portal/profile` | `app/portal/profile/page.tsx:150,160,200` | `1fr 1fr` ×3 | Paired form fields; also the tab bar (`:129`) has no wrap |
| `/admin` | `app/admin/page.tsx:103` | `repeat(5, 1fr)` | **5 stat cards at ~64px each** — worst case in the app |
| `/admin` | `app/admin/page.tsx:112` | `1fr 360px` | 360px rail |
| `/admin/learners` | `app/admin/learners/page.tsx:33` | `repeat(4, 1fr)` | 4 stat cards |
| `/admin/learners/[id]` | `app/admin/learners/[learnerId]/page.tsx:89` | `repeat(5, 1fr)` | 5 stat cards |
| `/admin/learners/[id]` | `app/admin/learners/[learnerId]/page.tsx:105` | `1fr 320px` | 320px rail |
| `/admin/reviews` | `app/admin/reviews/page.tsx:107` | `320px 1fr` | Queue list + detail pane; unusable side by side on a phone |
| `/admin/reviews` | `app/admin/reviews/page.tsx:252` | `1fr 140px` | Feedback textarea + score column |
| `/admin/cohort` | `app/admin/cohort/page.tsx:224` | `repeat(4, 1fr)` | 4 stat cards |
| `/admin/cohort` | `app/admin/cohort/page.tsx:243` | `1fr 1fr` | Paired fields |
| `/admin/resources` | `app/admin/resources/page.tsx:401` | `repeat(4, 1fr)` | 4 type pickers |
| `/admin/resources` | `app/admin/resources/page.tsx:500` | `1fr 1fr` | Paired fields |
| `/admin/learners/add` | `app/admin/learners/add/page.tsx:117,149,168` | `1fr 1fr` ×3 | Paired form fields |
| `/admin/sessions` | `app/admin/sessions/page.tsx:163` | `1fr 1fr` | Paired fields |

**Routes that do adapt** (using `repeat(auto-fill, minmax(...))`): `/portal/week` (`app/portal/week/page.tsx:22`, `minmax(300px, 1fr)`), `/portal/resources` grid (`:342`, `minmax(280px, 1fr)`), `/portal/simulation` character grid (`:158`, `minmax(320px, 1fr)`), `/admin/resources` type grid (`:378`, `minmax(180px, 1fr)`).

**Routes with no responsive problem:** `/auth/sign-in`, `/auth/sign-up` (centred single column, `maxWidth: 440`), `/not-found`, `/portal/onboarding` (single column, `maxWidth: 620`), `/portal/notifications` (single column), `/portal/community` (single column, `maxWidth: 760`), `/verify/[passportId]` (single column, `maxWidth: 760`, uses `flexWrap` on its stat row at `:159`).

**Tables are handled correctly.** All four `<table>` elements sit inside `.table-wrapper` with `overflow-x: auto` (`globals.css:173`): `app/admin/learners/page.tsx:47`, `app/admin/attendance/page.tsx:190`, `app/admin/page.tsx:172`, `app/admin/resources/page.tsx:276`. They scroll rather than overflow the page. Credit where due.

**Summary for target C:** 23 grid declarations across 15 routes need media queries they structurally cannot have while they remain inline styles, and the sidebar needs a mobile navigation pattern that does not exist in any form.

## Accessibility

Statically observable, in rough order of severity.

**A11Y-1 — no form label is programmatically associated with its input. `htmlFor` count across the entire codebase: 0.** Every field follows this shape:

```tsx
<div className="form-group">
  <label className="form-label">First Name *</label>
  <input className="form-input" value={...} onChange={...} />
</div>
```

The `<label>` is a sibling, not a wrapper, and carries no `htmlFor`; no input has an `id`, `aria-label` or `aria-labelledby`. With 80 `form-input` uses plus native `<select>`/`<textarea>` elements, **every form control in the portal is unlabelled to a screen reader.** Affects `/portal/profile` (13 fields), `/portal/onboarding` (5), `/admin/learners/add` (8), `/admin/resources` (~12), `/admin/sessions` (5), `/admin/cohort` (~8), `/admin/reviews` (2), `/admin/content` (~15), `AssignmentSubmitPanel` (2).

**A11Y-2 — `aria-*` appears exactly once in the whole codebase**, and it is `aria-hidden="true"` on the logo SVG (`components/UpthrustLogo.tsx:14`). No `aria-current` on the active nav item, no `aria-live` on any of the async result regions (AI output, save confirmations, error banners), no `aria-expanded` on any disclosure, no `role="dialog"` / `aria-modal` on the five hand-rolled modals, no `aria-selected` / `role="tab"` on the profile tab bar, no `aria-invalid` on any errored field. The one accessible thing in the repo is `lib/qr.ts:294`, which emits `role="img"` and `aria-label="Verification QR code"` — and it is dead code.

**A11Y-3 — modals have no focus management and are keyboard traps in the wrong direction.** The five hand-rolled overlays (`app/admin/resources/page.tsx`, `app/admin/sessions/page.tsx`, `app/admin/content/page.tsx`, `app/portal/portfolio/page.tsx`, `app/portal/resources/page.tsx` `VideoModal`) do not move focus on open, do not restore it on close, do not trap Tab inside the dialog, and have **no Escape handler** — `grep "key === 'Escape'\|keydown\|onKeyDown"` returns nothing for any of them. A keyboard user tabs straight out of the open modal into the page behind it, which is not inerted.

**A11Y-4 — clickable non-interactive elements.** `app/portal/onboarding/page.tsx:21` puts `onClick` on a `<div>` with `cursor: pointer` and no `role`, `tabIndex` or key handler — the onboarding checklist is mouse-only. `app/portal/community/page.tsx:279-292` uses `<button>` correctly for like/reply, so the pattern is inconsistent rather than uniform.

**A11Y-5 — the focus ring is incomplete.** `globals.css:389-396` styles `:focus-visible` for `.btn`, `a`, `input`, `textarea`, `select`. It does **not** cover bare `<button>` elements without `.btn` — which includes the profile tab bar (`app/portal/profile/page.tsx:131`), the preferred-role pills (`:220`), the community category filters (`app/portal/community/page.tsx:141`), the resource type filters (`app/portal/resources/page.tsx:311`), and every modal close button. Those receive the browser default outline at best, and several set `border: none` (`app/portal/profile/page.tsx:132`).

**A11Y-6 — colour contrast failures visible from the values alone.** Against `--paper: #FAF7F1` and `--white`:

| Foreground | Background | Approx. ratio | Where | Verdict |
|---|---|---|---|---|
| `--amber #C5743A` | `--paper #FAF7F1` | ~3.1:1 | `.btn-amber` text, amber accents | Fails AA for normal text (4.5:1) |
| `rgba(250,247,241,0.4)` | `--ink #0F1A2E` | ~4.0:1 | `.sidebar-section` labels at `--ink` (`Sidebar.tsx:104` uses 0.25 alpha) | **0.25 alpha ≈ 2.4:1 — fails badly** |
| `rgba(250,247,241,0.55)` | `--ink` | ~6.5:1 | Sidebar inactive links (`Sidebar.tsx:78`) | Passes |
| `#9AA1AC` | `#fff` | ~2.6:1 | `Stat` labels on the verify page (`verify:238`) | Fails |
| `MUTE #6A727E` | `#fff` | ~4.6:1 | Verify page body text | Marginal pass |
| `--ink-muted #4A5468` | `--paper` | ~7.6:1 | Most secondary text | Passes |

Compounding this: the eyebrow-label pattern renders at `fontSize: '0.5rem'`–`0.625rem` (8–10px) with `letterSpacing: 0.12em–0.22em` in `--ink-muted` or a low-alpha white — e.g. `Sidebar.tsx:100-105` (`0.5rem`, alpha `0.25`), `app/portal/page.tsx:157` (`0.625rem`), `app/portal/week/[weekNum]/page.tsx:98` (`0.625rem`). **8px uppercase tracked text is below any reasonable minimum regardless of contrast**, and it is the app's most-repeated typographic device.

**A11Y-7 — no skip link, no landmark discipline.** No `<a href="#main">`, no `<nav>` label (`Sidebar.tsx:152` uses a bare `<nav>`), no `<h1>` on `/portal/week`, `/portal/sessions`… (actually present on most), and heading order is not audited per screen. `app/not-found.tsx:3` renders its own `<html>`/`<body>`, bypassing the root layout's `lang="en"` — it re-declares `lang="en"` at `:3`, so that one is fine.

**A11Y-8 — `alert()` and `confirm()` for user feedback.** 17 `alert()` calls across 7 files (`app/admin/content/page.tsx` ×2, `app/admin/resources/page.tsx` ×6, `app/admin/reviews/page.tsx` ×1, `app/admin/sessions/page.tsx` ×1, `app/portal/community/page.tsx` ×2, `app/portal/portfolio/page.tsx` ×4, `app/portal/profile/page.tsx` ×1) plus `confirm()` in `PassportControls.tsx:87` and the delete paths. Native dialogs are unstyleable, block the main thread, and are the app's primary error-reporting channel for learners.

## Loading, empty and error states

Determined by inspecting each route for a loading indicator, an empty-data branch, and a user-visible error branch.

| Route | Loading | Empty | Error | Notes |
|---|---|---|---|---|
| `/portal` | — | ✅ | — | Server component; a failed query renders "Access Pending", which **misreports a DB error as a permissions state** |
| `/portal/onboarding` | ✅ | — | ✅ | Spinner (`:161-171`); `saveError` + `debugInfo` (`:150-151`) |
| `/portal/week` | — | — | — | **None of the three.** Empty `weeks` renders a blank grid |
| `/portal/week/[weekNum]` | — | ✅ | — | "Week N isn't available yet" (`:24-38`) covers not-found and unpublished |
| `/portal/sessions` | — | — | — | **None of the three** |
| `/portal/assignments` | — | ✅ | ✅ | Best-instrumented server page: no-learner (`:87`), no-pathway (`:107`), no-weeks (`:203`), and it surfaces `weeksError.message` (`:212-216`) |
| `/portal/portfolio` | — | ✅ | ✅ (`alert`) | No loading state despite 3 client fetches |
| `/portal/passport` | — | — | — | **None of the three** |
| `/portal/community` | ✅ | ✅ | ✅ (`alert`) | All three |
| `/portal/resources` | ✅ | ✅ | — | Errors from the resource fetch are dropped |
| `/portal/notifications` | ✅ | ✅ | — | The mark-read failures are silent (RLS-2) |
| `/portal/profile` | — | ✅ | ✅ (`alert`) | No loading state; form renders blank while fetching |
| `/portal/simulation` | ✅ | — | ✅ | `errorMsg` banner (`:326-329`) |
| `/portal/interview` | ✅ | ✅ | ✅ | All three; `loadError` and `errorMsg` handled separately |
| `/portal/writing-check` | ✅ | ✅ | ✅ | All three |
| `/verify/[passportId]` | — | ✅ | ✅ | `NotValid` covers 4 distinct failure modes. **No loading state and none needed** (server-rendered) |
| `/admin` | — | ✅ | — | — |
| `/admin/reviews` | — | ✅ | ✅ (`alert`) | No loading state; the queue appears empty until the fetch resolves |
| `/admin/attendance` | ✅ | ✅ | ✅ | All three — `setError` on every catch (`:52`, `:92`, `:120`, `:134`) |
| `/admin/sessions` | ✅ | ✅ | ✅ (`alert`) | All three |
| `/admin/learners` | — | ✅ | — | — |
| `/admin/learners/add` | — | — | ✅ | **No loading, no empty**; `error`/`success` banners (`:104-113`) |
| `/admin/learners/[id]` | — | ✅ | — | — |
| `/admin/content` | — | ✅ | ✅ (`alert`) | No loading state |
| `/admin/resources` | ✅ | ✅ | ✅ (`alert`) | All three |
| `/admin/cohort` | — | ✅ | — | 9 fetch calls, **none with error handling** |
| `/auth/sign-in`, `/auth/sign-up` | Clerk's own | n/a | Clerk's own | Delegated |

**All three states: 8 routes** — `/portal/community`, `/portal/interview`, `/portal/writing-check`, `/admin/sessions`, `/admin/resources`, `/admin/attendance`, plus `/portal/assignments` and `/portal/onboarding` (each missing one of the three but covering the states that matter for it).

**None of the three: 3 routes** — `/portal/week`, `/portal/sessions`, `/portal/passport`.

There is **no `loading.tsx`, no `error.tsx` and no `global-error.tsx` anywhere in `app/`** — the Next App Router's own primitives for exactly this are unused, which is why every server component either has a hand-rolled branch or nothing. A thrown error in any server component produces the unstyled Next error page.

---

# 6. Code health

## TypeScript strictness

`tsconfig.json` in full:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`strict: true` — so `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis` and `alwaysStrict` are all on. **Not enabled:** `noUncheckedIndexedAccess`, `noImplicitReturns`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. `skipLibCheck: true` and `allowJs: true` are the Next.js defaults.

**`npx tsc --noEmit` exits 0. The codebase typechecks clean.** That is worth stating plainly — it is the single strongest code-health signal in this repo, and it means the type layer is at least internally consistent even where it disagrees with the database.

| Metric | Count |
|---|---|
| `any` (as `: any`, `as any`, `any[]`, `<any>`) | **53** |
| `@ts-ignore` | **0** |
| `@ts-expect-error` | **0** |
| `process.env.X!` non-null assertions | 6 |

`any` by file: `app/admin/resources/page.tsx` 9, `app/api/admin/data/route.ts` 8, `app/portal/resources/page.tsx` 5, `app/api/passport-issue/route.ts` 4, `app/portal/community/page.tsx` 3, `app/admin/content/page.tsx` 3, then 2 each in `app/portal/passport/page.tsx`, `app/portal/onboarding/page.tsx`, `app/api/webhook/clerk/route.ts`, `app/api/simulation/route.ts`, `app/admin/cohort/page.tsx`, and 1 each in 9 more files.

The `any` usage clusters in two meaningful places:

- **`useState<any>(null)` for the learner record** — `app/portal/onboarding/page.tsx:47`, `profile/page.tsx:15`, `notifications/page.tsx:42`, `portfolio/page.tsx:49`, `community/page.tsx:19`, `resources/page.tsx:193`, `simulation/page.tsx:21`, `interview/page.tsx:19`, `writing-check/page.tsx:12`. Nine client pages hold the central domain object as `any`, so `lib/types.ts:34`'s `Learner` interface provides no protection on any client surface. This is why `app/portal/profile/page.tsx:118` can render `{learner?.pathway} Pathway · {learner?.tier} · {learner?.cohort}` and print `undefined Pathway · undefined · undefined` with no type error.
- **`getLearner(db: any, ...)`** — `app/api/admin/data/route.ts:31` types the Supabase client as `any`, which propagates through all 19 action handlers. That is why `submitted_at` on `portfolio_items` (P-1) and `duration_mins` on `resources` (R-1) compile cleanly.

The 6 `!` assertions on env vars: `lib/supabase.ts:10,11,17` (Supabase URL, anon key, service key), and `ANTHROPIC_API_KEY!` at `ai-feedback:145`, `interview:221`, `simulation:347,387`, `submit-assignment:248`, `writing-check:69`. `lib/supabase-admin.ts:9-11` and `lib/supabase-url.ts:10-12` do it **correctly** with an explicit throw — and both of those files are dead code (below).

## TODO / FIXME / HACK and commented-out code

**Zero.** `grep -rE "(//|/\*|--|\*)\s*(TODO|FIXME|HACK|XXX|NOTE:|WARNING:)"` across `app`, `components`, `lib`, `scripts` and all four `.sql` files returns nothing. `grep -rE "^\s*//\s*(const|let|var|await|return|import|if|function|export|db\.|fetch|<)"` — no commented-out code blocks either.

This is genuinely unusual and worth saying: **nobody left themselves a note.** The comments that exist are explanatory and often good (`lib/supabase.ts:3-7` explains why clients must not be constructed at module scope; `lib/passport.ts:85` warns that canonical field order must never change; `app/api/webhook/clerk/route.ts:117-118` explains why pathway is left null). The absence of TODOs is not a sign of completeness — the placeholders below are unmarked.

**Unmarked placeholders and deferred work:**

| File:line | What |
|---|---|
| `app/api/passport-pdf/route.ts:333-347, 479-481` | `.qr-placeholder` CSS + `<span>QR<br/>CODE</span>` — a drawn box where the QR belongs |
| `app/api/passport-pdf/QR_PATCH.md` | **A 55-line instruction file describing the three edits to wire up the real QR. Written, never applied.** This is the closest thing to a TODO in the repo, and it is a whole file |
| `app/api/passport-pdf/route.ts:477` | `'UP-C1-XXXX'` literal fallback printed on the credential |
| `supabase-additions.sql:132-143` | 12 seeded resources with `external_url = '#'` — **live placeholder rows** |
| `app/portal/assignments/page.tsx:265` | `{aTitle \|\| 'Brief coming soon'}` |
| `app/portal/week/[weekNum]/page.tsx:263` | `'Zoom link will appear here'` |
| `app/portal/sessions/page.tsx:110` | `'Zoom link coming soon — Genesis will add it before June 6.'` |
| `lib/types.ts:314-317` | `zoomLink: ''`, `whatsapp: ''`, `calendlyPm: ''`, `calendlyBa: ''` — four empty config slots |
| `app/portal/passport/page.tsx:213` | `'QR code for employer verification'` promised in a features list; not built |

## Dead code

### Unreferenced files (0 import sites)

| File | Lines / bytes | Notes |
|---|---|---|
| **`lib/qr.ts`** | 295 | Complete, correct, dependency-free QR encoder. Only referenced from `QR_PATCH.md`, which is documentation. **PASS-3** |
| **`lib/upthrust-logo-base64.ts`** | 9 lines / **90,679 bytes** | Four base64 PNG data URLs: `UPTHRUST_LOGO_DATA_URL`, `UPTHRUST_WATERMARK_DATA_URL`, `UPTHRUST_LOGO_LIGHT_DATA_URL`, `GENESIS_SIGNATURE_DATA_URL`. **The largest file in the repo, entirely unused.** Note that one of them is a facsimile of a real person's signature, committed to a Git repo |
| **`lib/supabase-admin.ts`** | 19 | A *better* `createAdminClient()` — has `import 'server-only'` (`:1`) and throws on a missing key (`:9-11`) instead of asserting. Superseded by the weaker version in `lib/supabase.ts`, which all 25 call sites use |
| **`lib/supabase-url.ts`** | 15 | `normalizeSupabaseUrl()` strips trailing slashes and a `/rest/v1` suffix — a real defensive fix. Imported only by `lib/supabase-admin.ts`, which is itself dead |
| **`components/PassportControls.tsx`** | 102 | **PASS-1.** The only UI for passport issuance |
| **`scripts/prep-logo.js`** | 5,825 bytes | One-shot image processor. Requires `sharp` (**not in `package.json`**) and reads `C:\Users\genes\Downloads\Upthrust Logo.png` — a hardcoded absolute path on one developer's machine. Output feeds `lib/upthrust-logo-base64.ts`, which is dead |
| **`scripts/prep-light-and-sig.js`** | 4,245 bytes | Same — generates the light logo and the signature PNG. Also needs `sharp` |

### Unreachable routes

| Route | Why |
|---|---|
| **`/api/ai-feedback`** (185 lines) | No `fetch('/api/ai-feedback'` anywhere. Superseded by the inline AI call in `/api/submit-assignment` |
| **`/api/submissions`** (101 lines) | No caller. Superseded by `/api/submit-assignment`. Its GET half is also unused |
| **`/api/passport-issue`** (212 lines) | No caller, because `PassportControls` is never rendered (PASS-1) |
| **`/api/webhook/clerk`** (162 lines) | Reachable in principle, blocked by middleware (W-1) |
| **`/verify/[passportId]`** (252 lines) | Reachable only to signed-in users (V-1) — i.e. not to its audience |

**About 900 lines of route code that no user action can reach.**

### Empty directories

`app/api/webhooks/`, `app/auth/login/`, `app/auth/register/`, `app/auth/verify/`, `public/`, `types/`, and a directory literally named `{app,components,lib,types}` — the residue of a brace-expansion that ran in a shell that did not support it. `app/auth/login/` and `app/auth/register/` suggest an earlier auth naming that was migrated to `sign-in`/`sign-up`; `app/auth/verify/` suggests the verify page was once intended to be public by living under the `/auth/(.*)` matcher, which would have fixed V-1.

### Unused exports

| Export | File:line |
|---|---|
| `createServiceClient` | `lib/supabase.ts:24` and again `lib/supabase-admin.ts:19` — an alias "used in some API routes", used in none |
| `MIN_OVERALL_THRESHOLD` | `lib/passport.ts:71` — used once (`passport-issue:76`), fine |
| `canonicalString` | `lib/passport.ts:95` — exported, only used internally |
| `verifyUrl`, `baseUrl` | `lib/passport.ts:124,132` — referenced only from `QR_PATCH.md` |
| `domainsFor` | `lib/passport.ts:39` — used once |
| `Pathway` (from `lib/passport.ts:37`) | Never imported anywhere |
| `Tier`, `RiskStatus`, `EnrollmentStatus`, `PassportEligibility`, `Phase`, `CapabilityLevel`, `ResourceType`, `ContentLevel`, `ContentLinkType` | `lib/types.ts:2-32` — all exported; only referenced through the interfaces that use them, never imported by name |
| `Week`, `CommunityPost`, `PortfolioItem`, `AIAttempt`, `Attendance`, `CapabilityScore`, `Resource`, `Notification`, `Announcement`, `Learner`, `Assignment` | `lib/types.ts` — imported inconsistently; `app/portal/assignments/page.tsx:17-48` **redefines `Week` and `Assignment` locally** rather than importing them |
| `PROGRAM` | `lib/types.ts:305` — imported once (`app/portal/passport/page.tsx:6`) and only `PROGRAM.contact` is read (`:121`). The `totalWeeks`, `start`, `end`, `demoDay`, `enrollmentClose` fields are **never read by anything** |
| `UpthrustMark` | `components/UpthrustLogo.tsx:5` — used only inside its own file |
| `qrSvg` | `lib/qr.ts:275` — dead |
| `normalizeSupabaseUrl`, `getSupabaseUrl` | `lib/supabase-url.ts:3,7` — dead |

### Orphaned tables and columns

| Object | Status |
|---|---|
| **`ai_practice_attempts`** | Written by nothing; read once. **Effectively orphaned** (AI-1) |
| **`community_replies`** | Live, but defined twice with conflicting FK behaviour |
| **`capability_scores`** | Live but frozen — insert-only, never updated (C-1) |
| **`sessions`** | Live and in active use, with **no DDL anywhere** |
| `assignments.is_portfolio_ready` | Declared, never written |
| `assignments.ai_score` | Declared, never written |
| `assignments.ai_quality_rating` | Declared with a CHECK, never written |
| `assignments.is_late` | Declared, never written — despite `isOverdue` being computed in the UI (`app/portal/assignments/page.tsx:231`) |
| `assignments.extension_granted` | Declared, never written |
| `assignments.portfolio_approved` | **Read in 6 places, written nowhere** — so the "approved for portfolio" state is permanently false |
| `assignments.portfolio_approved_at` | Declared, never written |
| `attendance.missed_session_task_sent` | Declared, never written |
| `weeks.pm_rubric_json` / `ba_rubric_json` | Declared, **never read or written** |
| `weeks.session_notes` | Declared, never read or written |
| `weeks.learning_goals` | Written by the base seed, **never read by any page** (the UI reads `outcomes` instead) |
| `weeks.start_date` / `end_date` | Written by the base seed, never read |
| `community_posts.is_pinned` | Sorted by, never set to true (AUTH-6) |
| `community_posts.pathway_tag`, `week_tag` | Declared, never written |
| `community_posts.author_avatar`, `community_replies.author_avatar` | Declared, never written |
| `learners.notes`, `avatar_url`, `phone` (write-only via profile), `portfolio_status` | `portfolio_status` is read nowhere; `notes` and `avatar_url` never written |
| `learners.onboarding_completed_at` | Written, never read |
| `passports.status` | No CHECK constraint, though three values are documented |

## Duplicated logic

| # | What | Where | Divergence |
|---|---|---|---|
| D-1 | **`getCurrentWeek()`** | 8 copies: `app/portal/layout.tsx:66`, `app/admin/layout.tsx:32`, `app/portal/page.tsx:23`, `app/admin/page.tsx:328`, `app/portal/week/page.tsx:56`, `app/portal/sessions/page.tsx:9`, `app/portal/resources/page.tsx:45`, `app/admin/attendance/page.tsx:9` | `app/portal/sessions/page.tsx:11` returns **`-1`** before the start date; the other seven return `0`. `app/admin/layout.tsx:36-39` computes `diffDays` then divides, the rest divide milliseconds — same result, different code |
| D-2 | **`createAdminClient()`** | `lib/supabase.ts:15` and `lib/supabase-admin.ts:6` | The dead one is better: `server-only` guard + explicit throw |
| D-3 | **AI feedback prompt sets** | `app/api/ai-feedback/route.ts:9-112` and `app/api/submit-assignment/route.ts:15-142` | Near-identical `FEEDBACK_PROMPTS` maps with the same four keys. The second adds `'Stakeholder'` and a `${2}` placeholder hack (`:127`, replaced at `:148`). ~230 duplicated lines |
| D-4 | **Assignment status colour maps** | `lib/types.ts:269-289` (`ASSIGNMENT_STATUS_COLOR`/`_BG`) and `app/portal/assignments/page.tsx:52-70` (`STATUS_COLOR`/`STATUS_BG`) | **Different values for the same statuses.** `lib/types.ts` uses `#2563EB` for Submitted; the local copy uses `#1D4ED8`. `lib/types.ts` omits `Human Reviewed` background parity. Both are imported/used in the same app |
| D-5 | **`CAPABILITY_AREAS`** | `lib/types.ts:255-266` and `app/admin/learners/add/page.tsx:10-15` | Identical 10 strings, hand-copied |
| D-6 | **Capability taxonomies** | `lib/passport.ts:10-21` (10 PM domains), `lib/passport.ts:23-35` (11 BA domains), `lib/types.ts:255-266` (10 mixed areas), `app/api/passport-pdf/route.ts:21-35` (6 PM / 6 BA labels) | **Four incompatible taxonomies.** The passport snapshot uses one, the printed credential uses another, the learner-facing page a third |
| D-7 | **URL extraction from pasted text** | `app/api/admin/data/route.ts:19-29` (`extractUrl`) and `app/portal/sessions/page.tsx:51-57` (`safeUrl`) | Same regex `/https?:\/\/[^\s<>"')]+/i`, same purpose, two implementations |
| D-8 | **Session date tables** | `lib/types.ts:320-334` (`WEEK_DATES`) and `app/portal/sessions/page.tsx:16-20` (`sessionDates`) | Two hand-maintained maps of the same 13 dates in different formats |
| D-9 | **Attendance-% recomputation** | `app/api/admin/data/route.ts:320-326` and `:343-359` | The same 4-line calculation, copy-pasted into the single and bulk paths |
| D-10 | **`isAdmin` check** | `app/api/admin/data/route.ts:36-38` (a function) vs inline `userId !== process.env.ADMIN_USER_ID` in 10 other files | Only the function has the `!!` empty-env guard |
| D-11 | **Learner-lookup-by-clerk-id** | `app/api/admin/data/route.ts:31-34`, `submissions:23-27`, `submit-assignment:165-169`, `complete-onboarding:25-29`, `weeks/[week]:35-39`, `passport-pdf:508`, `portal/layout:19-20`, `portal/page:44`, plus 9 client `useEffect`s | 17+ copies of the same query. Three use `.single()` (throws on no rows), the rest `.maybeSingle()` |
| D-12 | **Week/Assignment interfaces** | `lib/types.ts:72-134` and `app/portal/assignments/page.tsx:17-48` | Locally redefined with a subset of fields and `pathway: string` instead of the union |
| D-13 | **`@keyframes spin`** | `globals.css:362`, `AssignmentSubmitPanel.tsx:104`, `app/portal/onboarding/page.tsx:168` | Declared three times, twice inline |
| D-14 | **The "eyebrow label" typographic pattern** | ~30 sites | `fontSize` + `fontWeight: 700` + `letterSpacing` + `textTransform: 'uppercase'` re-typed by hand each time, at 5 different font sizes |

## Where failures are swallowed silently

Ordered by consequence.

| # | File:line | What is swallowed |
|---|---|---|
| S-1 | `app/api/submit-assignment/route.ts:272-281` | **The `status: 'AI Reviewed'` + `ai_feedback` write has no error check.** Against the DB CHECK this write always fails (A-2), so freshly generated AI feedback is discarded and the learner sees nothing. The route still returns `{success: true, aiFeedback}` (`:283-287`), so the panel displays feedback once and it is gone on reload |
| S-2 | `app/api/passport-issue/route.ts:121` | `const { data: assignmentRows } = await db.from('assignments').select(...)` — **error discarded.** The select names non-existent columns (PP-2), so this silently yields an empty Evidence Portfolio on every issued credential |
| S-3 | `app/api/passport-issue/route.ts:106` | `const { data: capRows } = ...` — error discarded; feeds the fallback that produces ten identical domain scores |
| S-4 | `app/api/notify/route.ts:243-252` | `try { await db.from('notifications').insert({...}) } catch { /* non-fatal */ }` — **an empty catch with a comment.** A failed in-portal notification is invisible to admin and learner alike |
| S-5 | `app/admin/cohort/page.tsx:90,109,149,175,189` | `.then(r => r.ok && sent++).catch(() => {})` — **five fan-out loops that both swallow errors and miscount.** `sent` is incremented inside an un-awaited `.then()`, and `setResult({success: \`...${sent} emailed\`})` runs at `:93` before any fetch resolves. **The success message always reports `0 emailed`** regardless of outcome |
| S-6 | `app/admin/cohort/page.tsx:121,141` | `.catch(() => {})` on notification creation — fully swallowed |
| S-7 | `app/portal/notifications/page.tsx:67,74` | `await db.from('notifications').update(...)` with no error destructure. RLS denies it (RLS-2); local state updates anyway, so the UI shows "read" and the next reload shows unread |
| S-8 | `app/portal/portfolio/page.tsx:83,95,111` | Post-mutation re-reads via the anon client, error discarded — the list silently fails to refresh after a successful write |
| S-9 | `components/Sidebar.tsx:55-59` | `.then(({ count }) => setUnreadCount(count \|\| 0))` — no error branch; RLS denial becomes a permanent `0` badge |
| S-10 | `app/portal/layout.tsx:22-24` | `catch (err) { console.error('Portal layout: DB error', err) }` then falls through to `if (!isAdmin && !learner)` → **renders "Access Pending".** A database outage is presented to the learner as an account-activation state |
| S-11 | `app/portal/page.tsx:49` | Same pattern without even a catch — a failed `learners` query leaves `learner` undefined → "Access Pending" |
| S-12 | `app/api/webhook/clerk/route.ts:98-106, 119-137, 150-153` | Three `await db.from('learners').update/insert(...)` calls with **no error handling at all**; the handler returns `{message: 'Linked successfully'}` (`:109`) whether or not the write succeeded |
| S-13 | `app/api/admin/data/route.ts:162-163` | `replies_count` read-then-write with no transaction and no error check — lost updates under concurrency |
| S-14 | `app/api/admin/data/route.ts:326, 359` | `await db.from('learners').update({attendance_pct: pct})` — error discarded in both attendance paths |
| S-15 | `app/portal/resources/page.tsx:206-218`, `app/portal/community/page.tsx:33-42` | `Promise.all` destructures only `data` from each result |
| S-16 | 37 sites | `const { data: X } = await db.from(...)` with the `error` field never destructured — a repo-wide pattern |
| S-17 | `app/api/writing-check/route.ts:65` | **No `try/catch` around the Anthropic `fetch`.** A network failure is an unhandled rejection producing a raw 500, not the route's own 502 path |
| S-18 | `app/api/interview/route.ts:217`, `app/api/simulation/route.ts:343,383` | Same — the `fetch` calls are unguarded; only non-OK *responses* are handled |

`console.error`/`console.log` appears 31 times across 13 files (most in `app/api/webhook/clerk/route.ts`, 7). Vercel function logs are the only place any of it lands. There is no error-reporting service, no alerting and no structured logging.

## Tests

**There are none.** Stated plainly:

- No test files: `*.test.*`, `*.spec.*` — zero matches anywhere in the repo.
- No test runner configured: no `jest.config`, `vitest.config`, `playwright.config`, `cypress.config`.
- No test script: `package.json:5-9` has only `dev`, `build`, `start`, `lint`.
- No test dependency: `package.json:20-24` has `@types/node`, `@types/react`, `@types/react-dom`, `typescript`.
- No CI: no `.github/` directory, no workflow file, no pre-commit hook, no Husky.
- No `next lint` configuration: the `lint` script exists but there is **no `.eslintrc*` or `eslint.config.*` file**, so `next lint` would prompt for setup rather than run.

The only automated check that exists and passes is `tsc --noEmit` (via `next build`). Coverage of behaviour: **0%.**

`.claude/settings.local.json` (untracked) records a permission entry for `node --experimental-vm-modules test-interview.mjs` and one for deleting that file, so an ad-hoc script was written and removed at some point. Nothing of it remains.

## Every environment variable read

| Variable | Read at | Server-only or `NEXT_PUBLIC_` | In `.env.local.example`? |
|---|---|---|---|
| `ADMIN_USER_ID` | `app/admin/layout.tsx:14`, `app/admin/page.tsx:25`, `app/admin/learners/page.tsx:12`, `app/admin/learners/[learnerId]/page.tsx:14`, `app/portal/layout.tsx:13`, `app/portal/page.tsx:33`, `app/portal/week/[weekNum]/page.tsx:17`, `app/api/admin/data/route.ts:37`, `app/api/admin/save-week/route.ts:8`, `app/api/admin/publish-week/route.ts:8`, `app/api/notify/route.ts:128,260`, `app/api/passport-issue/route.ts:29`, `app/api/passport-pdf/route.ts:499` | **Server-only** | Yes (`:19`) |
| `SUPABASE_SERVICE_ROLE_KEY` | `lib/supabase.ts:17`, `lib/supabase-admin.ts:7` | **Server-only** | Yes (`:12`) |
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase.ts:10,16`, `lib/supabase-url.ts:8` | **Exposed to the browser** | Yes (`:10`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase.ts:11` | **Exposed to the browser** | Yes (`:11`) |
| `ANTHROPIC_API_KEY` | `app/api/ai-feedback/route.ts:145`, `app/api/interview/route.ts:221`, `app/api/simulation/route.ts:347,387`, `app/api/submit-assignment/route.ts:248`, `app/api/writing-check/route.ts:69` | **Server-only** | Yes (`:23`) — **and see SEC-1** |
| `RESEND_API_KEY` | `app/api/notify/route.ts:23` | **Server-only** | Yes (`:28`) |
| `PASSPORT_SECRET` | `lib/passport.ts:80` | **Server-only** | **NO — undocumented.** Signing throws without it |
| `CLERK_WEBHOOK_SECRET` | `app/api/webhook/clerk/route.ts:35` | **Server-only** | **NO — undocumented.** Absence silently disables signature verification (W-3) |
| `NEXT_PUBLIC_APP_URL` | `app/api/notify/route.ts:64,136,280`, `lib/passport.ts:127` | **Exposed to the browser** | Yes (`:15`) |
| `NEXT_PUBLIC_ZOOM_LINK` | `app/api/notify/route.ts:209` | **Exposed to the browser** | **NO — undocumented** |
| `CLERK_SECRET_KEY` | Not read by app code — consumed by the Clerk SDK | **Server-only** | Yes (`:3`) — **and see SEC-1** |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Not read by app code — consumed by the Clerk SDK | **Exposed to the browser** (by design) | Yes (`:2`) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` / `_AFTER_SIGN_IN_URL` / `_AFTER_SIGN_UP_URL` | Not read by app code — consumed by the Clerk SDK | **Exposed to the browser** | Yes (`:4-7`) |
| `NEXT_PUBLIC_MARKETING_URL` | **Read nowhere** | — | Yes (`:16`) — **declared and never used**; this is the only trace of the marketing site in the portal |

**Three variables are read by code and documented nowhere:** `PASSPORT_SECRET`, `CLERK_WEBHOOK_SECRET`, `NEXT_PUBLIC_ZOOM_LINK`. `PASSPORT_SECRET` and `CLERK_WEBHOOK_SECRET` are also **absent from the local `.env.local`**, which means passport signing and webhook verification are both non-functional in the local environment as checked out. Whether they are set in Vercel cannot be determined from the repo (Section 9, Q4).

There is no runtime env validation — no zod schema, no startup assertion, no `env.ts`. A missing variable surfaces as a thrown `Error` (`lib/passport.ts:81`), a literal `undefined` in an HTTP header (the six `ANTHROPIC_API_KEY!` sites), or a silently skipped feature (`app/api/notify/route.ts:24-27`, `app/api/webhook/clerk/route.ts:36-43`).

## Secrets, keys and credentials committed to the repo

> **RETRACTED 2026-09-12 — SEC-1 below was a false positive. Corrected text follows the strikethrough.**

**~~SEC-1 — `.env.local.example` is tracked in Git and contains real-looking secret values for two variables.~~**

~~Both lines carry values matching live-credential formats rather than placeholder text. Both keys should be treated as compromised and rotated.~~

**Correction.** The `CLERK_SECRET_KEY` and `ANTHROPIC_API_KEY` values in `.env.local.example` are **placeholders, not credentials.** The original sweep used prefix patterns (`sk_test_`, `sk-ant-`) and matched those prefixes *inside* placeholder strings, without checking value length or placeholder markers. Re-checked on 2026-09-12:

| Variable | Value length in file | Real credential length | Placeholder marker present |
|---|---|---|---|
| `CLERK_SECRET_KEY` | 29 | ~48+ | Yes |
| `ANTHROPIC_API_KEY` | 28 | ~108 | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | 34 | 40+ or 200+ | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 26 | 200+ (JWT) | Yes |

A full-history scan for real credential shapes (`sk_live_`/`sk_test_` + 30, `sk-ant-api\d\d-` + 50, `eyJhbGciOiJ` + 40, `re_` + 25, `sb_secret_` + 20, `pk_live_` + 20) across **every commit** and all **98 paths ever tracked** returns zero matches. `.env.local` has never been committed (`git log --all -- .env.local` is empty) and is covered by `.gitignore:27`.

**No real credential has ever been committed to this repo. No rotation was required.** Rotation is harmless if already performed, but it was not necessary and was not caused by a genuine exposure.

The file was still standardised on 2026-09-12 (commit `fix(F-13)`) so that future scans cannot repeat this mistake, and three env vars read by code but previously undocumented — `PASSPORT_SECRET`, `CLERK_WEBHOOK_SECRET`, `NEXT_PUBLIC_ZOOM_LINK` — were added to it.

Confirmed clean, for contrast:

- **`.env.local` was never committed.** `git log --all -- .env.local` is empty, and `.gitignore:26-31` covers `.env`, `.env.local` and the `.env.*.local` variants.
- No other tracked file matches `sk_live|sk_test|pk_live|eyJhbGciOiJ|sk-ant-|re_[A-Za-z0-9]{20}` — the sweep over all 80 tracked files returned only `.env.local.example`.
- No private keys, certificates or `.pem` files (`.gitignore:19` covers `*.pem`).
- `SUPABASE_SERVICE_ROLE_KEY` and `RESEND_API_KEY` carry placeholder text in the example file, not real values.

**SEC-2 — `.claude/` is gitignored but present on disk** (`.gitignore:37-38`). `.claude/settings.local.json` is 7,690 bytes of tool-permission history. Not committed, so not a repo exposure — noted only because it sits inside the project directory and would be captured by any naive archive of the folder.

**SEC-3 — a facsimile signature image is committed.** `lib/upthrust-logo-base64.ts:9` exports `GENESIS_SIGNATURE_DATA_URL`, a base64 PNG of a real person's handwritten signature, generated by `scripts/prep-light-and-sig.js`. It is dead code, so it is not currently rendered anywhere — but it is in the repository, in Git history, and a signature image is a reusable credential-forgery asset. It was evidently prepared for the passport document.

---

# 7. Integration surface

## Every external call

| Service | Direction | Where | Auth | Notes |
|---|---|---|---|---|
| **Supabase** (PostgREST) | Outbound | `lib/supabase.ts:12` (anon), `:18` (service role); 25 server call sites, 14 client files | Anon key (browser) / service-role key (server) | Two client factories. No connection pooling concern — PostgREST over HTTP. No retry, no timeout, no circuit breaker on any call |
| **Supabase Storage** | Outbound | `app/admin/resources/page.tsx:145` (`upload`), `:150` (`getPublicUrl`) | **Anon key** | Bucket `content`. No DDL, no bucket policy, no config in the repo. Files made public by URL |
| **Clerk** | Outbound (SDK) | `@clerk/nextjs` — `clerkMiddleware` (`middleware.ts:6`), `auth()` (24 sites), `<ClerkProvider>` (`app/layout.tsx:15`), `<SignIn>`/`<SignUp>`/`<UserButton>`, `useUser()` (9 client pages) | Publishable + secret key | No custom JWT template, no session claims, **no Supabase integration** (RLS-1) |
| **Clerk** | **Inbound webhook** | `app/api/webhook/clerk/route.ts:61` | Svix signature, **conditionally** (W-3) | Blocked by middleware (W-1) |
| **Anthropic** | Outbound | 6 raw `fetch` calls to `https://api.anthropic.com/v1/messages` — see §4 table | `x-api-key` header, `!`-asserted | `anthropic-version: 2023-06-01`. No SDK, no retry, no backoff, no timeout, no streaming, no token accounting. 3 of the 6 have no `try/catch` |
| **Resend** | Outbound | `app/api/notify/route.ts:30` → `https://api.resend.com/emails` | `Authorization: Bearer` | No SDK. Fails soft when the key is absent (`:24-27`). No webhook back for bounces or deliveries |
| **Google Fonts** | Outbound (browser) | `app/globals.css:1`, `app/api/passport-pdf/route.ts:48` | None | Render-blocking `@import`; no `next/font`, no preconnect, no self-hosting. A third-party request on every page load |
| **Vercel** | Platform | `vercel.json` | — | Framework preset only. No cron jobs, no rewrites, no headers, no CSP, no region pinning |
| **Payments** | — | **NONE** | — | No Stripe, Paystack, Flutterwave, Paddle or any payment SDK or API call. `learners.tier` is set by hand |
| **Notion** | — | **NONE at runtime** | — | `resources.notion_url` is a column the save path writes (R-1) and the UI offers as a link type (`app/admin/resources/page.tsx:33`), but no Notion API is called. `lib/passport.ts:9,43,52,60,70` and `app/verify/[passportId]/page.tsx:7` cite "Notion 2.6 — Capability Framework" as the **source document** for the scoring bands — a design spec that lives outside the repo (Section 9, Q6) |
| **Zoom** | — | **NONE** | — | Zoom is links only: `weeks.zoom_link`, `sessions.zoom_link`, `NEXT_PUBLIC_ZOOM_LINK`. `extractUrl` (`app/api/admin/data/route.ts:19-29`) exists to salvage a URL from a pasted Zoom invite blob |
| **YouTube** | Outbound (iframe) | `app/portal/resources/page.tsx` `VideoModal` | None | Embeds by video ID; no Data API call |
| **Google Drive / Sheets** | — | **NONE** | — | The assumed medium for every learner submission (`submission_url`) and referenced throughout the seeded briefs, but never integrated. No API, no OAuth, no permission check — the portal cannot tell whether a submitted link is even readable |
| **WhatsApp** | — | **NONE** | — | `PROGRAM.whatsapp: ''` (`lib/types.ts:315`), empty. Referenced in seeded onboarding copy (`supabase-weeks-seed.sql:31`) |
| **Calendly** | — | **NONE** | — | `PROGRAM.calendlyPm: ''`, `calendlyBa: ''` (`lib/types.ts:316-317`), both empty |
| Unsplash / Clerk CDN / Google user content | Outbound (images) | Allowlisted in `next.config.js:7-11` | — | `images.unsplash.com`, `img.clerk.com`, `lh3.googleusercontent.com`. **`next/image` is not used anywhere in the app** — the allowlist is unused config |

**Five integrations, in total: Supabase, Clerk, Anthropic, Resend, Google Fonts.** No payments, no calendar, no document API, no messaging, no analytics, no error reporting.

## Data contract shared with the marketing site

**There is no shared contract. The portal has one dead reference to the marketing site and nothing else.**

| Candidate | Finding |
|---|---|
| Shared types | **None.** No shared package, no monorepo, no `git submodule`, no copied `types.ts`. `package.json` has no local or workspace dependency |
| Shared brand assets | **None shared, and none present.** `public/` is empty. The portal's logo is inline SVG (`components/UpthrustLogo.tsx`) — a hand-recreated mark, per its own comment (`:2`: "Recreated as crisp inline SVG"). `lib/upthrust-logo-base64.ts` holds base64 PNGs generated from a file on one developer's Downloads folder (`scripts/prep-logo.js:17`), and is dead code. **The two sites cannot be sharing a logo file; at best they are sharing a colour palette by hand-copy** |
| Shared tokens | **None mechanically.** The palette in `tailwind.config.js` and `app/globals.css:3-18` is duplicated by hand within the portal itself (DS-1); whether the marketing site has the same eleven hex values is not determinable from this repo |
| Pricing / tiers | `learners.tier` CHECK `IN ('Standard','Premium','VIP','Corporate')` (`supabase-schema.sql:15`) and the four `<option>`s at `app/admin/learners/add/page.tsx:161-164`. **No price, currency or instalment structure appears anywhere in the portal.** Tier is assigned manually by an admin. If the marketing site sells tiers, nothing connects the sale to the tier assignment |
| Pathway list | Duplicated by hand in 96 places inside the portal (§2 sweep). Whether the marketing site's list agrees is not determinable here — but the portal's own list is `PM`/`BA` only, and the revamp brief names six programmes |
| Cohort / date facts | Five disagreeing sources inside the portal (§2). Any marketing-site countdown or start date is a **sixth** copy with no mechanism to keep it aligned |
| Webhook between them | **None.** No inbound route other than `/api/webhook/clerk`. No outbound call to any `upthrustdigital.com` host |
| Enrolment handoff | **None.** There is no enrolment API. A learner reaches the portal by an admin adding a row (`/admin/learners/add`) or by self-signup at `/auth/sign-up` followed by manual linking. If the marketing site captures a lead or takes a payment, **the transfer into the portal is a human retyping an email address** |
| `NEXT_PUBLIC_MARKETING_URL` | Declared in `.env.local.example:16` and **read by no code.** The only named link between the two apps, and it is inert |
| Links pointing outward | `app/admin/learners/add/page.tsx:183` prints `https://upthrust-portal-qj18.vercel.app` as the portal link an admin should send. No link to `web.upthrustdigital.com` exists anywhere in the portal |

**DOM-1 — three different portal hostnames are hardcoded across the app**, and they disagree about which is canonical:

| Host | Where | Used for |
|---|---|---|
| `https://upthrust-portal-qj18.vercel.app` | `app/api/notify/route.ts:64,136` (fallback), `app/api/webhook/clerk/route.ts:13` (docblock), `app/admin/learners/add/page.tsx:183` (admin instructions) | Email links and CTAs when `NEXT_PUBLIC_APP_URL` is unset |
| `https://app.upthrustdigital.com` | `lib/passport.ts:128` (fallback), `app/verify/[passportId]/page.tsx:227` (footer copy) | Passport verify URLs and QR payloads |
| `upthrustdigital.com` *(no `app.` prefix)* | `app/api/passport-pdf/route.ts:477` | The verify URL **printed on the credential** |

So a passport's printed verify address, its QR payload (were the QR wired up) and the portal's email links can all point at different hosts. `NEXT_PUBLIC_APP_URL` is set in `.env.local`, which masks the first fallback locally but not the two hardcoded literals.

## Webhook endpoints

**One endpoint exists. One is scaffolded and empty.**

| Endpoint | Caller | Signature verified? | Reachable? |
|---|---|---|---|
| `POST /api/webhook/clerk` | Clerk (via Svix), for `user.created` and `user.updated` — configured in the Clerk dashboard per the route's own docblock (`:11-15`) | **Conditionally.** Requires `svix-id`, `svix-timestamp`, `svix-signature` headers or returns 401 (`:27-30`). Verifies with `svix` **only if `CLERK_WEBHOOK_SECRET` is set** (`:46-58`); otherwise parses and trusts the raw body (`:36-43`) | **No — blocked by middleware (W-1)** |
| `/api/webhooks/*` | — | — | Exempted from auth by `middleware.ts:3`, and **there is no handler there.** An auth-exempt path with nothing behind it |

**The security posture is a coincidence.** W-1 (wrong path) currently prevents anyone reaching the handler, which conceals W-3 (fail-open verification). Fixing the path without also setting `CLERK_WEBHOOK_SECRET` turns `/api/webhook/clerk` into an unauthenticated endpoint that can link an arbitrary Clerk user ID to an arbitrary learner email — an account-takeover primitive against any learner whose email is known. `svix` is already a dependency (`package.json:17`), so the verification path is present and functional; only the secret is missing and undocumented.

No outbound webhooks are sent. No Resend event webhook, no Supabase database webhook, no Vercel deploy hook, no Stripe-style receiver. `vercel.json` defines no cron, so the `GET /api/notify?week=N` reminder fan-out has **no scheduler** — it can only be triggered by an admin clicking a button in `/admin/cohort`.

---

# 8. Findings register

Severity is about the code as it stands today. Revamp risk is about absorption targets **A** (six programmes, two lengths), **B** (Lab surface), **C** (visual rebuild), **D** (per-cohort facts). Ranked by revamp risk first, then severity.

| ID | Area | Finding | Evidence (file:line) | Severity | Revamp risk |
|---|---|---|---|---|---|
| **F-1** | Data model | Pathway is encoded in **twelve `pm_*`/`ba_*` column names** on `weeks`, plus a two-value CHECK on `assignments.pathway`. Adding a programme is a schema migration, not a data insert | `supabase-schema.sql:49-58`, `supabase-additions.sql:44-45`, `supabase-schema.sql:69` | Low today | **BLOCKER for A and B** |
| **F-2** | Data model / types | **142 hardcoded locations** encode a programme identifier or programme length. 96 pathway, 40 length, 46 cohort/date. No single source of truth for any of them | §2 sweep, H-1…H-142 | Low today | **BLOCKER for A, B, D** |
| **F-3** | Data model | Two exported types named `Pathway` with **disjoint value sets**, bridged by the regex `/business/i.test(pathway)`. Any programme not containing "business" is silently classified Product Management — so Product Design, Payment Operations and AI Product Builder would all issue PM credentials | `lib/types.ts:1` vs `lib/passport.ts:37`; `lib/passport.ts:40,145`; `app/api/passport-issue/route.ts:141` | Medium | **BLOCKER for A** |
| **F-4** | Data model | **No representation of programme length anywhere.** No `programmes` table, no `weeks_total`, no `programme_id`. Length exists only as literal `12`/`13` in 40 places and as the row count in `weeks`. 12-week and 5-week programmes cannot coexist | `lib/types.ts:312`; H-21…H-40 | Low today | **BLOCKER for A** |
| **F-5** | Labs | **No dataset-backed exercise surface exists, in any form.** No dataset table/column/file; no per-week scoping mechanism; no timeboxing fields; no Core/Advanced dimension; no evidence-citation. `weeks.lab_exercise` is one TEXT column, never populated by any seed, rendered as a read-only paragraph | `supabase-schema.sql:46`; `app/portal/week/[weekNum]/page.tsx:149-158`; §4 Labs | Low today | **BLOCKER for B** |
| **F-6** | Labs | `assignments` is `UNIQUE(learner_id, week_number, pathway)` — **a learner structurally cannot hold two options for the same week**, which the 4×8×2 = 64-assignment matrix requires | `supabase-schema.sql:81` | Low today | **BLOCKER for B** |
| **F-7** | UI | **Below 768px there is no navigation at all.** `.portal-sidebar { display: none }` in the 768px block is never reset by the 700px block; there is no hamburger, drawer or mobile menu anywhere in the codebase (0 hits for any such pattern) | `app/globals.css:195-199` vs `:381-386`; `grep` for hamburger/drawer/aria-expanded → 0 | **High** | **BLOCKER for C** |
| **F-8** | UI | **~85–90% of the UI is bespoke inline-styled markup.** 1,441 inline `style={{}}` objects vs 454 `className`s. Shared component library is **two components in use** (`Sidebar`, `UpthrustLogo`). Zero of 28 screens is assembled from shared primitives. Inline styles cannot carry media queries, so the dense-console conversion is a rewrite, not a re-theme | Counts in §5; `components/` (3 files, 1 dead) | Medium | **BLOCKER for C** |
| **F-9** | UI | 23 fixed multi-column grids across 15 routes are declared inline with **no media query and no structural ability to have one** — incl. `repeat(5, 1fr)` stat rows and `1fr 320-360px` rails that force horizontal page scroll on a phone | `app/admin/page.tsx:103,112`; `app/portal/page.tsx:169,185`; +19 more, §5 table | Medium | **BLOCKER for C** |
| **F-10** | Data model | **Five disagreeing sources of cohort/date truth**, and re-running the content seed republishes all 13 weeks, reverting every manual unpublish | `lib/types.ts:305-334`; `supabase-schema.sql:147-202`; `supabase-weeks-seed.sql:26-171` (`:171`); `app/portal/sessions/page.tsx:15-23`; 8× `getCurrentWeek()` | **High** | **BLOCKER for D** |
| **F-11** | Data model | `getCurrentWeek()` duplicated in **eight files**, each hardcoding `2026-06-06` and a cap of 12; one returns `-1` where seven return `0` | `app/portal/layout.tsx:66`, `app/admin/layout.tsx:32`, `app/portal/page.tsx:23`, `app/admin/page.tsx:328`, `app/portal/week/page.tsx:56`, `app/portal/sessions/page.tsx:9`, `app/portal/resources/page.tsx:45`, `app/admin/attendance/page.tsx:9` | Medium | **BLOCKER for A and D** |
| **F-12** | Data model | Cohort is free text defaulting to `'Cohort 1'`, written by three paths, changeable by **no** UI. `admin_update_learner` accepts only pathway/tier/status. **A second cohort cannot be created through the product** | `supabase-schema.sql:16`; `app/api/webhook/clerk/route.ts:126`; `app/admin/learners/add/page.tsx:49`; `app/api/admin/data/route.ts:71-73` | **High** | **BLOCKER for D** |
| **F-13** | Security | ~~`.env.local.example` is tracked in Git with real-looking secret values for `CLERK_SECRET_KEY` and `ANTHROPIC_API_KEY`.~~ **RETRACTED 2026-09-12 — FALSE POSITIVE.** Those values are placeholders (24–34 chars, each containing a `REPLACE`/`YOUR`/`here` marker). The original sweep matched the `sk_test_` and `sk-ant-` *prefixes* inside placeholder strings and did not check length or markers. A full-history scan for real credential shapes across all commits and all 98 ever-tracked paths returns nothing: **no real credential has ever been committed to this repo.** No rotation was required. See commit `fix(F-13)` | `.env.local.example` | ~~BLOCKER~~ **Not a defect** | Independent |
| **F-14** | Auth | `update_profile` spreads an **unvalidated `fields` object** into a service-role `.update()` on the caller's own learner row. Any signed-in learner can set `passport_eligibility: 'Approved'`, `avg_score: 95`, `tier: 'Premium'`, `enrollment_status`, `pathway`, `risk_status`. The correct allowlist pattern exists 12 lines below in the same file | `app/api/admin/data/route.ts:54-61` vs `:70-75` | **BLOCKER** | Independent |
| **F-15** | Auth | Combined with F-14: the Premium-tier gate on passport download is **UI-only** — `passport-pdf` checks eligibility and never reads `tier`. A learner can self-approve then fetch their credential | `app/portal/passport/page.tsx:108,117-124` vs `app/api/passport-pdf/route.ts:517` | **High** | Independent |
| **F-16** | Grading | **Three of four review-queue buttons write statuses the DB CHECK forbids** (`Resubmission Requested`, `Human Reviewed`, `AI Reviewed`). The revision loop cannot be initiated, and every downstream feature reading those statuses is unreachable code | `supabase-schema.sql:73` vs `app/admin/reviews/page.tsx:44,288,292` and `app/api/submit-assignment/route.ts:278` | **BLOCKER** | Independent |
| **F-17** | Grading | **`learners.avg_score` and `assignment_completion_pct` are never recomputed.** Grading an assignment does not move the learner's average — which gates passport eligibility, the dashboard, and the criteria list. `attendance_pct` *is* recomputed, so the intent existed and was applied to one of three metrics | `app/api/admin/data/route.ts:227-249` (no `avg_score` write); read at `app/api/passport-issue/route.ts:73,76`, `app/portal/page.tsx:172`, `app/portal/passport/page.tsx:65` | **BLOCKER** | Independent |
| **F-18** | Passport | **`components/PassportControls.tsx` has zero import sites.** It is the only UI for Issue/Re-issue/Revoke, so `/api/passport-issue` has no caller and **no passport can be issued through the product** | `components/PassportControls.tsx`; `app/admin/learners/[learnerId]/page.tsx:9-10` | **BLOCKER** | Independent |
| **F-19** | Auth / routing | **The "public" verification page requires Clerk sign-in.** Not in `isPublicRoute`; documented as public in its own header and footer. The passport's entire external value proposition is unreachable by employers | `middleware.ts:3-6`; `app/verify/[passportId]/page.tsx:3,227` | **BLOCKER** | Independent |
| **F-20** | Auth / routing | **The Clerk webhook is unreachable.** Middleware exempts `/api/webhooks/*` (plural, empty dir); the handler is at `/api/webhook/clerk` (singular). No automatic account linking ever fires; the UI already hedges on this in two places | `middleware.ts:3` vs `app/api/webhook/clerk/route.ts:13`; `app/admin/learners/[learnerId]/page.tsx:63` | **BLOCKER** | Independent |
| **F-21** | Security | Webhook signature verification **fails open**: with `CLERK_WEBHOOK_SECRET` unset, any request with three arbitrary `svix-*` headers is trusted and can link a Clerk ID to a learner email. The secret is undocumented and absent locally. F-20 currently masks this; fixing F-20 alone weaponises it | `app/api/webhook/clerk/route.ts:36-43` | **High** (latent) | Independent |
| **F-22** | Data model / RLS | **Four tables have RLS enabled with zero policies** and six "own row" policies key on `request.jwt.claims->>'sub'`, which is never populated because **no Clerk→Supabase JWT bridge exists**. Consequence: browser-side Supabase calls across 14 files cannot succeed. The correct architecture is documented in three docblocks and the migration to it was left half-finished | `supabase-schema.sql:205-212`; `supabase-additions.sql:167,171,177,183,187,218`; `lib/supabase.ts:9-13`; §2 RLS-2 table | **BLOCKER** | Independent |
| **F-23** | Admin | Three admin capabilities are enforced by RLS alone and RLS denies them: **Add Learner**, **manual Clerk account linking** (the documented fallback for F-20), and **reading draft weeks** in the Week Content editor | `app/admin/learners/add/page.tsx:41,78`; `ClerkLinkForm.tsx:16`; `app/admin/content/page.tsx:44` | **BLOCKER** | Independent |
| **F-24** | Data model | `passports.learner_id` is **`bigint`** while `learners.id` is **`uuid`**; no FK declared. Every passport insert fails against the repo schema, and the mismatch would also break the HMAC canonical string | `passports.sql:12`; `app/api/passport-issue/route.ts:157,177`; `lib/passport.ts:98` | **BLOCKER** | Independent |
| **F-25** | Passport | The issuer selects `title, reviewer, reviewed_by` from `assignments` — **none of which exist** — and discards the error, so **every issued passport carries an empty Evidence Portfolio** | `app/api/passport-issue/route.ts:121-132`; `supabase-schema.sql:65-82` | **High** | Independent |
| **F-26** | Data model | **`capability_scores` is insert-only; nothing ever raises a level or score.** Learner-facing Capability Areas read "Not Started" permanently, and the passport snapshot falls back to the overall score for every domain — ten identical numbers on every credential | `app/admin/learners/add/page.tsx:78-82` (only write); `app/api/passport-issue/route.ts:115`; `app/portal/passport/page.tsx:173-196` | **High** | **A** (domains are per-pathway) |
| **F-27** | Passport | **`lib/qr.ts` (295 lines, complete QR encoder) has zero import sites.** The credential renders a drawn `<span>QR<br/>CODE</span>` box. `QR_PATCH.md` is a 55-line file describing the three edits to wire it up — written, never applied. Meanwhile the learner page promises "QR code for employer verification" | `lib/qr.ts`; `app/api/passport-pdf/route.ts:479-481`; `app/api/passport-pdf/QR_PATCH.md`; `app/portal/passport/page.tsx:213` | **High** | Independent |
| **F-28** | Passport | The printed credential **never reads the `passports` table.** It recomputes from `learners` and invents per-domain scores as `avg_score` × 1.05/0.98/1.02/0.95/1.0/0.97, over a **fourth capability taxonomy** (6 labels vs 10/11 in `lib/passport.ts` and 10 in `lib/types.ts`). The signed snapshot and the document handed to the learner are two different computations of different numbers | `app/api/passport-pdf/route.ts:21-35`, `:491-533`; D-6 | **High** | **A** |
| **F-29** | Passport | The `?sig` query parameter is **decorative**: `cryptoVerified = sigParamValid \|\| storedSigValid`, and `storedSigValid` checks a row's stored signature against that same row's fields — self-consistent by construction. Any issued row shows "cryptographically authenticated" with or without a sig | `app/verify/[passportId]/page.tsx:123-125` | Medium | Independent |
| **F-30** | Passport | **Three incompatible passport ID formats** in simultaneous use: `UP-C1-XXXX-PM`, `UPT-PM-C1-2026-001`, and a `'UP-C1-XXXX'` literal on the printed credential. `passport-issue` only honours IDs starting `UPT-`, so every admin-created learner gets a new ID at issuance, invalidating any previously shared link. `passport_id` has no unique index | `app/admin/learners/add/page.tsx:39`; `supabase-additions.sql:192`; `lib/passport.ts:138-147`; `app/api/passport-issue/route.ts:149-153`; `app/api/passport-pdf/route.ts:477` | **High** | **A**, **D** |
| **F-31** | Data model | **`sessions` is used in production with no DDL anywhere in the repo** — read, inserted, updated and deleted across two pages and 216+208 lines of UI | `app/api/admin/data/route.ts:262,271,285,490`; `app/portal/sessions/page.tsx:34` | **High** | Independent |
| **F-32** | Data model | The resource save path writes **five columns that exist in no SQL file** (`content_level`, `link_type`, `notion_url`, `youtube_url`, `duration_mins`), and `lib/types.ts` declares 13 `ResourceType` values against the schema's 7. 567 lines of admin UI depend on it, so production has almost certainly been altered by hand with nothing recording it | `app/api/admin/data/route.ts:385-401`; `supabase-additions.sql:65-79`; `lib/types.ts:9-30,161` | **High** | Independent |
| **F-33** | Portfolio | The portfolio insert writes `submitted_at`, **a column `portfolio_items` does not have** — so every "Add artefact" fails, visibly, with an `alert()` | `app/api/admin/data/route.ts:96`; `supabase-schema.sql:122-134` | **High** | Independent |
| **F-34** | Data model | `assignments.portfolio_approved` is **read in six places and written nowhere**, so the "approved for portfolio" state is permanently false. Same for `is_portfolio_ready`, `ai_score`, `ai_quality_rating`, `is_late`, `extension_granted`, `missed_session_task_sent`, `pm_rubric_json`, `ba_rubric_json` | `supabase-additions.sql:22-30`, `:37`, `:44-45`; §6 orphan table | Medium | **B** (rubric JSON is the natural Core/Advanced carrier) |
| **F-35** | Submissions | `if (!weekNumber === undefined \|\| ...)` — `!weekNumber` is a boolean and never `=== undefined`, so the clause is always false and **the `weekNumber` guard is a no-op**. A submission with a missing or `NaN` week reaches the database | `app/api/submit-assignment/route.ts:158` | **High** | Independent |
| **F-36** | AI | **`ai_practice_attempts` is written by nothing.** All three AI features return output to the browser and persist nothing. Every practice session is lost on reload; the passport's AI-contributions card never renders; there is no record of what any learner practised | `app/portal/passport/page.tsx:50` (only reference); `app/api/interview/route.ts`, `simulation/route.ts`, `writing-check/route.ts` | **High** | **B** |
| **F-37** | AI | AI feedback is generated **without the submission**. Both prompt sets tell the model it cannot see the work; the learner-facing label presents it as review of their submission. Honest in the prompt, misleading in the UI | `app/api/ai-feedback/route.ts:136`; `app/api/submit-assignment/route.ts:242`; `app/portal/assignments/page.tsx:295` | Medium | **B** |
| **F-38** | Security | **Stored XSS in four AI-output render sites.** `dangerouslySetInnerHTML` with only a `**bold**` → `<strong>` replacement, **no HTML escaping**. The writing-checker path is self-XSS (learner pastes text, model quotes it back, markup executes); the `/admin/reviews` path renders learner-influenced `ai_feedback` in the **admin's** session | `app/portal/writing-check/page.tsx:210`; `app/portal/interview/page.tsx:304`; `app/portal/simulation/page.tsx:402`; `app/admin/reviews/page.tsx:231` | **High** | Independent |
| **F-39** | Email | `notify` receives no `weekNumber` or `pathway` from the review queue, so learners receive **"Feedback on your Week undefined assignment is ready"** | `app/admin/reviews/page.tsx:62-70` vs `app/api/notify/route.ts:167-173,179-184` | **High** | Independent |
| **F-40** | Email / data | The `.eq('enrollment_status', 'Active')` anti-pattern in **three places**, excluding the `Pending` learners the webhook creates and the column defaults to: session-reminder fan-out, the admin dashboard's "Active Learners" count and submission-rate denominator, and the admin learner-table stats. The correct `.neq(..., 'Withdrawn')` is used in four other places, so the fix is known and unevenly applied | `app/api/notify/route.ts:274`; `app/admin/page.tsx:43`; `app/admin/learners/page.tsx:18`; `supabase-additions.sql:126`. Correct at `app/api/admin/data/route.ts:191,338,456,468` | **High** | **D** |
| **F-41** | Email | The reminder fan-out self-calls its own POST N times forwarding the admin's cookie, and counts `Promise.allSettled` fulfilments — so a run where all N calls return 500 reports `sent: N`. There is also **no scheduler**: `vercel.json` defines no cron, so reminders only fire on a button click | `app/api/notify/route.ts:278-288`; `vercel.json` | Medium | Independent |
| **F-42** | Admin | Five fan-out loops increment `sent` inside an **un-awaited `.then()`**, then report it in a success message that runs first — so `/admin/cohort` **always tells the admin "0 emailed"** regardless of outcome, and `.catch(() => {})` swallows every failure | `app/admin/cohort/page.tsx:90,93,109,149,175,189` | Medium | Independent |
| **F-43** | Attendance | The attendance-% denominator is `weekNumber + 1`, assuming every week 0..N has been held, and uses the *marked* week rather than the current one. Marking week 12 early sets the denominator to 13 for everyone; marking an earlier week retroactively inflates every learner's percentage. Also `arrival: 'Excused'` counts as attended | `app/api/admin/data/route.ts:321,343`, `:303,348` | Medium | **A** (denominator is week-count-derived) |
| **F-44** | Error handling | A DB failure in the portal layout and dashboard is presented to the learner as **"Access Pending"** — an outage is reported as an account state | `app/portal/layout.tsx:22-24,26`; `app/portal/page.tsx:49` | Medium | Independent |
| **F-45** | Error handling | **37 query sites destructure `{ data }` and never read `error`**, including the two that silently empty every passport's evidence and capability breakdown. Three webhook writes have no error handling at all | §6 S-1…S-18; `app/api/passport-issue/route.ts:106,121`; `app/api/webhook/clerk/route.ts:98,119,150` | **High** | Independent |
| **F-46** | Auth | `community_like` takes an arbitrary `newCount` from any signed-in user with no ownership, ledger or bounds check. `replies_count` is a read-then-write with no transaction | `app/api/admin/data/route.ts:167-172`, `:162-163` | Medium | Independent |
| **F-47** | Tests | **There are no tests.** No test files, no runner, no CI, no `.eslintrc` (so `next lint` cannot run). The only automated check is `tsc --noEmit`, which passes | `package.json:5-9,20-24`; no `.github/` | **High** | Independent |
| **F-48** | Observability | **No analytics, no error reporting, no structured logging.** Zero hits for gtag/PostHog/Mixpanel/Segment/Vercel Analytics/Sentry. 31 `console.*` calls into Vercel logs are the only telemetry. There is no way to answer "how many learners opened week 4" | `grep` across `app`, `components`, `lib` → 0 | Medium | **C**, **D** |
| **F-49** | Dead code | **~900 lines of unreachable route code** (`/api/ai-feedback` 185, `/api/submissions` 101, `/api/passport-issue` 212, `/api/webhook/clerk` 162, `/verify/[passportId]` 252) plus 7 unreferenced files (`lib/qr.ts` 295, `lib/upthrust-logo-base64.ts` 90 KB, `lib/supabase-admin.ts`, `lib/supabase-url.ts`, `components/PassportControls.tsx`, 2 scripts) and 31 unused CSS classes | §6 Dead code | Medium | **C** |
| **F-50** | Design system | **31 declared CSS classes have zero uses**, including `.portal-header` (the top utility bar target C needs), `.tab-bar`/`.tab-item`, all five `.alert-*`, all five `.badge-*` colours, `.stat-card`, `.progress-bar`, and all four `.phase-*`. The design system was written and then bypassed by inline styles | `app/globals.css:70-81,126-141,202-205,232-329`; usage counts in §5 | Medium | **C** |
| **F-51** | Design system | **Four independent definitions of the brand palette** (CSS vars, Tailwind config, `lib/types.ts` colour maps, and a separate `NAVY`/`GOLD` set in the verify + passport surfaces), plus per-file hex. Tailwind is installed, configured and effectively unused — its four `display-*` sizes have zero usage | `app/globals.css:3-18`; `tailwind.config.js`; `lib/types.ts:269-302`; `app/verify/[passportId]/page.tsx:22-25` | Medium | **BLOCKER-adjacent for C** |
| **F-52** | Design system | **~34 distinct unnamed font sizes**; no spacing scale, no radius scale, no shadow or z-index scale. The eyebrow-label pattern is re-typed by hand ~30 times at 5 different sizes | §5 Type scale / Spacing | Medium | **C** |
| **F-53** | A11y | **`htmlFor` count across the entire codebase is 0.** Every one of ~80 form controls is unlabelled to a screen reader; labels are siblings with no `id`, `aria-label` or `aria-labelledby` | `grep htmlFor` → 0; `form-input` ×80 | **High** | **C** |
| **F-54** | A11y | **`aria-*` appears exactly once**, on the logo's `aria-hidden`. No `aria-live` on any async result region, no `role="dialog"`/`aria-modal` on the five hand-rolled modals, no `aria-current` on nav, no `role="tab"` on the tab bar. The only accessible markup in the repo is in `lib/qr.ts` — dead code | `components/UpthrustLogo.tsx:14`; `lib/qr.ts:294` | **High** | **C** |
| **F-55** | A11y | The five modals have **no focus management, no focus trap and no Escape handler**; a keyboard user tabs straight into the un-inerted page behind. `.focus-visible` styling covers `.btn` but not bare `<button>`s, several of which set `border: none` | `app/admin/resources/page.tsx`, `sessions`, `content`, `portal/portfolio`, `portal/resources`; `app/globals.css:389-396` | Medium | **C** |
| **F-56** | A11y | Contrast and size failures visible from the values: `--amber #C5743A` on `--paper` ≈ 3.1:1; sidebar section labels at `rgba(250,247,241,0.25)` on `--ink` ≈ 2.4:1; verify-page stat labels `#9AA1AC` on white ≈ 2.6:1. Compounded by the eyebrow pattern rendering at **8–10px uppercase with 0.12–0.22em tracking** | `app/globals.css:10`; `components/Sidebar.tsx:100-105`; `app/verify/[passportId]/page.tsx:238` | Medium | **C** |
| **F-57** | UI | **Three routes have no loading, empty or error state**: `/portal/week`, `/portal/sessions`, `/portal/passport`. There is **no `loading.tsx`, `error.tsx` or `global-error.tsx` anywhere** — the App Router's own primitives are unused, so a thrown server error renders the unstyled Next error page | §5 state table; `find app -name 'loading.tsx' -o -name 'error.tsx'` → 0 | Medium | **C** |
| **F-58** | UI | 17 `alert()` calls plus `confirm()` are the primary error and confirmation channel for learners and admins — unstyleable, main-thread-blocking native dialogs | 7 files, §5 A11Y-8 | Medium | **C** |
| **F-59** | Integrations | **Three different portal hostnames hardcoded** — `upthrust-portal-qj18.vercel.app` (email fallbacks, admin instructions), `app.upthrustdigital.com` (passport verify + QR payload), `upthrustdigital.com` (printed on the credential). A passport's printed address, its QR payload and the portal's email links can all point at different hosts | `app/api/notify/route.ts:64,136`; `lib/passport.ts:128`; `app/verify/[passportId]/page.tsx:227`; `app/api/passport-pdf/route.ts:477`; `app/admin/learners/add/page.tsx:183` | Medium | **D** |
| **F-60** | Integrations | **No data contract with the marketing site exists.** No shared types, no shared assets (`public/` is empty), no webhook, no enrolment API. `NEXT_PUBLIC_MARKETING_URL` is declared and read by nothing. If the marketing site captures a lead or takes payment, **the handoff into the portal is a human retyping an email address** | `.env.local.example:16` (unread); `public/` empty; no inbound route but `/api/webhook/clerk` | **High** | **A**, **D** |
| **F-61** | Integrations | **No payment integration of any kind.** `learners.tier` — which F-15 shows gates the credential in the UI — is set by hand by an admin | `supabase-schema.sql:15`; `app/admin/learners/add/page.tsx:161-164` | Medium | **A** |
| **F-62** | Config | **Three env vars are read by code and documented nowhere**: `PASSPORT_SECRET`, `CLERK_WEBHOOK_SECRET`, `NEXT_PUBLIC_ZOOM_LINK`. The first two are also absent from the local `.env.local`, so passport signing and webhook verification are both non-functional as checked out. There is no runtime env validation anywhere | `lib/passport.ts:80`; `app/api/webhook/clerk/route.ts:35`; `app/api/notify/route.ts:209`; `.env.local.example` | **High** | Independent |
| **F-63** | Data model | `community_replies` is **created twice with conflicting FK behaviour** (CASCADE vs SET NULL), and its SELECT policy is created twice — the duplicate `CREATE POLICY` **raises an error that aborts the rest of `supabase-additions.sql`**, so everything after line 213 may never have been applied | `supabase-schema.sql:111-120,220` vs `supabase-additions.sql:201-209,213` | **High** | Independent |
| **F-64** | Data model | `learners.clerk_user_id` is `NOT NULL UNIQUE`, yet the app creates learners without it and renders a "not linked yet" branch for NULLs. Either production dropped the constraint or Add Learner has never worked | `supabase-schema.sql:8`; `app/admin/learners/add/page.tsx:41-64`; `app/admin/learners/[learnerId]/page.tsx:59` | Medium | Independent |
| **F-65** | Seeds | **12 seeded resource rows carry `external_url = '#'`** and are live, active and rendered to learners as clickable templates that go nowhere. No seed is dev-gated; all four SQL files instruct the reader to run them against production | `supabase-additions.sql:132-143` | Medium | Independent |
| **F-66** | Seeds | The capability-score seed and the passport-ID backfill both key on `enrollment_status = 'Active'` or run unconditionally against all learners, assigning **randomly numbered non-canonical passport IDs** with no unique index | `supabase-additions.sql:126`, `:191-193` | Medium | **A**, **D** |
| **F-67** | Ops | **No migration system.** Schema lives in four loose root-level `.sql` files applied by hand via the Supabase SQL Editor, with no ledger. The repo cannot prove what production contains, and F-32's evidence suggests it has already drifted | `supabase-schema.sql:2`; `supabase-additions.sql:3`; `passports.sql:3`; no `supabase/migrations/` | **BLOCKER** | **A**, **B**, **D** |
| **F-68** | Ops | Every page is `force-dynamic`; no ISR, no `revalidate`, no caching anywhere. Every page load is a fresh set of Supabase round-trips, and the bulk-attendance path issues 3N sequential queries | `next.config.js:4`; 28 × `export const dynamic`; `app/api/admin/data/route.ts:344-360` | Medium | **C** |
| **F-69** | Roles | **The role model is two roles, one of which is a single person in one env var**, compared with `===` in 13 places. No facilitator, mentor, reviewer or read-only role; no multi-admin support; no audit log of admin actions. Adding a second facilitator is a code change | 13 `ADMIN_USER_ID` sites, §3 | **High** | **A** (six programmes implies more than one facilitator) |
| **F-70** | Code health | 53 `any`, clustered on `useState<any>` for the learner record in **nine client pages** and `getLearner(db: any)` in the 19-action dispatcher — which is precisely why the column mismatches in F-32, F-33 and F-25 compile cleanly | `app/api/admin/data/route.ts:31`; 9 client pages, §6 | Medium | Independent |
| **F-71** | Code health | 14 duplicated-logic clusters, incl. **four incompatible capability taxonomies**, two divergent assignment-status colour maps, ~230 duplicated lines of AI prompts, and the learner-lookup query written 17+ times with inconsistent `.single()`/`.maybeSingle()` | §6 D-1…D-14 | Medium | **A**, **C** |
| **F-72** | Data model | Every enumeration is a TEXT column with an inline CHECK plus a parallel TS union, and several disagree (statuses in F-16, resource types in F-32). `passports` has **no CHECK constraints at all** despite documenting three `status` values in comments | §2 Enums; `passports.sql:17,24` | Medium | **A** |
| **F-73** | Curriculum | The Week Content editor **cannot load unpublished weeks** (RLS `is_published = TRUE` via the anon client) — editing drafts is the page's only purpose | `app/admin/content/page.tsx:44`; `supabase-schema.sql:215` | **High** | Independent |
| **F-74** | Curriculum | `/portal/week/[weekNum]` fetches the week's assignment with `.maybeSingle()` and **no pathway filter**, while `assignments` is unique on `(learner_id, week_number, pathway)` — a learner with both a PM and BA row for one week gets a multiple-rows error | `app/portal/week/[weekNum]/page.tsx:46-52` | Medium | **A** |
| **F-75** | Submissions | **Learners cannot upload a file.** The single `<input type="file">` in the codebase is admin-only. Every submission is a pasted URL validated only by `new URL()`, which accepts `javascript:` and `file:` schemes. The only Storage usage is an admin upload via the **anon** key to an undocumented public bucket | `app/admin/resources/page.tsx:477,145-150`; `AssignmentSubmitPanel.tsx:39-41` | **High** | **B** |
| **F-76** | Email | `assignment_due` is declared in the notification type union and the DB CHECK but has **no `case`** — it falls to `default` and returns 400. `resubmission_required` is unreachable because F-16 fails the status write before the email is sent | `app/api/notify/route.ts:16,236`; `app/admin/reviews/page.tsx:66` | Medium | Independent |
| **F-77** | Email | No unsubscribe link, no `List-Unsubscribe` header, no bounce or delivery handling. `sendEmail` returns `{sent:false, reason}` and **no caller inspects it** | `app/api/notify/route.ts:22-55,240`; `app/admin/reviews/page.tsx:70` | Medium | **D** |
| **F-78** | Community | `community_posts` and `community_replies` are the only tables with `USING (TRUE)` SELECT policies — so **any holder of the anon key (which ships in the JS bundle) can read every post and reply**, signed in or not | `supabase-schema.sql:219-220` | Medium | Independent |
| **F-79** | Community | The learner lookup on the community page is anon and fails, so `learner` is null and the posting guard blocks **every learner**; only the admin can post | `app/portal/community/page.tsx:37,69` | **High** | Independent |
| **F-80** | Security | A **facsimile of a real person's handwritten signature** is committed to the repo as a base64 PNG (`GENESIS_SIGNATURE_DATA_URL`), evidently prepared for the passport document. Currently dead code, but it is in Git history and is a reusable credential-forgery asset | `lib/upthrust-logo-base64.ts:9`; `scripts/prep-light-and-sig.js` | Medium | Independent |
| **F-81** | Security | Three AI routes have **no `try/catch` around the `fetch`** (network failure → unhandled rejection, raw 500), and all six assert `process.env.ANTHROPIC_API_KEY!` so a missing key sends a literal `undefined` header. No rate limit, quota or cost accounting on any of the six | `app/api/writing-check/route.ts:65`; `app/api/interview/route.ts:217`; `app/api/simulation/route.ts:343,383` | Medium | **B** |
| **F-82** | Repo hygiene | Seven empty directories, incl. a literal directory named `{app,components,lib,types}` (a failed brace expansion), plus `app/auth/login/`, `app/auth/register/` and `app/auth/verify/` — the last of which suggests the verify page was once meant to live under the auth matcher, which would have prevented F-19 | Root listing; `app/api/webhooks/`, `app/auth/*` | Low | Independent |
| **F-83** | UI | The three Clerk surfaces (`<SignIn>`, `<SignUp>`, `<UserButton>`) are used **entirely unstyled** — no `appearance` prop, no `baseTheme`, no override anywhere. Clerk's default look inside an Upthrust wrapper is the first thing a user sees | `app/auth/sign-in/page.tsx:15`; `app/auth/sign-up/page.tsx:15`; `components/Sidebar.tsx:203` | Low | **C** |
| **F-84** | Perf | Fonts load via a **render-blocking CSS `@import`** from Google Fonts, duplicated inside the passport HTML. No `next/font`, no preconnect, no self-hosting. `next/image` is never used, so the `remotePatterns` allowlist is dead config | `app/globals.css:1`; `app/api/passport-pdf/route.ts:48`; `next.config.js:7-11` | Low | **C** |
| **F-85** | Ops | `/admin/cohort` is named Cohort Settings and **cannot change any cohort setting** — no cohort name, dates, week count or programme list. It is an announcements-and-email console | `app/admin/cohort/page.tsx` | Medium | **BLOCKER-adjacent for D** |

### What is well built and should be kept

Stated because the revamp needs to know what not to throw away:

1. **The attendance subsystem** (`app/api/admin/data/route.ts:294-376`, `app/admin/attendance/page.tsx`) — admin-gated at the handler, validated inputs, upsert-by-lookup, derived metric recomputed after every write, individual + bulk + note paths, full loading/empty/error states. This is the reference implementation the rest of the app should have followed.
2. **`lib/passport.ts`** — documented canonical field order, `timingSafeEqual` with a length pre-check, secret read at call time with a throw, and an explicit warning that the field order must never change. Correct cryptography, correctly commented.
3. **The service-role-through-API-routes architecture** — correct, and documented in three separate docblocks. It is half-migrated, not wrong.
4. **Ownership is always derived from the Clerk session, never from the request body.** No learner-facing endpoint accepts a `learnerId`. `portfolio_edit`/`portfolio_delete` add a defence-in-depth ownership predicate.
5. **The passport issuance integrity gate** (`app/api/passport-issue/route.ts:85-97`) — a hard data-quality check that no `Approved` override can bypass.
6. **`passports` RLS** — enabled with no policies, explicitly to prevent anon-key enumeration, with the reasoning written into the migration.
7. **`app/portal/assignments/page.tsx:107-124`** — the only pathway read site that refuses to guess. It is the correct pattern for target A, already written.
8. **`lib/ai-models.ts`** — model strings centralised with the reasoning recorded, and all six call sites import it. A lesson clearly learned the hard way.
9. **The shared app shell** (`.portal-layout` / `Sidebar` / `.portal-main`, used by both layouts) — the one genuinely reusable UI structure.
10. **`app/verify/[passportId]/page.tsx:213-222`** — a deliberately honest "How to interpret this" panel that refuses to overclaim employer recognition. Keep the judgement, not just the copy.
11. **Tables scroll rather than overflow** — all four are wrapped in `.table-wrapper`.
12. **`tsc --noEmit` passes clean**, and there are zero `@ts-ignore`/`@ts-expect-error` suppressions. Nobody papered over a type error.
13. **No TODO/FIXME/HACK and no commented-out code** anywhere in 12,715 lines.
14. **The AI prompts themselves are good** — the five simulation characters have hidden agendas and pressure points; the interview bank withholds model answers until after submission. That is real instructional design, and it is portable.

---

# 9. Open questions for the product owner

These are things the code genuinely cannot answer.

**Q1 — What does the production database actually contain?** This is the question that gates the whole plan. The repo has no migration ledger, and three code paths write columns that no SQL file declares (`resources.content_level`/`link_type`/`notion_url`/`youtube_url`/`duration_mins`, `portfolio_items.submitted_at`), one table has no DDL at all (`sessions`), and one has a type that cannot work as written (`passports.learner_id bigint` vs `learners.id uuid`). Either those features are broken in production or the schema was altered by hand in the Supabase dashboard and nothing recorded it. **Please export the live schema** (`pg_dump --schema-only`, plus the RLS policy list). Until then every schema claim in Section 2 is a claim about the repo, not about reality.

**Q2 — Has anyone ever successfully issued a Capability Passport?** The issuance UI is never rendered (F-18), the issuance route has no caller, the evidence query selects non-existent columns (F-25), `avg_score` is never recomputed so the eligibility gate reads 0 (F-17), and the `learner_id` type cannot accept a UUID (F-24). Against the code, no passport can exist. If any do, one or more of those four things is different in production and I need to know which. **And is there live data in the `passports` table?**

**Q3 — Is there live data in `ai_practice_attempts`, `capability_scores` (with non-zero scores), `portfolio_items`, or `notifications`?** Each is a table I would otherwise call dead or frozen based on the code. If any holds real rows, something is writing to it that I could not find — most likely a manual dashboard edit or a script outside the repo.

**Q4 — Are `PASSPORT_SECRET` and `CLERK_WEBHOOK_SECRET` set in Vercel?** Both are read by code and documented in no file, and both are absent from the local `.env.local`. If `PASSPORT_SECRET` is set, **what is the plan for it across the rebuild?** Rotating it invalidates every signature ever issued (`lib/passport.ts:85` warns about exactly this). If `CLERK_WEBHOOK_SECRET` is unset, F-21 is armed the moment the webhook path is fixed.

**Q5 — How are learners currently being enrolled, in practice?** The webhook is unreachable (F-20), Add Learner is RLS-blocked (F-23), and manual Clerk linking is RLS-blocked (F-23). Some process is getting rows into `learners` with `clerk_user_id` populated. Is it direct Supabase dashboard editing? A script? Has any learner ever completed the intended path?

**Q6 — Where is "Notion 2.6 — Capability Framework"?** `lib/passport.ts:9,43,52,60,70` and `app/verify/[passportId]/page.tsx:7` cite it as the authoritative source for the capability domains, the rating bands, the readiness tiers and the issuance rules. It lives outside the repo. The code contains **four incompatible capability taxonomies** (F-28), and I cannot tell which one the framework actually specifies — or whether the framework itself needs to change for six programmes.

**Q7 — Which of the four capability taxonomies is correct?** `lib/passport.ts` PM (10 domains) / BA (11 domains), `lib/types.ts` `CAPABILITY_AREAS` (10 mixed), and `passport-pdf` (6 per pathway, with invented scores). The signed snapshot uses one, the printed credential another, the learner-facing page a third. Which is the one to build on?

**Q8 — Was the resubmission loop ever used?** F-16 says the status it depends on cannot be stored. If facilitators have been requesting revisions, they were doing it some other way — verbally, by email, or by using "Approve" with corrective feedback. **What is the real revision workflow today?** That determines whether the Lab's submission/feedback cycle is a new build or a fix.

**Q9 — Was the QR deliberately deferred, or forgotten?** `lib/qr.ts` is a complete, correct, dependency-free encoder and `QR_PATCH.md` is a written instruction to wire it up. Someone did the hard part and stopped before the easy part. Was that a conscious decision (e.g. waiting on the verify page being public), or did it fall off?

**Q10 — Is `components/PassportControls.tsx` unrendered on purpose?** It is complete and working. Was it pulled out because issuance was not ready, or is this simply an unfinished wiring step?

**Q11 — What is the intended relationship between `tier` and the Capability Passport?** The UI says Premium-only and the server does not enforce it (F-15). With no payment integration (F-61), tier is assigned by hand. Is the tier gate a real commercial rule that needs enforcing, or copy that no longer reflects the offer?

**Q12 — For the six programmes: do the two 5-week intensives share the `weeks` calendar model at all?** A 5-week programme running concurrently with a 12-week one breaks every one of the eight `getCurrentWeek()` copies, which assume a single global cohort start date. Do intensives run on their own start dates? Can a learner be on two programmes at once? The answer determines whether `weeks` becomes `programme_weeks` or something structurally different.

**Q13 — For the Lab: where does the 60+ sheet synthetic dataset live today, and in what form?** Nothing in the repo suggests it exists yet. Is it a Google Sheet, a set of CSVs, a database? Scoped access per week per pathway is a real access-control design, and it needs to be built against whatever that artefact actually is.

**Q14 — Are the 64 Lab assignments meant to replace the current weekly assignment, or sit alongside it?** `assignments` currently holds one row per learner per week per pathway. Two options per week (Core/Advanced) breaks that uniqueness constraint (F-6). Do learners pick one option or do both? Does the existing weekly assignment survive?

**Q15 — Is `web.upthrustdigital.com` the canonical marketing domain, and which portal host is canonical?** The portal hardcodes three different portal hostnames (F-59) and declares an unused `NEXT_PUBLIC_MARKETING_URL`. Passport verify URLs are the highest-stakes case: an already-issued credential printed with the wrong host cannot be corrected after the fact.

**Q16 — Who else needs facilitator access, and at what level?** The role model is one person in one env var (F-69). Six programmes plausibly means multiple facilitators, possibly scoped per programme. Do facilitators need to see all learners, or only their own? Is there a need for read-only access (e.g. an employer view, which `learners.employer_visible` anticipates but nothing implements)?

**Q17 — Is the `Design` pathway value in `learners.pathway` in use?** `supabase-schema.sql:14` allows `'Design'`, and no code path handles it — every read site coerces it to PM. Was Product Design piloted already? Are there learners sitting on that value right now, silently seeing PM content?

**Q18 — What is the acceptable data-loss position on the 12 placeholder resources** (`external_url = '#'`) and the randomly generated passport IDs from `supabase-additions.sql:191-193`? Both are live rows created by seeds that ran against production. Cleaning them up is a data decision, not a code one.
