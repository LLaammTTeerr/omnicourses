# Backend domain core: survey findings (rules, audit, plans, sharing, transcript, terms, onboarding, curriculum read side)

Surveyed at 3c4da22 (worktree refactor/converge). Read-only. Paths are relative to the repo root.

## 1. Model of the area

- `terms/term.ts`: the Term value (year, number 1..3), order, key, label, today's term from a Vietnam date (ADR 0009). It is a pure leaf with fan-in 27.
- `transcript/`: stores the student's rows (`transcript_rows`) and exposes `TranscriptEntry` and `TRANSCRIPT_RESULTS` (`transcript-entry.ts`, a pure leaf). It gives results no meaning (ADR 0007).
- `onboarding/`: the student's program and cohort (`cohortOf`), plus the hand list of offered cohorts (`onboarding-options.ts:3`) that gates plan creation.
- `curriculum/` (read side): owns the curriculum tables. `CurriculumService` serves the explorer DTOs and small lookups for other modules (`findCurriculumId`, `catalogCourses`, `curriculumLabels`, `requirementGroupIds`). `CurriculumRulesReader` turns rows into the engine's input, `CurriculumRules`.
- `rules/`: the pure engine (`attempts`, `grades`, `gpa`, `coverage`, `credit-caps`, `prerequisites`, `graduation`, `audit`, `standing`, `plan-issues`) plus every result type in `types.ts`. `RulesService` is the loader: onboarding, then curriculum id, then reader and transcript, then the pure function. `rules.service.spec.ts:131-160` fails on a runtime import of framework code from a pure file.
- `audit/`: two thin controllers (`GET users/me/audit`, `GET programs/:p/curricula/:c/standing`). Their DTO classes `implements` the engine types and the engine result is returned as is: no mapping code.
- `plans/`: stores plans and placements (ADR 0014), checks shape and references only, and asks `RulesService` for issues. It owns the issues report schema (`plan-issues.dto.ts`).
- `sharing/`: share tokens, plus the public projection of a plan and its report (`shared-plan.ts`). The issue codes it shows are hand-classified (ADR 0010).
- Dependencies: audit, plans and sharing depend on rules. rules depends on curriculum, transcript, onboarding and terms. sharing depends on plans, curriculum and rules. plans and sharing depend on audit only for `CreditCapsDto`.
- State: Postgres only (`transcript_rows`, `onboarding_answers`, `plans`, `plan_placements`, `plan_shares`, the curriculum tables). The engine is stateless, and every report is computed on read.

## 2. Ideal direction

- The engine is a library that owns its vocabulary: its inputs (curriculum rules, transcript entries, board, training type, group kind) and its outputs. It imports nothing that knows about Nest, TypeORM or HTTP, not even as a type. This is what ADR 0015's shared package needs.
- Each business concept has one derivation inside the engine: course status, "the record as of / before a term", and prerequisite satisfaction (one named policy for each consumer).
- The feature modules (audit, plans, sharing) are adapters: a loader call, the engine, and a schema class that `implements` the engine type. They share nothing with each other except through rules or common.
- Docs that mirror engine types either point at `rules/types.ts` or are checked by a spec. A hand copy with no check drifts, and this one already has.
- Do not rewrite. Each step below is a type move or a local merge whose behaviour the existing rules specs pin.

## 3. Findings

