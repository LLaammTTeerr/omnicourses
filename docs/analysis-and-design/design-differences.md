# Design vs. use-case specification differences

The [class model](class-model.md) and the [sequence diagrams](sequence-diagrams/README.md) draw the code on `main` as of 15 November 2026 (the class model also draws the academic calendar and the notification inbox, added later); UC-12 below was rewritten on 25 November 2026 with the notification inbox API ([ADR 0018](adr/0018-notification-inbox.md)). Where that code differs from a use-case specification ([`docs/requirements/use-cases/`](../requirements/use-cases/README.md), and the Use-Case Specification v1.0 in [`report/assignments/PA2/uc-specs.tex`](../../report/assignments/PA2/uc-specs.tex)), the code is drawn and the difference is listed here. Each "not built" below was checked by searching `src/` for the code it would need.

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

## UC-09 Share or export a plan (F9)

Only the API is built (`src/backend/src/sharing/`, [ADR 0010](adr/0010-public-pages-and-guide-content.md), amendment of 25 November 2026). No screen calls it yet.

| Specification | As built | Follow-up |
| --- | --- | --- |
| The Share panel, the shared page with its banner, and **Download PDF** (steps 1–8, A1). | Not built. The API has the owner's routes (`GET`, `PUT`, `DELETE /api/plans/{id}/share`) and the reader's route (`GET /api/shared-plans/{token}`). | The screens. The PDF is the browser's print layout of the shared page (agreed by Dũng and accepted by Lâm, 25 November 2026; no server PDF), and it follows the owner's choice below |
| **Create link** creates a link; a plan already shared shows its link instead (steps 3–4, A4). | One request does both: `PUT /api/plans/{id}/share` creates the link when there is none and returns the live one when there is. It also carries the two tick boxes, `showName` and `showTranscriptChecks`: only an explicit `true` turns one on, and one left out stays as it is. `GET` shows the link and both choices without changing anything. | |
| A reader sees the violations the rule engine finds; the same problems as the student when the student chose to show the checks from the transcript (step 2, A9). | As specified, in the API. With the choice off, the answer holds the engine's issues that follow from the plan and its curriculum alone, does not read the transcript, and names the four codes left out in `issueCodesNotShown` (`prerequisite_not_met`, `already_passed`, `already_in_progress`, `requirement_not_covered`). With it on, the answer holds the owner's own issue list and the coverage of each requirement, with names in place of ids and never a grade. | The Share panel must warn the student when the box is ticked (a reader can then tell which courses the student passed, failed or is taking), and the shared page and the PDF must say "some checks are not shown" when `issueCodesNotShown` is not empty. The choice was agreed by Dũng and accepted by Lâm on 25 November 2026. |
| With that choice on, a reader sees the estimated graduation term (step 2, §7; UC-16). | A gap: nothing computes one (see UC-03 and UC-05), and only the rule engine may. With the choice on, the answer gives the coverage of each requirement and whether the plan would meet the curriculum (`coverage.graduation`); with it off, neither. | The rule engine; then the same choice |
| The prototype `shared.html` shows a row of passed courses and the coverage of each requirement group. | The coverage is in the answer when the owner chose to show the checks from the transcript. The row of passed courses is in no answer: UC-09 step 2 does not list it. | |
| A reader sees the plan's "program, cohort and curriculum version" (step 2). | The answer gives the curriculum's code, cohort and names and the program's code and names, and no id. | |
| The token is "at least as strong as a session token" (§7). | 32 random bytes. Unlike a session token it is stored readable, because A4 shows the live link again (agreed by Dũng and accepted by Lâm, 25 November 2026). | |
| The page tells search engines not to index it (§7). | Every answer that reaches the header step under `/api/shared-plans` carries `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`: the plan, the "not shared" answer, and the 429, 400 and 404 that the route's own code does not make. The CORS answer to `OPTIONS` and the body parser's own 400, 413 and 415 are made earlier and do not carry them; none holds plan data (ADR 0010). The page must add its own `noindex`. | The shared page |

