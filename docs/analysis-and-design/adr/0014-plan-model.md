# ADR 0014: The plan model

- Status: proposed
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
| **Violations come from the rule engine through a `PlanIssuesProvider` interface** (`src/backend/src/plans/plan-issues.ts`), served later as `GET /api/plans/{id}/issues`. Not stored. | Store violations with the plan | They change whenever the transcript, the curriculum or the rules change; computing them on read keeps them current (UC-05 A7). Issues are codes with parameters, as in ADR 0006. |
| **A what-if copy is a duplicated plan** (`POST /api/plans/{id}/duplicate`). Discarding it deletes it. | A separate scenario table | UC-06 saves the copy "as a new plan"; a copy is already a plan. |
| **Another student's plan answers 404, as a missing or malformed id does.** | 403 | A 403 would confirm that the plan exists. |
| **No primary or active plan in the database yet.** The UI remembers the open plan. | An `is_primary` column | It needs an "exactly one per student" rule and a choice of the next primary on delete, and nothing in B1 reads it. Add it when sharing, notifications or the advisor need "the student's plan". |

## Consequences

- The rule engine registers a `PlanIssuesProvider` and serves `GET /api/plans/{id}/issues` (ADR 0013, "Plan issues").
- The sharing module (F9, ADR 0010) needs a read-only method on `PlansService` that reads a plan by id for a share token. Its share table will have its own `user_id` and `plan_id … ON DELETE CASCADE`, so deleting a plan stops its links (UC-09 A5).
- F12 must refuse to delete a curriculum or requirement group that a plan uses; the database refuses it already. A course-code correction must update `plan_placements.course_code` in the same migration as the transcript (ADR 0011).
- The plan generator saves its result with `POST /api/plans` and `terms` in the body, in one request.
- Open: whether past terms belong in a plan or are always read from the transcript. The model allows both; the prototype draws past terms from the transcript.
