You are the independent reviewer of one refactor batch in the OmniCourse repo. You did not write it. Find what is wrong with it before a human reads it. Default to doubt: "behaviour unchanged" is true only where you checked it.

## Where
- Worktree /home/lamter/omnicourses/.claude/worktrees/cv-build-be, branch cvb/03-engine-vocabulary. The batch is `git diff c9de5ba853dd98e38f4a4458fb18da9d537f9412..HEAD` (commits: `git log --oneline c9de5ba853dd98e38f4a4458fb18da9d537f9412..HEAD`).
- READ-ONLY: do not edit, stage, commit, push or post anything. You may run targeted tests, typecheck and lint, and `node /home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/depgraph.mjs <src dir>`. Do not open /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/03-engine-vocabulary/report.md until you have written down your own findings; then read it only to check the implementer's stated omissions.

## What the batch was asked to do: the rule engine's input vocabulary in a pure file, and common/ as a real leaf
Sources: BAC-1 and BAC-6 (the CreditCapsDto part only) in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-domain.md; BAC-6 in /home/lamter/omnicourses/.claude/worktrees/converge/converge/survey/backend-platform.md. Read them first.

Why: the rule engine is meant to be a pure library (ADR 0013, ADR 0015), but its pure files take their input types from a Nest injectable and from TypeORM entity files, and the spec that guards purity skips `import type`. Separately, common/ (imported by 15 folders) imports terms/ for one DTO class.

A. Engine vocabulary
1. New src/backend/src/curriculum/curriculum-rules.ts, a pure file (it may import terms/term.ts and nothing else): CurriculumRules, CurriculumRuleGroup, CurriculumRuleCourse, CurriculumRuleCombinedMinimum, CourseRules (today interfaces inside curriculum-rules.reader.ts) and the value lists with their types TRAINING_TYPES / TrainingType and REQUIREMENT_GROUP_KINDS / RequirementGroupKind (today inside program.entity.ts and requirement-group.entity.ts).
2. The reader class and its row mappers stay in curriculum-rules.reader.ts. Entities, DTOs, rules files, fixtures and specs import these names from the new file; the entity files and the reader stop exporting them (no re-export).
3. rules/rules.service.spec.ts: add the new file to the allowed pure imports and make the purity check walk type-only imports too, for the engine files and for the pure leaves they may import. Prove it bites: a temporary `import type { Repository } from 'typeorm'` in a rules file must fail the spec (then remove it).
4. Enum values, DTO class names and property order stay as they are, so openapi.json is byte-identical (verify.sh checks).

B. CreditCapsDto. plans/plan-issues.dto.ts and sharing/sharing.dto.ts import CreditCapsDto from audit/audit.dto.ts; that one class is the only reason plans and sharing depend on audit. Give it a home that needs no feature-to-feature import (the survey suggests plans/plan-issues.dto.ts with audit importing it, or common/; choose the one that leaves fewer cross-folder edges and say why). Class name and properties unchanged. Leave courseCodesOf and groupIdsOf where they are.

C. TermDto. common/field-validators.ts defines TermDto and therefore imports terms/term.ts. Move the class to src/backend/src/terms/term.dto.ts (same class name, same decorators in the same order) and update its importers. After this, common/ and config/ import no feature folder.

D. scripts/layers.mjs: remove the edges lint reports as gone, and add the edges this batch creates on purpose (each new edge must point from a less stable folder to a more stable one; list them in the report).

## Boundaries it had to keep
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.

## Check, in this order, and record what you checked
1. Behaviour: for every function, query, constant, type or template that moved, merged or was rewritten, compare old and new line by line. Name any difference in results, order, error text, SQL, lock mode, timing or rendered output.
2. Contract: `git diff c9de5ba853dd98e38f4a4458fb18da9d537f9412..HEAD -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` shows nothing it should not; no route, DTO field or class name, status or error code changed.
3. Tests: `git diff c9de5ba853dd98e38f4a4458fb18da9d537f9412..HEAD --stat -- '*.spec.ts' '*.e2e-spec.ts' '*.test.mjs'`. For each changed or deleted test file, confirm no `it(`, `test(` or `expect(` was lost or loosened; a moved test must be the same test. New logic has a test that fails when the logic is wrong (try to think of the mutation that would slip through).
4. Completeness: search src/, test/, scripts/, deploy/, .github/, docs/analysis-and-design, AGENTS.md, README.md for every name, path and import the batch retired. Nothing still points at them; the old and the new implementation do not coexist.
5. Structure: is the system simpler, or was the complexity only moved? Any new cross-folder import or cycle (compare the import graph with the base)? A wrapper, flag or parameter that only one caller understands? A smaller change that gets the same result?
6. Repo rules: no comments, no new dependency, .js import suffixes in the backend, names that say what things are, no magic numbers; `git log --format='%h %G? %s' c9de5ba853dd98e38f4a4458fb18da9d537f9412..HEAD` shows G for every commit and Conventional subjects; exactly one new file under .changeset/.
7. Scope: nothing outside the objective, nothing in the off-limits files beyond a listed one-line import change.
8. Run the purity spec with a planted type-only import of typeorm in a rules file and confirm it fails; restore the tree. Diff openapi.json after a build (`npx --yes npm@11.21.1 run build -w src/backend && npx --yes npm@11.21.1 run openapi -w src/backend && git status --short`): it must be unchanged.

Blocking: wrong or changed behaviour, a broken boundary, a lost or weakened test, an incomplete migration, a repo-rule violation, or a clearly simpler design that removes real complexity. Non-blocking: naming, wording, optional polish. Each finding: file, line, the problem, the concrete fix.

Write the review to /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/03-engine-vocabulary/review-ROUND.md (ROUND is the round number you are told, 1 if none) and return the structured verdict.