## UC-10 Follow a school-task guide (F11)

As the specification schedules: B1 has browsing, search and reading (steps 1–7, A1, A2, A5, A8). The parts that use the student's data (A3 program values from the rule engine, A4 courses from a plan) and reporting a problem (A6) are not built, and no guide route reads the signed-in user.

## UC-12 Receive notifications (F10)

The school dates and their calendar page are built ([ADR 0017](adr/0017-academic-calendar.md)). The notification inbox is built in the API only ([ADR 0018](adr/0018-notification-inbox.md), proposed): the single-page app has no bell and no inbox screen yet. Dũng, the owner of F10, decided the timing, the time zone and the repeat rules on 25 November 2026; UC-12 gives "seven days" only as an example.

| Specification | As built | Follow-up |
| --- | --- | --- |
| At a scheduled moment, for example seven days before a registration window opens, the system creates a notification (steps 1 and 3). | Built. A registration window makes one notification 7 days before it opens and one on the day it opens; a term makes one on its first day (Dũng, 25 November 2026). Days follow Vietnam time. One function creates what is due today: a timer runs it when the app starts, every 10 minutes and at 00:00 in Vietnam, and each read of the inbox or of the unread count runs it for the caller. A day that has passed is skipped, and a moved date sends nothing again. The students of the date's program receive it; an account waiting for deletion does not. | |
| The student has finished onboarding (precondition). | A student receives the notifications of a school date once onboarding has saved their program, finished or not: the same rule as the calendar's default program. Dũng confirmed this on 25 November 2026 ([ADR 0018](adr/0018-notification-inbox.md), decision 6). The single-page app sends a student whose onboarding is unfinished to onboarding first, so such a student sees the notifications after finishing. | |
| The system asks the rule engine what applies to the student, and the registration notification says what the active plan places: "Your plan places 5 courses, 19 credits" (steps 2–3, A6). | Not built (confirmed by Dũng, 25 November 2026). The registration notification holds the date only: a kind, a copy of the school date and link keys. The module reads no plan and calls no rule-engine function. No rule-engine function reads the calendar; ADR 0017 keeps it that way, so a date never decides an academic rule. | **B3:** the plan's courses and credits in the registration notification. They must come from the rule engine and the plans module (ADR 0018, decision 10). |
| The registration notification links to the plan and to the registration guide (step 3). | The API returns link targets as keys, not URLs: `calendar` and `planner` for a registration notification, `calendar` for a term start, `audit` for a transcript change. There is no guide link: no stable key names a guide. | A key for the registration guide (ADR 0018, open question 3) |
| A bell with the unread count, a popover, and an inbox listed newest first; opening a notification marks it read (steps 4–7). **Mark all as read** (A3) and filters (A4). | Built in the API: `GET /api/notifications` (newest first; filters `unread` and `kind`; pages), `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read` and `POST /api/notifications/read-all`. No screen calls them yet. A4's "plan" filter has no kind, because A2 is not built. The calendar page at `/calendar` shows the school dates of the student's program in a week view and a month view, with the term week; it has no read state and is not in UC-12: it follows the calendar UI prototype. | The bell, the popover and the inbox screen |
| The student saves a new transcript, and the notification lists what changed in the audit (A1). | Built without the list (confirmed by Dũng, 25 November 2026). Each save that changes a transcript that was not empty makes one notification, inside the save's transaction. It says only that the saved transcript changed and links to the degree audit: no grade, no course and no audit result. The first import, a save with the same rows in any order, a refused save and a failed save make none. | **B3:** the list of what changed in the audit. It must come from the rule engine (ADR 0018, decision 10). |
| A curriculum change makes the active plan break a rule, and the system creates a notification that names the rule (A2). | Not built. Not in B2 (Dũng, 25 November 2026). | |
| The student turns a kind of notification off in settings (A5). | Not built. Not in B2 (Dũng, 25 November 2026). | |
| A notification never states a rule's value on its own; it shows the rule engine's result (special requirements). | A notification states no rule value and no rule-engine result at all: it holds a kind, a copy of a school date and link keys. | |
| Notifications are in-app only; there is no mail sender before B3 (special requirements). | As specified: the inbox only, no email (Lâm, 12 November 2026). | |
| (none) | An add/drop window (`add_drop` in the calendar) makes no notification. Not in B2 (Dũng, 25 November 2026). | |
| (none) | A notification keeps a copy of the school date as it was announced. It stays when an administrator deletes the date (confirmed by Dũng, 25 November 2026), and it does not follow a later change of the date. | |
| The dates come from the published school calendar, entered by the team (special requirements). | A program administrator of that program enters them through the API: `POST /api/admin/programs/{programId}/calendar-events`, and `PATCH` and `DELETE` on `…/calendar-events/{eventId}`. The writes use F12's program grant and write lock ([ADR 0011](adr/0011-curriculum-administration.md)). No screen calls these routes yet. Nothing is seeded, so a program shows no dates until its administrator enters them. | An administration screen for the dates |
| (none) | The API also returns another program's dates when asked by program code (`program` query). The page always shows the student's own program. | |
| (none) | The calendar prototype also shows a personal timetable: the student's classes, rooms, deadlines, exams and notes. It is not built. ADR 0017 leaves it to a separate feature with its own ADR, and the Project Lead approved it as that separate feature. | Personal timetable, its own PR and ADR |

