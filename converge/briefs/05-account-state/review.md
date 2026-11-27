You are the independent reviewer of one refactor batch in the OmniCourse repo. You did not write it. Find what is wrong with it before a human reads it. Default to doubt: "behaviour unchanged" is true only where you checked it.

## Where
- Worktree /home/lamter/omnicourses/.claude/worktrees/cv-build-be, branch cvb/05-account-state. The batch is `git diff 2335a9ebf9a98dd08bb31e6efdb095707ad1219e..HEAD` (commits: `git log --oneline 2335a9ebf9a98dd08bb31e6efdb095707ad1219e..HEAD`).
- READ-ONLY: do not edit, stage, commit, push or post anything. You may run targeted tests, typecheck and lint, and `node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs <src dir>`. Do not open /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/05-account-state/report.md until you have written down your own findings; then read it only to check the implementer's stated omissions.

## What the batch was asked to do: users/ owns "account waiting for deletion" and the student row lock
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

## Boundaries it had to keep
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.

## Check, in this order, and record what you checked
1. Behaviour: for every function, query, constant, type or template that moved, merged or was rewritten, compare old and new line by line. Name any difference in results, order, error text, SQL, lock mode, timing or rendered output.
2. Contract: `git diff 2335a9ebf9a98dd08bb31e6efdb095707ad1219e..HEAD -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` shows nothing it should not; no route, DTO field or class name, status or error code changed.
3. Tests: `git diff 2335a9ebf9a98dd08bb31e6efdb095707ad1219e..HEAD --stat -- '*.spec.ts' '*.e2e-spec.ts' '*.test.mjs'`. For each changed or deleted test file, confirm no `it(`, `test(` or `expect(` was lost or loosened; a moved test must be the same test. New logic has a test that fails when the logic is wrong (try to think of the mutation that would slip through).
4. Completeness: search src/, test/, scripts/, deploy/, .github/, docs/analysis-and-design, AGENTS.md, README.md for every name, path and import the batch retired. Nothing still points at them; the old and the new implementation do not coexist.
5. Structure: is the system simpler, or was the complexity only moved? Any new cross-folder import or cycle (compare the import graph with the base)? A wrapper, flag or parameter that only one caller understands? A smaller change that gets the same result?
6. Repo rules: no comments, no new dependency, .js import suffixes in the backend, names that say what things are, no magic numbers; `git log --format='%h %G? %s' 2335a9ebf9a98dd08bb31e6efdb095707ad1219e..HEAD` shows G for every commit and Conventional subjects; exactly one new file under .changeset/.
7. Scope: nothing outside the objective, nothing in the off-limits files beyond a listed one-line import change.
8. For every replaced site, put the old SQL and the new SQL side by side and compare filter, lock clause (FOR SHARE / FOR NO KEY UPDATE / FOR UPDATE / none), ORDER BY, parameters and the transaction it runs in. Any difference is blocking. Run the e2e files account, plan-sharing, plans, transcript, notifications and curriculum-admin* yourself (DATABASE_URL=postgres://omnicourse:omnicourse@localhost:5432/omnicourse_cv_be , from src/backend: `npx vitest run --config vitest.e2e.config.mts test/<file>`).

Blocking: wrong or changed behaviour, a broken boundary, a lost or weakened test, an incomplete migration, a repo-rule violation, or a clearly simpler design that removes real complexity. Non-blocking: naming, wording, optional polish. Each finding: file, line, the problem, the concrete fix.

Write the review to /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/05-account-state/review-ROUND.md (ROUND is the round number you are told, 1 if none) and return the structured verdict.