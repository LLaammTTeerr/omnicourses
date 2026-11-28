# Triage of the external review (bd9f32c, 27 Nov) against the top of the stack

Checked on 28 Nov 2026 in `cv-build-be` at 30d1c72 (main plus #234 to #239, #243, #244). Main has #220 to #233.
Paths below are relative to that worktree. Nothing was run except reads and `git grep`.

Note on "8 groups": `review-SUMMARY.md` holds only scores. The rows below come from the six area reports (backend, domain, frontend, security, devops, docs). Each "extra care" claim from the brief has its own row: R1, R2, R3, R5, R7, R8, R10. Row numbers R35, R59 and R61 are not used: on a second check they were #240 items, not review findings.

Much of the review is outdated. PR #207 (merged after bd9f32c) fixed many of its findings, among them the health check, shutdown hooks, contrast, lazy routes, scoped styles and most ADR statuses.

**Counts:** 70 rows. 5 class A items (6 rows, because R66 is part of item 1). 36 class B (9 already in an issue, 27 new: 23 for the Project Lead, 4 for the frontend owner). 28 class C / wrong / already fixed.

## Class A, worth doing (best first)

1. **R1. The rule-engine coverage gate cannot pass with no files.** Add a test to `src/backend/src/repo-config.spec.ts`. For each glob key under `coverage.thresholds` in `src/backend/vitest.config.mts`, the test asserts that at least one production `.ts` file matches (no spec files, no `testing/`). It also asserts that the folder the purity test guards (`rules/`) sits under the glob. In the same PR, fix `docs/test/test-plan.md:33` and `:154` (row R66). They say the check is manual, and line 33 also says the deploy workflow deploys nothing, which is false. Proof: rename the key to `src/rulez/**`. The new test fails, while `npm test` alone stays green. Size: 1 spec and 1 doc, about 20 lines. Touches no file of #166 or #77.
2. **R20. A schema-drift check for every table.** Six e2e specs check only their own tables. Eight of the 26 entity tables have no check: users, sessions, sign_in_attempts, ai_usage, guides, guide_texts, onboarding_answers, transcript_rows. Add one e2e test that reads every table from `DataSource.entityMetadatas` and expects `createSchemaBuilder().log()` to return no up-queries for any of them. Optionally drop the six filtered copies later. Proof: change one column type in an entity and the test fails. Risk: the first run may fail on an uncovered table that has already drifted. That is a finding for a person, not a schema change the agent may make. Size: 1 new e2e spec, about 25 lines. It reads `ai_usage` only through metadata and touches no `ai/**` file.
3. **R33. Every frontend fetch mock goes through the route contract.** `mockApi` (from #238, still open) refuses routes missing from `openapi.json`. But 16 specs still spy on `fetch` directly, so their routes are never checked: 5 browser specs (Calendar, Guides, Notifications, Privacy, HomeView) and 11 jsdom specs (`*/api.spec.ts`, `auth/store.spec.ts`, `SignInView.spec.ts`, `onboarding/store.spec.ts`). Smallest change: in the api specs that record `calls`, also expect each recorded call to pass `contractHasRoute`. Move the browser specs to `mockApi`. Proof: change a recorded path to `/no-such-route` and the test fails. Size: about 16 test files, about 40 lines. Do it after #238 merges. It fits either answer to the #241 question "keep mockApi strict or add an opt-out". No dashboard files, no #166 or #77 files.
4. **R46.** A point about deploy; not kept in this file.
5. **R62. The README "What is built" table against the contract.** The table is "the one place that says what is built", but it carries a hand date ("as of 27 November 2026", `README.md:18`) and no test. Add a spec that checks the first path segment of every `openapi.json` route against the README API column, both ways. Proof: delete a README route and the test fails. Size: 1 spec of about 40 lines, plus possibly small README wording fixes. Lowest value of the five, because the column uses wildcards (`auth/*`), so the parser must stay loose.

## Class B, by person

### Project Lead: already in an issue
- R7 an error `code` on every 4xx: #240 item 1.
- R10 the inbox GET creates notifications: #240 "Reading the inbox creates notifications".
- R14 config is not checked at boot: #28 item 8 (now only partly true).
- R24 the engine in the browser (ADR 0015): #95.
- R40 absolute session lifetime: #240 "The session cap" and #28 item 4.
- R41 throttling per IP only: #96 and #28 item 2.
- R44 actions pinned by tag, not by SHA: #28 item 15.
- R56 ADR statuses (0019 shipped but "proposed"; 0020 waits for acceptance): #240.

### Project Lead: new (in no issue)
- R8 student routes drop unknown fields; admin and `users/me` routes refuse them (contract).
- R15 expired or revoked session rows stay until the user signs in again (database job).
- R17 a redundant index, `ix_curriculums_program_id` (needs a migration).
- R18 a placement in a past term counts as passed with no transcript attempt (academic rule).
- R19 exempt credits count toward the term load, Điều 7.1.b (academic rule).
- R21 the per-term `passedCredits` disagrees with the accumulated credits (academic figure).
- R22 F12 accepts a course in two groups and overflow chains with no warning (rule and admin behaviour).
- R23 no downgrade label on classification; 38 credits a year for every training type (academic rule).
- R2 a frontend coverage gate (CI gate).
- R3 a full-stack smoke test in CI (CI gate).
- Security and deploy: several rows, all new. Not kept in this file.
- R68: a point about sign-in; not kept in this file.
- R60 a PR-template checkbox for ADR status (process; minor).

### Frontend owner (Hoà): already in an issue
- R31 menu labels written in `<feature>/routes.ts`: #241 "Where menu labels live".

### Frontend owner (Hoà): new
- R5 split `PlanEditorView.vue` (955 lines) and `CurriculumAdmin.vue` (795) into composables and child components.
- R27 an unknown URL silently redirects to `/`, with no 404 page.
- R28 Google Fonts is a render-blocking, third-party request. If it stays, the Lead should check the privacy text.
- R29 axe accessibility checks in the browser specs (a new dependency).

## Class C / wrong / already fixed
- Fixed before the stack (mostly #207): R9 health check (now 503), R13 shutdown hooks, R25 contrast, R26 lazy routes, R30 scoped styles, R32 i18n parity, R36 ARIA on pool items, R54 lint step in CI, R57 ADR 0013 file name, and R56 except 0019/0020.
- Fixed by the stack: R11 academic-calendar no longer imports curriculum-admin (#234, open).
- Wrong: R16 `users.purge_after` has a partial index.
- Partly fixed: R15 sessions, R14 config, and one deploy row. These are still listed under B for what remains.
- C, not code structure or not worth it: R4 coverage figure ">98 %" in ADR 0013, R67 ORM and raw SQL mixed in one service, R71 `v-html` in `Icon.vue`, R72 no plural rules, R73 property tests, R6 raw SQL typing, R12 hand-rolled `setInterval` timers, R34 dense lines over 200 characters, R55 loose `engines`, R58 use cases split between LaTeX and Markdown, R63 changelog "No changes", R64 bus factor and large PRs, R65 jsdom time, Chromium only, hex colours in two files, reload clears data, ADR 0016 reserved by #77.

## Full table

Not kept in this repository: the full table has rows on security and deploy, and this repository is public. For the same reason a few lines above name such a row by number only. The Project Lead has those findings directly. The rows this mission acted on (R1, R20, R33, R66) are restated in `converge/briefs/23-checks-that-can-fail/implement.md`.