### BAC-1 Move the engine's curriculum input vocabulary into a pure curriculum leaf, and extend the purity spec to type imports
- Problems it solves:
  - Needless link: pure engine files take their input types from a Nest injectable that imports TypeORM. These are `rules/audit.ts:2`, `rules/coverage.ts:2`, `rules/plan-issues.ts:1` and `rules/standing.ts:2`, all importing from `curriculum/curriculum-rules.reader.ts` (`@Injectable`, `typeorm` at lines 1-3, interfaces at 12-52).
  - Needless link: `rules/types.ts:1-2` and `rules/credit-caps.ts:1` import `TrainingType` and `RequirementGroupKind` from TypeORM entity files (`curriculum/program.entity.ts:5-6`, `curriculum/requirement-group.entity.ts:19-20`). The value lists `TRAINING_TYPES` and `REQUIREMENT_GROUP_KINDS` live in those entity files, so 6 DTO files load entity modules just to get an enum: `audit/audit.dto.ts:4-5`, `plans/plan-issues.dto.ts:3-4`, `curriculum/curriculum.dto.ts:3-4`, `curriculum-admin/curriculum-admin.dto.ts:4` and `curriculum-admin/program-admin.dto.ts:6`.
  - Enforcement gap: the purity spec skips `import type` (the regex `(?!type )` at `rules/rules.service.spec.ts:135`). The engine is pure at run time but not at compile time, and nothing protects that.
  - Hidden link: ADR 0015 (accepted, not built, #95) says `checkPlan` "imports only types and other pure functions, with no database, Nest or Node dependency" (line 16). Moved into a workspace package today, the engine would drag the reader and the entity files, and their `typeorm`/`@nestjs` types, into the frontend typecheck.
- Callers and dependents. I searched with `rg -n "from '\.\./curriculum/" src/backend/src/rules` and `rg -n "import .*(TRAINING_TYPES|TrainingType|REQUIREMENT_GROUP_KINDS|RequirementGroupKind).*entity"` (13 import lines in 10 files), and checked `origin/feat/advisor-harness` with `git grep`: the advisor imports nothing from rules or curriculum (only a comment in `engine-facts.ts:28`).
- Cost today: a reader of the engine must open a Nest/TypeORM file to learn its inputs. Adding a training type means editing an entity file that 15 files import.
- Proposed change:
  1. Add `src/backend/src/curriculum/curriculum-rules.ts`, a pure leaf with no imports except `terms/term.ts`. It holds `CurriculumRules`, `CurriculumRuleGroup`, `CurriculumRuleCourse`, `CurriculumRuleCombinedMinimum`, `CourseRules`, `TRAINING_TYPES`/`TrainingType` and `REQUIREMENT_GROUP_KINDS`/`RequirementGroupKind`. It follows the pattern of `transcript/transcript-entry.ts` and `terms/term.ts`, which are already whitelisted pure leaves.
  2. Keep the reader class and its row mappers in `curriculum-rules.reader.ts`.
  3. Entities and DTOs import the enums from the leaf. The entity files stop exporting them: no re-export shim.
  4. In the spec, add the leaf to `PURE_IMPORTS`, and walk type imports too, both for engine files and for the closure of the pure leaves.
  - The direction stays rules -> curriculum (a pure file). No curriculum -> rules edge is created, so there is no new folder cycle.
  - Deferred: extracting the package itself (ADR 0015) touches `src/backend/package.json` (in-flight PR #77) and the frontend build. This step only prepares it.
- Contract impact: none. The enum values and DTO class names are unchanged. `openapi-document.ts:35-43` sorts schemas and paths, so `openapi.json` stays byte for byte.
- Write scope: `src/backend/src/curriculum/{curriculum-rules.ts (new), curriculum-rules.reader.ts, program.entity.ts, requirement-group.entity.ts, curriculum.dto.ts}`, `src/backend/src/rules/{types.ts, credit-caps.ts, audit.ts, coverage.ts, plan-issues.ts, standing.ts, rules.service.spec.ts}`, `src/backend/src/audit/audit.dto.ts`, `src/backend/src/plans/plan-issues.dto.ts`, `src/backend/src/curriculum-admin/{curriculum-admin.dto.ts, program-admin.dto.ts}`, `src/backend/src/rules/testing/fixtures.ts`, and the specs that import these names (`rules/standing.spec.ts`, `rules/plan-issues.spec.ts`, `curriculum/curriculum.service.spec.ts`; found with rg).
- Effort S, risk low, confidence high. To verify: `npm run typecheck`, unit tests, `npm run build && npm run openapi -w src/backend` with an empty `git diff src/backend/openapi.json`, and the extended purity spec failing on a deliberately added `import type { Repository } from 'typeorm'` in a rules file.
- Alternatives: put the vocabulary in `rules/types.ts`. Rejected: entities would import rules while rules imports curriculum at run time, a folder cycle. A new top-level `domain/` folder: more churn for the same effect. Leave it: it works at run time, but it blocks ADR 0015 and the gap stays unguarded.

### BAC-2 Give course status and "the record before a term" one function each in `rules/attempts.ts`, and name the two prerequisite policies in `rules/prerequisites.ts`
- Problems it solves:
  - Hidden link, a copy: `rules/coverage.ts:30-35` and `rules/standing.ts:8-13` each derive a course's status from a `CourseRecord`, and the code does not tie them together. They differ only in the label for "no record" (`not_taken` against `null`). `coverage.ts:34` `record.official ? 'failed' : 'not_taken'`: the `not_taken` arm cannot be reached for an existing record, because `resolve()` marks a record with no completed attempt as in progress (`attempts.ts:54-63`).
  - Hidden link, a copy: `rules/plan-issues.ts:120-123` `standingBefore` re-implements `attempts.ts:75-78` `recordAsOf` with `<` in place of `<=`. Two "as of" helpers that must agree on attempt resolution live in two files.
  - Hidden link, a convention: whether an in-progress prerequisite counts is decided twice, with no shared name. Explorer readiness counts passed courses only (`standing.ts:17-20`). The planner counts passed, in-progress and planned-earlier courses (`plan-issues.ts:125-136`). The difference is decided (ADR 0013, 27 Nov amendment). A third consumer (the advisor, F8) has to rediscover it from the code.
- Callers. I ran `rg -n "statusOf|standingBefore|recordAsOf|passedBefore" src/backend/src`: they are all in `rules/`, with specs in `attempts.spec.ts`, `audit.spec.ts`, `plan-issues.spec.ts` and `standing.spec.ts`.
- Cost today: changing what "in progress" means for status (as #207 did for standing) means finding three places by reading.
- Proposed change: add `courseStatus(record)` (passed | in_progress | failed) and `recordBefore(record, term)` to `attempts.ts`. `coverage.ts` maps "no record" to `not_taken`, `standing.ts` maps it to `null`, and `plan-issues.ts` calls `recordBefore`. In `prerequisites.ts`, export two named builders of the satisfied set: `passedOnly(records)` for the explorer, and the planner's `passedOrAssumedBefore(...)`, moved there from `plan-issues.ts`. Delete the local copies.
- Contract impact: none. No decision changes (hard rule 1), and the existing specs pin every result.
- Write scope: `src/backend/src/rules/{attempts.ts, coverage.ts, standing.ts, plan-issues.ts, prerequisites.ts}` and their specs (add tests for the new exports only).
- Effort S, risk low, confidence high. To verify: all `rules/*.spec.ts`, `test/audit.e2e-spec.ts` and the plan-issues e2e unchanged, with coverage still at or above 80% for `src/rules/**`.
- Alternatives: leave it. The copies are small, but they sit in the one module where a silent divergence is a wrong academic verdict.

### BAC-3 Stop hand-copying engine types into `class-model.md`: point at `rules/types.ts`, or add a spec that fails when a type is missing
- Problems it solves:
  - Hidden link, a copy that already drifted: `docs/analysis-and-design/class-model.md` (1451 lines) redraws every engine type with its fields, for example `TermSummary` at 572-584 and `PlanIssue` at 716. `rg -n -i "standing|readiness"` finds no `CurriculumStanding` or `CourseStandingItem` class, although #207 added both to `rules/types.ts:283-298`. Its own source list (line 455) names `rules/types.ts`.
  - Contention: it is the most-edited file in this area, with 13 commits since 1 Nov. #215 and #218 each had to edit it next to `types.ts`, `audit.ts` and `audit.dto.ts`.
- Callers: docs only. I searched with `rg -n "class-model" docs README.md`.
- Cost today: every new engine field needs an unprompted doc edit, and missing it fails nothing.
- Proposed change, one of two. (a) Keep class names and relations in the mermaid diagrams, drop the field lists, and link `rules/types.ts`, which the code already shows (repo rule: the doc holds only what the code cannot show). (b) If the field lists are a course deliverable, add a backend spec that reads the doc and fails when an exported interface of `rules/types.ts` is missing from it.
- Contract impact: none.
- Write scope: `docs/analysis-and-design/class-model.md`, plus for (b) one new spec file (for example `src/backend/src/rules/class-model.spec.ts`).
- Effort S, risk low, confidence med (whether the report needs field lists is open, see question 1). To verify: docs only, plus the new spec failing before the standing types are added to the doc.
- Alternatives: leave it. Then it keeps drifting: it already drifted within one PR.

### BAC-4 Bring the ADR decision rows up to date with the 26 Nov seams, and correct one stale contract sentence
- Problems it solves (surplus, stale docs that send an agent to code that no longer exists):
  - ADR 0013 line 21 names `rules/audit-types.ts`, and line 75 names `PlanIssuesProvider`.
  - ADR 0014 lines 27 and 38 name `PlanIssuesProvider` in `plans/plan-issues.ts`.
  - ADR 0010 line 42 names `PlanIssuesProvider` and `issuesWithoutTranscript`.
  - `docs/test/test-cases-b1.md:367` names `plans/plan-issues.ts`.
  - The decision tables contradict the amendments at the bottom, so a reader must reconcile the two.
  - Contract text: `audit/curriculum-standing.dto.ts:26` says readiness is null for an in-progress course, but `rules/standing.ts:30-32` returns `locked` for an in-progress course with an unmet prerequisite (#207 "mark in-progress course locked if prerequisite fails"; ADR 0013, 27 Nov amendment).
- Callers. I searched with `rg -n "audit-types|PlanIssuesProvider|issuesWithoutTranscript|plan-issues.ts" docs README.md AGENTS.md`.
- Cost today: the ADR tables are what an agent reads first, and they point at removed files and tokens.
- Proposed change: in each stale row, replace the name with the current one, followed by "(renamed 26 Nov, see amendment)". Do not rewrite decisions. Fix the DTO description to say "null when prerequisites are not recorded or the course is passed; locked whenever a prerequisite is not passed, in progress included".
- Contract impact: the ADR edits have none. The DTO description changes `openapi.json` text: needs decision, and is deferred to in-flight PR #77, which owns `src/backend/openapi.json`.
- Write scope: `docs/analysis-and-design/adr/{0010,0013,0014}-*.md`, `docs/test/test-cases-b1.md`. Later, `src/backend/src/audit/curriculum-standing.dto.ts` with `src/backend/openapi.json`.
- Effort S, risk low, confidence high. To verify: rg for the old names returns only amendment lines.
- Alternatives: leave the amendments as the only record (the current convention). Cheaper, but the tables keep misleading.

### BAC-5 Make the graduation-condition id grammar part of the contract, so the frontend parser is checked
- Problems it solves:
  - Hidden link across tiers: the engine builds condition ids as `group:<uuid>`, `combined:<uuid>`, `total_credits` and five fixed ids (`rules/graduation.ts:5-30, 42, 48, 54`). The frontend parses that grammar (`frontend/src/audit/present.ts:42-57`, `split(/:(.*)/s)`) and words the fixed ids (`frontend/src/audit/messages.ts:218-223, 340-344`).
  - Enforcement gap: the contract types `id` as a free string (`audit/audit.dto.ts:335-336`), so the frontend contract specs (`frontend/src/testing/contract.ts`) cannot catch a renamed id. The only frontend test with the grammar uses a hand-written fixture (`AuditView.spec.ts:161`).
- Callers. I searched with `rg -n "conditionLabel|conditionAnchor|group:|combined:" src/frontend/src/audit`.
- Cost today: renaming or adding a not-checked condition silently falls back to the English `description` on screen.
- Proposed change: give `GraduationConditionDto.id` a `pattern`, or better a structured pair (`kind` enum plus `subjectId`), and add a frontend spec over `contractEnum` that every fixed id has a wording in both languages.
- Contract impact: needs decision. It adds an enum or pattern, or new fields, to `GraduationConditionDto` in `openapi.json`. Deferred: in-flight PR #77 owns `openapi.json`.
- Write scope: `src/backend/src/rules/{types.ts, graduation.ts}`, `src/backend/src/audit/audit.dto.ts`, `src/frontend/src/audit/{present.ts, messages.ts}`, a frontend audit spec, and `openapi.json`. Do not touch `frontend/src/audit/api.ts` (in-flight PR #214).
- Effort S, risk low, confidence med. To verify: contract spec and `AuditView.spec.ts`.
- Alternatives: leave it. The grammar is stable today, and the fallback is the engine's own English text, so drift is visible, but not caught by CI.

### BAC-6 Put the board traversals in one place, and stop plans and sharing depending on audit for one schema class
- Problems it solves:
  - Hidden link, one concept split across folders: `courseCodesOf` lives in `rules/plan-issues.ts:58` but is used by `plans/plans.service.ts:7,136`, `sharing/sharing.service.ts:8,102` and `rules/rules.service.ts:47`, and tested in `plans/plan-board.spec.ts`. Its sibling `groupIdsOf` lives in `plans/plan-board.ts:35`.
  - Needless link: `plans/plan-issues.dto.ts:2` and `sharing/sharing.dto.ts:3` import `CreditCapsDto` from `audit/audit.dto.ts:221`. This is the only reason for the plans -> audit and sharing -> audit folder edges in `depgraph-backend.json`.
- Callers: I ran `rg -n "courseCodesOf|groupIdsOf|CreditCapsDto" src/backend/src`.
- Cost today: small. An agent changing the board shape looks in plans and misses the rules helper.
- Proposed change: move `courseCodesOf` and `groupIdsOf` into a pure `rules/board.ts`, next to the `BoardTerm` type that `rules/types.ts` owns, together with its spec cases. Moving them into `plans/plan-board.ts` would make rules import plans: a cycle. Move `CreditCapsDto` (same class name) into `plans/plan-issues.dto.ts` and have `audit.dto.ts` import it from there, or put it in `common/` beside `TermDto`.
- Contract impact: none. Schemas are sorted by name and the class name is kept.
- Write scope: `src/backend/src/rules/{board.ts (new), plan-issues.ts, rules.service.ts}`, `src/backend/src/plans/{plan-board.ts, plan-board.spec.ts, plans.service.ts, plan-issues.dto.ts}`, `src/backend/src/sharing/{sharing.service.ts, sharing.dto.ts}`, `src/backend/src/audit/audit.dto.ts`.
- Effort S, risk low, confidence high. Value is low. To verify: typecheck, unit tests, and an empty `openapi.json` diff.
- Alternatives: leave it. Two imports of a six-line class and one misplaced helper are a real but small cost. Do this only alongside BAC-1, which edits the same DTO files.

### BAC-7 Give the "lock the student's row before a per-student write" convention one owner
- Problems it solves:
  - Hidden link, a call order callers just have to know: the same lock is written out as raw SQL in `plans/plans.service.ts:57` and `:84`, `transcript/transcript.service.ts:30` and `sharing/sharing.service.ts:57` (that one adds `FOR SHARE` and `deletion_requested_at IS NULL`). Each module reaches into the `users` table directly.
  - The reasons are spread over ADR 0007:25, ADR 0010:44 and ADR 0014:34. `curriculum-admin/admin-write.service.ts:38` does the same.
- Callers: I ran `rg -n 'FROM "users"' src/backend/src`.
- Cost today: a new per-student table (the advisor consents of #77, for example) must copy the right lock mode by reading three ADRs.
- Proposed change: add a users-owned helper (for example `users/student-lock.ts`: `lockStudent(tx, userId, { requireActive })`) and call it from the four sites. Coordinate with the users/platform surveyor, who owns `users/`.
- Contract impact: none.
- Write scope: `src/backend/src/users/` (new file), `plans/plans.service.ts`, `transcript/transcript.service.ts`, `sharing/sharing.service.ts`. `curriculum-admin/admin-write.service.ts` is optional and belongs to the curriculum-admin area.
- Effort S, risk med (lock semantics), confidence med. To verify: the plans, transcript, sharing and account e2e suites, including their concurrent-deletion cases.
- Alternatives: leave it. The SQL is one line, but the convention is invisible to someone adding a table.

## 4. Looked at and left alone

- **`audit/audit.dto.ts` (430 lines), `plans/plan-issues.dto.ts`.** There is no repeated mapping. Each class `implements` its engine type, so a missing field is a compile error, and the controller returns the engine object as is (`audit.controller.ts:39`). The size is Swagger decorators and descriptions. Generating them (the Nest swagger CLI plugin) would change `openapi.json`.
- **`sharing/shared-plan.ts` mapping.** A real projection: it filters codes and drops ids, transcript and grades (ADR 0010).
- **`rules/types.ts` as one file, including `BoardTerm`, `Placement` and `CITATIONS`.** Decided in #190 (ADR 0013, 26 Nov amendment). Do not split it.
- **`SHARED_ISSUE_CODES`/`TRANSCRIPT_ISSUE_CODES` hand lists (`sharing/shared-plan.ts:7-20`).** Deliberate: ADR 0010:42 says "a code the engine gains later reaches no reader until someone classifies it". `shared-plan.spec.ts:62-70` fails when a code is added.
- **The explorer counting passed prerequisites only, while the planner also counts in-progress and planned ones.** Decided (ADR 0013, 27 Nov amendment). BAC-2 only names the two policies.
- **`RulesService` as loader inside `rules/`, and rules -> onboarding/transcript/curriculum.** ADR 0013. The purity spec isolates the pure files. `auditFor` and `standingFor` share the curriculum-id-then-rules lookup, which is acceptable at two call sites.
- **The `'standard'` branch in `rules/credit-caps.ts:12,25,70`.** ADR 0012.
- **`OFFERED_COHORTS` hand lists (`onboarding/onboarding-options.ts:3`, `frontend/src/onboarding/api.ts:24`).** The visibility gate for cohorts with no draft state (ADR 0011:227). The frontend copy is tied to the contract by `frontend/src/onboarding/api.spec.ts:22-24`.
- **Frontend copies of the term calendar (`frontend/src/terms.ts`), `MAX_PLAN_TERMS`, and the issue/term-kind enums.** ADR 0009:26 documents the calendar copy. The limits and enums are pinned by `plans/api.spec.ts:101-108` and the other contract specs. They are a natural part of ADR 0015's package later.
- **Frontend rule re-derivation.** None found. `plans/present.ts:150-172` and `audit/present.ts` consume engine statuses. `curriculum/present.ts` `groupColour` is presentation (frontend surveyor).
- **Entity CHECK literals (`plan-placement.entity.ts:12-18`, `program.entity.ts:12`).** They mirror frozen migrations.
- **The engine running with an empty transcript for a share, then filtering.** ADR 0010, pinned by `rules.service.spec.ts` and `shared-plan.spec.ts`.
- **The per-consumer lookups on `CurriculumService` (`curriculumLabels`, `requirementGroupIds`, `catalogCourses`).** curriculum owns those tables (ADR 0013 module-boundary row).

## 5. Open questions

1. Must `class-model.md` keep field-level listings of engine types (course report deliverable), or may it point to `rules/types.ts`? This decides between BAC-3 (a) and (b).
2. Is ADR 0015 (the engine in the browser, #95) still planned? If yes, BAC-1 is step 1 of it. If not, BAC-1 is still worth it for compile-time purity, at lower priority.
3. After #77 lands: may the contract text of `CourseStandingDto.readiness` and the shape of `GraduationConditionDto.id` change (BAC-4, BAC-5)?
4. Should "offered cohorts" become curriculum data (a draft or published flag) instead of code in two tiers? This is a product decision. ADR 0011:227 chose code for now.
