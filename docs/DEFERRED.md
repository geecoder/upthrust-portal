# Deferred — found during pre-launch stabilisation, not fixed

**Branch:** `fix/pre-launch-stabilisation` · **Opened:** 2026-09-12 · **Cohort 2 starts:** 2026-09-26

Everything here was found while doing the seven stabilisation tasks and deliberately left alone, either because the brief put it out of scope or because it belongs to the data-model rebuild. Ordered by how soon it will hurt.

Audit reference: `docs/PORTAL_AUDIT_2026-09-10.md`. Schema evidence: `docs/SCHEMA_DRIFT.md`.

---

## Needs a decision before Cohort 2 goes live

### D-0 · The Clerk webhook is unreachable, and fixing the path alone would arm a worse bug — **do not fix these separately**
Audit F-20: middleware exempts `/api/webhooks/*` (plural, an empty directory); the handler is at `/api/webhook/clerk` (singular, `app/api/webhook/clerk/route.ts:13`). Clerk's POSTs carry no session cookie, so `auth.protect()` rejects them. No automatic account linking has ever fired.

Audit F-21: `app/api/webhook/clerk/route.ts:36-43` — when `CLERK_WEBHOOK_SECRET` is unset, signature verification is **skipped** and the request body is trusted. That variable is absent from the local `.env.local` and was, until 2026-09-12, documented nowhere.

**These two bugs currently mask each other.** F-20 means nothing reaches the handler; F-21 means that if anything did, and the secret were still unset, an unauthenticated caller could link an arbitrary Clerk account to an arbitrary learner email — account takeover for any learner whose email address is known.

Not fixed here because it is outside the brief's scope, and because fixing the path without first setting the secret would convert a dead endpoint into a live vulnerability. **If you fix F-20, set `CLERK_WEBHOOK_SECRET` in Vercel in the same change**, and consider making the route refuse to run when the secret is missing rather than falling open. The `svix` dependency is already installed and the verification path already works.

Task 5 did change this handler — it now stamps the active cohort and checks its insert error — but deliberately did not touch the routing or the verification logic.

### D-1 · The one live passport is internally inconsistent — **new finding**
`passports` holds exactly one row: `UPT-PM-C1-2026-001`, `pathway = 'BA'`, `track = 'PM'`, `overall_score = 0`, `evidence = []`, `issued_at = 2026-06-03`.