## UC-14 Manage account and privacy

| Specification | As built |
| --- | --- |
| The sessions list shows the place each device was last used (step 4). | A session stores the browser's user agent and its times; no place. |
| Withdraw AI consent (A3). | Not built: no AI feature is built, and the only consent stored is `users.consent_at` from sign-up. |
| The export holds notifications; deletion stops every shared link (A4, A5). | The export holds the student's notifications: the `notifications` table has a `user_id` key to `users`, and the export holds every table that has one. A deletion request deletes every shared plan's link in the transaction that revokes the sessions, and a restored account gets none back (UC-09 A7). A `plan_shares` row is exported without its token. |
| 30 days of grace. | The default of `ACCOUNT_DELETION_GRACE_DAYS`; the deadline promised is stored in `users.purge_after`. |

## Use cases with no code on `main`

- UC-06 what-if scenario (F7), UC-07 generate a plan (F6), UC-08 advisor chat (F8): not built. UC-09 and UC-16 sharing (F9): the API is built and tested (`src/backend/src/sharing/`, see UC-09 above); the single-page app has no sharing screen. The AI gateway (`src/backend/src/ai/`) is built, and no feature module injects `LlmService` yet.
- UC-11, UC-17, UC-18 curriculum administration (F12): the API is built and tested (`src/backend/src/curriculum-admin/`); the single-page app has no administration screen. Their sequence diagrams are not drawn yet.

## Documents that lag the code

- The [class model](class-model.md) has `PlanShare` in §1.4 and §1.7 only; §3 does not draw `SharingService` and its two controllers, and no sequence diagram of UC-09 is drawn.
- [`architecture.md`](architecture.md) §4.2 and §5 still show `rules`, `audit`, `plans`, `curriculum-admin`, the session store and the student screens as planned; all are built.
- [`architecture.md`](architecture.md) has no `academic-calendar` module in §4.1, and no `notifications` module there either: §4.2 names `notifications` with its API built. The school dates and the `/calendar` page are built ([class model](class-model.md) §1.6, §3.5), and so is the notification inbox API ([class model](class-model.md) §1.8, §3.6; [ADR 0018](adr/0018-notification-inbox.md)).
- [`sequence-diagrams/UC-01-sign-up-and-onboard.md`](sequence-diagrams/UC-01-sign-up-and-onboard.md) draws sign-up, sign-in and sessions; onboarding (`GET` and `PUT /api/users/me/onboarding`) has been built since and is not drawn.
