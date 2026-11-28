You are the independent reviewer of one refactor batch in the OmniCourse repo. You did not write it. Find what is wrong with it before a human reads it. Default to doubt: "behaviour unchanged" is true only where you checked it.

## Where
- Worktree /home/lamter/omnicourses/.claude/worktrees/cv-build-be, branch cvb/22-config-and-pins. The batch is `git diff 43422c52c1c1dfb97e5fab198ea9c3c54d670436..HEAD` (commits: `git log --oneline 43422c52c1c1dfb97e5fab198ea9c3c54d670436..HEAD`).
- READ-ONLY: do not edit, stage, commit, push or post anything. You may run targeted tests, typecheck and lint, and `node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs <src dir>`. Do not open /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/22-config-and-pins/report.md until you have written down your own findings; then read it only to check the implementer's stated omissions.

## What the batch was asked to do: configuration names, runtime versions and exact pins are checked instead of remembered
Source: findings 1.1, 2.1, 2.2, 4.1 and the alias of 3.3 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/config-deploy-ci.md. Read them first, then src/backend/src/repo-config.spec.ts (a unit spec that already reads repo files: it checks compose.yaml ports), src/backend/src/config/env.ts and .env.example.

Why: three lists are kept in step by memory. (1) The settings the backend reads (config/env.ts, 13 names) and the settings .env.example documents: NODE_ENV is read and not documented, and nothing fails when a new setting is forgotten. (2) The pinned runtimes: Node in .nvmrc, deploy/server/setup.sh and AGENTS.md; npm in two workflows, setup.sh and AGENTS.md; the PostgreSQL image in compose.yaml, ci.yml and setup.sh. A bump is five files found by search. (3) AGENTS.md says every dependency is pinned exactly; no check says so.

A. In src/backend/src/repo-config.spec.ts add three checks, each reading the files as text or JSON (no new dependency, no network):
1. Settings: the set of environment variable names read in config/env.ts equals the set of names in .env.example (commented-out lines count as documented), apart from a short named list of names the host sets and a developer does not (NODE_ENV), and apart from the frontend's VITE_* names, which you check against their one reader in src/frontend/src. If .env.example lacks a name today, add the line to .env.example in the style of its neighbours (that file is documentation; say which lines you added).
2. Pinned runtimes: every place that states the Node version, the npm version or the PostgreSQL image version states the same one: .nvmrc, compose.yaml, .github/workflows/ci.yml and release.yml, deploy/server/setup.sh, and the "Stack" line of AGENTS.md. The spec only reads .github/ and deploy/; you must not edit anything there. If the copies disagree today, do not fix those files: report the disagreement at the top of your result and make the check name the files that agree.
3. Exact pins: every version in dependencies and devDependencies of the three package.json files is an exact x.y.z.
Each check must be shown to fail: change one copy in a scratch copy of the file (or temporarily in the worktree, restored at once) and see the spec fail; say so in the report.

B. Logging. src/backend/src/common/failure-kind.ts has logFailure, whose last step is "log the line with the stack if there is one, without it if not"; src/backend/src/notifications/notifications.service.ts repeats that step (near lines 134-135). Export the step once from failure-kind.ts, use it in both, and keep every logged text identical (the existing specs pin them).

C. Root package.json: add a `test:e2e` script that runs the backend's e2e suite, so the commands block of AGENTS.md can name one-word commands; update that block minimally. Do not touch .github/.

D. One sentence in docs/analysis-and-design/architecture.md (cross-cutting table, configuration row) that the list of settings and the pinned runtimes are checked by src/backend/src/repo-config.spec.ts.

## Boundaries it had to keep
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.

## Check, in this order, and record what you checked
1. Behaviour: for every function, query, constant, type or template that moved, merged or was rewritten, compare old and new line by line. Name any difference in results, order, error text, SQL, lock mode, timing or rendered output.
2. Contract: `git diff 43422c52c1c1dfb97e5fab198ea9c3c54d670436..HEAD -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` shows nothing it should not; no route, DTO field or class name, status or error code changed.
3. Tests: `git diff 43422c52c1c1dfb97e5fab198ea9c3c54d670436..HEAD --stat -- '*.spec.ts' '*.e2e-spec.ts' '*.test.mjs'`. For each changed or deleted test file, confirm no `it(`, `test(` or `expect(` was lost or loosened; a moved test must be the same test. New logic has a test that fails when the logic is wrong (try to think of the mutation that would slip through).
4. Completeness: search src/, test/, scripts/, deploy/, .github/, docs/analysis-and-design, AGENTS.md, README.md for every name, path and import the batch retired. Nothing still points at them; the old and the new implementation do not coexist.
5. Structure: is the system simpler, or was the complexity only moved? Any new cross-folder import or cycle (compare the import graph with the base)? A wrapper, flag or parameter that only one caller understands? A smaller change that gets the same result?
6. Repo rules: no comments, no new dependency, .js import suffixes in the backend, names that say what things are, no magic numbers; `git log --format='%h %G? %s' 43422c52c1c1dfb97e5fab198ea9c3c54d670436..HEAD` shows G for every commit and Conventional subjects; exactly one new file under .changeset/.
7. Scope: nothing outside the objective, nothing in the off-limits files beyond a listed one-line import change.
8. Defeat each new check yourself in the worktree and restore: remove a line from .env.example; add a getter for a new variable in config/env.ts; change the Node version in .nvmrc; change the postgres image tag in compose.yaml; put a caret in one package.json version. Each must fail the spec with a message that names the file. Confirm `git diff <base>..HEAD -- .github deploy` is empty.

Blocking: wrong or changed behaviour, a broken boundary, a lost or weakened test, an incomplete migration, a repo-rule violation, or a clearly simpler design that removes real complexity. Non-blocking: naming, wording, optional polish. Each finding: file, line, the problem, the concrete fix.

Write the review to /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/22-config-and-pins/review-ROUND.md (ROUND is the round number you are told, 1 if none) and return the structured verdict.