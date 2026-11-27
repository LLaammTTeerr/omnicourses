You are the independent reviewer of one refactor batch in the OmniCourse repo. You did not write it. Find what is wrong with it before a human reads it. Default to doubt: "behaviour unchanged" is true only where you checked it.

## Where
- Worktree /home/lamter/omnicourses/.claude/worktrees/cv-build-be, branch cvb/08-clc-seeds. The batch is `git diff f51144cab26311038186de0806c51eb40f00a62e..HEAD` (commits: `git log --oneline f51144cab26311038186de0806c51eb40f00a62e..HEAD`).
- READ-ONLY: do not edit, stage, commit, push or post anything. You may run targeted tests, typecheck and lint, and `node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs <src dir>`. Do not open /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/08-clc-seeds/report.md until you have written down your own findings; then read it only to check the implementer's stated omissions.

## What the batch was asked to do: each CLC 2025 course written once
Sources: BAC-2 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-admin-content.md. Read it first. The seed data now lives in src/backend/src/curriculum/seeds/.

This is academic data (AGENTS.md hard rule 1): no value may change, and nothing may be derived by a rule you infer. You are only removing copies.

Why: the nine clc-2025-*.rows.ts files (218 lines each) all contain the same 187 courses; a course's name, credits and four period counts are written nine times, and a fix must be made nine times. Only three things differ per specialisation: which requirement group each course belongs to, the PDF page, and a few per-row extras.

A. Proof harness first, outside the repo: a script that imports the built seed list (the CurriculumSeed array that seed-curricula.ts loads; find its export in curriculum/seeds/index.ts) and writes it as canonical JSON. Run it on the untouched tree and keep the file. After the change run it again: the two files must be identical byte for byte, order of programs, groups and rows included.

B. Write each course fact once: one table of the CLC 2025 courses (code, Vietnamese name, credits, the four period counts, shared extras). Each specialisation file then lists only what is its own: for every requirement group, the course codes in order, the page of each row, and its own extras. Groups whose rows are identical in all nine files are written once and shared. List group membership explicitly for every group, the free-elective group included: do not compute any group as "the rest". Generate the new files from the old ones with a throwaway script rather than by hand, so no value is retyped.

C. Delete the nine row files and whatever only they needed (the conflict check in catalog.ts that exists only because of the copies stays if anything else can still trigger it; say which).

D. Keep a permanent spec that would catch a broken table: every code a specialisation lists exists in the course table, no code is listed twice in one specialisation, and the per-specialisation row counts and credit totals equal fixed numbers taken from today's data.

Report: the two checksums of the canonical JSON, and the line counts before and after.

## Boundaries it had to keep
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.

## Check, in this order, and record what you checked
1. Behaviour: for every function, query, constant, type or template that moved, merged or was rewritten, compare old and new line by line. Name any difference in results, order, error text, SQL, lock mode, timing or rendered output.
2. Contract: `git diff f51144cab26311038186de0806c51eb40f00a62e..HEAD -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` shows nothing it should not; no route, DTO field or class name, status or error code changed.
3. Tests: `git diff f51144cab26311038186de0806c51eb40f00a62e..HEAD --stat -- '*.spec.ts' '*.e2e-spec.ts' '*.test.mjs'`. For each changed or deleted test file, confirm no `it(`, `test(` or `expect(` was lost or loosened; a moved test must be the same test. New logic has a test that fails when the logic is wrong (try to think of the mutation that would slip through).
4. Completeness: search src/, test/, scripts/, deploy/, .github/, docs/analysis-and-design, AGENTS.md, README.md for every name, path and import the batch retired. Nothing still points at them; the old and the new implementation do not coexist.
5. Structure: is the system simpler, or was the complexity only moved? Any new cross-folder import or cycle (compare the import graph with the base)? A wrapper, flag or parameter that only one caller understands? A smaller change that gets the same result?
6. Repo rules: no comments, no new dependency, .js import suffixes in the backend, names that say what things are, no magic numbers; `git log --format='%h %G? %s' f51144cab26311038186de0806c51eb40f00a62e..HEAD` shows G for every commit and Conventional subjects; exactly one new file under .changeset/.
7. Scope: nothing outside the objective, nothing in the off-limits files beyond a listed one-line import change.
8. Rebuild the proof yourself: check out the base commit into a temporary directory outside the repo (git worktree or git archive), produce the canonical JSON of the seed list from both trees with your own script, and compare. A difference of one byte is blocking. Confirm no group is computed as a remainder.

Blocking: wrong or changed behaviour, a broken boundary, a lost or weakened test, an incomplete migration, a repo-rule violation, or a clearly simpler design that removes real complexity. Non-blocking: naming, wording, optional polish. Each finding: file, line, the problem, the concrete fix.

Write the review to /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/08-clc-seeds/review-ROUND.md (ROUND is the round number you are told, 1 if none) and return the structured verdict.