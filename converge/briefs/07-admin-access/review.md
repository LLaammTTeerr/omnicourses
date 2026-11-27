You are the independent reviewer of one refactor batch in the OmniCourse repo. You did not write it. Find what is wrong with it before a human reads it. Default to doubt: "behaviour unchanged" is true only where you checked it.

## Where
- Worktree /home/lamter/omnicourses/.claude/worktrees/cv-build-be, branch cvb/07-admin-access. The batch is `git diff 0a76adac3de1c937c5397831b6c85960adcf5cf2..HEAD` (commits: `git log --oneline 0a76adac3de1c937c5397831b6c85960adcf5cf2..HEAD`).
- READ-ONLY: do not edit, stage, commit, push or post anything. You may run targeted tests, typecheck and lint, and `node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs <src dir>`. Do not open /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/07-admin-access/report.md until you have written down your own findings; then read it only to check the implementer's stated omissions.

## What the batch was asked to do: the admin write gate as its own module, and a composition root that parallel branches can both edit
Sources: BAC-1 (step 2) in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-admin-content.md; BAC-5 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-platform.md. Read them first, then ADR 0011.

A. Admin access. academic-calendar imports the whole CurriculumAdminModule (five controllers) only to reach AdminWriteService and the 403 decorator; account imports from curriculum-admin too. Create src/backend/src/admin-access/ holding what "may this caller write" needs: admin-write.service.ts, the grants reader (Need, grantsOf, missingPermission), the two grant entities, the 403 error decorator, and a small AdminAccessModule that registers the two entities and exports the service. curriculum-admin and academic-calendar import that module. What presents grants to the API (DTOs, the user-grants presenter, controllers) stays in curriculum-admin. Table names, entity class names, DTO class names, routes and Swagger tags do not change; openapi.json stays byte-identical. No re-export files at the old paths. csv-import.service.ts and its spec are off limits beyond an import-path line.
Register the new module where modules are registered, add the folder to the module table in docs/analysis-and-design/architecture.md (lint's module-index rule checks it), and update ADR text that names the old paths.

B. Composition root.
1. src/backend/src/features.ts lists 15 modules on one line, so two branches that each add a module always conflict. One module per line, sorted by name (module order is free since #183; the contract build sorts).
2. src/backend/src/database/migrations/index.ts needs every migration twice (an import and an array entry). Keep an explicit list (ADR 0002 rejects globs) but make it one line per migration; the existing index.spec.ts must still prove every file is listed and timestamps are unique, and the run order stays by timestamp.
3. app.module.ts and openapi-document.ts each assemble the platform imports (TypeORM root, ClockModule, the feature list) by hand. One function builds them for both.

C. scripts/layers.mjs: add the edges of the new folder on purpose and remove the ones lint reports as gone (academic-calendar -> curriculum-admin and account -> curriculum-admin should go; say in the report if they cannot).

## Boundaries it had to keep
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.

## Check, in this order, and record what you checked
1. Behaviour: for every function, query, constant, type or template that moved, merged or was rewritten, compare old and new line by line. Name any difference in results, order, error text, SQL, lock mode, timing or rendered output.
2. Contract: `git diff 0a76adac3de1c937c5397831b6c85960adcf5cf2..HEAD -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` shows nothing it should not; no route, DTO field or class name, status or error code changed.
3. Tests: `git diff 0a76adac3de1c937c5397831b6c85960adcf5cf2..HEAD --stat -- '*.spec.ts' '*.e2e-spec.ts' '*.test.mjs'`. For each changed or deleted test file, confirm no `it(`, `test(` or `expect(` was lost or loosened; a moved test must be the same test. New logic has a test that fails when the logic is wrong (try to think of the mutation that would slip through).
4. Completeness: search src/, test/, scripts/, deploy/, .github/, docs/analysis-and-design, AGENTS.md, README.md for every name, path and import the batch retired. Nothing still points at them; the old and the new implementation do not coexist.
5. Structure: is the system simpler, or was the complexity only moved? Any new cross-folder import or cycle (compare the import graph with the base)? A wrapper, flag or parameter that only one caller understands? A smaller change that gets the same result?
6. Repo rules: no comments, no new dependency, .js import suffixes in the backend, names that say what things are, no magic numbers; `git log --format='%h %G? %s' 0a76adac3de1c937c5397831b6c85960adcf5cf2..HEAD` shows G for every commit and Conventional subjects; exactly one new file under .changeset/.
7. Scope: nothing outside the objective, nothing in the off-limits files beyond a listed one-line import change.

Blocking: wrong or changed behaviour, a broken boundary, a lost or weakened test, an incomplete migration, a repo-rule violation, or a clearly simpler design that removes real complexity. Non-blocking: naming, wording, optional polish. Each finding: file, line, the problem, the concrete fix.

Write the review to /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/07-admin-access/review-ROUND.md (ROUND is the round number you are told, 1 if none) and return the structured verdict.