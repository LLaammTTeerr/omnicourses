You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-be (branch cvb/07-admin-access is checked out; base commit 0a76adac3de1c937c5397831b6c85960adcf5cf2). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: the admin write gate as its own module, and a composition root that parallel branches can both edit
Sources: BAC-1 (step 2) in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-admin-content.md; BAC-5 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-platform.md. Read them first, then ADR 0011.

A. Admin access. academic-calendar imports the whole CurriculumAdminModule (five controllers) only to reach AdminWriteService and the 403 decorator; account imports from curriculum-admin too. Create src/backend/src/admin-access/ holding what "may this caller write" needs: admin-write.service.ts, the grants reader (Need, grantsOf, missingPermission), the two grant entities, the 403 error decorator, and a small AdminAccessModule that registers the two entities and exports the service. curriculum-admin and academic-calendar import that module. What presents grants to the API (DTOs, the user-grants presenter, controllers) stays in curriculum-admin. Table names, entity class names, DTO class names, routes and Swagger tags do not change; openapi.json stays byte-identical. No re-export files at the old paths. csv-import.service.ts and its spec are off limits beyond an import-path line.
Register the new module where modules are registered, add the folder to the module table in docs/analysis-and-design/architecture.md (lint's module-index rule checks it), and update ADR text that names the old paths.

B. Composition root.
1. src/backend/src/features.ts lists 15 modules on one line, so two branches that each add a module always conflict. One module per line, sorted by name (module order is free since #183; the contract build sorts).
2. src/backend/src/database/migrations/index.ts needs every migration twice (an import and an array entry). Keep an explicit list (ADR 0002 rejects globs) but make it one line per migration; the existing index.spec.ts must still prove every file is listed and timestamps are unique, and the run order stays by timestamp.
3. app.module.ts and openapi-document.ts each assemble the platform imports (TypeORM root, ClockModule, the feature list) by hand. One function builds them for both.

C. scripts/layers.mjs: add the edges of the new folder on purpose and remove the ones lint reports as gone (academic-calendar -> curriculum-admin and account -> curriculum-admin should go; say in the report if they cannot).

## Boundaries
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.
- The survey findings named above are leads, not truth: confirm each claim in the code before acting on it. If a claim is wrong, or a step cannot be done without breaking a boundary, do not force it: leave that step out and say so in your result.
- Keep the diff to the objective: no drive-by renames, reformatting or unrelated cleanup.
- Docs: search docs/analysis-and-design, AGENTS.md, README.md, CONTRIBUTING.md and GLOSSARY.md for names or paths you moved or removed, and correct the lines that would now be wrong (not docs/test/**, not report/**: those are dated records).

## Verify
- The machine is shared with other jobs: run every test command at low priority and with few workers, like `cd src/backend && nice -n 10 npx vitest run --maxWorkers=4 <path>` or `cd src/frontend && nice -n 10 npx vitest run --maxWorkers=4 <path>`, never the whole suite in a loop. A test that fails with "Test timed out in 5000ms" while the machine is busy is load, not your change: run that file once more before you conclude anything.
- While working, run targeted checks as above, and `npx --yes npm@11.21.1 run typecheck -w src/backend` (or `-w src/frontend`), `npx --yes npm@11.21.1 run lint`.
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-build-be omnicourse_cv_be typecheck lint unit-be build e2e openapi contract` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, backend unit tests, build, e2e, and the openapi and migration diffs (a "-" on the COUNTS line is a suite it did not run; the orchestrator runs the rest); about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`refactor(backend): ...`), a body of one or two sentences that says why, and as the last line the Co-Authored-By trailer that your own session's attribution reminder gives for your model (if you have none: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`).
- In the last commit add `.changeset/07-admin-access.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/07-admin-access/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.