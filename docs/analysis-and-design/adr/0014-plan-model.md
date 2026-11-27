# ADR 0014: The plan model

- Status: accepted (2026-11-27, Lâm)
- Date: 2026-11-09
- Deciders: Lâm (Project Lead)
- Reviewers: Hoà (F5 planner, F7 what-if), Triết (rule engine), Dũng (F9 sharing)

## Context

F5 (Vision §5, UC-05) lets a student keep several plans, each placing courses into terms "from now to graduation". Other features build on the same stored plan: the plan generator saves its result as a plan ([ADR 0006](0006-plan-generator.md), UC-07 step 10), a what-if scenario runs on a copy of a plan (F7, UC-06), a shared link shows one plan to an advisor (F9, UC-09, [ADR 0010](0010-public-pages-and-guide-content.md)), and the rule engine reports a plan's violations (UC-05 step 6, UC-19). So the shape of a plan outlives the PR that adds the `plans` module.

The planner prototype (`docs/analysis-and-design/ui-prototypes/planner.html`) shows what a plan holds: one row per term, course tiles in each row, and a dashed "elective slot" tile that holds credits for an elective group before a course is chosen. Its plan menu creates, renames, duplicates, switches and deletes plans, and deleting asks first.

AGENTS.md hard rule 1 leaves every academic rule to the rule engine, and [ADR 0012](0012-credit-caps-by-training-type.md) says a plan outside the credit caps is reported, not refused, because a petition can allow it.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **Two tables: `plans` and `plan_placements`.** A plan has a name, its owner and the curriculum it is made against. A placement is one tile: a term (`term_year`, `term_number`, ADR 0009), a `position` within the term, and either a `course_code` or a slot (`requirement_group_id` and `slot_credits`). A CHECK keeps exactly one of the two kinds. | A JSON column holding the board on `plans`; a `plan_terms` table between them | Rows can be checked by the database (term range, code format, one placement per course, one tile per position) and read by the rule engine and the sharing module without parsing. A terms table would store nothing a term row does not already say: an empty term is not stored, and the planner draws the rows up to the target graduation term itself. |
| **A plan points at one curriculum (`curriculum_id`), fixed at creation.** | Read the student's current program and cohort at each use | TC-B2-ADM-03 asks that a new cohort leaves saved plans on their original curriculum version. Onboarding answers can change (UC-01 A9), and a plan keeps its own curriculum. |
| **Each table has its own `user_id … ON DELETE CASCADE`. `plan_placements` also has a composite key `(plan_id, user_id) → plans (id, user_id)`.** | Placements reaching the user only through `plans` | AGENTS.md and [ADR 0004](0004-account-export-and-deletion.md): the account export reads `user_id`, and `account.e2e-spec.ts` fails on a table that reaches `users` only through another. The composite key makes a placement's `user_id` always its plan's. |
| **`course_code` is a plain code, checked against the catalog when the plan is saved and kept as it is afterwards. `curriculum_id` and `requirement_group_id` are foreign keys with `ON DELETE RESTRICT`.** | A foreign key to `courses`; `CASCADE` or `SET NULL` on curriculum and group | Same choice as the transcript ([ADR 0007](0007-transcript.md)); [ADR 0011](0011-curriculum-administration.md) already lists plans as a plain-string consumer of course codes. A plan that a curriculum change now breaks still loads, and the rule engine reports it (UC-05 A7). ADR 0011 refuses to delete referenced curriculum data, and RESTRICT makes the database refuse too, where a cascade would silently erase students' plans. |
| **A course is placed at most once in a plan.** A partial unique index on `(plan_id, course_code)`. | Allow repeats | The planner prototype stores a plan as course → term. A retake after a failed attempt is still one placement, in the term of the retake. Two slots of the same group are allowed: each holds its own credits. |
| **The planner saves the whole board in one `PUT /api/plans/{id}/placements`,** which replaces every placement in one transaction, under a row lock on the plan. Any invalid placement refuses the whole request. | One route per move (add, move, remove) | The planner already holds the whole board for undo (UC-05 A3). All-or-nothing replacement cannot leave half a move saved, and a lost response is recovered by reading the plan again (TC-B2-PLAN-02). The transcript uses the same pattern (ADR 0007). |
| **The plans module checks shape and references only.** Codes must exist in the catalog; a slot's group must belong to the plan's curriculum; a course outside the curriculum is allowed. **No prerequisite, offering term, credit cap or coverage check.** | Refuse a plan that breaks a rule | Hard rule 1 and ADR 0012. Whether a course outside the curriculum counts is a coverage question for the engine. |
| **Violations come from the rule engine through `RulesService`** (`src/backend/src/rules/rules.service.ts`; was a `PlanIssuesProvider` interface in `plans/plan-issues.ts`, renamed, see the amendment below), served later as `GET /api/plans/{id}/issues`. Not stored. | Store violations with the plan | They change whenever the transcript, the curriculum or the rules change; computing them on read keeps them current (UC-05 A7). Issues are codes with parameters, as in ADR 0006. |
| **A what-if copy is a duplicated plan** (`POST /api/plans/{id}/duplicate`). Discarding it deletes it. | A separate scenario table | UC-06 saves the copy "as a new plan"; a copy is already a plan. |
| **Another student's plan answers 404, as a missing or malformed id does.** | 403 | A 403 would confirm that the plan exists. |
| **No primary or active plan in the database yet.** The UI remembers the open plan. | An `is_primary` column | It needs an "exactly one per student" rule and a choice of the next primary on delete, and nothing in B1 reads it. Add it when sharing, notifications or the advisor need "the student's plan". |

