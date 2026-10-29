# Elaboration test plan

- Owner: Thắng
- Version: 0.1, draft for review
- Date: 29 October 2026
- Covers: Sprint 2 (B0, 1 November) and Sprint 3 (B1, 15 November)
- Reviewers: Dũng for test runs and reports, feature owners for expected results, and Lâm for build acceptance and scope

## 1. Purpose

This plan explains what the team will test before accepting B0 and B1. B0 must provide a working app with sign-in. B1 adds the curriculum data and the first features that use it.

Thắng owns this plan, the shared test tools and the acceptance checks. Dũng writes detailed test cases, reruns them on each build to check for regressions, and writes the reports. Each feature owner maintains tests for their own code.

The plan follows the Project Lead's Work Breakdown dated 23 October 2026, [AGENTS.md](../../AGENTS.md), [CONTRIBUTING.md](../../CONTRIBUTING.md) and the accepted [ADRs](../analysis-and-design/adr/). The use cases in [PR #16](https://github.com/LLaammTTeerr/omnicourses/pull/16), [UC-11](../requirements/use-cases/UC-11-maintain-curriculum.md) and the project plan in [PR #20](https://github.com/LLaammTTeerr/omnicourses/pull/20) are still drafts. Resolve differences before approving the build requirements. This plan proposes the acceptance checks; it does not report that any test has passed.

## 2. What we will test

### B0: a working app

- **Accounts:** sign-up with consent, sign-in, protected API routes, session listing, refresh, removal and sign-out. Test both successful and rejected requests against PostgreSQL.
- **Screens:** sign-up and sign-in use the real API, the backend interface called by the app. At least one automated test signs in through a real browser. Check error messages, reloads, sign-out, keyboard use and screen widths from 360 to 1920 px.
- **Deployment:** the database can be created from the merged migrations, and the running website reaches the API and database. Record the website URL and the tested commit, tagged B0. Uploading build files alone does not prove the website works.

Google sign-in was planned for Sprint 2 but is not built yet. Lâm must decide whether it remains required for B0. Record that decision and any other scope changes before acceptance.

### B1: curriculum and planning foundations

- **Academic features:** the rule engine, degree audit and curriculum explorer use APCS data checked against the official source.
- **Accounts:** onboarding and account export/deletion follow their agreed requirements.
- **Plans:** a student can keep several plans. The plans API supports them, and the basic planner shows terms and lets the student add or remove courses.
- **Guides and curriculum administration:** guide search/browse and the curriculum administration API follow their agreed requirements.
- **AI gateway:** test its structured-data and chat operations, fake implementation and unavailable response without calling a live provider. Its goal-box and advisor screens come later.

Drag-and-drop, live plan validation, plan comparison, transcript parsing, notifications, sharing, the goal box, advisor chat, administration screens and the full performance tests belong to the later Construction plan. The administration API can be tested before its screens exist. Curriculum PDF import also belongs to Construction (B2), following Thắng's scope confirmation on 29 October; [UC-12](../requirements/use-cases/UC-12-import-curriculum-pdf.md) defines the draft workflow and records the ADR 0003 wording that still needs alignment.

## 3. How we test and who does it

| Test level | What it checks | Owner | What to record |
| --- | --- | --- | --- |
| Unit and component | Individual functions and UI components, including limits and failures, using Vitest. | Feature owners; Thắng maintains shared tools. | Results for the tested commit. Every bug fix includes a regression test. |
| API and database | Real NestJS requests against a separate PostgreSQL 18.6 test database. Check permissions, migrations, database constraints and complete saves. | Backend feature owners; Triết reviews migrations. | E2e results, including rejected requests and failed saves. |
| Browser | Sign-in through the actual screen and API using Vitest browser mode. A test with a mocked API does not replace this journey. | Thắng sets up the browser tests; Hoà supplies the screens. | Results, browser version, and frontend/backend commit. |
| Regression and usability | Rerun the agreed cases; check keyboard use, VI/EN text, different screen sizes and recovery from failures. For B1, check WCAG 2.1 AA contrast. | Dũng runs cases and reports results; owners fix defects. | Case results, defects and B1 contrast measurements. |
| Data and acceptance | Compare APCS data with its source and check whether the build meets section 7. | Thắng prepares data and acceptance findings; Triết checks the data; Lâm decides exceptions. | Source version, data-review result and acceptance decision. |

The browser test setup still needs its own PR. That PR must choose and pin the browser provider and dependencies, add run commands, and connect them to CI. Keep the existing tests when adding browser tests.

## 4. Test environments and data

### Environments

- **Local:** use Node 22.22.1, npm 11.21.1, the repository lockfile and PostgreSQL 18.6 in Podman or Docker. Use a separate database for tests.
- **CI:** GitHub runs the backend and frontend checks defined in [ci.yml](../../.github/workflows/ci.yml). Browser tests and the rules coverage check still need to be added.
- **Staging:** use the test website selected by Lâm. Record its UI/API URLs, deployed commit, applied database migrations and build tag.

Never run tests against a live student database. Keep credentials in local environment settings or CI secrets, away from reports and committed files. Use a disposable database and keep each run's data separate. Ask before manually recreating a database or deleting data.

### Data and expected results

- Use made-up accounts, transcripts and plans. Keep real student names, IDs, transcripts and portal credentials out of fixtures, prompts and logs.
- Record the official APCS source and the program/cohort it covers. Thắng enters the data; Triết checks its courses, credits, prerequisites, requirement groups and offering terms. Leave unknown values unresolved until the source or owner answers them. Do not ask AI to fill them in.
- Use small, made-up curricula for focused tests, including two cohorts and a course shared by several groups. Label these clearly so they are not confused with official APCS data.
- Work out expected academic results from official rules and reviewed examples, then have Triết check them. Do not invent pass marks, GPA rules or rules for counting credits. Do not use the rule engine's own answer as the only proof that it is correct.
- Use fake model replies in automated gateway tests. CI makes no paid AI calls. Any authorised live-provider check is separate; rule-engine tests do not depend on it.

## 5. Required checks

These checks guide Dũng's detailed cases and the feature owners' automated tests. They still need to be implemented and run.

### B0 checks

