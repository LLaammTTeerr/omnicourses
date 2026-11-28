You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-fb (branch cvb/19-route-contract is checked out; base commit 5a9bbac026e9d449398f5a9a411ef75f61050282). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: the test API mock refuses a route the contract does not have
Source: the third gap of FRO-5 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/frontend-platform.md (it was held back while src/frontend/src/testing/fetch.ts belonged to an open pull request; that pull request has merged). Read it first, then src/frontend/src/testing/fetch.ts and src/frontend/src/testing/contract.ts.

Why: every feature's api module builds its request paths by hand, and the unit tests mock those same paths with `mockApi({ 'GET /plans/123': ... })`. If the backend renames or removes a route, src/backend/openapi.json changes, but every frontend unit test still passes with the old path. Only admin/api.spec.ts compares its paths with the contract, through a hand-written table. mockApi is the one place all 39 spec files that touch the API go through.

A. In src/frontend/src/testing/contract.ts add a helper that says whether the contract has a route for a method and a path as the client sends it (the contract's paths carry the API prefix and `{name}` segments; a `{name}` segment matches exactly one non-empty path segment; the query string is not part of the path). Give it a spec: a literal path, a path with parameters, the wrong method, one segment too many or too few, an unknown path.

B. mockApi checks every route key it is given, when it is called, and throws an error that names the route when the contract has no such route. Checking at registration means a wrong path fails even in a test where that call never happens.

C. Run the whole frontend unit suite and the browser suite. For every route the new check refuses, find out which it is and act:
- the test mocks a path the production code never calls (a typo or a leftover in the test): fix the test's route;
- the production api module calls a route the contract does not have: this is a real defect. Do not change production code. Leave that test working by the smallest means and report the route, the api function and the contract's nearest path at the top of your result;
- the test deliberately answers a route outside the contract (for example to prove an unexpected call is rejected): keep it working with an explicit, named way to say so at that call site, and list each use in the report. Add such an escape only if a real case needs it.
No assertion in any existing test may change.

D. The hand table in admin/api.spec.ts stays: it checks more (which template each function hits).

E. One sentence in docs/analysis-and-design/architecture.md where the contract checks are described: the test API mock refuses a route that is not in openapi.json.

No production file under src/frontend/src changes except the two testing helpers; src/backend is not touched.

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
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-build-fb omnicourse_cv_fb typecheck lint unit-fe build browser contract` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, frontend unit tests, build, browser tests and the contract diff (a "-" on the COUNTS line is a suite it did not run; the orchestrator runs the rest); about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`test(frontend): ...`), a body of one or two sentences that says why, and as the last line the Co-Authored-By trailer that your own session's attribution reminder gives for your model (if you have none: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`).
- In the last commit add `.changeset/19-route-contract.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/19-route-contract/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.