- 2026-11-26: Bounds on input, not rules: at most 30 terms, 30 placements in a term and 300 placements in a plan. They stop oversized requests. They are far above any real plan: APCS has 12 terms of about 8 courses.
- 2026-11-26: A copy reads the original plan with `FOR SHARE`, so a save of the original that is in progress finishes first and the copy never holds half of it.
- 2026-11-26: A save locks the plan row with `FOR NO KEY UPDATE`, as the transcript does (ADR 0007). Two saves of one plan then run one after the other, and the lock does not block the `KEY SHARE` lock that an insert that references the plan takes (a copy, a link).

## Consequences

- The rule engine (`RulesService`, was `PlanIssuesProvider`; renamed, see the amendment below) serves `GET /api/plans/{id}/issues` (ADR 0013, "Plan issues").
- The sharing module (F9, ADR 0010) needs a read-only method on `PlansService` that reads a plan by id for a share token. Its share table will have its own `user_id` and `plan_id … ON DELETE CASCADE`, so deleting a plan stops its links (UC-09 A5).
- F12 must refuse to delete a curriculum or requirement group that a plan uses; the database refuses it already. A course-code correction must update `plan_placements.course_code` in the same migration as the transcript (ADR 0011).
- The plan generator saves its result with `POST /api/plans` and `terms` in the body, in one request.
- Open: whether past terms belong in a plan or are always read from the transcript. The model allows both; the prototype draws past terms from the transcript.
- 2026-11-26: The drag preview adds the dropped placement at the end of each target term. The planner draws a drop in the same place, so the positions in each report match the planner's tiles.

## Amendment, 26 November 2026: no provider interface

*Decided by the coordinator under the Project Lead's standing delegation, 26 November 2026 (backend cleanup).* `PlanIssuesProvider` and the `PLAN_ISSUES_PROVIDER` token are removed. `PlansController` and `SharingService` inject `RulesService`, and the plan-issue types are in `rules/types.ts`. Violations are still computed on read and never stored. The plan id route parameter, its 404 answer and its description are in `plans/plan-id.ts`, which `sharing` uses too. See ADR 0013, amendment of 26 November 2026.
