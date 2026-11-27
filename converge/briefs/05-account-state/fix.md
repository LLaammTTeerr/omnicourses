You are finishing one refactor batch in the OmniCourse repo after an independent review. The batch and its rules:

You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-be (branch cvb/05-account-state is checked out; base commit 2335a9ebf9a98dd08bb31e6efdb095707ad1219e). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: users/ owns "account waiting for deletion" and the student row lock
Sources: BAC-1 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-platform.md; BAC-7 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-domain.md. Read them first, then ADR 0004 (account export and deletion) with its amendments, and the account e2e and unit specs that cover a deletion request racing a write.

Why: whether an account is waiting for deletion is decided by reading users.deletion_requested_at, and that read is written out again in nine or more places in five modules, mostly inside raw SQL. The same modules also lock the student's users row before a per-student write (FOR SHARE, FOR NO KEY UPDATE, or a plain lock) so a deletion request cannot slip between check and write; that protocol is written down only in a spec and in ADRs. A new feature has to rediscover both by reading other modules.

A. Characterize first. List every site (search for deletion_requested_at, deletionRequestedAt and FROM "users" under src/backend/src; the surveys name them: auth.service.ts, sharing.service.ts, notifications.service.ts, curriculum-admin/admin-lookups.ts, access-admin.service.ts, admin-write.service.ts, plans.service.ts, transcript.service.ts). For each, write down in the report the exact SQL or predicate today: filter, lock mode, row order, and what the caller does with the result. Check that an existing test pins each site's behaviour (the lock tests use src/backend/test/support/locks.ts); where none does, add a characterization test in its own commit before changing the site.

B. One owner. In src/backend/src/users/ export (names are yours; make them say what they do):
1. the predicate for an entity ("is this account waiting for deletion"),
2. the SQL condition for raw statements that must keep their own shape (the notifications INSERT ... SELECT, the public share read),
3. the row lock for per-student writes, with the lock modes that exist today as explicit choices and the option to require an active account, returning what the callers need.
Replace every site with these. Each site keeps its lock mode, its filter and its row order exactly; the advisory locks taken before or after stay where they are. If two sites differ in a way you cannot explain, keep the difference and report it; do not unify behaviour.

C. Guard. Add a lint rule (scripts/lint.mjs, with a case in scripts/lint.test.mjs, table in scripts/layers.mjs) for "this identifier may appear only under this folder": deletion_requested_at and deletionRequestedAt only under src/backend/src/users/ and src/backend/src/database/migrations/ (specs and e2e tests exempt). Keep it generic enough to take a second entry later, no more.

D. scripts/layers.mjs: add the backend edges this creates on purpose (modules now import users/ helpers; most edges exist already) and remove any that lint reports as gone.

Out of scope: what "waiting" means (do not add purge_after to the predicate), the account export, anything under ai/ or advisor/.

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
- Message: a Conventional Commit subject in English (`refactor(users): ...`), a body of one or two sentences that says why, and as the last line the Co-Authored-By trailer that your own session's attribution reminder gives for your model (if you have none: `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`).
- In the last commit add `.changeset/05-account-state.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/05-account-state/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.

## Now
The batch is already implemented on this branch (see `git log --oneline 2335a9ebf9a98dd08bb31e6efdb095707ad1219e..HEAD` and /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/05-account-state/report.md). An independent reviewer found the problems listed below. For each blocking finding: check it against the code; if it is right, fix it in a new commit (do not amend or rebase); if it is wrong, say why in the report with evidence. Take a non-blocking finding only when it is cheap and clearly right. Then run the full verify again, append a "Review round" section to the report, and return the structured result (commits: only the new ones).

Findings:
