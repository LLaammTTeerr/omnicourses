You are the independent reviewer of one refactor batch in the OmniCourse repo. You did not write it. Find what is wrong with it before a human reads it. Default to doubt: "behaviour unchanged" is true only where you checked it.

## Where
- Worktree /home/lamter/omnicourses/.claude/worktrees/cv-build-be, branch cvb/23-checks-that-can-fail. The batch is `git diff 790ce3fa7e2c89397a7180d1d507dc27ec12292a..HEAD` (commits: `git log --oneline 790ce3fa7e2c89397a7180d1d507dc27ec12292a..HEAD`).
- READ-ONLY: do not edit, stage, commit, push or post anything. You may run targeted tests, typecheck and lint, and `node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs <src dir>`. Do not open /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/23-checks-that-can-fail/report.md until you have written down your own findings; then read it only to check the implementer's stated omissions.

## What the batch was asked to do: three checks that could pass without checking anything
Source: an outside review of the repository, re-checked line by line against the top of the stack on 28 Nov 2026. Three of its findings are gaps in enforcement: a check exists, but it can pass without checking. Close each one with a test. Nothing in production code changes. Confirm every claim below in the code before you act on it.

Counts at the base of this batch (full verify): backend 1224 unit and 368 e2e, frontend 1402 unit and 68 browser. The baseline line the verify script prints is older; compare with these numbers instead.

One commit per part, in this order.

