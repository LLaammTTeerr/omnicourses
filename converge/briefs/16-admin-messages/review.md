You are the independent reviewer of one refactor batch in the OmniCourse repo. You did not write it. Find what is wrong with it before a human reads it. Default to doubt: "behaviour unchanged" is true only where you checked it.

## Where
- Worktree /home/lamter/omnicourses/.claude/worktrees/cv-build-fb, branch cvb/16-admin-messages. The batch is `git diff 9d66307450cd7491d6becc5ea6a7ddc4fb118721..HEAD` (commits: `git log --oneline 9d66307450cd7491d6becc5ea6a7ddc4fb118721..HEAD`).
- READ-ONLY: do not edit, stage, commit, push or post anything. You may run targeted tests, typecheck and lint, and `node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs <src dir>`. Do not open /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/16-admin-messages/report.md until you have written down your own findings; then read it only to check the implementer's stated omissions.

## What the batch was asked to do: the admin message catalogue split by screen
Sources: FRO-6 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/frontend-admin-content.md. Read it first.

src/frontend/src/admin/messages.ts is one file of about 1160 lines: six interfaces for six screens plus two complete language objects, with the Vietnamese and the English text of one screen about 400 lines apart. Every admin change edits it.

Split it by screen into files under src/frontend/src/admin/messages/ (one per screen plus one for the shared keys), each holding its interface and its vi and en text side by side. admin/messages.ts stays as the one place that composes and exports ADMIN_MESSAGES and the AdminText type, so no screen, dialog or spec changes its imports or the keys it reads. Every string moves byte for byte: do it with a script or with careful cut and paste, never by retyping, and prove it: before the change write the whole ADMIN_MESSAGES object as canonical JSON (functions called with a few fixed arguments, or listed by name) to a file outside the repo; after the change do the same and compare. Put the comparison result in the report. The catalogue spec (src/frontend/src/messages.spec.ts) and every admin spec pass untouched.

The audit dashboard already has its catalogue in its own file (audit/dashboard-messages.ts): follow that file's shape.

## Boundaries it had to keep
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.

## Check, in this order, and record what you checked
1. Behaviour: for every function, query, constant, type or template that moved, merged or was rewritten, compare old and new line by line. Name any difference in results, order, error text, SQL, lock mode, timing or rendered output.
2. Contract: `git diff 9d66307450cd7491d6becc5ea6a7ddc4fb118721..HEAD -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` shows nothing it should not; no route, DTO field or class name, status or error code changed.
3. Tests: `git diff 9d66307450cd7491d6becc5ea6a7ddc4fb118721..HEAD --stat -- '*.spec.ts' '*.e2e-spec.ts' '*.test.mjs'`. For each changed or deleted test file, confirm no `it(`, `test(` or `expect(` was lost or loosened; a moved test must be the same test. New logic has a test that fails when the logic is wrong (try to think of the mutation that would slip through).
4. Completeness: search src/, test/, scripts/, deploy/, .github/, docs/analysis-and-design, AGENTS.md, README.md for every name, path and import the batch retired. Nothing still points at them; the old and the new implementation do not coexist.
5. Structure: is the system simpler, or was the complexity only moved? Any new cross-folder import or cycle (compare the import graph with the base)? A wrapper, flag or parameter that only one caller understands? A smaller change that gets the same result?
6. Repo rules: no comments, no new dependency, .js import suffixes in the backend, names that say what things are, no magic numbers; `git log --format='%h %G? %s' 9d66307450cd7491d6becc5ea6a7ddc4fb118721..HEAD` shows G for every commit and Conventional subjects; exactly one new file under .changeset/.
7. Scope: nothing outside the objective, nothing in the off-limits files beyond a listed one-line import change.
8. Rebuild the proof yourself: load ADMIN_MESSAGES at the base commit and at HEAD (a small vitest file or tsx script you do not commit), serialise both the same way and compare. Any changed, missing or added string is blocking.

Blocking: wrong or changed behaviour, a broken boundary, a lost or weakened test, an incomplete migration, a repo-rule violation, or a clearly simpler design that removes real complexity. Non-blocking: naming, wording, optional polish. Each finding: file, line, the problem, the concrete fix.

Write the review to /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/16-admin-messages/review-ROUND.md (ROUND is the round number you are told, 1 if none) and return the structured verdict.