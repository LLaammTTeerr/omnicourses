You are the independent reviewer of one refactor batch in the OmniCourse repo. You did not write it. Find what is wrong with it before a human reads it. Default to doubt: "behaviour unchanged" is true only where you checked it.

## Where
- Worktree /home/lamter/omnicourses/.claude/worktrees/cv-build-be, branch cvb/02-locks-and-seeds. The batch is `git diff 9eef108dcb0dcfb23c7b428dd0469a442acb2c3c..HEAD` (commits: `git log --oneline 9eef108dcb0dcfb23c7b428dd0469a442acb2c3c..HEAD`).
- READ-ONLY: do not edit, stage, commit, push or post anything. You may run targeted tests, typecheck and lint, and `node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs <src dir>`. Do not open /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/02-locks-and-seeds/report.md until you have written down your own findings; then read it only to check the implementer's stated omissions.

## What the batch was asked to do: one registry for database lock keys, and curriculum seed data inside curriculum/
Sources: BAC-2 and BAC-7 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-platform.md; BAC-1 (step 1 only) and BAC-3 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-admin-content.md. Read them first.

Why: the backend has a folder cycle curriculum <-> curriculum-admin <-> database. It exists because (a) seed code and account code import a lock number from a curriculum-admin service file, and (b) curriculum's seed data sits in database/seeds while database/seed.ts imports curriculum. After this batch, `node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs src/backend/src` must report folderCycles [["auth","users"]] only.

A. Lock keys
1. New src/backend/src/common/advisory-locks.ts owns every advisory-lock key, values unchanged: the admin write lock 11_012_001 and the access-manager lock 11_012_002 (today in curriculum-admin/admin-write.service.ts), the sign-in attempt namespace 11_012_003 (auth/auth.service.ts) and the AI quota namespace 3003 (ai/ai-cost-guard.service.ts). Two call styles exist (one bigint key; a namespace plus hashtext): name the two groups so a reader sees they are separate key spaces.
2. A spec asserts the keys are unique within each group.
3. Every call site imports from the registry; the local constants and any re-export are deleted. ai/ai-cost-guard.service.ts is otherwise off limits: change only its constant into an import.
4. Add a shared lock helper only if the call sites are truly the same statement; a wrapper that just renames `pg_advisory_xact_lock` is not worth a function.

B. Seeds
1. `git mv` src/backend/src/database/seeds to src/backend/src/curriculum/seeds (the specs inside move with it) and fix every import (seed-curricula.ts, curriculum-admin/program-admin.dto.spec.ts, the e2e specs under src/backend/test; test/curriculum-admin-import.e2e-spec.ts is otherwise off limits: import path line only).
2. src/backend/src/database/seed.ts becomes a list of seeders with one signature `(dataSource, options)`, the options type shared by guides and curriculum, the command-line flag parsed once. The CLI stays the same: `npm run db:seed`, the flag `--guide-fixtures`, the production refusal, the output a deploy relies on (check deploy/, .github/workflows and package.json scripts for callers before you change anything).
3. Prove it: build, then run db:migrate and db:seed twice against a fresh database (create one named omnicourse_cv_be_seed with `docker exec $(docker ps --filter publish=5432 --format '{{.Names}}' | head -1) createdb -U omnicourse omnicourse_cv_be_seed`, DATABASE_URL=postgres://omnicourse:omnicourse@localhost:5432/omnicourse_cv_be_seed); the second run must insert nothing. Put both outputs in the report.

C. scripts/layers.mjs: lint will now report the listed backend edges that no longer exist; remove exactly those lines.

## Boundaries it had to keep
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.

## Check, in this order, and record what you checked
1. Behaviour: for every function, query, constant, type or template that moved, merged or was rewritten, compare old and new line by line. Name any difference in results, order, error text, SQL, lock mode, timing or rendered output.
2. Contract: `git diff 9eef108dcb0dcfb23c7b428dd0469a442acb2c3c..HEAD -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` shows nothing it should not; no route, DTO field or class name, status or error code changed.
3. Tests: `git diff 9eef108dcb0dcfb23c7b428dd0469a442acb2c3c..HEAD --stat -- '*.spec.ts' '*.e2e-spec.ts' '*.test.mjs'`. For each changed or deleted test file, confirm no `it(`, `test(` or `expect(` was lost or loosened; a moved test must be the same test. New logic has a test that fails when the logic is wrong (try to think of the mutation that would slip through).
4. Completeness: search src/, test/, scripts/, deploy/, .github/, docs/analysis-and-design, AGENTS.md, README.md for every name, path and import the batch retired. Nothing still points at them; the old and the new implementation do not coexist.
5. Structure: is the system simpler, or was the complexity only moved? Any new cross-folder import or cycle (compare the import graph with the base)? A wrapper, flag or parameter that only one caller understands? A smaller change that gets the same result?
6. Repo rules: no comments, no new dependency, .js import suffixes in the backend, names that say what things are, no magic numbers; `git log --format='%h %G? %s' 9eef108dcb0dcfb23c7b428dd0469a442acb2c3c..HEAD` shows G for every commit and Conventional subjects; exactly one new file under .changeset/.
7. Scope: nothing outside the objective, nothing in the off-limits files beyond a listed one-line import change.

Blocking: wrong or changed behaviour, a broken boundary, a lost or weakened test, an incomplete migration, a repo-rule violation, or a clearly simpler design that removes real complexity. Non-blocking: naming, wording, optional polish. Each finding: file, line, the problem, the concrete fix.

Write the review to /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/02-locks-and-seeds/review-ROUND.md (ROUND is the round number you are told, 1 if none) and return the structured verdict.