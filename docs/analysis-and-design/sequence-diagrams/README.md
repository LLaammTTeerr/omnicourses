# Sequence diagrams

One file per use case, named like its specification. Each is drawn from the code on `main`, names the source files it was read from, and gives the main flow and the alternate flows that are implemented (401, 400, 404, 409, 429 and their handling). Participants are real components: the view, the store or API module, the controller, the service, the rule engine and the database. Where the code differs from the specification, the code is drawn and the difference is in [Design vs. use-case specification differences](../design-differences.md). The classes are in the [class model](../class-model.md).

| Use case | Feature | Diagrams |
| --- | --- | --- |
| [UC-01 Sign up and onboard](UC-01-sign-up-and-onboard.md) | F1 | Sign up; sign in; every signed-in request (`ThrottlerGuard`, `AuthGuard`); token rotation; signing out and revoking a session |
| [UC-02 Import transcript](UC-02-import-transcript.md) | F2 | Open the transcript; enter or paste rows, review and save; alternate flows of the save |
| [UC-03 View degree audit](UC-03-view-degree-audit.md) | F3 | The audit through the rule engine; alternate flows (409 `onboarding_required`, 409 `curriculum_not_found`, no transcript) |
| [UC-04 Explore curriculum](UC-04-explore-curriculum.md) | F4 | Read the curriculum; search and open a course; alternate flows |
| [UC-05 Build and edit a plan](UC-05-build-and-edit-a-plan.md) | F5 | Open the planner and a plan with live issues; drag preview (`POST /plans/{id}/issues/drops`); drop, save and re-check; alternate flows of the save (429 retry) |
| [UC-09 Share or export a plan](UC-09-share-or-export-a-plan.md) (and UC-16) | F9 | Open the Share dialog, create/update or stop a link (`GET`, `PUT`, `DELETE /plans/{id}/share`); open a shared plan (`GET /shared-plans/{token}`) and Print/PDF; plan and account deletion stopping links |
| [UC-10 Follow a school-task guide](UC-10-follow-a-school-task-guide.md) | F11 | Browse and search the guides; read one guide |
| [UC-11 Maintain curriculum](UC-11-maintain-curriculum.md) (and UC-17, UC-18) | F12 | Open `/admin` and maintain curriculum/rules under the F12 write lock; shared catalog edit with impact confirmation; CSV preview and confirm; access bootstrap and grants |
| [UC-12 Receive notifications](UC-12-receive-notifications.md) | F10 | Scheduled school-date notifications (`NotificationSchedule`); transactional `transcript_changed` hook; unread badge polling, `/notifications` inbox and marking read |
| [UC-14 Manage account and privacy](UC-14-manage-account-and-privacy.md) | F1, privacy NFR | Export the account; ask for the deletion; the grace period and the purge |

Not drawn separately yet: onboarding (`GET` and `PUT /api/users/me/onboarding`, UC-01 steps 6–10) and the student calendar view (`GET /api/academic-calendar`). Which use cases have code is in the [README feature table](../../../README.md#what-is-built).

The diagrams are Mermaid blocks, which GitHub renders. To check that every block parses, render a file with the Mermaid CLI from a folder outside the repository: `npx -y @mermaid-js/mermaid-cli@12.2.0 -i <file>.md -o out.md`.
