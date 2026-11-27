You are finishing one refactor batch in the OmniCourse repo after an independent review. The batch and its rules:

You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-be (branch cvb/04-rules-one-derivation is checked out; base commit bfe79b3a4d56a3b6dc1c58cc420e6b3dbf6123d2). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: one derivation each for course status and "the record before a term", and two named prerequisite policies
Sources: BAC-2 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-domain.md. Read it first, then ADR 0013 (docs/analysis-and-design/adr/0013-rule-engine-and-degree-audit.md) including its amendments.

This is the rule engine: AGENTS.md hard rule 1 applies. No audit result, standing, readiness or plan issue may change for any input. You are merging copies that already agree, not deciding a rule. If two copies turn out to disagree for some input, STOP on that item: keep both as they are, and report the input and the two results.

A. Before changing anything, read the specs in src/backend/src/rules (attempts, audit, coverage, standing, plan-issues, prerequisites) and decide whether they pin every branch you are about to touch. Where they do not, add characterization tests first, in their own commit, and see them pass on the unchanged code.

B. Course status. rules/coverage.ts and rules/standing.ts each derive a course's status from a CourseRecord. Export one `courseStatus(record)` from rules/attempts.ts and have both call it; each maps "no record" to its own value (not_taken, null) at its own call site. The survey claims one arm of the coverage copy is unreachable: confirm from attempts.ts before relying on it, and keep the observable results identical either way.

C. The record before a term. rules/plan-issues.ts has `standingBefore`, a re-implementation of `recordAsOf` in rules/attempts.ts with < in place of <=. Export `recordBefore(record, term)` from attempts.ts next to recordAsOf, sharing what they share; plan-issues.ts calls it.

D. Prerequisite policies. Whether an in-progress prerequisite counts is decided in two places with no shared name: the explorer counts passed courses only (standing.ts); the planner counts passed, in-progress and planned-earlier courses (plan-issues.ts). Both are decided (ADR 0013, 27 Nov amendment). In rules/prerequisites.ts export the two builders of the "satisfied" set under names that say which policy each is; standing.ts and plan-issues.ts call them; the local copies go.

E. New exports get direct tests. The statement coverage of src/rules must stay at or above 80 % (the unit run enforces it). The purity spec must still pass.

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
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-build-be omnicourse_cv_be typecheck lint unit-be build e2e openapi contract` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, backend unit tests, build, e2e, and the openapi and migration diffs (a "-" on the COUNTS line is a suite it did not run; the orchestrator runs the rest); about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`refactor(rules): ...`), a body of one or two sentences that says why, and the last line `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- In the last commit add `.changeset/04-rules-one-derivation.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/04-rules-one-derivation/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.

## Now
The batch is already implemented on this branch (see `git log --oneline bfe79b3a4d56a3b6dc1c58cc420e6b3dbf6123d2..HEAD` and /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/04-rules-one-derivation/report.md). An independent reviewer found the problems listed below. For each blocking finding: check it against the code; if it is right, fix it in a new commit (do not amend or rebase); if it is wrong, say why in the report with evidence. Take a non-blocking finding only when it is cheap and clearly right. Then run the full verify again, append a "Review round" section to the report, and return the structured result (commits: only the new ones).

Findings:
