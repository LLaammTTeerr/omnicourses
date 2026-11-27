You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-fa (branch cvb/18-dashboard-folder is checked out; base commit 7f14cb02132731b5c05851f5e1a1458f2f3f15d0). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: the dashboard in its own feature folder
Why: the dashboard screen (merged with PR #214) lives in src/frontend/src/audit/. It reads the calendar, notifications, onboarding and plans, so the degree-audit feature now imports four other features, and `audit` and `plans` import each other. The dashboard is a screen that composes features; audit is one of the features it composes. scripts/layers.mjs lists the four edges `audit -> calendar`, `audit -> notifications`, `audit -> onboarding` and `audit -> plans` only because of it.

A. Proof first, outside the repo: serialise the app's routes (path, name, the whole meta, children, in order; a component replaced by whether it is lazy) to canonical JSON on the untouched tree; do it again on your final commit; the two must be identical. Put the result in the report. Do not commit the proof.

B. Move, with `git mv`, the dashboard's files from src/frontend/src/audit/ to a new src/frontend/src/dashboard/: DashboardView.vue, DashboardView.spec.ts, dashboard.ts, dashboard.spec.ts and dashboard-messages.ts (in the new folder the catalogue follows the other features and is called messages.ts; the exported names stay). Move the dashboard's route records out of audit/routes.ts into dashboard/routes.ts and let router.ts spread them at the same place in the order, so path, name, meta and menu order are unchanged. Fix every import. What the dashboard reads from audit (its api and helpers) it now imports across folders; do not copy code. The specs move with their files, assertions untouched; they may keep importing audit/testing/fixtures.

C. scripts/layers.mjs: remove the four `audit -> ...` edges the dashboard caused and add the `dashboard -> ...` edges lint asks for. After this, `audit` must import no feature except the ones it imported before the dashboard arrived (curriculum, transcript), and there must be no `audit -> plans` edge. List the final edges in the report.

D. If DashboardView.vue or dashboard.ts contain the inline lookups this stack replaced elsewhere (`GROUPS.find((g) => g.id === id)!.glyph` and the short-name twin), use groupGlyph / groupShort from groups.ts. Nothing else in the dashboard's code changes: this batch is a move.

E. Docs: correct the lines in docs/analysis-and-design (architecture.md section 5, class-model.md, sequence diagrams) and README.md that name the dashboard's old paths.

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
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-build-fa omnicourse_cv_fa typecheck lint unit-fe build browser contract` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, frontend unit tests, build, browser tests and the contract diff (a "-" on the COUNTS line is a suite it did not run; the orchestrator runs the rest); about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`refactor(dashboard): ...`), a body of one or two sentences that says why, and as the last line the Co-Authored-By trailer that your own session's attribution reminder gives for your model (if you have none: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`).
- In the last commit add `.changeset/18-dashboard-folder.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/18-dashboard-folder/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.