You are the independent reviewer of one refactor batch in the OmniCourse repo. You did not write it. Find what is wrong with it before a human reads it. Default to doubt: "behaviour unchanged" is true only where you checked it.

## Where
- Worktree /home/lamter/omnicourses/.claude/worktrees/cv-build-fb, branch cvb/19-route-contract. The batch is `git diff 5a9bbac026e9d449398f5a9a411ef75f61050282..HEAD` (commits: `git log --oneline 5a9bbac026e9d449398f5a9a411ef75f61050282..HEAD`).
- READ-ONLY: do not edit, stage, commit, push or post anything. You may run targeted tests, typecheck and lint, and `node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs <src dir>`. Do not open /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/19-route-contract/report.md until you have written down your own findings; then read it only to check the implementer's stated omissions.

## What the batch was asked to do: the test API mock refuses a route the contract does not have
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

## Boundaries it had to keep
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.

## Check, in this order, and record what you checked
1. Behaviour: for every function, query, constant, type or template that moved, merged or was rewritten, compare old and new line by line. Name any difference in results, order, error text, SQL, lock mode, timing or rendered output.
2. Contract: `git diff 5a9bbac026e9d449398f5a9a411ef75f61050282..HEAD -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` shows nothing it should not; no route, DTO field or class name, status or error code changed.
3. Tests: `git diff 5a9bbac026e9d449398f5a9a411ef75f61050282..HEAD --stat -- '*.spec.ts' '*.e2e-spec.ts' '*.test.mjs'`. For each changed or deleted test file, confirm no `it(`, `test(` or `expect(` was lost or loosened; a moved test must be the same test. New logic has a test that fails when the logic is wrong (try to think of the mutation that would slip through).
4. Completeness: search src/, test/, scripts/, deploy/, .github/, docs/analysis-and-design, AGENTS.md, README.md for every name, path and import the batch retired. Nothing still points at them; the old and the new implementation do not coexist.
5. Structure: is the system simpler, or was the complexity only moved? Any new cross-folder import or cycle (compare the import graph with the base)? A wrapper, flag or parameter that only one caller understands? A smaller change that gets the same result?
6. Repo rules: no comments, no new dependency, .js import suffixes in the backend, names that say what things are, no magic numbers; `git log --format='%h %G? %s' 5a9bbac026e9d449398f5a9a411ef75f61050282..HEAD` shows G for every commit and Conventional subjects; exactly one new file under .changeset/.
7. Scope: nothing outside the objective, nothing in the off-limits files beyond a listed one-line import change.
8. Try to defeat the check: in one feature's api module change a path to one the contract lacks (and the same in its spec's mockApi key), run that spec, and confirm it fails with the new error; restore. Confirm a path with one segment too many, and a right path with the wrong method, are refused. Count the test cases of the suite before and after (`npx vitest run --maxWorkers=4` Tests line): only the new helper's cases may be added, none lost.

Blocking: wrong or changed behaviour, a broken boundary, a lost or weakened test, an incomplete migration, a repo-rule violation, or a clearly simpler design that removes real complexity. Non-blocking: naming, wording, optional polish. Each finding: file, line, the problem, the concrete fix.

Write the review to /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/19-route-contract/review-ROUND.md (ROUND is the round number you are told, 1 if none) and return the structured verdict.