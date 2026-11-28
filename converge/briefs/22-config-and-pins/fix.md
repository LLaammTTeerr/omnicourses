You are finishing one refactor batch in the OmniCourse repo after an independent review. The batch and its rules:

You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-be (branch cvb/22-config-and-pins is checked out; base commit 43422c52c1c1dfb97e5fab198ea9c3c54d670436). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: configuration names, runtime versions and exact pins are checked instead of remembered
Source: findings 1.1, 2.1, 2.2, 4.1 and the alias of 3.3 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/config-deploy-ci.md. Read them first, then src/backend/src/repo-config.spec.ts (a unit spec that already reads repo files: it checks compose.yaml ports), src/backend/src/config/env.ts and .env.example.

Why: three lists are kept in step by memory. (1) The settings the backend reads (config/env.ts, 13 names) and the settings .env.example documents: NODE_ENV is read and not documented, and nothing fails when a new setting is forgotten. (2) The pinned runtimes: Node in .nvmrc, deploy/server/setup.sh and AGENTS.md; npm in two workflows, setup.sh and AGENTS.md; the PostgreSQL image in compose.yaml, ci.yml and setup.sh. A bump is five files found by search. (3) AGENTS.md says every dependency is pinned exactly; no check says so.

A. In src/backend/src/repo-config.spec.ts add three checks, each reading the files as text or JSON (no new dependency, no network):
1. Settings: the set of environment variable names read in config/env.ts equals the set of names in .env.example (commented-out lines count as documented), apart from a short named list of names the host sets and a developer does not (NODE_ENV), and apart from the frontend's VITE_* names, which you check against their one reader in src/frontend/src. If .env.example lacks a name today, add the line to .env.example in the style of its neighbours (that file is documentation; say which lines you added).
2. Pinned runtimes: every place that states the Node version, the npm version or the PostgreSQL image version states the same one: .nvmrc, compose.yaml, .github/workflows/ci.yml and release.yml, deploy/server/setup.sh, and the "Stack" line of AGENTS.md. The spec only reads .github/ and deploy/; you must not edit anything there. If the copies disagree today, do not fix those files: report the disagreement at the top of your result and make the check name the files that agree.
3. Exact pins: every version in dependencies and devDependencies of the three package.json files is an exact x.y.z.
Each check must be shown to fail: change one copy in a scratch copy of the file (or temporarily in the worktree, restored at once) and see the spec fail; say so in the report.

B. Logging. src/backend/src/common/failure-kind.ts has logFailure, whose last step is "log the line with the stack if there is one, without it if not"; src/backend/src/notifications/notifications.service.ts repeats that step (near lines 134-135). Export the step once from failure-kind.ts, use it in both, and keep every logged text identical (the existing specs pin them).

C. Root package.json: add a `test:e2e` script that runs the backend's e2e suite, so the commands block of AGENTS.md can name one-word commands; update that block minimally. Do not touch .github/.

D. One sentence in docs/analysis-and-design/architecture.md (cross-cutting table, configuration row) that the list of settings and the pinned runtimes are checked by src/backend/src/repo-config.spec.ts.

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
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-build-be omnicourse_cv_be typecheck lint unit-be build e2e openapi contract` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, backend unit tests, build, e2e, and the openapi and migration diffs (a "-" on the COUNTS line is a suite it did not run; the orchestrator runs the rest); about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`test(backend): ...`), a body of one or two sentences that says why, and as the last line the Co-Authored-By trailer that your own session's attribution reminder gives for your model (if you have none: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`).
- In the last commit add `.changeset/22-config-and-pins.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/22-config-and-pins/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.

## Now
The batch is already implemented on this branch (see `git log --oneline 43422c52c1c1dfb97e5fab198ea9c3c54d670436..HEAD` and /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/22-config-and-pins/report.md). An independent reviewer found the problems listed below. For each blocking finding: check it against the code; if it is right, fix it in a new commit (do not amend or rebase); if it is wrong, say why in the report with evidence. Take a non-blocking finding only when it is cheap and clearly right. Then run the full verify again, append a "Review round" section to the report, and return the structured result (commits: only the new ones).

Findings:
