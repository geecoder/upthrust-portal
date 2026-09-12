# Deferred — found during pre-launch stabilisation, not fixed

**Branch:** `fix/pre-launch-stabilisation` · **Opened:** 2026-09-12 · **Cohort 2 starts:** 2026-09-26

Everything here was found while doing the seven stabilisation tasks and deliberately left alone, either because the brief put it out of scope or because it belongs to the data-model rebuild. Ordered by how soon it will hurt.

Audit reference: `docs/PORTAL_AUDIT_2026-09-10.md`. Schema evidence: `docs/SCHEMA_DRIFT.md`.

---

## Needs a decision before Cohort 2 goes live

### D-1 · The one live passport is internally inconsistent — **new finding**
`passports` holds exactly one row: `UPT-PM-C1-2026-001`, `pathway = 'BA'`, `track = 'PM'`, `overall_score = 0`, `evidence = []`, `issued_at = 2026-06-03`.

Three separate problems in one row. `track`/`pathway` contradict each other (F-3's regex, `lib/passport.ts:145`, materialised in live data). The score is zero, which `app/api/passport-issue/route.ts:93` should have made impossible — so this row was not created by that route as currently written. Evidence is empty (F-25).

**Why it matters now:** Task 7 makes `/verify/[passportId]` public. This row then becomes publicly readable and renders as a valid issued credential showing a score of 0 and a PM ID for a BA learner. Task 7 unblocks the route; it cannot fix the data.

**Decision needed:** correct the row, revoke it (`status = 'revoked'` makes the verify page show "Passport revoked"), or accept it. Not actioned here because mutating a signed credential is the owner's call, and any edit invalidates its HMAC signature.

### D-2 · `sessions` appears to have no RLS — **new finding**
The anon key reads all 7 rows of `sessions` (`docs/SCHEMA_DRIFT.md` §4). The table has no `CREATE TABLE` in any repo file, so `ENABLE ROW LEVEL SECURITY` was almost certainly never run on it. Zoom links, session dates and descriptions are readable by anyone holding the anon key, which ships in the client JS bundle.

Not fixed here: enabling RLS on a live table that two pages read is a behaviour change needing a policy designed alongside it, and `docs/INTROSPECT.sql` query 2a must confirm the RLS state first. Low severity (the content is semi-public by nature), but it is an unintended exposure.

### D-3 · `supabase-additions.sql` was only partially applied
Four columns it declares do not exist in production (`attendance.session_title`, `attendance.missed_session_task_sent`, `weeks.pm_rubric_json`, `weeks.ba_rubric_json`), all after line 33. The duplicate `CREATE POLICY` at line 213 would raise an error and abort the rest of the script. Nothing records which statements landed.

No live impact — none of the four columns is read or written by any code path. Logged because it explains the drift pattern and because the file must never be re-run.

---

## Belongs to the data-model rebuild

### D-4 · F-18 — passport issuance has no UI
`components/PassportControls.tsx` (102 lines, complete and working) has zero import sites, so `/api/passport-issue` has no caller. Explicitly out of scope per the brief: issuance is not needed until week 12 and depends on the pathway model.

### D-5 · F-3 — two conflicting `Pathway` types bridged by a regex
`lib/types.ts:1` (`'PM' | 'BA' | 'Design' | 'Undecided'`) vs `lib/passport.ts:37` (`'Product Management' | 'Business Analysis'`), reconciled by `/business/i.test(pathway) ? 'BA' : 'PM'` at `lib/passport.ts:40,145` and `app/api/passport-issue/route.ts:141`. Any pathway not containing "business" is classified PM. Already visible in live data — see D-1.

### D-6 · `passports.learner_id` bigint/uuid mismatch — **resolved, not a defect**
The audit (F-24) called this a blocker. Production has `uuid`, matching `learners.id`. Only the stale `passports.sql:12` says `bigint`. No action needed beyond not trusting that file.

### D-7 · F-25 — issuer selects columns that do not exist
`app/api/passport-issue/route.ts:123` selects `title`, `reviewer`, `reviewed_by` from `assignments`; none exist. The error is discarded (`:121` destructures only `data`), so every issued passport gets an empty Evidence Portfolio. Confirmed in live data (D-1). Deferred with issuance.

### D-8 · F-1, F-2, F-4 — 142 hardcoded pathway/length locations
Twelve `pm_*`/`ba_*` columns on `weeks`, a two-value CHECK on `assignments.pathway`, and 142 literal sites. Explicitly out of scope.

### D-9 · F-6 — `assignments` uniqueness forbids two options per week
`UNIQUE(learner_id, week_number, pathway)` cannot express the Lab's Core/Advanced pair. Blocks target B.

### D-10 · F-26 — `capability_scores` is insert-only
No code path ever raises a level or score. Production confirms the shape of the problem: only 4 of 7 learners have rows at all; three have 10 × `Not Started`; one has 11 × `Advanced` (11 = the length of `BA_DOMAINS`), which must have been set by hand for the D-1 passport.

### D-11 · F-17 — `avg_score` and `assignment_completion_pct` are never recomputed
Grading an assignment does not move the learner's average. Production: 25 assignments graded, but only **1 of 7** learners has `avg_score > 0`. `attendance_pct` is correctly recomputed and all 7 learners have it — so the intent existed and was applied to one metric of three. This gates passport eligibility (`app/api/passport-issue/route.ts:76`) and is the reason the D-1 passport has a zero score.

Not fixed here: it is a real defect but not launch-blocking for week 1 of a cohort, and the correct recomputation depends on decisions the rebuild owns (which statuses count, whether resubmissions average or replace).

---

## UI and code health — rebuild scope

### D-12 · F-7 — no navigation below 768px
`.portal-sidebar { display: none }` at `app/globals.css:196` is never reset by the 700px block, and there is no hamburger, drawer or mobile menu anywhere. A learner on a phone can reach `/portal` and then cannot navigate. Out of scope (UI layer), but this is the highest-impact UI defect and Cohort 2 will hit it on day one.

### D-13 · F-8, F-9 — bespoke inline-styled UI
1,441 inline `style={{}}` objects vs 454 `className`s; two shared components in use; 23 fixed grids with no media queries. Out of scope.

### D-14 · F-38 — stored XSS in four AI-output render sites
`dangerouslySetInnerHTML` with a `**bold**` → `<strong>` replacement and no HTML escaping, at `app/portal/writing-check/page.tsx:210`, `app/portal/interview/page.tsx:304`, `app/portal/simulation/page.tsx:402`, `app/admin/reviews/page.tsx:231`. The admin-reviews site renders learner-influenced content in the admin's session.

Not fixed here: the brief scopes this run to F-12/13/14/16/19 plus schema truth. **This is the one deferred item I would argue for pulling forward** — it is a real security defect with a small, contained fix (escape before replacing), and it is not entangled with the rebuild.

### D-15 · F-33 — portfolio add is permanently broken
`app/api/admin/data/route.ts:96` writes `submitted_at`, which `portfolio_items` does not have. Production has **0 rows** in that table, consistent with every insert having always failed. Learners see an `alert()`.

Not fixed here: not on the task list. One-line fix (drop the field from the insert) — worth doing before Cohort 2 if portfolio building starts early.

### D-16 · F-40 — `.eq('enrollment_status', 'Active')` in three places
`app/api/notify/route.ts:274`, `app/admin/page.tsx:43`, `app/admin/learners/page.tsx:18`. Excludes `Pending` learners from session reminders and admin counts. Currently harmless — all 7 production learners are `Active`, and production's column default is `'Active'` (not `'Pending'` as the repo file claims). Becomes live the moment a Cohort 2 learner is created via the webhook, which writes `'Pending'` explicitly.

### D-17 · F-16 residue — `assignment_due` notification type is stubbed
Declared in the union (`app/api/notify/route.ts:16`) and in the DB CHECK, no `case`, falls to `default` → 400.

### D-18 · ~46 `'Cohort 1'` display literals
Left alone per the Task 5 brief. Full list in the audit at H-97…H-142. The three *write* paths are fixed in Task 5; these are display-only strings in headings, email footers and the sidebar.

### D-19 · F-49 — ~900 lines of unreachable route code
`/api/ai-feedback` (185), `/api/submissions` (101) have no callers. `lib/qr.ts` (295), `lib/upthrust-logo-base64.ts` (90 KB), `lib/supabase-admin.ts`, `lib/supabase-url.ts`, `components/PassportControls.tsx` and both `scripts/` files have zero import sites.

### D-20 · F-80 — a facsimile signature is committed
`lib/upthrust-logo-base64.ts:9` exports `GENESIS_SIGNATURE_DATA_URL`, a base64 PNG of a real handwritten signature. Dead code, but present in Git history and reusable as a forgery asset.

### D-21 · `resources` has three orphan columns
`file_url`, `content_type`, `thumbnail_url` exist in production, are written by nothing, and `file_url` is the one the Storage upload at `app/admin/resources/page.tsx:150` computes a URL for but never saves. Uploaded files are effectively lost.
