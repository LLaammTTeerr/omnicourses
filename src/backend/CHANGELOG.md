# @omnicourse/backend

## 0.5.3

No changes in this release.

## 0.5.2

### Patch Changes

- [#182](https://github.com/LLaammTTeerr/omnicourses/pull/182) [`b3b01c6`](https://github.com/LLaammTTeerr/omnicourses/commit/b3b01c635ecd518664650d8e9547e1c38c674dba) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - When the hourly account purge fails, the server log now names only the kind of failure, never a database message that can quote a student's data.

## 0.5.1

### Patch Changes

- [`50f6ce2`](https://github.com/LLaammTTeerr/omnicourses/commit/50f6ce2c1ae665045f1ed0ad579782f17217c390) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - The account export now writes a school date as the day it holds ("2026-11-25"), not as the evening before in UTC ("2026-11-24T17:00:00.000Z").

- [#179](https://github.com/LLaammTTeerr/omnicourses/pull/179) [`9094df3`](https://github.com/LLaammTTeerr/omnicourses/commit/9094df34c9b3b8a471a429893274144df9a60fce) Thanks [@Anhdung1478](https://github.com/Anhdung1478)! - A text field with a null character, or one character too long once an emoji style mark is counted, is now refused with a 400 instead of failing with a 500: plan names, transcript course names, the sign-up display name, catalog courses, requirement groups, calendar events and the calendar's program filter. A program code with a null character in the curriculum page's address is a 404.

## 0.5.0

### Minor Changes

- [#147](https://github.com/LLaammTTeerr/omnicourses/pull/147) [`2363714`](https://github.com/LLaammTTeerr/omnicourses/commit/2363714172efd087340bdd76b2d885a4972c163f) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Catalog maintainers and program administrators can now enter many courses, or many course-to-group links, from one CSV file: the API previews what each row would add or change, lists every bad row by its number, and saves the whole file only after confirmation, or nothing.

- [#161](https://github.com/LLaammTTeerr/omnicourses/pull/161) [`bd1d46e`](https://github.com/LLaammTTeerr/omnicourses/commit/bd1d46e6267a3294d6874a4207063fb3e6195908) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Access managers can now create a program, and program administrators can edit their program's names and faculty and add or edit its cohorts, through the administration API. A new cohort starts empty and changes nothing in the other cohorts.

- [#148](https://github.com/LLaammTTeerr/omnicourses/pull/148) [`684f148`](https://github.com/LLaammTTeerr/omnicourses/commit/684f1486a93b0840c40332922ce51bd9959bc7d5) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Add the administration screens: a program administrator edits a cohort's requirement groups, courses, prerequisites and offering terms, a catalog maintainer maintains the shared course catalog, an access manager grants and revokes permissions by user ID, and Settings shows your user ID to copy.

- [#156](https://github.com/LLaammTTeerr/omnicourses/pull/156) [`c1701b9`](https://github.com/LLaammTTeerr/omnicourses/commit/c1701b9c4474ebd7c5b0f31aaf464b5420fc5091) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Notification inbox API: a student gets a notification 7 days before a registration window of their program opens, on the day it opens, on the first day of a term, and each time they save a transcript that differs from the saved one; they can list the notifications, see how many are unread and mark them read.

- [#153](https://github.com/LLaammTTeerr/omnicourses/pull/153) [`e669a0b`](https://github.com/LLaammTTeerr/omnicourses/commit/e669a0b579bf24126070e03b2013131d1e4d7d88) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Share a plan with a read-only link: the API creates, shows and stops the link of a plan, and anyone who holds the link can read the plan without signing in. The reader never gets grades, the email, transcript rows or other plans, and gets the checks that come from the transcript only when the owner chooses to show them.

### Patch Changes

- [#165](https://github.com/LLaammTTeerr/omnicourses/pull/165) [`e7bd617`](https://github.com/LLaammTTeerr/omnicourses/commit/e7bd61715c048906ceb6467e6e4baee8af990b36) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - The API description of the two administration reads (programs and grants) now lists only the answers they can give.

- [#172](https://github.com/LLaammTTeerr/omnicourses/pull/172) [`72ae3f1`](https://github.com/LLaammTTeerr/omnicourses/commit/72ae3f16161e6a334ade8996a9f4bd3b2415b5d1) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Deleting a requirement group that saved plans still use now answers 409 `referenced_item` ("Saved plans use the group") instead of a server error, and the group stays.

- [#169](https://github.com/LLaammTTeerr/omnicourses/pull/169) [`8bcc498`](https://github.com/LLaammTTeerr/omnicourses/commit/8bcc498585c42b2b44396a629c3eef96ab1dbf32) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - A new plan, or a copy of one, can only use a program and cohort that onboarding offers; plans saved earlier on another cohort still open.

## 0.4.0

### Minor Changes

- [#108](https://github.com/LLaammTTeerr/omnicourses/pull/108) [`d8a18ea`](https://github.com/LLaammTTeerr/omnicourses/commit/d8a18ea139e4750f1fd90d1ede3c3dc5dd815eaa) Thanks [@rakun68](https://github.com/rakun68)! - School dates for each program: every signed-in student can read the term, registration, add/drop, exam and holiday dates of their program, and the program's administrator can add, change and remove them.

- [#111](https://github.com/LLaammTTeerr/omnicourses/pull/111) [`fd1f1ce`](https://github.com/LLaammTTeerr/omnicourses/commit/fd1f1cefa69107882be3c7535cbd28aa1847d6d6) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - APCS courses are now recorded as having no prerequisite, except Capstone Project II (CS470), which needs Capstone Project I (CS469) as the curriculum prints. The planner checks them instead of listing them as "not recorded yet", and the curriculum explorer shows each course's prerequisites; offering terms are still not recorded.

- [#112](https://github.com/LLaammTTeerr/omnicourses/pull/112) [`e20bdc1`](https://github.com/LLaammTTeerr/omnicourses/commit/e20bdc1b792ccedb3b652a70ee938b0bbbd1d428) Thanks [@Anhdung1478](https://github.com/Anhdung1478)! - Two school task guides are now published, checked on the portals: "Your school accounts and portals" and "View your grades". "Register for courses" and "Pay tuition" stay hidden until their remaining portal steps can be checked.

### Patch Changes

- [#100](https://github.com/LLaammTTeerr/omnicourses/pull/100) [`acb7a58`](https://github.com/LLaammTTeerr/omnicourses/commit/acb7a582cd0ca4aa1995db8c71d666d90fd3e05d) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - A catalog maintainer can no longer delete a course that a student's saved plan still places; the delete is refused with the plan placements listed as references.

- [#105](https://github.com/LLaammTTeerr/omnicourses/pull/105) [`7abf8e6`](https://github.com/LLaammTTeerr/omnicourses/commit/7abf8e6170a200758a8adb1f64f3363f7ce320a6) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - A plan's coverage now counts a course placed in a term the transcript already has it in once, by the transcript's own result and credits.

## 0.3.0

### Minor Changes

- [#79](https://github.com/LLaammTTeerr/omnicourses/pull/79) [`bea7ee2`](https://github.com/LLaammTTeerr/omnicourses/commit/bea7ee20dfd213d57ba81d6a2ca42bda621906ef) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - The degree audit no longer reports credits still to go for a group it counts as met, keeps a failed or in-progress course's own status in every group that needs it (so the planner names it as missing there too), no longer lists a group with no minimum of its own as a graduation condition met, and gives both credit figures with a credits_differ warning.

- [#74](https://github.com/LLaammTTeerr/omnicourses/pull/74) [`4a97fa7`](https://github.com/LLaammTTeerr/omnicourses/commit/4a97fa7a22b5e4035a3b2cdd6c297703d2d6a9eb) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Curriculum administration API (F12): program, catalog and access grants with an operator bootstrap, requirement groups and course links, per-curriculum prerequisites (cycles refused) and offering terms, a confirmed shared-course change, and prerequisites/offering terms on the curriculum read API (null when not recorded).

- [#66](https://github.com/LLaammTTeerr/omnicourses/pull/66) [`df6427b`](https://github.com/LLaammTTeerr/omnicourses/commit/df6427bc993904b1c762593ab330a6312cd6025c) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Students can save and read their onboarding answers (`GET` and `PUT /api/users/me/onboarding`): program and cohort (APCS 2024 or 2025), target graduation term, credits per term and internship term, each optional until they finish.

- [#78](https://github.com/LLaammTTeerr/omnicourses/pull/78) [`e8fbdb4`](https://github.com/LLaammTTeerr/omnicourses/commit/e8fbdb48e111f05e002a1b5d7b6f3c8a81b10f83) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - A plan now shows its issues live: prerequisites, offering terms, credit caps, repeated or already passed courses and what is left to cover, each with its regulation clause, and unrecorded data as unknown.

- [#90](https://github.com/LLaammTTeerr/omnicourses/pull/90) [`37b8e45`](https://github.com/LLaammTTeerr/omnicourses/commit/37b8e45725202449dc4f9fc820eb43c53f9b72f2) Thanks [@rakun68](https://github.com/rakun68)! - The planner opens straight into a plan (a "Default plan" is made for a student who has none), with a link back to the plan list. Plans can be made from the tabs with a name, deleted beside their tab, and locked against accidental changes. The plan list shows each plan's terms and courses and opens from anywhere on its card. Removing a course no longer jumps to the top of the page, the drag preview keeps working after many drags, tooltips are white with black text, and dropdowns drop down.

- [#90](https://github.com/LLaammTTeerr/omnicourses/pull/90) [`37b8e45`](https://github.com/LLaammTTeerr/omnicourses/commit/37b8e45725202449dc4f9fc820eb43c53f9b72f2) Thanks [@rakun68](https://github.com/rakun68)! - The planner moves closer to its prototype: while a course is dragged or lifted, each term says before the drop what the rule engine would report there and what its load would be (new `POST /plans/{id}/issues`, which saves nothing); the page scrolls near its edges and tiles glide to their new place; Undo (Ctrl+Z), What-if (a copy to try changes on) and plan tabs sit above a status strip with the expected graduation term and each group's credits; the course tray is a grid of tiles with group filters and elective slots; terms already taken and the courses in progress now are shown; each term row puts its load and labelled meter beside its tiles; tiles show their group, a grade from an earlier attempt and a "!" on a violation; and the issues panel collapses, gives each issue a short title, and counts the groups still short instead of listing them.

- [#90](https://github.com/LLaammTTeerr/omnicourses/pull/90) [`37b8e45`](https://github.com/LLaammTTeerr/omnicourses/commit/37b8e45725202449dc4f9fc820eb43c53f9b72f2) Thanks [@rakun68](https://github.com/rakun68)! - The drag preview asks about every term in one request (`POST /plans/{id}/issues/drops`), so it stays within the rate limit. A drop whose rule cannot be checked says "Not checked" instead of looking fine, and a drop that breaks a rule in another term shows as a bad drop. The status strip shows the rule engine's graduation status as it reports it. Passed courses stay in the tray, marked, since a retake is allowed. The issues panel no longer says "no problem" while a group is still short.

- [#71](https://github.com/LLaammTTeerr/omnicourses/pull/71) [`463f6c9`](https://github.com/LLaammTTeerr/omnicourses/commit/463f6c991b931ec0a00ef547f7b24d7978b42c3d) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Students can keep several plans, each placing courses or elective slots into terms, with create, rename, duplicate, delete and a whole-board save.

- [#72](https://github.com/LLaammTTeerr/omnicourses/pull/72) [`2cd352c`](https://github.com/LLaammTTeerr/omnicourses/commit/2cd352cb5c66a02eea6e63f1e6c52d300cb82348) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Add the degree audit (`GET /api/users/me/audit`): requirement coverage per group, credits, GPA per term and overall, credit-cap checks by training type, and graduation status with the conditions the data cannot check, all computed by the deterministic rule engine.

## 0.2.0

### Minor Changes

- [#14](https://github.com/LLaammTTeerr/omnicourses/pull/14) [`488aa80`](https://github.com/LLaammTTeerr/omnicourses/commit/488aa808fe38c499cf02e5442bb61d5dba9a296a) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Students can download everything OmniCourse holds about them (`GET /api/users/me/export`) and delete their account (`DELETE /api/users/me`, password required). Deletion signs them out everywhere and completes after 30 days; signing in before then cancels it.

- [#12](https://github.com/LLaammTTeerr/omnicourses/pull/12) [`1a53b41`](https://github.com/LLaammTTeerr/omnicourses/commit/1a53b413e5b71ad08b606f3dd38e8c58e8c66b21) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Add the AI gateway (`LlmService`): typed `structured()` replies and streamed `chat()` with tools through OpenRouter, a per-user daily cap, and a clear 503 `ai_unavailable` when the model can't answer.

- [#36](https://github.com/LLaammTTeerr/omnicourses/pull/36) [`38f06ac`](https://github.com/LLaammTTeerr/omnicourses/commit/38f06ac8610335dae7a69ca9234ca5fa9857c000) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Seed the APCS 2024 and 2025 curricula and the nine CLC 2025 specialisations, with their requirement groups and courses, using `npm run db:seed`.

- [#65](https://github.com/LLaammTTeerr/omnicourses/pull/65) [`9a42280`](https://github.com/LLaammTTeerr/omnicourses/commit/9a42280603ea0f48aba332649dfb50c53250ef5b) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Signed-in students can read the programs, a cohort's curriculum with its requirement groups and courses, and any catalog course (`GET /api/programs`, `GET /api/programs/{program}/curricula/{cohort}`, `GET /api/courses/{code}`).

- [#54](https://github.com/LLaammTTeerr/omnicourses/pull/54) [`a8bd0c9`](https://github.com/LLaammTTeerr/omnicourses/commit/a8bd0c9830e1a166922f2ac150e8c8d2c8727cac) Thanks [@Anhdung1478](https://github.com/Anhdung1478)! - Add the guides pages: anyone can browse, search and read the school-task guides in Vietnamese or English without signing in. The first four guides stay drafts until they are checked on the portals.

- [#29](https://github.com/LLaammTTeerr/omnicourses/pull/29) [`45a58e2`](https://github.com/LLaammTTeerr/omnicourses/commit/45a58e2e050819c2a55c26a3ebba54262803914d) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Students can save their transcript (`PUT /api/users/me/transcript`) and read it back (`GET /api/users/me/transcript`): course, credits, term and result (a grade, in progress, exempt, pass or fail) for each course taken, with retakes kept as separate rows.

### Patch Changes

- [#56](https://github.com/LLaammTTeerr/omnicourses/pull/56) [`2784c37`](https://github.com/LLaammTTeerr/omnicourses/commit/2784c371fc4065a4e54e39c736de1f25ab163645) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - A blank or invalid `SESSION_TTL_DAYS` or `PORT` now falls back to its default (7 days, port 3000) instead of signing everyone out at once or picking a random port.

- [#59](https://github.com/LLaammTTeerr/omnicourses/pull/59) [`a7dd2c5`](https://github.com/LLaammTTeerr/omnicourses/commit/a7dd2c5e6cc18cca8bec75798d5f15000771e0fa) Thanks [@Anhdung1478](https://github.com/Anhdung1478)! - The API docs now describe the sign-in token as an opaque bearer token instead of a JWT.

- [#63](https://github.com/LLaammTTeerr/omnicourses/pull/63) [`99cd0ad`](https://github.com/LLaammTTeerr/omnicourses/commit/99cd0adf39f9d75eed3e54ea4fede29743660d3f) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Security pass fixes: two sign-ups with the same email now answer 409 instead of 500, the health check no longer reveals the database version, the API docs are hidden in production, and responses no longer advertise Express.

- [#62](https://github.com/LLaammTTeerr/omnicourses/pull/62) [`e47b7be`](https://github.com/LLaammTTeerr/omnicourses/commit/e47b7be5672c92749fafce9a22b43c2c3af76261) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Behind a reverse proxy, rate limits now count each visitor separately (`TRUST_PROXY`), and the API can listen on one interface only (`LISTEN_HOST`).

- [#58](https://github.com/LLaammTTeerr/omnicourses/pull/58) [`402166c`](https://github.com/LLaammTTeerr/omnicourses/commit/402166c2053c0c3de76725be8a4aa7f801fbc84e) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Internal restructuring of the account, AI gateway, guides and seed code; no API change.

- [#23](https://github.com/LLaammTTeerr/omnicourses/pull/23) [`900b1b8`](https://github.com/LLaammTTeerr/omnicourses/commit/900b1b82169686813f3a4a7e82d4a1aa4ade5f05) Thanks [@VoNguyenMinhTriet](https://github.com/VoNguyenMinhTriet)! - Created a simple schema for storing course information. No data has been added so far.
  This is still incomplete, so accesses should be via a view, so that the internals can be more easily modified.

## 0.1.0

### Minor Changes

- [#8](https://github.com/LLaammTTeerr/omnicourses/pull/8) [`c3c527c`](https://github.com/LLaammTTeerr/omnicourses/commit/c3c527c45222652d593917297bb6c1a33b37610b) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Add email and password sign-up and sign-in with rotating, revocable sessions (`/api/auth/*`, `/api/users/me`). Every API route now requires a bearer token unless marked public.
