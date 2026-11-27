# Survey: tests, CI, tooling, docs

Read-only survey of the worktree at 3c4da22. Counts come from grep/git on this tree. Nothing was run (no test suites).

## 1. Model of the area

- Backend unit specs sit next to the code (vitest.config.mts, coverage threshold only on src/rules). E2E: 24 files in src/backend/test, config vitest.e2e.config.mts, fileParallelism false, testTimeout 30 s. 22 of them boot the whole AppModule through support/app.ts (bootApp: compile, configureApp, migrate, init) against the shared public schema. 4 files (curriculum-admin, curriculum-schema-migration, guide-seed, curriculum-seed) use support/schema.ts privateSchema (own schema, own migrate).
- Test isolation on the shared schema is by unique data, not by cleanup: runSuffix() / randomUUID() in support/admin.ts and support/users.ts. Nothing deletes rows afterwards.
- Frontend: jsdom specs next to code, helpers in src/frontend/src/testing (fetch.ts mockApi, signed-in.ts, contract.ts reads backend/openapi.json). 13 *.browser.spec.ts (1726 lines) run by vitest.browser.config.ts in Chromium (CI only installs Playwright in the frontend job).
- scripts/lint.mjs (237 lines, no spec, not typed) walks src/backend/src and src/frontend/src only. Rules: no-ts-ignore, no-debugger, no-direct-process-env (backend src, not spec), no-vue-fetch, vue-style-scoped (allowlist App.vue), csp-script-hash (index.html vs deploy/server/nginx-site.conf).
- Already enforced by specs, not lint: openapi.json equals the built document (src/backend/src/openapi-document.spec.ts), module-order independence, both locales complete (src/frontend/src/messages.spec.ts), nav shape (shell/nav.spec.ts), user_id cascade rules (test/user-table-rules.ts).
- CI (.github/workflows/ci.yml): changeset, signed-commits, scope, backend (typecheck, unit+coverage, build, e2e, openapi export), frontend (lint, typecheck, unit, playwright install, browser, build). conventions.yml checks the PR title. Release/deploy/reset-staging are separate.
- Docs: AGENTS.md (145 lines, agent how-to and rules), CONTRIBUTING.md (111, workflow), README.md (102, feature table, run), architecture.md (362, module table in section 4), 18 ADRs (0016 reserved for PR #77), GLOSSARY.md. docs/test holds 446 of the 517 files: dated plans, cases, reports and 19 MB of evidence (88 .mjs, 190 .txt, 129 .png). report/ is LaTeX coursework (58 files).

## 2. Ideal direction

- One command that equals CI minus the things only GitHub can do (signatures, PR title, changeset), documented in one place.
- Architectural rules that matter live as small rules in the one existing checker (scripts/lint.mjs), with a spec for the checker itself, instead of in prose.
- E2E files independent of each other (unique data already), so file order and parallelism are free; migrate once per run, not once per file.
- Tests that list "what the screen shows" derive it from the declaration of that thing (NAV), so adding one entry edits one place.
- Dated evidence is invisible to normal code search, so an agent landing in the repo meets only living files.
- The module index already exists (architecture.md section 4 table). Keep it, add a check that it lists every module folder; do not add per-module contract files.

## 3. Findings

### TES-1 Give developers one local command that equals CI, and list lint in AGENTS.md
Problems it solves
- Enforcement gap: AGENTS.md:17-23 (Commands) and "Run typecheck, tests and build before every push" omit lint. `npm run lint` runs only in the CI frontend job (ci.yml:152) and README.md:83. An agent following AGENTS.md gets a red CI on a lint rule it was never told to run (no-vue-fetch, scoped styles, CSP hash: the CSP check fails on any edit of index.html).
- Hidden link: what CI checks that a developer cannot run with one command: lint, typecheck x2, unit x2, browser tests (own playwright install), build x2, e2e, openapi drift. Root package.json has `test`, `typecheck`, `build`, `lint` as separate scripts; there is no aggregate, and `npm test` at root does not run lint, e2e or browser tests.
- Surplus: ci.yml:117-140 backend job exports openapi.json and uploads it as an artifact; no workflow downloads it (grep for download-artifact: none in .github/). The drift check is the unit test openapi-document.spec.ts.
- Surplus: NPM_VERSION 11.21.1 declared in both ci.yml:20 and release.yml:18 (and AGENTS.md:11, ADR 0001, deploy/README.md:39); PostgreSQL 18.6 in compose.yaml:4, ci.yml:115, AGENTS.md, README, architecture.md x3, deploy/README.md. No check ties them. Low cost to leave; mention only.
Callers/dependents: searched root package.json, ci.yml, AGENTS.md, README.md, CONTRIBUTING.md for "lint" and "typecheck". PR #77 owns AGENTS.md (deferred: in-flight PR #77 for the AGENTS.md line).
Cost today: an agent runs three commands from AGENTS.md, pushes, learns of lint in CI.
Proposed change: add root script `"verify": "npm run lint && npm run typecheck && npm test && npm run build"` (e2e and browser stay separate because they need DB/Chromium; say so in the Commands block: `npm run test:e2e -w src/backend`, `npm run test:browser`). Make CI call the same pieces (ci.yml runs the individual steps for log clarity; no change needed beyond lint). Delete the openapi artifact upload step. AGENTS.md Commands block: replace the "typecheck && test && build" line with verify.
Contract impact: none.
Write scope: package.json, .github/workflows/ci.yml (delete 4 lines), AGENTS.md (deferred: in-flight PR #77; do the package.json and ci.yml part now, hand the one-line AGENTS edit to the PR #77 owner or do it after it merges).
Effort S, risk low, confidence high. Verification: run `npm run verify`; CI green; the artifact step removal changes no job result.
Alternatives: leave it (cost is a red CI per new agent); a git pre-push hook (needs install step, rejected).

### TES-2 Extend scripts/lint.mjs with the structural rules that only discipline protects, and give it a spec
Problems it solves (each is an enforcement gap unless noted)
- Dependency direction: no rule. Verified edges (grep of imports of *.entity.js / *.repository.js outside own folder): curriculum-admin -> curriculum 12 imports, curriculum-admin -> users 6, auth -> users 5, plans -> curriculum 4, rules -> curriculum 3, sharing -> plans 1, notifications -> academic-calendar 1. Cycles per the depgraph: auth<->users, curriculum<->curriculum-admin<->database (curriculum/seed-curricula.ts imports curriculum-admin/admin-write.service.ts). Nothing stops a third cycle or users importing a feature.
- Frontend root mixes shared leaves (locale.ts fan-in 80, api.ts 36) and composition root (router.ts, app.ts, App.vue); nothing stops a feature importing router.ts (shell/nav.ts already does: nav.ts:4).
- API calls only in api modules: the rule is only for .vue (lint.mjs, checkVueSfcRules). Verified fact: in non-spec .ts, `fetch(` appears only in src/frontend/src/api.ts, so extending the rule to every .ts file except api.ts passes today and protects the convention in stores and composables.
- Migrations listed: index.ts:18-19 comment says "A migration left out of this list never runs"; today 16 files and 16 entries. No check.
- Features registered: a *.module.ts missing from FEATURE_MODULES (features.ts:19) or not imported by a registered module silently disappears from the app and the contract.
- Module index: architecture.md:6 says the section 4 table was matched to features.ts by hand on 26 Nov.
- lint does not cover src/backend/test or *.config.mts (walk starts at src/backend/src, lint.mjs:206-207). Verified no process.env or ts-ignore in test/ today, so widening costs nothing.
- lint.mjs has no test: it exports lintWorkspace(rootDir) for one, but grep finds no importer. The rules (regex masks for comments and tags) are exactly the code that silently stops matching.
Callers and dependents: searched repo for "lint.mjs"/"lintWorkspace": package.json:14, architecture.md:64,273, ci.yml. Folder cycle data from depgraph-backend.json.
Cost today: nobody finds out a new cycle or an unregistered module until a reviewer notices; the module table drifts silently.
Proposed change (all in the one script, plain regex on import lines like the rest of it):
1. Widen the backend walk to src/backend/test and the vitest config files.
2. Rule import-direction (backend): a table `ALLOWED_IMPORTS = { folder: [folders] }` seeded from today's edges (ratchet: current edges allowed, any new edge fails with the rule name). Also seed "no folder imports advisor" and "users, curriculum, common, config import no feature folder except the existing auth/curriculum-admin cases". Retire an allowlist line when the cycle is fixed (see the other surveys).
3. Rule api-only-in-api-modules: no `fetch(` in any frontend .ts except api.ts and sibling api modules (same message as no-vue-fetch; merge the two checks into one function over .ts and .vue).
4. Rule migrations-listed and modules-registered: compare directory listing with index.ts / features.ts imports.
5. Rule module-in-architecture-table: each FEATURE_MODULES folder name appears in architecture.md section 4 (backticked). Costs 8 lines; if the Project Lead thinks docs checks cost more than they save, drop only this one (deletion test: it guards one table, the table is the only module index).
6. scripts/lint.spec.ts (or lint.test.mjs run by root `npm test`): feed lintWorkspace a temp dir with one violation per rule.
Contract impact: none.
Write scope: scripts/lint.mjs, one new spec file next to it, root package.json test wiring. Does not touch any src file. Rule 5 reads architecture.md (read only; it is owned by PR #77 for edits, deferred: in-flight PR #77 if the table needs a new line).
Effort M, risk low (a rule can only fail CI, never change behaviour), confidence high on 3, 4, 6; medium on 2 (allowlist must be generated from the real graph, not hand typed: generate with the depgraph script).
Verification: the new spec; `npm run lint` passes on main; revert an import in a scratch copy to see each rule fire.
Alternatives: dependency-cruiser or eslint-plugin-boundaries (new dependency, new config language, rejected: no eslint in the repo at all, grep package.json); leave it (agents will keep adding edges, see 3c4da22 which added notifications -> academic-calendar and sharing -> plans).

### TES-3 Migrate once per run and let e2e files run in parallel
Problems it solves
- Needless link: vitest.e2e.config.mts sets fileParallelism false; 22 files each run bootApp, which calls migrate(DataSource) again (support/app.ts:13). Wall time is the sum of 24 files plus 22 app boots. Not measured (suites not run per the brief).
- Hidden link: isolation is already by unique data: runSuffix() in admin.ts:18 used by curriculum-admin-programs (spec:36,317,421) and academic-calendar (spec:31); randomUUID emails in support/users.ts:7. Files that need clean tables already use privateSchema (curriculum-admin.e2e-spec.ts:345-353 deletes global_admin_grants only inside its own schema).
- Assumed (unverified) blockers to check by running three times with parallelism on: curriculum.e2e-spec.ts and audit read the seeded APCS rows by fixed code (curriculum.e2e-spec.ts:57-169, read only); notifications.e2e-spec.ts uses a fake clock in 2090 and `startingOn` over all calendar events (academic-calendar.e2e-spec.ts:163 filters by its own codes; notifications may not); support/faults.ts creates a trigger on a shared table (only fires on a matching value, safe); two Nest apps in one run each have their own in-memory throttler (rate-limits.e2e-spec.ts), so no shared counter.
Callers and dependents: grep for bootApp (22 files), privateSchema (5 files), DELETE FROM / TRUNCATE in test/ (only inside private schemas).
Cost today: slow local e2e, so developers skip it (AGENTS says run it when touching the backend); one forgotten suite blocks everyone's iteration.
Proposed change: vitest globalSetup that runs migrate once and removes migrate from bootApp (keep it in privateSchema). Set fileParallelism true (or poolOptions with a small worker count; Postgres max_connections is the limit: each app opens its own pool). Fix any file the three runs show colliding by moving it to privateSchema (existing helper). Keep the one-file fallback `--no-file-parallelism` in the command comment-free docs (docs/test/browser-tests.md style, not code).
Contract impact: none.
Write scope: src/backend/vitest.e2e.config.mts, new src/backend/test/support/global-setup.ts, src/backend/test/support/app.ts, any colliding file under src/backend/test/. Files owned by PRs: curriculum-admin-import.e2e-spec.ts (deferred: in-flight PR #166), advisor/ai/rt77 specs (deferred: in-flight PR #77).
Effort M, risk med (flakiness appears only under load), confidence medium. Verification: 5 consecutive parallel runs green, the same test count as today, and a run with the order shuffled (--sequence.shuffle).
Alternatives: leave it (safe, slow); a database per worker (more setup, rejected until measured).

### TES-4 Derive the sidebar expectations from NAV and move the bell tests out of App.spec.ts
Problems it solves
- Contention / hidden link: the full Vietnamese menu list is typed again in src/frontend/src/App.spec.ts:53 and :60 (plus MobileBars.spec.ts, Shell.browser.spec.ts, auth/SignIn.browser.spec.ts hold "Tổng quan"). Adding or reordering one page edits all of them; App.spec.ts is the 5th most edited file (12 commits since 1 Nov). The order and sections are already pinned once in shell/nav.spec.ts:17-23.
- Contention: App.spec.ts mixes the shell (lines 34-180) with the F10 notification bell (182-246: unread poll, badge cap). The bell belongs to notifications/.
Callers: grep "'Tổng quan'" in src/frontend/src.
Proposed change: in App.spec.ts build the expected list from `listed(NAV, holdsGrant).map(i => i.label.vi)` so the test checks "the sidebar renders the declared menu", leaving wording and order to nav.spec.ts; keep one literal check of the current labels in a single place (nav.spec.ts already). Move the `describe('the notification bell (F10)')` block to src/frontend/src/notifications/NotificationBell.spec.ts, reusing render() through a small export from testing/signed-in.ts or its own copy of the 12-line helper.
Contract impact: none. Write scope: src/frontend/src/App.spec.ts, new notifications/*.spec.ts, shell/MobileBars.spec.ts. Not testing/fetch.ts (deferred: in-flight PR #214); do not edit audit/ files (PR #214).
Effort S, risk low, confidence high. Verification: same tests pass; no test removed (the moved ones still run; count via vitest list before and after).
Alternatives: leave it (one edit per new page in 4 files).

### TES-5 Keep dated evidence out of everyday code search
Problems it solves
- Surplus for readers: docs/test is 446 of 517 doc files; docs/test/evidence is 19 MB, 530 files (88 .mjs driver scripts, 190 .txt dumps, 129 png) although docs/test/README.md:11-15 now forbids adding such scripts. 101 lines in docs/test/*.md link into evidence/, so deleting is not safe (verified by grep).
- Hidden link: an agent grepping for a term (a route, "prerequisite") hits dated reports, test cases and evidence before the living code and ADRs. GLOSSARY.md, architecture.md, ADRs, use cases and README are the living set; report-b0..b2, test-cases-b*, evidence/, report/ and docs/management/weekly-reports are records.
Proposed change: add `.rgignore` at the repo root (ripgrep honours it; Claude Code's search tool uses ripgrep) with docs/test/evidence/, report/, docs/management/weekly-reports/, docs/analysis-and-design/ui-prototypes/assets/. Add one sentence to AGENTS.md "Domain docs" (docs/agents/domain.md is the better home, not owned by an open PR): "docs/test and report/ are dated records, not specs: read test-plan.md only when asked for a build check." No file moves; links stay valid.
Contract impact: none. Write scope: new .rgignore, docs/agents/domain.md. Effort S, risk low, confidence medium (assumes agents use ripgrep; plain grep -r still sees everything). Verification: `rg -l prerequisite | head` no longer lists evidence files.
Alternatives: move evidence to a release asset or branch (big diff, breaks 101 links, rejected); leave it.

### TES-6 Remove three small dead or duplicate items in tooling
- Surplus: eslint directive at src/backend/src/ai/sse.spec.ts:135 (`// eslint-disable-next-line no-unsafe-finally`); the repo has no eslint (no dependency in any package.json, no config file) so the line is a comment that does nothing. Delete it (the finally-return it guards is the test's point; keep the code). Also a comment, which the repo forbids. Note sse.spec.ts is in ai/ (deferred if PR #77 touches it: file is not on the in-flight list, but src/backend/src/ai/sse.ts is).
- Surplus: ci.yml backend "Export OpenAPI contract" step and artifact upload (see TES-1).
- Special case: .github/workflows/ci.yml:43-50 and conventions.yml carry long inline shell for the Version PR exception; it is the cost of changesets. Left alone, see section 4.
Contract impact none. Effort S, risk low, confidence high. Write scope: sse.spec.ts, ci.yml.

### TES-7 Comments in src/: only migrations still carry any
- Verified: outside src/backend/src/database/migrations, comment lines in src/ are exactly two (frontend/src/env.d.ts:1 triple-slash reference, needed; groups.spec.ts:1 vitest-environment pragma, needed) plus the eslint line in TES-6. #207 and later added no comments elsewhere.
- Migrations (76 comment lines in 8 files) hold the why of constraints with ADR numbers. AGENTS.md says "No comments"; earlier passes (#193, #198) kept these. Most are decisions the code cannot show (nullable training_type means "no cap check"; CHECK instead of enum). Restating comment to delete: src/backend/src/database/migrations/1794300000000-add-audit-rules-to-curriculum.ts:69 ("One target per group: the primary key is the source group."). Candidates that mostly restate their DDL: 1794218005469-create-plans.ts:57 and 1794230000000-create-curriculum-admin.ts:47,62 (the CHECK/PK next to them says it).
- needs decision: whether migration comments count as "a fact the code cannot show" (keep) or move to the ADRs (delete). Recommendation: keep; delete only the four restating lines. Migrations are already-run files, so text-only edits are safe but each is an edit to a file existing deployments have executed (checksum is not stored by TypeORM, so no effect).
- Tests that cannot fail or only repeat the implementation: scanned every spec touched by 3c4da22 (script: `it` blocks with no expect/assert/throws token) and found none. Pattern greps (toBeTruthy, toBeDefined, expect(true)) give 1 weak assertion: src/frontend/src/audit/DashboardView.spec.ts:139 (`attributes('data-group')).toBeTruthy()`), which belongs to PR #214 (deferred: in-flight PR #214). The `attributes('disabled')).toBeDefined()` lines are fine (attribute presence is the behaviour). sampled, not exhaustive for #215-#218 additions.
Effort S, risk low, confidence medium.

### TES-8 Keep each fact that is typed in many docs behind one pointer (only where a copy already drifted or can drift silently)
- Hidden link: AGENTS.md:126-145 (merge, deploy, release), CONTRIBUTING.md section 4, README.md:90 ("Rules for changing main") and ci.yml all state the merge/deploy rules; AGENTS.md says it adds "only what is different". Verified no contradiction found today, so this is a watch item, not a fix.
- Stale-prone, verified: ADR 0006 and 0015 are "accepted, not built yet" (a status that is a build claim; the README table is the stated home for build status), ADR 0019 is "proposed" (0019-student-id-and-class-name.md:3) although #217 shipped it. Proposed change: set 0019 status per its owner; strip build claims from ADR status lines (the ADR README rule is in docs/agents/domain.md). needs decision: Project Lead owns ADR status.
- README.md F3 row says "past-term view" is not built while #215 shipped its API (verified from the commit list; the screen is in PR #214, so the row is correct until #214 lands). Update with #214.
Effort S, risk low, confidence medium. Write scope: docs/analysis-and-design/adr/0019-*.md, README.md (13 commits since Nov: conflict-prone, batch with a feature PR).
Alternatives: leave it.

## 4. Looked at and left alone
- Fixed-name test data is safe in private schemas (curriculum-seed.e2e-spec.ts:221 DELETE FROM course_prerequisite_lists, guide-seed.e2e-spec.ts:31 DELETE FROM guides); only the shared-schema files must not delete.
- Locale completeness is already enforced (src/frontend/src/messages.spec.ts compares vi/en per catalogue). Do not add a lint rule for it.
- openapi.json drift is already a unit test; features order independence too (openapi-document.spec.ts). Do not duplicate in lint.
- docs/analysis-and-design/adr numbering gap 0016: documented in architecture.md:313, reserved for PR #77. Not a defect.
- Vue-style-scoped allowlist (App.vue only) and the CSP hash rule: real security guard, cheap, keep.
- CI "scope" job and the Version Packages shell in ci.yml: costs lines, but saves a full test run for every release PR; GitHub treats skipped required jobs as passed.
- vi.waitFor in browser specs and the one real sleep in src/frontend/src/components/ModalDialog.browser.spec.ts:40 (a wait for an event that must not happen, named NO_EVENT_WAIT_MS): inherent to the check, no retries or skips anywhere (grep for .skip, .only, .todo, retry: found only the live-spec skipIf for a missing key).
- Fake timers in 10 specs use toFake lists limited to what is needed; no flake pattern seen.
- support/locks.ts `within` and waitUntilAnySessionBlockedBy: bounded 5 s polls on pg_stat_activity, the only way to test lock waiting.
- Unit-spec shape (next to code, pure helpers in testing/) and the 80 % rules threshold: fine.
- backend typecheck already includes test/ and config (tsconfig.json include), so type errors in test support are caught; only lint rules skip them.
- docs/test/evidence 530 files violate the current policy only historically, as the policy says; do not delete (cited 101 times).

## 5. Open questions
1. May lint.mjs get a ratchet allowlist of today's cross-module imports (TES-2, rule 2)? It writes the current cycles down as accepted until the structure surveys remove them.
2. Does the Project Lead want migration comments kept as the why-record (TES-7)?
3. ADR 0019 status and removing "not built yet" from ADR status lines (TES-8): Project Lead's call.
4. Is the e2e suite's wall time actually a problem (TES-3 is unmeasured)? If it runs under a few minutes, leave it and take only the migrate-once part.
