# @omnicourse/frontend

## 0.3.0

### Minor Changes

- [#90](https://github.com/LLaammTTeerr/omnicourses/pull/90) [`37b8e45`](https://github.com/LLaammTTeerr/omnicourses/commit/37b8e45725202449dc4f9fc820eb43c53f9b72f2) Thanks [@rakun68](https://github.com/rakun68)! - Every select now opens the app's own styled list (keyboard and screen reader friendly), and every tooltip uses the app's own style instead of the browser's.

- [#90](https://github.com/LLaammTTeerr/omnicourses/pull/90) [`37b8e45`](https://github.com/LLaammTTeerr/omnicourses/commit/37b8e45725202449dc4f9fc820eb43c53f9b72f2) Thanks [@rakun68](https://github.com/rakun68)! - The planner opens straight into a plan (a "Default plan" is made for a student who has none), with a link back to the plan list. Plans can be made from the tabs with a name, deleted beside their tab, and locked against accidental changes. The plan list shows each plan's terms and courses and opens from anywhere on its card. Removing a course no longer jumps to the top of the page, the drag preview keeps working after many drags, tooltips are white with black text, and dropdowns drop down.

- [#90](https://github.com/LLaammTTeerr/omnicourses/pull/90) [`37b8e45`](https://github.com/LLaammTTeerr/omnicourses/commit/37b8e45725202449dc4f9fc820eb43c53f9b72f2) Thanks [@rakun68](https://github.com/rakun68)! - Planner looks and moves like the prototype: a course follows the pointer while dragged (the page still scrolls with the wheel), a bin takes a placed course back to the list, the credit meters and issue count animate, a refused rule makes the course shake, issues link to the regulation and to their course, and each course already taken opens in the curriculum explorer.

- [#90](https://github.com/LLaammTTeerr/omnicourses/pull/90) [`37b8e45`](https://github.com/LLaammTTeerr/omnicourses/commit/37b8e45725202449dc4f9fc820eb43c53f9b72f2) Thanks [@rakun68](https://github.com/rakun68)! - The planner moves closer to its prototype: while a course is dragged or lifted, each term says before the drop what the rule engine would report there and what its load would be (new `POST /plans/{id}/issues`, which saves nothing); the page scrolls near its edges and tiles glide to their new place; Undo (Ctrl+Z), What-if (a copy to try changes on) and plan tabs sit above a status strip with the expected graduation term and each group's credits; the course tray is a grid of tiles with group filters and elective slots; terms already taken and the courses in progress now are shown; each term row puts its load and labelled meter beside its tiles; tiles show their group, a grade from an earlier attempt and a "!" on a violation; and the issues panel collapses, gives each issue a short title, and counts the groups still short instead of listing them.

- [#92](https://github.com/LLaammTTeerr/omnicourses/pull/92) [`18a31c5`](https://github.com/LLaammTTeerr/omnicourses/commit/18a31c5769ccc85dfbec45f888d639803436cbe1) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - A privacy notice at /privacy, in Vietnamese and English and readable without signing in, says what OmniCourse stores, how long it keeps it, how to export or delete it, what backups hold and what AI may send; sign-up links it beside the consent box.

- [#79](https://github.com/LLaammTTeerr/omnicourses/pull/79) [`bea7ee2`](https://github.com/LLaammTTeerr/omnicourses/commit/bea7ee20dfd213d57ba81d6a2ca42bda621906ef) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - See where you stand after onboarding: a dashboard with your graduation status, credits, each requirement group's progress and the conditions still unmet, and a degree audit page with every group's courses, what is missing and the regulation clause each condition cites. On a phone, the tab bar shows Dashboard, Plans, Audit and Curriculum, and a More menu holds Transcript, Guides and Settings.

- [#76](https://github.com/LLaammTTeerr/omnicourses/pull/76) [`949501f`](https://github.com/LLaammTTeerr/omnicourses/commit/949501f060083d4776f8e26a83ab7eb188e37e27) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Tell OmniCourse your program, cohort and goals in a short onboarding (and change them later in Settings), then browse your curriculum by requirement group and search its courses.

- [#80](https://github.com/LLaammTTeerr/omnicourses/pull/80) [`4de07e7`](https://github.com/LLaammTTeerr/omnicourses/commit/4de07e7441d2be79f005df295c458fa591a56149) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Planner (F5): a list of plans to create, rename, copy and delete, and an editor that places the student's curriculum courses into terms, moves them by button, keyboard or drag, saves through the plans API and shows the rule engine's issues on each course and term.

- [#70](https://github.com/LLaammTTeerr/omnicourses/pull/70) [`c96b47e`](https://github.com/LLaammTTeerr/omnicourses/commit/c96b47eccfbe94ee52cabea7732f582225e2b317) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Sign up, sign in and out, enter and review your transcript, and manage your sessions, theme, language, data export and account deletion, in a new app shell with light and dark themes.

### Patch Changes

- [#90](https://github.com/LLaammTTeerr/omnicourses/pull/90) [`37b8e45`](https://github.com/LLaammTTeerr/omnicourses/commit/37b8e45725202449dc4f9fc820eb43c53f9b72f2) Thanks [@rakun68](https://github.com/rakun68)! - The drag preview asks about every term in one request (`POST /plans/{id}/issues/drops`), so it stays within the rate limit. A drop whose rule cannot be checked says "Not checked" instead of looking fine, and a drop that breaks a rule in another term shows as a bad drop. The status strip shows the rule engine's graduation status as it reports it. Passed courses stay in the tray, marked, since a retake is allowed. The issues panel no longer says "no problem" while a group is still short.

- [#90](https://github.com/LLaammTTeerr/omnicourses/pull/90) [`37b8e45`](https://github.com/LLaammTTeerr/omnicourses/commit/37b8e45725202449dc4f9fc820eb43c53f9b72f2) Thanks [@rakun68](https://github.com/rakun68)! - A plan change that the server rate-limits is kept and sent again after a short wait, instead of being undone. A term whose drag preview could not be loaded says so, instead of showing no colour.

- [#81](https://github.com/LLaammTTeerr/omnicourses/pull/81) [`ee24ea5`](https://github.com/LLaammTTeerr/omnicourses/commit/ee24ea5f0a8023973fe8864f4a2e9bdff5c3ef44) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - A dialog whose request is still running can no longer be closed, by Escape or by going back, and says it is working; a request that gets no answer, guides included, fails after 30 seconds; plan actions run one at a time; a plan whose deletion finds it already gone leaves the list; a wrong password, or no answer, when deleting the account is now said in the dialog.

## 0.2.0

### Minor Changes

- [#54](https://github.com/LLaammTTeerr/omnicourses/pull/54) [`a8bd0c9`](https://github.com/LLaammTTeerr/omnicourses/commit/a8bd0c9830e1a166922f2ac150e8c8d2c8727cac) Thanks [@Anhdung1478](https://github.com/Anhdung1478)! - Add the guides pages: anyone can browse, search and read the school-task guides in Vietnamese or English without signing in. The first four guides stay drafts until they are checked on the portals.

### Patch Changes

- [#63](https://github.com/LLaammTTeerr/omnicourses/pull/63) [`99cd0ad`](https://github.com/LLaammTTeerr/omnicourses/commit/99cd0adf39f9d75eed3e54ea4fede29743660d3f) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - Security pass fixes: two sign-ups with the same email now answer 409 instead of 500, the health check no longer reveals the database version, the API docs are hidden in production, and responses no longer advertise Express.

- [#57](https://github.com/LLaammTTeerr/omnicourses/pull/57) [`697fa07`](https://github.com/LLaammTTeerr/omnicourses/commit/697fa071637e638d8c936f0728c0de02617466c7) Thanks [@LLaammTTeerr](https://github.com/LLaammTTeerr)! - The browser tab shows "OmniCourse" again when you go back to the home page from a guide.

## 0.1.0

No changes in this release.