## Part A. The rule-engine coverage gate cannot pass with no files
Facts: `src/backend/vitest.config.mts` (about lines 20-24) sets `coverage.thresholds` with a glob key for the rule engine (`src/rules/**`, 80 % statements; the Vision's NFR). In Vitest 5.0.4 a threshold glob that matches no file gives an empty coverage map whose percentage is the string "Unknown"; "Unknown" < 80 is false, so the run passes with no message. `npm run lint` catches a rename of `rules/` only until someone updates `scripts/layers.mjs`; a typo in the glob key is never caught. `src/backend/src/repo-config.spec.ts` (it already checks settings and version pins by reading repo files) does not mention coverage.
Do:
1. In `src/backend/src/repo-config.spec.ts` add a test: for every glob key under `coverage.thresholds` in `vitest.config.mts`, at least one production `.ts` file matches it (not a `*.spec.ts` file, not a file under a `testing/` folder). Also assert that the folder the purity test guards (see `src/backend/src/rules/rules.service.spec.ts`, the test that lists the files of `rules/`) lies under one of those globs. Read the thresholds from the config itself (import the config object if the TypeScript setup allows it; otherwise read the file the way the spec already reads other config files). Do not write a second copy of the glob in the test. Use the file helpers the spec already uses; no new dependency.
2. Prove it: change the key to `src/rulez/**`, run the spec, see the new test fail, restore.
3. `docs/test/test-plan.md` lines 33 and 154 say this check is manual, and line 33 also says the deploy workflow deploys nothing. Read `.github/workflows/deploy.yml` and correct both lines to what is true now, in the document's own style. (This one file under docs/test is in scope for this batch.)

## Part B. One schema-drift check for every table
Facts: entities and SQL migrations describe the schema twice (`synchronize` is false). Six e2e specs ask TypeORM what it would change, `createSchemaBuilder().log()`, each filtered to its own tables: `academic-calendar.e2e-spec.ts` (about line 71), `curriculum-admin.e2e-spec.ts` (96), `curriculum.e2e-spec.ts` (50), `notifications.e2e-spec.ts` (133), `plan-sharing.e2e-spec.ts` (100), `plans.e2e-spec.ts` (63), all in `src/backend/test/`. Eight of the 26 entity tables have no such check: users, sessions, sign_in_attempts, ai_usage, guides, guide_texts, onboarding_answers, transcript_rows.
Do:
1. Add one e2e spec, `src/backend/test/schema-drift.e2e-spec.ts`, that boots through `src/backend/test/support/` like its neighbours and expects that, after the migrations, TypeORM would run no up-query for any table in `dataSource.entityMetadatas`. Take the table list from the metadata; do not type table names.
2. If it fails on the first run, that is a real difference between an entity and the migrated schema. Do not change an entity or a migration, and do not add a list of exceptions. Stop part B, leave the new spec out of the branch, and put the exact output (table, column, the SQL TypeORM would run) in your report and in `leftOut`. The Project Lead decides schema changes.
3. If it passes: for each of the six filtered checks, compare it with the new test. Where the new test makes the same call and the same assertion for a superset of the tables, remove the filtered copy (only that `it`/`expect`, nothing else in the spec) and list it in your report with the reason. Where a filtered check asserts anything more, keep it and say what.
4. Prove it: change one column type in an entity of one of the eight tables (not under `src/backend/src/ai/`), run the new spec with `DATABASE_URL=postgres://omnicourse:omnicourse@localhost:5432/omnicourse_cv_be`, see it fail, restore.
The spec reaches `ai_usage` only through the metadata; do not open or change files under `src/backend/src/ai/` or `src/backend/src/advisor/`.

## Part C. Every frontend fetch mock goes through the route contract
Facts: `mockApi` in `src/frontend/src/testing/fetch.ts` refuses a route that is not in `src/backend/openapi.json`. Sixteen specs still spy on `fetch` directly, so the routes they mock are never checked: five browser specs (Calendar, Guides, Notifications, Privacy, HomeView) and eleven jsdom specs (the `*/api.spec.ts` files, `auth/store.spec.ts`, `SignInView.spec.ts`, `onboarding/store.spec.ts`). Find them with a search for `vi.spyOn(globalThis, 'fetch'` and `vi.stubGlobal('fetch'` under `src/frontend/src`, and list what you find; the count may differ.
Do:
1. Use the route check that already exists (`mockApi` and the helper it calls in `src/frontend/src/testing/`). Do not write a second route matcher.
2. Where a spec only needs canned answers, move it to `mockApi`. Where a spec records the calls it saw and asserts on them, keep its recording and add that every recorded call is a route of the contract, through the existing helper. Choose per spec whichever changes fewer lines.
3. Every existing `it(` and `expect(` stays, with the same meaning. Count them per file before and after and put the table in your report.
4. If a spec mocks a call that is rightly outside the contract (a static file, an absolute external URL, a deliberately unknown route to test an error path), leave that call as it is and list it with the reason.
5. Do not touch anything under `src/frontend/src/dashboard/` (it belongs to the frontend owner and is out of bounds for this work).
6. Prove it: in one moved spec change a mocked path to `/no-such-route`, see the spec fail on the route check, restore.

If one part cannot be done within the boundaries, leave that part out, say so in `leftOut`, and finish the others.

## Boundaries it had to keep
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.

## Check, in this order, and record what you checked
1. Behaviour: for every function, query, constant, type or template that moved, merged or was rewritten, compare old and new line by line. Name any difference in results, order, error text, SQL, lock mode, timing or rendered output.
2. Contract: `git diff 790ce3fa7e2c89397a7180d1d507dc27ec12292a..HEAD -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` shows nothing it should not; no route, DTO field or class name, status or error code changed.
3. Tests: `git diff 790ce3fa7e2c89397a7180d1d507dc27ec12292a..HEAD --stat -- '*.spec.ts' '*.e2e-spec.ts' '*.test.mjs'`. For each changed or deleted test file, confirm no `it(`, `test(` or `expect(` was lost or loosened; a moved test must be the same test. New logic has a test that fails when the logic is wrong (try to think of the mutation that would slip through).
4. Completeness: search src/, test/, scripts/, deploy/, .github/, docs/analysis-and-design, AGENTS.md, README.md for every name, path and import the batch retired. Nothing still points at them; the old and the new implementation do not coexist.
5. Structure: is the system simpler, or was the complexity only moved? Any new cross-folder import or cycle (compare the import graph with the base)? A wrapper, flag or parameter that only one caller understands? A smaller change that gets the same result?
6. Repo rules: no comments, no new dependency, .js import suffixes in the backend, names that say what things are, no magic numbers; `git log --format='%h %G? %s' 790ce3fa7e2c89397a7180d1d507dc27ec12292a..HEAD` shows G for every commit and Conventional subjects; exactly one new file under .changeset/.
7. Scope: nothing outside the objective, nothing in the off-limits files beyond a listed one-line import change.
8. Run the three proofs yourself. The read-only rule has one exception for this batch: you may make the temporary mutation edits these proofs need, one at a time, and you must restore each with `git checkout -- <file>` before the next; `git status --short` must be empty when you finish. (a) change the coverage glob key in src/backend/vitest.config.mts to a folder that does not exist: the new repo-config test must fail; (b) change one column type in an entity of a table that had no drift check: the new e2e spec must fail (DATABASE_URL=postgres://omnicourse:omnicourse@localhost:5432/omnicourse_cv_be, from src/backend: `nice -n 10 npx vitest run --config vitest.e2e.config.mts test/schema-drift.e2e-spec.ts`); (c) in one frontend spec the batch moved, change a mocked path to a route that is not in openapi.json: the spec must fail on the route check.
9. For every drift check removed from a feature e2e spec: show that the new test makes the same call and the same assertion for that spec's tables. A removed check that asserted anything more is blocking.
10. For every frontend spec the batch touched: count `it(` and `expect(` before and after (`git show 790ce3fa7e2c89397a7180d1d507dc27ec12292a:<path> | grep -c`), and read each changed expectation. A lost or loosened expectation is blocking. Nothing under src/frontend/src/dashboard/ changed.
11. docs/test/test-plan.md: the two corrected lines state only what .github/workflows/deploy.yml and the new test really do.

Blocking: wrong or changed behaviour, a broken boundary, a lost or weakened test, an incomplete migration, a repo-rule violation, or a clearly simpler design that removes real complexity. Non-blocking: naming, wording, optional polish. Each finding: file, line, the problem, the concrete fix.

Write the review to /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/23-checks-that-can-fail/review-ROUND.md (ROUND is the round number you are told, 1 if none) and return the structured verdict.