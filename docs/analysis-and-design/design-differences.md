# Design vs. use-case specification differences

The [class model](class-model.md) and the [sequence diagrams](sequence-diagrams/README.md) draw the code on `main` as of 15 November 2026. Where that code differs from a use-case specification ([`docs/requirements/use-cases/`](../requirements/use-cases/README.md), and the Use-Case Specification v1.0 in [`report/assignments/PA2/uc-specs.tex`](../../report/assignments/PA2/uc-specs.tex)), the code is drawn and the difference is listed here. Each "not built" below was checked by searching `src/` for the code it would need.

## UC-01 Sign up and onboard

| Specification | As built | Follow-up |
| --- | --- | --- |
| A student whose onboarding is unfinished can open the dashboard, which asks them to finish it (B1 test case USER-01k). | The router guard (`src/frontend/src/router.ts`, `onboardingFirst`) sends them to `/onboarding` before any private page except `/settings`. `AuditGate`'s notice for 409 `onboarding_required` shows only when the guard could not load the onboarding answers. | Issue #115 |
| Sign-in with Google. | Not built; `users.google_sub` exists and is unused ([ADR 0002](adr/0002-authentication-and-sessions.md), deferred). | |

## UC-02 Import transcript (F2)

| Specification | As built | Follow-up |
| --- | --- | --- |
| The student uploads the transcript PDF exported from the portal; a deterministic parser reads it (steps 1–5, A1, A7, A8). | No file is read and there is no parser. The student types every row in (`TranscriptView.vue`). The school portals offer no transcript file to export, so the source file the use case assumes does not exist. | The Project Lead decided on 15 November 2026 to change F2 to "paste the grades table, or type it in". Pasting is not on `main` yet; UC-02 and the glossary entry "Transcript import" need the same change. |
| Rows not in the student's curriculum are marked **Not in your curriculum** in the review table (step 5). | The transcript page marks nothing. The degree audit reports such courses as unmatched courses with a `not_in_curriculum` warning. | |
| Manual entry offers the curriculum's courses to pick from and fills in the credits (A4). | The student types the course code, name and credits; nothing is looked up. | |
| Saving over an existing transcript first shows the rows added, changed and removed (A5). | The save replaces the whole set in one transaction; no comparison is shown. | |
| After saving, the degree audit opens (step 9). | The page stays on the transcript and shows a toast. | |
| A row has a grade. | A row has a result (`graded`, `in_progress`, `exempt`, `pass`, `fail`) and a grade only when graded ([ADR 0007](adr/0007-transcript.md)). | Already noted in UC-02 §8 |

## UC-03 View degree audit (F3)

| Specification | As built |
| --- | --- |
| The summary shows the estimated graduation term (step 3). | The rule engine does not compute one: nothing in `src/` does. `DegreeAudit.graduation` says `done` or `not_yet` with the conditions met, unmet and not checked. |
| A past-term picker shows the dashboard as it stood at the end of a term (A2). | Not built. The audit page lists each term's credits and averages (`DegreeAudit.terms`). |
| **Needs attention** items link to the planner, a guide or the transcript (step 6). | The dashboard lists up to five unmet graduation conditions, each linking to its place on the audit page. |
| Precondition only: a program and cohort are chosen. | The API also answers 409 `curriculum_not_found` when the chosen program and cohort have no curriculum ([ADR 0013](adr/0013-rule-engine-and-degree-audit.md)). |

## UC-04 Explore curriculum (F4)

| Specification | As built |
| --- | --- |
| The system asks the rule engine for each course's state; the list shows in progress, available now, locked and passed (steps 2–3). | The explorer does not call the rule engine. It lists the courses by requirement group and adds a neutral "in your transcript" mark from the saved transcript's course codes. |
| Prerequisite graph (A1). | Not built. |
| The drawer shows prerequisites with their state, the courses it unlocks, the offering terms, and a link to place the course in a plan (step 7). | The drawer shows the catalog record and the requirement groups that list the course, with a fixed note that prerequisites and offering terms are not recorded yet. `CurriculumDto` already carries `prerequisites` and `offeringTerms` per course (null when not recorded); the explorer does not read them. |
| The student sees their own curriculum. | The student can also switch to another offered program and cohort. |

## UC-05 Build and edit a plan (F5)

| Specification | As built |
| --- | --- |
| Planned for B2. | Built in B1. |
| The strip shows the estimated graduation term (steps 2, 6). | Not computed. The strip shows the coverage of each requirement group and whether the plan would meet the curriculum (`PlanCoverage.graduation`). |
| While dragging, terms that cannot take the course fade out and refuse the drop (step 4). | No term refuses a drop. Each row shows the rule engine's verdict and reason, and a drop that breaks a rule still lands and is saved, with the violation listed ([ADR 0012](adr/0012-credit-caps-by-training-type.md), [ADR 0014](adr/0014-plan-model.md)). |
| A fix suggestion with **Apply** (A2). | Not built: the Issues panel lists each issue with its citation and no fix. |
| A change is validated in under 300 ms. | The preview is one request to the API per drag (`POST /api/plans/{id}/issues/drops`); the time was not measured for this document. [ADR 0015](adr/0015-rule-engine-in-the-browser.md) (proposed) would run the check in the browser. |
| A plan holds courses. | A placement is a course or a slot: credits held for a requirement group until a course is chosen. A plan can also be locked on one browser. Neither is in the specification. |
| (none) | `POST /api/plans/{id}/issues` is built and tested, but no screen calls it since the batched drops route replaced it. |

## UC-10 Follow a school-task guide (F11)

As the specification schedules: B1 has browsing, search and reading (steps 1–7, A1, A2, A5, A8). The parts that use the student's data (A3 program values from the rule engine, A4 courses from a plan) and reporting a problem (A6) are not built, and no guide route reads the signed-in user.

## UC-14 Manage account and privacy

| Specification | As built |
| --- | --- |
| The sessions list shows the place each device was last used (step 4). | A session stores the browser's user agent and its times; no place. |
| Withdraw AI consent (A3). | Not built: no AI feature is built, and the only consent stored is `users.consent_at` from sign-up. |
| The export holds notifications; deletion stops every shared link (A4, A5). | Neither notifications nor sharing exists. The export holds every table with a `user_id` key to `users`, whatever tables exist. |
| 30 days of grace. | The default of `ACCOUNT_DELETION_GRACE_DAYS`; the deadline promised is stored in `users.purge_after`. |

## Use cases with no code on `main`

- UC-06 what-if scenario (F7), UC-07 generate a plan (F6), UC-08 advisor chat (F8), UC-09 and UC-16 sharing (F9), UC-12 notifications (F10): not built. The AI gateway (`src/backend/src/ai/`) is built, and no feature module injects `LlmService` yet.
- UC-11, UC-17, UC-18 curriculum administration (F12): the API is built and tested (`src/backend/src/curriculum-admin/`); the single-page app has no administration screen. Their sequence diagrams are not drawn yet.

## Documents that lag the code

- [`architecture.md`](architecture.md) §4.2 and §5 still show `rules`, `audit`, `plans`, `curriculum-admin`, the session store and the student screens as planned; all are built.
- [`sequence-diagrams/UC-01-sign-up-and-onboard.md`](sequence-diagrams/UC-01-sign-up-and-onboard.md) draws sign-up, sign-in and sessions; onboarding (`GET` and `PUT /api/users/me/onboarding`) has been built since and is not drawn.
