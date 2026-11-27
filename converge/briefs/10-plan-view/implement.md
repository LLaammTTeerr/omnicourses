You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-fa (branch cvb/10-plan-view is checked out; base commit 9eef108dcb0dcfb23c7b428dd0469a442acb2c3c). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: a pure issue-view leaf for the planner, and a tested view model for the shared plan page
Sources: FRO-2, FRO-1 (step 1 only) and FRO-7 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/frontend-planning.md. Read them first. The rendered page must not change: sharing/SharedPlanView.spec.ts, the SharedPlan browser spec, plans/PlanEditorView.spec.ts and the IssuesPanel tests pass with their assertions untouched.

A. plans/issue-view.ts. plans/present.ts does two jobs: what an issue or a term load looks like (pure), and loading the board's data (composables that fetch). The signed-out shared page imports the first and so drags in the second. Move the pure part (ISSUE_KINDS_SHOWN, KIND_STYLE, strongest, BAR_CODES, METER_HEADROOM_CREDITS, capOf, toneOf, meter, and the citation helper `clause` that exists twice) into plans/issue-view.ts, which imports types only: no composable, no api call. Callers import from the new file; present.ts re-exports nothing. The matching tests move beside it with the same assertions.

B. sharing/view.ts. SharedPlanView.vue (1077 lines) computes its row and tile view models inside the component, re-deriving what plans/present.ts derives, and uses an adapter (toEngineIssue) that puts a group NAME into requirementGroupId so a planner function can word it. Move the view-model logic into pure functions in sharing/view.ts built on the leaf from A; make the leaf functions accept the structural part of an issue they need so the adapter can be deleted; give the wording function an explicit way to get the requirement name instead of the id convention (the editor's behaviour stays identical). Unit-test view.ts with fixtures. The component keeps only what needs Vue.

C. Surplus in sharing/api.ts: the survey says UpdatePlanShareBody and PlanShareStatus have no reader and NotShared is read only by a spec. Verify by search; delete what is unused and point the spec at the real type.

Do not start on shared components or CSS (that is the next batch). Do not touch plans/session.ts behaviour. If lint reports feature edges in scripts/layers.mjs that no longer exist, remove exactly those lines.

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
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-build-fa omnicourse_cv_fa typecheck lint unit-fe build browser contract` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, frontend unit tests, build, browser tests and the contract diff (a "-" on the COUNTS line is a suite it did not run; the orchestrator runs the rest); about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`refactor(plans): ...`), a body of one or two sentences that says why, and the last line `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- In the last commit add `.changeset/10-plan-view.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/10-plan-view/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.