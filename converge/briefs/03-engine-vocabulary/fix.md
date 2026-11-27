You are finishing one refactor batch in the OmniCourse repo after an independent review. The batch and its rules:

You are implementing one batch of a whole-codebase architectural convergence of the OmniCourse repo. The aim of the mission: one change to a business concept lands in one place, and people and agents can work in parallel without colliding. The batch must leave the system simpler, with behaviour unchanged.

## Where
- Worktree: /home/lamter/omnicourses/.claude/worktrees/cv-build-be (branch cvb/03-engine-vocabulary is checked out; base commit c9de5ba853dd98e38f4a4458fb18da9d537f9412). Work only there. Never touch another worktree or /home/lamter/omnicourses itself, never switch branches, never push, never open a pull request, never post to GitHub or Discord, never write a progress file. The orchestrator integrates your commits.
- npm: the machine's npm is 9 and rewrites the lockfile. Use `npx --yes npm@11.21.1 <command>` for every npm command. node_modules is installed.

## Objective: the rule engine's input vocabulary in a pure file, and common/ as a real leaf
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

## Boundaries
- Fixed contract: routes, DTO fields and class names, status and error codes, response bodies, database columns, existing migration files, and src/backend/openapi.json byte for byte. What the rule engine decides does not change (AGENTS.md hard rule 1).
- Tests are the safety net: never delete, skip or weaken a test or an assertion. A test may move with the code it tests; its assertions stay. New logic gets a spec that would fail if the logic were wrong; a pure move needs none.
- Repo rules that bite: no code comments at all, no new dependency, no lockfile change, relative imports with a .js suffix in the backend, no magic numbers, English, Conventional Commits.
- Off limits (owned by open pull requests): src/frontend/src/audit/{DashboardView.vue,DashboardView.spec.ts,api.ts,dashboard.ts,dashboard.spec.ts,dashboard-messages.ts}, src/frontend/src/shell/icons.ts, src/frontend/src/testing/fetch.ts (PR #214); src/backend/src/curriculum-admin/csv-import.service.ts and its spec, src/backend/test/curriculum-admin-import.e2e-spec.ts, docs/analysis-and-design/adr/0011-curriculum-administration.md, docs/test/test-cases-b2.md (PR #166); everything under src/backend/src/advisor/ and src/backend/src/ai/ (PR #77). If the objective needs a one-line import-path change in one of these files because a module moved, make exactly that line and list it in your result.
- The survey findings named above are leads, not truth: confirm each claim in the code before acting on it. If a claim is wrong, or a step cannot be done without breaking a boundary, do not force it: leave that step out and say so in your result.
- Keep the diff to the objective: no drive-by renames, reformatting or unrelated cleanup.
- Docs: search docs/analysis-and-design, AGENTS.md, README.md, CONTRIBUTING.md and GLOSSARY.md for names or paths you moved or removed, and correct the lines that would now be wrong (not docs/test/**, not report/**: those are dated records).

## Verify
- While working, run targeted checks: `cd src/backend && npx vitest run <path>`, `cd src/frontend && npx vitest run <path>`, `npx --yes npm@11.21.1 run typecheck -w src/backend` (or `-w src/frontend`), `npx --yes npm@11.21.1 run lint`.
- Before you finish: `/home/lamter/omnicourses/.claude/worktrees/converge/converge/tools/verify.sh /home/lamter/omnicourses/.claude/worktrees/cv-build-be omnicourse_cv_be typecheck lint unit-be build e2e openapi contract` must print `RESULT: ALL PASS`, and no number on its COUNTS line may be lower than the baseline it prints unless you can name the reason. It runs typecheck, lint, backend unit tests, build, e2e, and the openapi and migration diffs (a "-" on the COUNTS line is a suite it did not run; the orchestrator runs the rest); about 3 minutes, and it waits its turn if another run is active (allow up to 20 minutes). On failure, read the log path it prints and fix the cause; never the test.

## Commits
- Small commits, one coherent step each. Signing is configured: a plain `git commit` signs. Never pass --no-gpg-sign or change git config. If signing fails, stop and return status "blocked".
- Message: a Conventional Commit subject in English (`refactor(rules): ...`), a body of one or two sentences that says why, and the last line `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`.
- In the last commit add `.changeset/03-engine-vocabulary.md`. Nothing here is visible to a user, so it is an empty changeset: the file holds exactly two lines, `---` and `---`.

## Result
- Write /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/03-engine-vocabulary/report.md (with a shell heredoc if the Write tool refuses a path outside the worktree; if that fails too, put the content in your result): what changed and why, commit by commit; every step of the objective you left out and why; what a reviewer should look at twice; the last lines of the verify output.
- Return the structured result: status "done" only when verify printed RESULT: ALL PASS on your final commit and `git status --short` is empty.

## Now
The batch is already implemented on this branch (see `git log --oneline c9de5ba853dd98e38f4a4458fb18da9d537f9412..HEAD` and /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/03-engine-vocabulary/report.md). An independent reviewer found the problems listed below. For each blocking finding: check it against the code; if it is right, fix it in a new commit (do not amend or rebase); if it is wrong, say why in the report with evidence. Take a non-blocking finding only when it is cheap and clearly right. Then run the full verify again, append a "Review round" section to the report, and return the structured result (commits: only the new ones).

Findings:
