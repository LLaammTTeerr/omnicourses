# Elaboration test plan

- Owner: Thắng
- Version: 0.2, revised after PR #30 review
- Date: 29 October 2026
- Covers: Sprint 2 (B0, 1 November) and Sprint 3 (B1, 15 November)
- Reviewers: Dũng for test runs and reports, feature owners for expected results, and Lâm for build acceptance and scope

## 1. Purpose

This plan explains what the team will test before accepting B0 and B1. B0 must provide a working app with sign-in. B1 adds the curriculum data and the first features that use it.

Thắng owns this plan, the shared test tools and the acceptance checks. Dũng writes detailed test cases, reruns them on each build to check for regressions, and writes the reports. Each feature owner maintains tests for their own code.

The plan follows [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md) and the accepted [ADRs](../analysis-and-design/adr/). The use cases in [PR #16](https://github.com/LLaammTTeerr/omnicourses/pull/16), [UC-11](../requirements/use-cases/UC-11-maintain-curriculum.md) and the project plan in [PR #20](https://github.com/LLaammTTeerr/omnicourses/pull/20) are still drafts. For curriculum administration, this revision follows Lâm's review and [SDP v2 §4.2.1–4.2.3](https://github.com/LLaammTTeerr/omnicourses/blob/1e8d8c4623017738574812431dadd639d8bc4545/docs/management/software-development-plan.md#42-project-plan): the API and screens belong to B2, replacing the earlier Work Breakdown's B1 API target. This plan proposes acceptance checks; it does not report that any test has passed.

## 2. What we will test

### B0: a working app

- **Accounts:** sign-up with consent, sign-in, protected API routes, session listing, refresh, removal and sign-out. Test both successful and rejected requests against PostgreSQL.
- **Screens:** sign-up and sign-in use the real API, the backend interface called by the app. At least one automated test signs in through a real browser. Check error messages, reloads, sign-out, keyboard use and screen widths from 360 to 1920 px.
- **Deployment:** the database can be created from the merged migrations, and the running website reaches the API and database. Record the website URL and the tested commit, tagged B0. Uploading build files alone does not prove the website works.

Google sign-in is deferred until after B0 (Lâm, 29 Oct 2026); B0 covers email and password only.

### B1: curriculum and planning foundations

- **Academic features:** the rule engine, degree audit and curriculum explorer use APCS data checked against the official source.
- **Accounts:** onboarding and account export/deletion follow their agreed requirements.
- **Plans:** a student can keep several plans. The plans API supports them, and the basic planner shows terms and lets the student add or remove courses.
- **Guides:** guide search/browse follows the agreed requirements and Sprint 3 handoff.
- **AI gateway:** test its structured-data and chat operations, fake implementation and unavailable response without calling a live provider. Its goal-box and advisor screens come later.

Drag-and-drop, live plan validation, plan comparison, transcript parsing, notifications, sharing, the goal box, advisor chat, the curriculum administration API and screens, and the full performance tests belong to the later Construction plan. B1 uses manually prepared, verified APCS seed data. Curriculum PDF import remains excluded by ADR 0003; it is not a B0/B1 acceptance requirement or an approved B2 commitment.

## 3. How we test and who does it

| Test level | What it checks | Owner | What to record |
| --- | --- | --- | --- |
| Unit and component | Individual functions and UI components, including limits and failures, using Vitest. | Feature owners; Thắng maintains shared tools. | Results for the tested commit. Every bug fix includes a regression test. |
| API and database | Real NestJS requests against a separate PostgreSQL 18.6 test database. Check permissions, migrations, database constraints and complete saves. | Backend feature owners; Triết reviews migrations. | E2e results, including rejected requests and failed saves. |
| Browser | Sign-in through the actual screen and API using Vitest browser mode. A test with a mocked API does not replace this journey. | Thắng sets up the browser tests; Hoà supplies the screens. | Results, browser version, and frontend/backend commit. |
| Regression and usability | Rerun the agreed cases; check keyboard use, VI/EN text, different screen sizes and recovery from failures. Check WCAG 2.1 AA contrast against [Vision v1.0 §6, Usability](sources/vision-v1-nfr-excerpts.md#usability). | Dũng runs cases and reports results; owners fix defects. | Case results, defects and B1 contrast measurements. |
| Data and acceptance | Compare APCS data with its source and check whether the build meets section 7. | Thắng prepares data and acceptance findings; Triết checks the data; Lâm decides exceptions. | Source version, data-review result and acceptance decision. |

The Chromium browser smoke harness is in [PR #31](https://github.com/LLaammTTeerr/omnicourses/pull/31), merged on 29 October. It pins the provider, adds `npm run test:browser` and runs browser tests in CI, while preserving the existing tests. Its smoke tests mock HTTP; the real-API sign-in acceptance case still depends on [#13](https://github.com/LLaammTTeerr/omnicourses/issues/13). Setup and commands are in [browser-tests.md](https://github.com/LLaammTTeerr/omnicourses/blob/0d96bccbd3c2cd632cdede31dcd19a3b808fa898/docs/test/browser-tests.md).

## 4. Test environments and data

### Environments

- **Local:** use Node 22.22.1, npm 11.21.1, the repository lockfile and PostgreSQL 18.6 in Podman or Docker. Use a separate database for tests.
- **CI:** GitHub runs backend and frontend checks defined in [ci.yml](../../.github/workflows/ci.yml). PR #31 adds browser smoke tests; the rules coverage check still needs to be added.
- **Staging:** use the test website selected by Lâm. Record its UI/API URLs, deployed commit, applied database migrations and build tag.

Never run tests against a live student database. Keep credentials in local environment settings or CI secrets, away from reports and committed files. Use a disposable database and keep each run's data separate. Ask before manually recreating a database or deleting data.

### Data and expected results

- Use made-up accounts, transcripts and plans. Keep real student names, IDs, transcripts and portal credentials out of fixtures, prompts and logs.
- Record the official APCS source and the program/cohort it covers. Thắng enters the data; Triết checks its courses, credits, prerequisites, requirement groups and offering terms. Leave unknown values unresolved until the source or owner answers them. Do not ask AI to fill them in.
- Use small, made-up curricula for focused tests, including two cohorts and a course shared by several groups. Label these clearly so they are not confused with official APCS data.
- Work out expected academic results from official rules and reviewed examples, then have Triết check them. Do not invent pass marks, GPA rules or rules for counting credits. Do not use the rule engine's own answer as the only proof that it is correct.
- Use fake model replies in automated gateway tests. CI makes no paid AI calls. Any authorised live-provider check is separate; rule-engine tests do not depend on it.

## 5. Required checks

These checks guide Dũng's detailed cases and the feature owners' automated tests. They still need to be implemented and run. IDs follow `TC-<build>-<area>-<number>` and stay stable. Dũng adds preconditions, inputs and steps under that ID, using suffixes such as `TC-B0-AUTH-01a` for separate outcomes. Reports cite those case IDs and their parent requirement; an example row is not evidence that a test passed.

### B0 checks

| ID | Area | Cases to cover | Requirement / source |
| --- | --- | --- | --- |
| TC-B0-AUTH-01 | Sign-up and sign-in | Successful requests; missing consent; invalid fields; duplicate email; wrong password or unknown email; too many attempts. | F1; UC-01 (#16); ADR 0002 |
| TC-B0-SESS-01 | Sessions | Missing or expired token; list your own sessions; refresh makes the old token unusable; revoke your own session; refusal to revoke another user's session; sign-out. | F1; UC-01 (#16); ADR 0002 |
| TC-B0-UI-01 | Screens | Sign in through the browser and real API. Show incorrect-credential errors clearly. Restore or refresh sign-in after reload, return to sign-in if refresh is rejected, and clear access on sign-out. Check keyboard use and VI/EN text. | F1; UC-01 (#16); issue #13 |
| TC-B0-DB-01 | Database and API | Start with an empty test database and apply migrations. Test cohort and course/group constraints. Check that health reaches PostgreSQL and that the OpenAPI documentation loads. | ADR 0001, ADR 0002; F12 schema / ADR 0005 (#23); SDP §4.2.2 B0 |
| TC-B0-DEP-01 | Deployed build | The website reaches the API. The deployed, tested and tagged commits match. | SDP §4.2.2 B0 (#20); CONTRIBUTING.md §4 |

### B1 checks

| ID | Area | Cases to cover | Requirement / source |
| --- | --- | --- | --- |
| TC-B1-ACAD-01 | Academic features | Met/unmet prerequisites; allowed/disallowed offering terms; empty/partial transcripts; requirement coverage; credits and GPA under agreed rules; explorer links and graph; separate cohort results. For the APCS credit cap, main-term loads 13 and 26 are invalid, 14 and 25 are within the cap; summer 12 is within the cap and 13 exceeds it. Keep other rules satisfied in those boundary cases. | F3–F4; UC-03–04; AGENTS.md hard rule 1; SDP §2.2 (#20) |
| TC-B1-PLAN-01 | Plans | Create, list, read and update several plans for one student. Refuse another student's access. Add/remove a course through the basic planner and check that the change is saved. | F5; UC-05; SDP §4.2.3 plans API handoff (#20) |
| TC-B1-USER-01 | Accounts and guides | Onboard to a supported program/cohort. Export the account without secrets or another student's data. Check the agreed deletion process and guide search/browse. | F1, F11; UC-01, UC-10; SDP §4.2.2–4.2.3 (#20) |
| TC-B1-DATA-01 | Verified APCS seed data | Check source version, course codes, credits and curriculum links against the official source, with Triết's review. Check separate cohorts and shared catalog courses; keep missing prerequisites/offering terms unresolved until their handoff is complete. | F3–F4, F12; AGENTS.md hard rule 1; ADR 0003; ADR 0005 (#23) |
| TC-B1-AI-01 | AI gateway | Check structured-data and chat operations, fake replies and the unavailable response. | F6 goal box, F8; ADR 0003 |

Administration writes are B2 checks, not B1 release criteria. The [UC-11 example table](../requirements/use-cases/UC-11-maintain-curriculum.md#examples-to-test) defines `TC-B2-ADM-01` through `TC-B2-ADM-05` for the Construction plan, including global catalog permission and its effect on every linked curriculum.

### Coverage and speed

| ID | Check | Requirement / source |
| --- | --- | --- |
| TC-B1-COV-01 | The rules module has at least **80% statement coverage**. Count every production file, including files no test reaches; exclude tests, generated files and other modules. CI fails below 80%. | AGENTS.md §Testing; [Vision v1.0 §6, Testability and maintainability](sources/vision-v1-nfr-excerpts.md#testability-and-maintainability) |
| TC-B1-PERF-01 | Audit and dashboard load in **under two seconds with a synthetic 40-course transcript on a normal connection**. Agree the network profile and timing boundaries; record environment, dataset, run count and results. | F3 / UC-03; [Vision v1.0 §6, Performance](sources/vision-v1-nfr-excerpts.md#performance) |
| TC-B1-A11Y-01 | B1 screens support keyboard use, VI/EN, widths from 360 to 1920 px and **WCAG 2.1 AA contrast**. Record the tested screens and contrast measurements. | [Vision v1.0 §6, Usability](sources/vision-v1-nfr-excerpts.md#usability) |

Thắng adds the coverage gate in Sprint 3 when the rules module exists. The linked source excerpts identify the Vision version, revision date, exact §6 clauses and original file checksum. Dũng records measurement preconditions in the detailed cases with Triết and Hoà. The Construction plan covers validation under 300 milliseconds and plan generation under 30 seconds with visible progress, from the same Performance clause.

## 6. Running tests and reporting results

Once the required Node/npm versions, dependencies and test database are ready, run the existing commands:

```bash
npm run typecheck
npm test
npm run build
npm run test:e2e -w src/backend
npm run openapi -w src/backend
```

The e2e command needs `DATABASE_URL` set to the test database. OpenAPI export needs the backend build first. After including merged PR #31, install Chromium as described in its browser-test guide and run `npm run test:browser`. Investigate failed commands before reporting success. Add the coverage command when its PR merges.

Dũng's report records the build tag and commit, environment, test-case IDs, expected and actual results, and any linked defects. Mark each case **passed**, **failed**, **blocked** or **not run**. A skipped or blocked case never counts as passed. Thắng checks the report against the acceptance criteria.

File defects as GitHub issues linked from the Discord Sprint task, following [the issue-tracker guide](../agents/issue-tracker.md). Include steps to reproduce, made-up inputs, expected/actual results and the affected build. Keep secrets out. The feature owner fixes the defect and adds a regression test; Dũng retests it.

## 7. When a build is ready

### Before acceptance testing

- Identify the exact commit and the features the build must include. Resolve assumptions or list them for review.
- Merge the required code and migrations. Make sure the test environment and data are ready.
- Have automated test results for that commit and an owner for each detailed test case.
- For B1 academic features, have Triết check both the APCS data and the expected results.

Other tests can run earlier. If a staging site or verified dataset is missing, mark only the tests that need it as blocked; if a required feature is not merged, mark them not run. Give each an owner. B0's exceptions are listed under the acceptance criteria below.

### Proposed acceptance criteria

- Typecheck, unit/component tests, build and backend e2e checks pass for the candidate commit. Required tests are not weakened or quietly skipped.
- All required cases pass. For B0, two kinds of case do not count as failures (Lâm, 30 Oct 2026):
  - No staging site is chosen yet and `deploy.yml` only builds files, so cases that need a deployed server (such as TC-B0-DEP-01) are marked **blocked: no server yet**.
  - If the sign-in screens (#13) or the curriculum schema (#23) are not merged by 1 November, cases that need them (such as TC-B0-UI-01 and the cohort and course/group constraints in TC-B0-DB-01) are marked **not run: feature not merged** and move to B1.

  These cases do not count as passed either. The report lists each one with an owner, and they are carried to B1. B1 meets the rules coverage, audit/dashboard speed and usability requirements traced to Vision §6 in §5, including WCAG 2.1 AA contrast. Missing tests never count as passed by omission.
- No open defect exposes another user's or program's protected data, loses stored data, gives a known wrong academic result or blocks a required user task.
- Smaller defects have an owner and a recorded decision. Lâm must approve any exception or scope reduction. Keep the original failed or blocked result in the report.
- The report identifies the deployed commit and tag. Thắng records the acceptance findings, Dũng supplies the regression results, and Lâm decides whether to release or submit the build.

### When to stop and resume

Stop affected tests if the environment is unreliable, migrations fail, test data is damaged or a required interface is missing. Keep the evidence and identify the owner. Resume after the cause is fixed, the environment and data are restored, and basic checks pass. Then rerun the affected cases.

## 8. Schedule and remaining work

| Due date | Thắng's work | What it needs |
| --- | --- | --- |
| 29 October | UC-11 and this test-plan draft, with Vision NFR source excerpts. | Team review and agreed curriculum interfaces. PDF import is excluded under ADR 0003. |
| 1 November, B0 | Browser tests with a sign-in journey; B0 acceptance check. | Hoà's screen ([#13](https://github.com/LLaammTTeerr/omnicourses/issues/13)), Triết's schema ([#23](https://github.com/LLaammTTeerr/omnicourses/pull/23)), Lâm's staging site and Dũng's cases. |
| 8 November | APCS seed data checked by Triết. | Official source documents and the agreed database structure. Data entry can start before database integration. |
| 15 November, B1 | Rules coverage check, B1 acceptance check and the Construction test-plan update. | The rules module, curriculum read API, verified seed data and B1 features. The Construction plan carries the B2 administration cases from UC-11. |

On 29 October, `main` has backend unit/API tests, frontend `jsdom` tests and the Chromium smoke harness merged in #31. It still needs the real-API browser sign-in journey, rules module and coverage gate, and verified APCS seed data. Writing this plan does not complete those tasks.