Three separate problems in one row. `track`/`pathway` contradict each other (F-3's regex, `lib/passport.ts:145`, materialised in live data). The score is zero, which `app/api/passport-issue/route.ts:93` should have made impossible — so this row was not created by that route as currently written. Evidence is empty (F-25).

**Why it matters now:** Task 7 has made `/verify/[passportId]` public. This row is now publicly readable at `/verify/UPT-PM-C1-2026-001`.

**What Task 7 already mitigated:** the public page no longer renders `overall_score`, `rating`, `readiness_level`, `capability_breakdown` or `evidence`, so the zero score and the empty evidence list are no longer visible to anyone. What remains visible is the **`UPT-PM-…` credential ID against a `BA` programme label** — the contradiction is still on the page, because the ID is the verification key and cannot be hidden.

**Decision needed:** correct the row, revoke it (`status = 'revoked'` makes the verify page show "Passport revoked" and disclose nothing else), or accept it. Not actioned here because mutating a signed credential is the owner's call and any edit invalidates its HMAC signature.

### D-1b · `/verify` is enumerable — **new, and a direct consequence of Task 7**
Passport IDs are sequential and guessable by design: `UPT-<PM|BA>-C<n>-<year>-<seq3>` (`lib/passport.ts:138-147`). `lib/passport.ts:76` acknowledges this and argues the signature is the real control. That reasoning holds for *tampering*, but not for *enumeration*: the page renders for any validly issued row whether or not a `?sig` is supplied, because `cryptoVerified = sigParamValid || storedSigValid` and `storedSigValid` checks the row against itself (audit F-29).

So someone who guesses IDs can currently harvest **learner name + programme + cohort + issue date**. With one passport issued that is negligible; at the end of a cohort it is a roster.

Task 7 reduced the payload to those four fields but deliberately did not change the access rule, because requiring a valid `?sig` would break the verification URL already printed on the one issued credential (`app/api/passport-pdf/route.ts:477` prints a bare URL with no signature).

**Recommended before the first cohort graduates:** require a valid `?sig` to render anything, and make the PDF/QR emit the signed URL — which is what `app/api/passport-pdf/QR_PATCH.md` was already written to do. That closes enumeration and makes the `?sig` parameter meaningful at the same time.

### D-2 · `sessions` was readable by anyone holding the anon key — **FIXED, migration 0005**
RLS *was* enabled (Addendum 1's guess that it was not was wrong — see `docs/SCHEMA_DRIFT.md` B3); the exposure came from a deliberate policy, `sessions_read_all SELECT USING (true)`.

**This entry originally called it "low severity (the content is semi-public by nature)". That was wrong.** Measured with the anon key alone on 2026-09-17: 7 rows, each carrying a **live Zoom join link with the password in the query string** (`https://us06web.zoom.us/j/876...?pwd=NB6PbBk...`). The anon key ships in the client bundle, so anyone who viewed source could list every session and join any of them uninvited. A meeting-access leak, not metadata.

**Fixed** by `0005_sessions_rls.sql`, applied 2026-09-17. Safe to drop because nothing read the table with the anon key — both readers (`app/portal/sessions/page.tsx:34`, `app/api/admin/data/route.ts:569`) use the service-role client, which bypasses RLS. Verified before and after:

| | anon rows | Zoom links visible | service-role rows |
|---|---|---|---|
| before | 7 | **yes** | 7 |
| after | **0** | no | 7 |

**Sibling not fixed:** `weeks` has `weeks_select_published USING (is_published = true)` and all 13 weeks are published, so the anon key reads every week row — including 8 `recording_url` YouTube links and several `session_slides_url` Google Slides / Notion links. No `weeks.zoom_link` is populated, so no meeting credential leaks this way. It is **not** dropped because `app/admin/content/page.tsx` reads `weeks` through the browser client and tightening the policy would break the content editor. Fixing it means moving that read server-side first — the same work D-23 did for the learner pages.

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

### D-11 · F-17 — `avg_score` and `assignment_completion_pct` are never recomputed — **DISPLAY fixed in Milestone 5; the columns are still stale**
Grading an assignment does not move the learner's average. Production: 25 assignments graded, but only **1 of 7** learners has `avg_score > 0`, and `assignment_completion_pct` is **0.00 for all 7**. `attendance_pct` is correctly recomputed and all 7 learners have it — so the intent existed and was applied to one metric of three.

**What M5 changed.** Every learner-facing and admin-facing *display* of these metrics now derives them from the rows instead of reading the columns (`lib/passport-progress.ts`). Measured with `scripts/check-passport-progress-live.ts`: 6 of 7 learners were being shown a number their own assignment rows contradicted — four of them shown an average of 0 while holding graded work averaging 73.8 to 88. Grading an assignment now moves the learner's displayed progress, because it is the same fact read twice rather than two facts kept in step.

**What is still open.** The columns themselves are untouched and still stale. That matters in one place: `app/api/passport-issue/route.ts:76` gates issuance on `avg_score`, so a learner can now correctly see "criteria met" while issuance refuses. M5's brief is display-only and explicitly does not wire issuance, so this divergence is deliberate — but **the owner should know that issuance reads the stale column, not the computed value.** The recomputation questions this entry originally raised are half-answered: `assignments` is unique on (learner, week, pathway), so a resubmission replaces rather than accumulates and there is nothing to average; which statuses count is settled by `isApprovedWork()`. What remains is whether to backfill the columns or drop them, which belongs with the rebuild.

### D-11b · Attendance percentage cannot be derived from the `attendance` table — **found during Milestone 5**
All **62** attendance rows have `attended = true`. Absence is recorded by the **absence of a row**, not by a false flag, so `attended / rows` is 100% for every learner — which is exactly what the first version of the M5 computation returned before it was checked against production.

The denominator has to be sessions *held*, and nothing states it: `sessions` holds 7 rows while learners have 10–14 attendance rows each, and the maintained `attendance_pct` values imply a denominator of **11** (10/11 = 91%, 8/11 = 73%) that appears nowhere in the schema.

So attendance is the one criterion that still reads its stored column, deliberately, and fails closed to 0% if that column is ever null. Fixing this properly means recording absence explicitly — an attendance row per learner per session held, or a sessions-held count the product can read. Not attempted in M5.

---

## UI and code health — rebuild scope

### D-12 · F-7 — no navigation below 768px
`.portal-sidebar { display: none }` at `app/globals.css:196` is never reset by the 700px block, and there is no hamburger, drawer or mobile menu anywhere. A learner on a phone can reach `/portal` and then cannot navigate. Out of scope (UI layer), but this is the highest-impact UI defect and Cohort 2 will hit it on day one.

### D-13 · F-8, F-9 — bespoke inline-styled UI
1,441 inline `style={{}}` objects vs 454 `className`s; two shared components in use; 23 fixed grids with no media queries. Out of scope.

### D-14 · F-38 — stored XSS in four AI-output render sites
`dangerouslySetInnerHTML` with a `**bold**` → `<strong>` replacement and no HTML escaping, at `app/portal/writing-check/page.tsx:210`, `app/portal/interview/page.tsx:304`, `app/portal/simulation/page.tsx:402`, `app/admin/reviews/page.tsx:231`. The admin-reviews site renders learner-influenced content in the admin's session.

Not fixed here: the brief scopes this run to F-12/13/14/16/19 plus schema truth. **This is the one deferred item I would argue for pulling forward** — it is a real security defect with a small, contained fix (escape before replacing), and it is not entangled with the rebuild.

### D-15 · F-33 — portfolio add is permanently broken — **FIXED in Milestone 4**
`app/api/admin/data/route.ts` wrote `submitted_at`, which `portfolio_items` does not have. Production has **0 rows** in that table, consistent with every insert having always failed. Learners saw an `alert()`.

**Fixed**: the field is dropped from the insert; `created_at` has a column default and was the timestamp actually wanted. The learner-facing surface moved to `/portal/capstone` in the same milestone, where the add form reports failures in the page instead of in an `alert()`. See also D-23 — the page this was reached from had never worked either, so the broken insert was never actually reachable.

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

### D-22 · The learner notifications surface has never worked — **found during Milestone 2**
Both learner-facing notification reads go through the **browser (anon) Supabase client**: the unread badge at `components/Sidebar.tsx` and the whole of `app/portal/notifications/page.tsx` (read at `:56`, mark-read at `:67` and `:74`). `notifications` has RLS enabled with 4 policies and **the anon key sees 0 of 50 rows** (`docs/SCHEMA_DRIFT.md` §4, re-confirmed in Addendum 1). The policies are almost certainly keyed on `auth.uid()`, which this app never sets — it authenticates with Clerk, not Supabase Auth.

So: the badge has always read zero, the notifications page has always been empty, and mark-as-read has always been a no-op. The 50 rows in production have never been delivered to anyone. Admin-side notification creation (`app/api/admin/data/route.ts:275,290,309`) uses the service-role client and does work — it has been writing rows into a table nothing could read.

Not fixed here: Milestone 2 removes notifications from the learner experience, so fixing the read path would be work spent on a module being switched off. **Whoever turns `notifications` back on from `/admin/modules` must fix this first, or they will ship an empty screen.** The fix is to move both reads behind a server route that uses the service-role client and filters by the signed-in learner — the same shape as `/api/admin/data` — not to loosen the RLS policy.

### D-23 · The Portfolio page had never worked either — **found during Milestone 4, now retired**
`app/portal/portfolio/page.tsx` opened by reading `learners` through the **browser anon client**, then `if (!l) return`. RLS shows the anon key **0 of 7** learner rows (`docs/SCHEMA_DRIFT.md` §4), so that early return fired on every load for every learner: no artefacts, no assignments, nothing. The page rendered its header and an empty state, always.

This is the same root cause as D-22 and it means the broken insert in D-15 was never reachable from the UI — two defects stacked, which is why neither was noticed.

**Resolved for every reachable page.** M4 replaced the portfolio surface with `/portal/capstone`, a server component. The rest was closed after M3: `GET /api/me` (`app/api/me/route.ts`) serves the signed-in learner their own row, read server-side with the service-role client and narrowed to the `LEARNER_SELF_READABLE` allowlist, and the four reachable pages now use it — profile, simulation, onboarding and resources. Proved by `scripts/verify-learner-data-path.ts` (17 assertions).

**The severe case was onboarding, and it was a Cohort 2 blocker.** `completeOnboarding()` ran a cascade of three attempts: an anon `UPDATE` by learner id, an anon `UPDATE` by `clerk_user_id`, then `/api/complete-onboarding` as a "fallback". The first two could never succeed, and the branch taken when `learner` was null — which was always, since that read was anon too — never reached the API route at all. A blocked `UPDATE` matches zero rows and **PostgREST answers 204 with no error**, so nothing threw: the page navigated to `/portal`, `/portal` saw `onboarding_complete` still false and bounced the learner back. `onboarding_complete` defaults to `false` and both creation paths write it explicitly (`app/api/webhook/clerk/route.ts:140`, `app/admin/learners/add/page.tsx:69`), so **every Cohort 2 learner would have been stuck in that loop with no error displayed.** The 7 existing learners escaped only because the flag was set for them outside the form — all 7 read `onboarding_complete = true` with a NULL `onboarding_completed_at` and NULL `career_goal`. The cascade is now one server call.

**Still carrying the pattern, all currently unreachable** (listed by the verify script each run, so they cannot be forgotten): `community/page.tsx`, `interview/page.tsx`, `writing-check/page.tsx`, `notifications/page.tsx` — all behind switched-off modules — plus `components/Sidebar.tsx`'s unread badge (already guarded off, and D-22), and `admin/learners/add/page.tsx` and `admin/learners/[learnerId]/ClerkLinkForm.tsx`, behind an `/admin` that D-25 makes unreachable. **Each must be fixed before its module or the console is re-enabled.**

### D-24 · `capability_scores.level` holds a value its own type forbids — **found during Milestone 4**
Live data is `'Advanced'` x11 and `'Not Started'` x30. The `CapabilityLevel` type permits `'Not Started' | 'Emerging' | 'Developing' | 'Competent' | 'Capstone Ready'` — **`'Advanced'` is not in it**, and the column has no CHECK constraint to have caught that. `LEVEL_ORDER` on the passport page does not contain it either, so those 11 rows sort as unknown wherever level ordering is used.

Not fixed in M4: migration 0004 renames the assignment status only. Renaming a level value that no row holds would have been a no-op dressed up as a migration, and deciding what `'Advanced'` should map to is a curriculum question for the owner, not a code one. It belongs with the M6 rebuild, where `capability_scores` is being reconsidered anyway.

### D-25 · `ADMIN_USER_ID` is an unreplaced placeholder — the admin console is unreachable — **found during Milestone 3**
`.env.local` carries `ADMIN_USER_ID=user_REPLACE_AFTER_FIRST_LOGIN`. `app/admin/layout.tsx:15` reads `if (userId !== process.env.ADMIN_USER_ID) redirect('/portal')`, so **no real Clerk id can ever match and every visitor to `/admin` is redirected away.** Confirmed against the live Clerk user list: the six real users are `user_3E...` ids; none is the placeholder.

Consequences, all of them live wherever that value is unreplaced:
- **`/admin/modules` cannot be opened, so nobody can toggle a module.** M1 built the console and M3's brief requires the disabled AI tools to be "admin-toggleable back on from the admin console" — that path is currently closed. The flags can only be changed by writing `module_access` directly.
- Every other admin screen — reviews, learners, sessions, resources — is equally unreachable.
- `app/portal/page.tsx` never redirects an admin to `/admin`, and the admin bypass in `guardModuleForLearner` / `gateModule` never fires. Those two fail safe, so nothing is over-exposed.

**Not fixed because I cannot fix it correctly:** the right value is the owner's own Clerk user id (`user_3E0U7fAsJV7lg78KZbkK2Vr8CAk` is `genesis.rotechi@gmail.com`, the likely intended admin, but choosing an admin is not my call). It also has to be set in the **Vercel** environment, not just `.env.local` — I can read neither, so whether production is affected is unverified. **Check this before Cohort 2.**

### D-26 · No rate limit or per-learner cap on any AI endpoint — **reported per the M3 brief, not built**
`/api/simulation`, `/api/interview` and `/api/writing-check` each call the Anthropic API on a signed-in learner's request. A grep for rate limiting, throttling or quota logic across `app/` and `lib/` returns nothing. Any authenticated learner can call these as fast as they can issue requests, and every call bills.

M3 hardened what was trivial — the per-request ceilings below — and deliberately did not build a limiter, which needs shared storage (the process-local counter a serverless deployment would give you is not a limit):

| Route | Input validation before M3 | After |
|---|---|---|
| `POST /api/simulation` | `characterId` checked; **`messages` unvalidated** — `messages.map()` threw an unhandled 500 on a non-array, and any array length was forwarded and billed | array checked, ≤60 turns, each message text ≤4,000 chars |
| `POST /api/interview` | `pathway` coerced, `questionId` looked up; **`userAnswer` untyped and unbounded** | must be a non-empty string, ≤6,000 chars |
| `POST /api/writing-check` | already the best of the three: ≥50 chars required, truncated to 3,000 | unchanged |
| `GET /api/simulation`, `GET /api/interview` | no input | unchanged |

Also fixed while in there: both simulation error paths returned `detail: errText` — the provider's raw error body — to the client. Now logged, not returned.

**Still open:** a real per-learner cap. The cheapest honest version is a `ai_practice_attempts` row count per learner per day checked before the call — that table already exists and is insert-only (D-10). Worth doing before the AI tools are opened to a second cohort.

### D-27 · A placeholder learner row is in production — **found during Milestone 3**
`learners` holds a row with `clerk_user_id = 'user_YOUR_CLERK_USER_ID'` (first name `Genesis`, `Cohort 1`, PM) alongside the real `user_3E0U7f...` Genesis row. It is one of the 7 rows every admin count and every learner tally includes, and it can never be signed in as.

Not deleted here: deleting production rows is the owner's call, and it is harmless beyond skewing counts by one. Recommend removing it, together with the `Testing Onboarding BA Path` row if that is also test data — note that row is the one marked `passport_eligibility = 'Approved'` and is the D-1 inconsistent passport.
