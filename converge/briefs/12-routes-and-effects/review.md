You are the independent reviewer of one refactor batch in the OmniCourse repo. You did not write it. Find what is wrong with it before a human reads it. Default to doubt: "behaviour unchanged" is true only where you checked it.

## Where
- Worktree /home/lamter/omnicourses/.claude/worktrees/cv-build-fa, branch cvb/12-routes-and-effects. The batch is `git diff c05b6038e7393f79e4c746652d77f0a0b612ddc2..HEAD` (commits: `git log --oneline c05b6038e7393f79e4c746652d77f0a0b612ddc2..HEAD`).
- READ-ONLY: do not edit, stage, commit, push or post anything. You may run targeted tests, typecheck and lint, and `node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs <src dir>`. Do not open /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/12-routes-and-effects/report.md until you have written down your own findings; then read it only to check the implementer's stated omissions.

## What the batch was asked to do: each feature owns its route records and its app-wide effects
Sources: FRO-4 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/frontend-platform.md; FRO-3 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/frontend-admin-content.md; TES-4 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/tests-ci-docs.md. Read them first, and PRs #201 and #203 in git log (menu entries live on the routes; menu order is route order): keep that design.

Why: router.ts, App.vue and App.spec.ts are edited by every feature (15, 9 and 12 commits in four weeks). Two branches that each add a screen always collide in the same array, and admin and notification behaviour is tested in the shared App.spec.ts.

A. Proof first, outside the repo: a script or temporary spec that serialises the app's routes (path, name, the whole meta, children, in order; a component replaced by whether it is lazy) to canonical JSON. Run it on the untouched tree and keep the file; run it on your final commit; the two must be identical. Put the result in the report. Do not commit the proof.

B. Route records.
1. A kernel file src/frontend/src/route-meta.ts holds the MenuEntry type and the RouteMeta augmentation (today router.ts imports MenuEntry from shell/nav.ts while nav.ts imports routes from router.ts). Add it to the kernel list in scripts/layers.mjs.
2. Each feature folder gets routes.ts exporting its route records, moved as they are (path, name, meta, lazy import, menu labels as literals: where labels come from is the frontend owner's decision, do not change it). The admin children are built from ADMIN_SECTIONS (add the path and the lazy loader to each section), so a new admin screen is one entry.
3. router.ts keeps the guards, the stale-chunk reload and one ordered list that spreads the features' records in today's order.
audit/routes.ts is a new file and allowed; the other audit dashboard files are off limits.

C. App-wide effects. App.vue holds the admin-grant loading with its retry and the unread-notification polling. Move each into its feature as a composable (admin/access.ts, notifications/store.ts) that App.vue calls in one line; same watchers, same intervals. Move the App.spec.ts cases that test them into specs in admin/ and notifications/ with the same assertions (count the it( blocks before and after and list the moved ones in the report).

D. Sidebar expectations. App.spec.ts and shell/MobileBars.spec.ts type the Vietnamese menu labels again. Only if shell/nav.spec.ts already pins every label and the order literally: build the expected lists in App.spec.ts and MobileBars.spec.ts from the declared menu, so these specs check "the shell renders the declared menu" and nav.spec.ts alone pins the wording. If nav.spec.ts does not pin them all, leave these specs as they are and say so.

E. scripts/layers.mjs: what lint asks for, listed in the report.

## Boundaries it had to keep
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.

## Check, in this order, and record what you checked
1. Behaviour: for every function, query, constant, type or template that moved, merged or was rewritten, compare old and new line by line. Name any difference in results, order, error text, SQL, lock mode, timing or rendered output.
2. Contract: `git diff c05b6038e7393f79e4c746652d77f0a0b612ddc2..HEAD -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` shows nothing it should not; no route, DTO field or class name, status or error code changed.
3. Tests: `git diff c05b6038e7393f79e4c746652d77f0a0b612ddc2..HEAD --stat -- '*.spec.ts' '*.e2e-spec.ts' '*.test.mjs'`. For each changed or deleted test file, confirm no `it(`, `test(` or `expect(` was lost or loosened; a moved test must be the same test. New logic has a test that fails when the logic is wrong (try to think of the mutation that would slip through).
4. Completeness: search src/, test/, scripts/, deploy/, .github/, docs/analysis-and-design, AGENTS.md, README.md for every name, path and import the batch retired. Nothing still points at them; the old and the new implementation do not coexist.
5. Structure: is the system simpler, or was the complexity only moved? Any new cross-folder import or cycle (compare the import graph with the base)? A wrapper, flag or parameter that only one caller understands? A smaller change that gets the same result?
6. Repo rules: no comments, no new dependency, .js import suffixes in the backend, names that say what things are, no magic numbers; `git log --format='%h %G? %s' c05b6038e7393f79e4c746652d77f0a0b612ddc2..HEAD` shows G for every commit and Conventional subjects; exactly one new file under .changeset/.
7. Scope: nothing outside the objective, nothing in the off-limits files beyond a listed one-line import change.
8. Rebuild the route proof yourself at the base and at HEAD and compare. Count the test cases of App.spec.ts and of the specs that received its cases, before and after: none may be lost, and every moved case keeps its assertions.

Blocking: wrong or changed behaviour, a broken boundary, a lost or weakened test, an incomplete migration, a repo-rule violation, or a clearly simpler design that removes real complexity. Non-blocking: naming, wording, optional polish. Each finding: file, line, the problem, the concrete fix.

Write the review to /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/12-routes-and-effects/review-ROUND.md (ROUND is the round number you are told, 1 if none) and return the structured verdict.