| Area | Cases to cover |
| --- | --- |
| Sign-up and sign-in (F1, UC-01) | Successful requests; missing consent; invalid fields; duplicate email; wrong password or unknown email; too many attempts. |
| Sessions (ADR 0002) | Missing or expired token; list your own sessions; refresh makes the old token unusable; revoke your own session; refusal to revoke another user's session; sign-out. |
| Screens (issue #13) | Sign in through the browser and real API. Show incorrect-credential errors clearly. Restore or refresh sign-in after reload, return to sign-in if refresh is rejected, and clear access on sign-out. Check keyboard use and VI/EN text. |
| Database and API | Start with an empty test database and apply migrations. Test cohort and course/group constraints. Check that health reaches PostgreSQL and that the OpenAPI documentation loads. |
| Deployed build | The website reaches the API. The deployed, tested and tagged commits match. |

### B1 checks

| Area | Cases to cover |
| --- | --- |
| Academic features (F3–F4) | Met/unmet prerequisites; allowed/disallowed offering terms; credit-cap limits; empty/partial transcripts; requirement coverage; credits and GPA under the agreed rules; explorer links and graph; separate results for different cohorts. |
| Plans (UC-05) | Create, list, read and update several plans for one student. Refuse another student's access. Add/remove a course through the basic planner and check that the change is saved. |
| Accounts and guides | Onboard to a supported program/cohort. Export the account without secrets or another student's data. Check the agreed deletion process and guide search/browse. |
| Curriculum administration (UC-11) | Allow authorised edits and refuse writes to another program. Add a second cohort without changing the first (A1). Reject duplicate codes and links to missing items (A3). A failed save stores no partial change; an unknown result is not reported as success (A7). |
| AI gateway (ADR 0003) | Check structured-data and chat operations, fake replies and the unavailable response. |

### Coverage and speed

The `rules` module must have at least **80% statement coverage**: automated tests must execute at least 80% of its production statements. Count all production files in that module, including files no test reaches. Exclude tests, generated files and other backend modules. CI must fail below 80%. Thắng adds this check in Sprint 3 when the rules module exists.

For B1, the degree audit must load in **under two seconds for a made-up 40-course transcript**. Agree with Triết and Hoà where timing starts and ends. Record the environment, dataset, number of runs and results. The later Construction plan covers validation under 300 ms and plan generation under 30 seconds.

## 6. Running tests and reporting results

Once the required Node/npm versions, dependencies and test database are ready, run the existing commands:

```powershell
npm run typecheck
npm test
npm run build
npm run test:e2e -w src/backend
npm run openapi -w src/backend
```

The e2e command needs `DATABASE_URL` set to the test database. OpenAPI export needs the backend build first. Investigate failed commands before reporting success. Add the browser and coverage commands here once their PRs merge.

Dũng's report records the build tag and commit, environment, test-case IDs, expected and actual results, and any linked defects. Mark each case **passed**, **failed**, **blocked** or **not run**. A skipped or blocked case never counts as passed. Thắng checks the report against the acceptance criteria.

File defects as GitHub issues linked from the Discord Sprint task, following [the issue-tracker guide](../agents/issue-tracker.md). Include steps to reproduce, made-up inputs, expected/actual results and the affected build. Keep secrets out. The feature owner fixes the defect and adds a regression test; Dũng retests it.

## 7. When a build is ready

### Before acceptance testing

- Identify the exact commit and the features the build must include. Resolve assumptions or list them for review.
- Merge the required code and migrations. Make sure the test environment and data are ready.
- Have automated test results for that commit and an owner for each detailed test case.
- For B1 academic features, have Triết check both the APCS data and the expected results.

Other tests can run earlier. If a screen, staging site or verified dataset is missing, mark only the tests that need it as blocked, with an owner.

### Proposed acceptance criteria

- Typecheck, unit/component tests, build and backend e2e checks pass for the candidate commit. Required tests are not weakened or quietly skipped.
- All required cases pass, including B0's browser sign-in and checks on the deployed website. B1 also meets the rules coverage, audit speed and WCAG 2.1 AA contrast requirements.
- No open defect exposes another user's or program's protected data, loses stored data, gives a known wrong academic result or blocks a required user task.
- Smaller defects have an owner and a recorded decision. Lâm must approve any exception or scope reduction. Keep the original failed or blocked result in the report.
- The report identifies the deployed commit and tag. Thắng records the acceptance findings, Dũng supplies the regression results, and Lâm decides whether to release or submit the build.

### When to stop and resume

Stop affected tests if the environment is unreliable, migrations fail, test data is damaged or a required interface is missing. Keep the evidence and identify the owner. Resume after the cause is fixed, the environment and data are restored, and basic checks pass. Then rerun the affected cases.

## 8. Schedule and remaining work

| Due date | Thắng's work | What it needs |
| --- | --- | --- |
| 29 October | UC-11, UC-12 and this test-plan draft. | Team review and alignment of the confirmed UC-12 scope with the use-case model and ADR 0003. |
| 1 November, B0 | Browser tests with a sign-in journey; B0 acceptance check. | Hoà's screen ([#13](https://github.com/LLaammTTeerr/omnicourses/issues/13)), Triết's schema ([#23](https://github.com/LLaammTTeerr/omnicourses/pull/23)), Lâm's staging site and Dũng's cases. |
| 8 November | APCS seed data checked by Triết. | Official source documents and the agreed database structure. Data entry can start before database integration. |
| 15 November, B1 | Rules coverage check, administration API tests, B1 acceptance check and the Construction test-plan update. | The rules module, curriculum read API, permission decisions and B1 features. |

On 29 October, `main` has backend unit/API tests and frontend `jsdom` component tests, which simulate a browser environment. It still needs real-browser tests, the rules module and coverage check, and APCS seed data. Writing this plan does not complete those tasks.
