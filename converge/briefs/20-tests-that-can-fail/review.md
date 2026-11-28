You are the independent reviewer of one refactor batch in the OmniCourse repo. You did not write it. Find what is wrong with it before a human reads it. Default to doubt: "behaviour unchanged" is true only where you checked it.

## Where
- Worktree /home/lamter/omnicourses/.claude/worktrees/cv-build-be, branch cvb/20-tests-that-can-fail. The batch is `git diff 094ce476acb5852d2729714b72e480e563fcfb90..HEAD` (commits: `git log --oneline 094ce476acb5852d2729714b72e480e563fcfb90..HEAD`).
- READ-ONLY: do not edit, stage, commit, push or post anything. You may run targeted tests, typecheck and lint, and `node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs <src dir>`. Do not open /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/20-tests-that-can-fail/report.md until you have written down your own findings; then read it only to check the implementer's stated omissions.

## What the batch was asked to do: tests that could not fail now can
Source: /home/lamter/omnicourses/.claude/worktrees/converge/converge/tests-scan.md, a complete scan of the 139 spec files changed since the last test clean-up. It lists about 38 tests that could not catch a real bug, each with the mutation of the production code it survives and a suggested rewrite. Two were confirmed by running the mutation; the rest are reasoned. Read the whole file before you start. The Project Lead asked for exactly this: remove tests that could not catch a real bug, and fix them where there is behaviour to check.

Work finding by finding, in the order of the report:
1. Confirm it. Apply the mutation the report names (or an equivalent one) to the production code and run that one spec (`nice -n 10 npx vitest run --maxWorkers=2 <file>` from src/backend or src/frontend; e2e specs: `DATABASE_URL=postgres://omnicourse:omnicourse@localhost:5432/omnicourse_cv_be npx vitest run --config vitest.e2e.config.mts test/<file>` from src/backend). If the spec still passes, the finding is real. If it fails, the report is wrong about this one: skip it and say so. Restore the production file with `git checkout -- <file>` at once.
2. Fix the test the smallest way that makes it catch that mutation. Run it with the mutation applied (must fail) and without (must pass). A changed test must assert at least what it asserted before.
3. Production code never changes in a commit of this batch. If a strengthened test fails on the unchanged production code, you have found a real defect or a wrong assumption: undo that test change, and report it at the top of your result. Do not fix production.

What to do by kind:
- A constant imported from the module under test and compared with itself, where the test's title or a document states the number (30 days, 7 MiB, 2000 and 128 characters, 60 seconds, the int4 maximum): write the literal in the spec under a named constant.
- An assertion on a mock's call list with no observable result: assert the arguments or the result, as the report suggests.
- An assertion that is always true (`every` over a possibly empty list, `>=` where the value must grow, `expect.any(...)` where the value is known, a regex that matches anything, `findIndex` compared without checking it is not -1): make it specific.
- A test or assertion with nothing of its own to check (an `expect(fetch).toHaveBeenCalled()` that is always true by then, a test of the spec file's own teardown, an assertion on a class name): remove it, and list each removal with the reason it could not fail. Prefer strengthening to removing whenever there is behaviour to check.

Leave alone, and list as "left by design" in the report:
- Tests that compare rendered text with the message catalogue entry (`SETTINGS_MESSAGES.vi.x`, `ADMIN_MESSAGES...`): an earlier pass (PR #199) chose to check behaviour, not wording.
- Every finding in src/frontend/src/dashboard/*.spec.ts: the frontend owner's code from this week; he gets the list.
- Everything under the report's "Unsure" headings.
- Off-limits files as always.

Commits: one per area (for example backend auth, backend curriculum-admin, backend e2e, frontend admin, frontend the rest), each message naming how many tests it changed. The report (and your result) must hold one line per finding: file:line, the mutation, survived before (yes/no), caught after (yes/no), action (rewritten / removed with reason / skipped with reason).

## Boundaries it had to keep
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.

## Check, in this order, and record what you checked
1. Behaviour: for every function, query, constant, type or template that moved, merged or was rewritten, compare old and new line by line. Name any difference in results, order, error text, SQL, lock mode, timing or rendered output.
2. Contract: `git diff 094ce476acb5852d2729714b72e480e563fcfb90..HEAD -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` shows nothing it should not; no route, DTO field or class name, status or error code changed.
3. Tests: `git diff 094ce476acb5852d2729714b72e480e563fcfb90..HEAD --stat -- '*.spec.ts' '*.e2e-spec.ts' '*.test.mjs'`. For each changed or deleted test file, confirm no `it(`, `test(` or `expect(` was lost or loosened; a moved test must be the same test. New logic has a test that fails when the logic is wrong (try to think of the mutation that would slip through).
4. Completeness: search src/, test/, scripts/, deploy/, .github/, docs/analysis-and-design, AGENTS.md, README.md for every name, path and import the batch retired. Nothing still points at them; the old and the new implementation do not coexist.
5. Structure: is the system simpler, or was the complexity only moved? Any new cross-folder import or cycle (compare the import graph with the base)? A wrapper, flag or parameter that only one caller understands? A smaller change that gets the same result?
6. Repo rules: no comments, no new dependency, .js import suffixes in the backend, names that say what things are, no magic numbers; `git log --format='%h %G? %s' 094ce476acb5852d2729714b72e480e563fcfb90..HEAD` shows G for every commit and Conventional subjects; exactly one new file under .changeset/.
7. Scope: nothing outside the objective, nothing in the off-limits files beyond a listed one-line import change.
8. For every changed test: confirm it asserts at least what it asserted before. For every removed test or assertion: say whether it truly had nothing of its own to check; one unjustified removal is blocking. Re-run five of the mutations yourself (pick the ones on locks, limits and session lifetime) against the new tests and confirm each now fails, then restore. Confirm no production file changed: `git diff --stat <base>..HEAD -- src ':!*.spec.ts' ':!*.e2e-spec.ts'` must be empty.

Blocking: wrong or changed behaviour, a broken boundary, a lost or weakened test, an incomplete migration, a repo-rule violation, or a clearly simpler design that removes real complexity. Non-blocking: naming, wording, optional polish. Each finding: file, line, the problem, the concrete fix.

Write the review to /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/20-tests-that-can-fail/review-ROUND.md (ROUND is the round number you are told, 1 if none) and return the structured verdict.