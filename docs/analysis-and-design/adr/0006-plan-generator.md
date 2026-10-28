# ADR 0006: How the plan generator builds a plan

- Status: proposed
- Date: 2026-10-28
- Deciders: Lâm (owner of `plan-generator`)
- Reviewer: Triết (rule engine interface), Hoà (plans API, how reasons are shown)

## Context

F6 (Vision §5) builds a plan for the student. [ADR 0003](0003-language-model-scope.md) makes it a deterministic planner over Triết's rule engine, with a model only filling the planning-goal form. The Performance NFR (Vision §6) asks for a plan "in under 30 seconds with visible progress". UC-07 §8 leaves three questions to this ADR: the search method, what happens at the 30-second limit (A8), and whether a model summarises the result.

The planner takes the student's transcript, their curriculum and a planning goal. It returns a plan from the next term to graduation with a reason for every placement (UC-07 step 8). AGENTS.md hard rule 1 splits the work: the planner chooses *where* each course goes, and the rule engine answers *whether* it may go there. The planner holds no academic rule of its own: no prerequisite, offering term, credit cap or requirement coverage.

The rule engine isn't built yet (callable functions due 29 Nov), and the curriculum schema (#23) is still changing. So this ADR states what the planner needs from the engine in glossary terms, not table names.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **Fill terms one at a time, most urgent course first.** For each term, the planner asks the engine which remaining courses may be placed there and adds them in priority order until the term reaches the student's credits per term. Priority is the **length of the longest prerequisite chain that starts at the course** (for an OR prerequisite, the shorter branch), so long chains start early. Ties go to the student's courses to take, then to the lower course code. | Integer programming or CP-SAT solver; backtracking search; the model places courses (forbidden by ADR 0003) | This is the critical-path heuristic from list scheduling (Hu 1961; Graham 1969). Those papers prove bounds only for simpler settings (equal-length jobs, identical machines), so here it is a heuristic with no optimality guarantee. In exchange, each placement has a one-line reason, and the work is about terms × courses engine calls (≈ 16 × 150 for APCS), each one deterministic. A solver could find shorter plans, but it needs a native dependency (OR-Tools has no official Node binding), its running time is hard to bound, and it can't say why a course sits where it does. |
| **Electives are picked from the engine's list.** For each requirement group the engine reports as short, the planner picks among the courses the engine says count for it. Order: courses to take first, then courses that need nothing more before them, then the shortest prerequisite chain, then the lower course code. Courses to avoid are skipped unless the group can't be filled without them. After each pick the planner asks the engine again, until the engine reports the group as covered. | The planner counts credits against the group itself | Coverage is a rule (hard rule 1). The order of picks is a preference, not a rule, so the planner owns it. |
| **A compulsory course the student wants to avoid is placed anyway** (UC-07 A6), with the reason "compulsory: every student of the cohort must pass it". | Drop it and report the plan as incomplete | UC-07 A6. The engine's coverage report is what marks the course compulsory. |
| **Credits per term come from the goal, capped by the engine.** The planner never places more than the engine's credit cap for the term. When the goal asks for more than the cap allows, the plan says which part of the goal it could not meet and cites the cap the engine returned (UC-07 A4). | The planner clamps to the published 14–25 / 12 itself | The credit cap is published per program (GLOSSARY: Credit cap) and is a rule. |
| **Summer terms are used only when needed.** The planner first plans main terms only. If that misses the target graduation term, it plans again with summer terms allowed and keeps whichever plan graduates earlier. A what-if scenario that adds a summer term (UC-06) turns them on from the start. | Always use summer terms; never use them | The planning-goal form has no summer field. Students don't expect summer courses unless they need them. |
| **Courses in progress stay in their current term**, as part of the plan, so the engine judges later placements against them like any planned course. The plan lists them under "assumes these are passed". | Mark them passed in the transcript; leave them out | The planner never edits the transcript. Whether a course in progress meets a prerequisite (a minimum grade, say) stays the engine's answer. Failing one is a what-if scenario (UC-06). |
| **The internship term holds what the engine allows.** The goal sets the internship term. The engine says which course is the internship and what credit cap applies in that term. | The planner reserves the whole term for the internship | Which courses may share a term with the internship is a curriculum rule. Open until Thắng's seed data shows how APCS states it. |
| **An unreachable target still gives a plan** (UC-07 A5): the earliest estimated graduation term the planner found, plus the violations the engine returned for the courses that pushed it later. | Refuse and return nothing | The student sees why the target can't be met, in the engine's words, and can change the goal. |
| **The draft is validated as a whole, and every violation is shown.** The engine's `validate`, the same check F5 runs live, reviews the finished plan. A violation it finds is listed on the plan, never hidden. Tests on synthetic curricula assert that ordinary goals give no violations. | Hide plans that have violations | The student and the tests both see what the engine sees. |
| **Reasons are codes with parameters**, e.g. `{ code: 'prerequisite_passed', course: 'CSC10002', term }`. The UI renders them in Vietnamese and English. | Sentences built on the server | The UI is bilingual (#13), and Hoà owns the wording. Tests compare codes, not prose. |
| **No model summary, for now.** The reasons are the explanation. | A model summary of the reasons, which ADR 0003 allows ("explains the result") | A second model call per plan costs money and can misstate a rule in fluent prose. Revisit if students find the reasons too terse. |
| **At the 30-second limit, return the best plan found so far, never nothing.** The method above is expected to take well under a second, so v1 has no limit of its own. The client shows progress, mostly for the goal box's model call (up to 30 s, ADR 0003), and cancels by dropping the request. | Stop and ask the student to relax the goal | Performance NFR (Vision §6). The real cost depends on the engine; it is measured on the APCS seed (8 Nov) before Sprint 5. |
| **A pure function behind one endpoint.** `generatePlan(goal, rules)` has no database access. One endpoint returns the unsaved plan, and the student saves it through Hoà's plans API (UC-07 step 10). | The planner saves the plan itself | Ownership stays split as in ADR 0003. Unit tests run on synthetic curricula with a fake engine. |

## What the planner needs from the rule engine

This is a proposal for Triết, and the names are placeholders. The engine is bound to one student once, so no call has to repeat the transcript and the curriculum. Every function is deterministic and has no side effects.

```ts
interface StudentRules {                        // from RulesService.forStudent(transcript, curriculum)
  remainingRequirements(plan): RequirementGap[];  // per requirement group: compulsory courses left, credits short, eligible courses
  prerequisitesOf(course): PrerequisiteExpression; // AND/OR, for ranking chains
  canPlace(course, term, plan): Violation[];      // [] = allowed; prerequisites and offering terms
  creditCap(term, plan): { min: number; max: number };
  internshipCourse(): Course | null;
  validate(plan): Violation[];                    // the same check F5 uses live
  estimatedGraduationTerm(plan): Term | null;
}
```

## Consequences

- The planner holds no academic rule. When a rule changes, only the engine changes.
- The planner can be built and tested before the real engine exists, against a fake `StudentRules` over a synthetic curriculum.
- Plans may not be the shortest possible. Greedy packing, the order of elective picks and terms with limited offerings can each cost a term. If the APCS seed shows real losses, a search that swaps placements can be added later, under the same 30-second rule.
- Terms are written as in ADR 0007 (student record).
- Open:
  - how the APCS curriculum states the internship term's rules (row above);
  - the engine's cost per call, to be measured on the APCS seed.
