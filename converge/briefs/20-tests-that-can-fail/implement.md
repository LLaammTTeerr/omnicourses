You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-be (branch cvb/20-tests-that-can-fail is checked out; base commit 094ce476acb5852d2729714b72e480e563fcfb90). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: tests that could not fail now can
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
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-build-be omnicourse_cv_be typecheck lint unit-be unit-fe build e2e openapi browser` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, backend and frontend unit tests, build, e2e, the openapi diff and the browser tests (the migration-folder diff is left to the orchestrator) (a "-" on the COUNTS line is a suite it did not run; the orchestrator runs the rest); about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`test: ...`), a body of one or two sentences that says why, and as the last line the Co-Authored-By trailer that your own session's attribution reminder gives for your model (if you have none: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`).
- In the last commit add `.changeset/20-tests-that-can-fail.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/20-tests-that-can-fail/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.