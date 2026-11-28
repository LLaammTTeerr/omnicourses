You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-be (branch cvb/23-checks-that-can-fail is checked out; base commit 790ce3fa7e2c89397a7180d1d507dc27ec12292a). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: three checks that could pass without checking anything
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

## Boundaries
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.
- The survey findings named above are leads, not truth: confirm each claim in the code before acting on it. If a claim is wrong, or a step cannot be done without breaking a boundary, do not force it: leave that step out and say so in your result.
- Keep the diff to the objective: no drive-by renames, reformatting or unrelated cleanup.
- Docs: search docs/analysis-and-design, AGENTS.md, README.md, CONTRIBUTING.md and GLOSSARY.md for names or paths you moved or removed, and correct the lines that would now be wrong (not docs/test/**, not report/**: those are dated records).

## Verify
- The machine is shared with other jobs: run every test command at low priority and with few workers, like `cd src/backend && nice -n 10 npx vitest run --maxWorkers=4 <path>` or `cd src/frontend && nice -n 10 npx vitest run --maxWorkers=4 <path>`, never the whole suite in a loop. A test that fails with "Test timed out in 5000ms" while the machine is busy is load, not your change: run that file once more before you conclude anything.
- While working, run targeted checks as above, and `npx --yes npm@11.21.1 run typecheck -w src/backend` (or `-w src/frontend`), `npx --yes npm@11.21.1 run lint`.
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-build-be omnicourse_cv_be typecheck lint unit-be unit-fe build e2e openapi browser` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, backend and frontend unit tests, build, e2e, the openapi diff and the browser tests (the migration-folder diff is left to the orchestrator) (a "-" on the COUNTS line is a suite it did not run; the orchestrator runs the rest); about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`test: ...`), a body of one or two sentences that says why, and as the last line the Co-Authored-By trailer that your own session's attribution reminder gives for your model (if you have none: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`).
- In the last commit add `.changeset/23-checks-that-can-fail.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/23-checks-that-can-fail/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.