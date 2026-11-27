You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-be (branch cvb/02-locks-and-seeds is checked out; base commit 9eef108dcb0dcfb23c7b428dd0469a442acb2c3c). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: one registry for database lock keys, and curriculum seed data inside curriculum/
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

## Boundaries
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.
- The survey findings named above are leads, not truth: confirm each claim in the code before acting on it. If a claim is wrong, or a step cannot be done without breaking a boundary, do not force it: leave that step out and say so in your result.
- Keep the diff to the objective: no drive-by renames, reformatting or unrelated cleanup.
- Docs: search docs/analysis-and-design, AGENTS.md, README.md, CONTRIBUTING.md and GLOSSARY.md for names or paths you moved or removed, and correct the lines that would now be wrong (not docs/test/**, not report/**: those are dated records).

## Verify
- While working, run targeted checks: `cd src/backend && npx vitest run <path>`, `cd src/frontend && npx vitest run <path>`, `npx --yes npm@11.21.1 run typecheck -w src/backend` (or `-w src/frontend`), `npx --yes npm@11.21.1 run lint`.
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-build-be omnicourse_cv_be typecheck lint unit-be build e2e openapi contract` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, backend unit tests, build, e2e, and the openapi and migration diffs (a "-" on the COUNTS line is a suite it did not run; the orchestrator runs the rest); about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`refactor(backend): ...`), a body of one or two sentences that says why, and the last line `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- In the last commit add `.changeset/02-locks-and-seeds.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/02-locks-and-seeds/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.