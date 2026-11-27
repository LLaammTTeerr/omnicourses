# B1 test report

- Owner: Dũng. Drafted by the Project Lead's coding agent, which leads B1 acceptance for Lâm, from two runs of 15 November 2026: its own scripted run on staging and on a local database, and Dũng's manual run on production ([`results-2026-11-15.md`](evidence/b1/results-2026-11-15.md), pull request #118). Where the two differ, §4 gives both.
- Build: B1 is tag `B1` on commit `1decf4a` (`1decf4a0bb63152955ee0ab3f39d33b357b292ab`, "chore(release): version packages (#69)", version 0.3.0). [Deploy run 43666848017](https://github.com/LLaammTTeerr/omnicourses/actions/runs/43666848017) (15 November 2026, 02:14 UTC) deployed that commit to production and created the tag.
- Tested commit: `7f66b7a` (`7f66b7a2c8c4a138aa713b90b264d89e4cef3e95`), which is B1 plus one commit that changes documents only. `git diff --stat 1decf4a 7f66b7a` lists two files, `.changeset/late-comics-bow.md` and `docs/test/test-cases-b1.md`; no file under `src/` differs. During both runs staging and production ran `7f66b7a`. Since about 07:35 UTC production runs a later commit, with the guide texts of #112 and documents; the `B1` tag is unchanged.
- Cases: [B1 test cases](test-cases-b1.md) v0.4 and the [B0 test cases](test-cases-b0.md) carried to B1 (B1 cases §8). Parent checks: [test plan §5](test-plan.md#5-required-checks).
- Runs: 15 November 2026. The scripted run, 03:02–03:31 UTC (10:02–10:31 in Vietnam), on staging, https://stag-omnicourses.lamter.cc, and on a local disposable database for the cases that §1 of the cases keeps off staging. Dũng's manual run, about 02:30–05:00 UTC, on production, https://omnicourses.lamter.cc, which served the same commit from 02:22 UTC. The scripted run tested nothing on production. After the decision, from 07:41:39 UTC, the test-only guide cases GUIDE-01i, j and k were tried on a local test database on the later commit `47e4ba3`; that changed no B1 result (§4).
- **Decision: B1 is accepted with exceptions** (Lâm, on Discord, 15 November 2026, 07:40 UTC). It was made on the figures this report gives: 127 passed, 12 failed, 12 blocked and 5 not run. The failed, blocked and not-run cases carry to B2 as §5 and §8 record. None of the failures is in the audit, data or rule checks.

## 1. Summary

156 detailed cases: 99 for B1 and the 57 B0 cases run again on B1.

| Result | Cases |
| --- | --- |
| Passed | 127. B1 (76): ACAD-01a–g, ACAD-02a–f, PLAN-01a–l, DATA-01a–e, AI-01a–g, COV-01a–c, USER-01a–j, l–v, x–z, GUIDE-01o, PERF-01a–h, A11Y-01a, c, g. B0 on B1 (51): AUTH-01a–p, SESS-01a–k, UI-01b–j, m–q, DB-01a–f, DEP-01a–d |
| Failed | 12. Accessibility ([#119](https://github.com/LLaammTTeerr/omnicourses/issues/119)): A11Y-01b, d, e, f. The planner's Taken strip ([#101](https://github.com/LLaammTTeerr/omnicourses/issues/101), known): PLAN-01n. The case and the build disagree and a decision is needed: USER-01k ([#115](https://github.com/LLaammTTeerr/omnicourses/issues/115)). Fail as written, cause not established: PLAN-01m ([#117](https://github.com/LLaammTTeerr/omnicourses/issues/117): 121 saves got through a limit documented as 120, so the case saw no 429). Fail as written while the app does what the case protects ([#116](https://github.com/LLaammTTeerr/omnicourses/issues/116)): USER-01w, UI-01a, UI-01k, UI-01l, DEP-01f |
| Blocked | 12. GUIDE-01a–h, l, m, n, **blocked: no guide is published** ([#114](https://github.com/LLaammTTeerr/omnicourses/issues/114), cases §6 item 10); ACAD-01h, **blocked: no prerequisite or offering-term data** (cases §6 item 14) |
| Not run | 5. GUIDE-01i, j, k: not run on the tested build (they need a local test database with the test-only guides; seen passing on a later commit, §4; Dũng records them as blocked). DEP-01e (needs a second network). SESS-01l (not run by hand, by design) |
| **Total** | **156** |

What matters for the decision:

- **The academic core passed.** Every audit, counting, plan, data, gateway and coverage case that can run on B1 passed on observed evidence, except two. PLAN-01n (#101): the planner's **Đã học / Taken** strip shows 172 credits where its six terms hold 102. PLAN-01m (#117): on staging 121 saves got through the limit documented as 120, so the case as written saw no 429; whether the limit or the case is off by one is not established, and on production's guide list the 121st request did get 429. Once the limit is reached, the planner keeps the board and sends the save again as the case expects. No case found a wrong audit result, a leak between two students, or lost data.
- **No guide is published.** B1's scope has the first guide batch (G01, G02, G06, G07). All four are still drafts, so the guide list is empty on staging and on production (#114). Eleven guide cases are blocked on it. After both runs, pull request #112 was approved and merged as `e20bdc1` (15 November 2026, about 07:35 UTC). Production now serves G01 (`accounts-and-portals`) and G07 (`grades-and-transcript`) as published; G02 and G06 are still drafts. So #114 is resolved for G01 and G07 only. The guide results below stay as seen on the tested build; the cases for G01 and G07 can be run again on production and have not been yet.
- **USER-01k does not happen as the case says** (#115), in both runs. There is no **My program isn't listed** choice, and the dashboard never opens for a student who has not finished onboarding: the app sends them to onboarding first. Details in §4.
- **Speed passed; accessibility did not.** In Dũng's manual run on production every timed load of the dashboard and the audit was under 2 seconds (the slowest was 1047 ms). A11Y-01b, d, e and f failed: focus is lost after some actions, the skip link skips nothing on three screens, one button is not translated, and axe-core finds contrast violations in 65 of 84 runs (#119).
- **Where a pass was seen.** The 27 AUTH-01 and SESS-01 passes, DB-01, DATA-01, COV-01, AI-01 and USER-01n, q, r, y, z were seen on a local build of the tested tree with a disposable database, not on a deployed server. On production Dũng records USER-01n, q, r, y, z as blocked: they need database access there. §4 gives both.

By parent check. A parent passes only when all its required detailed outcomes pass ([test plan §5](test-plan.md#5-required-checks)); the totals above count only the detailed cases.

| Parent check | Result | Why |
| --- | --- | --- |
| TC-B1-USER-01 | not passed | 24 of 26 passed. USER-01k failed (#115) and USER-01w failed as written (#116). USER-01n, q, r, y, z passed on a local database and are blocked on production. |
| TC-B1-GUIDE-01 | blocked | No guide is published on the tested build (#114). #112 merged after the runs (`e20bdc1`), and the cases are not yet run again. GUIDE-01o passed on production. GUIDE-01i, j, k are not run on the tested build. |
| TC-B1-ACAD-01 | not passed yet | ACAD-01a–g passed. ACAD-01h is blocked on prerequisite and offering-term data (§6 item 14 of the cases). |
| TC-B1-ACAD-02 | passed | ACAD-02a–f passed. |
| TC-B1-PLAN-01 | failed | PLAN-01n failed (#101). PLAN-01m failed as written (#117). PLAN-01a–l passed. |
| TC-B1-DATA-01 | passed | DATA-01a–e passed. Prerequisites and offering terms are recorded as unresolved (§5). |
| TC-B1-AI-01 | passed | AI-01a–g passed. No B1 route calls a model, and no model was called in this run. |
| TC-B1-COV-01 | passed | `src/rules/**`: 459 of 459 statements covered (100 %); a run below 80 % fails. |
| TC-B1-PERF-01 | passed | PERF-01a–h passed in Dũng's manual run on production: 130 timed runs, all under 2 seconds. |
| TC-B1-A11Y-01 | failed | A11Y-01b, d, e, f failed (#119). A11Y-01a, c, g passed. |
| TC-B0-AUTH-01 | passed | AUTH-01a–p passed again through the API, on a local build; the screens passed on staging under UI-01 except the three below. |
| TC-B0-SESS-01 | all run cases passed | SESS-01a–k passed, on a local build. SESS-01l is not run by hand, by design. |
| TC-B0-UI-01 | not passed | 14 of 17 passed. UI-01a, k and l fail as written: the app's address is a public home page, not the sign-in screen (#116). |
| TC-B0-DB-01 | passed | DB-01a–f passed. |
| TC-B0-DEP-01 | not passed | DEP-01a–d passed. DEP-01e needs a second network. DEP-01f fails as written: the tag is `1decf4a`, the servers run `7f66b7a`, documents-only apart. |

## 2. Environment and how it was run

| Item | Used |
| --- | --- |
| Staging | https://stag-omnicourses.lamter.cc, commit `7f66b7a`. Checked three ways. [Deploy run 43670057781](https://github.com/LLaammTTeerr/omnicourses/actions/runs/43670057781) on branch `staging` succeeded at 02:57:12 UTC; its log says "Deploying 7f66b7a2c8c4a138aa713b90b264d89e4cef3e95 to staging", "migrating and seeding" and "stag: live: 7f66b7a…". `origin/staging` was `7f66b7a` at the start and at the end of the run. `GET /api/docs-json` on staging is identical to `src/backend/openapi.json` of `7f66b7a` (35 paths). The app shows no version or commit of its own: `/api/health` answers only `{"status":"ok","database":"up"}`. No account was created before that deploy run had finished. |
| Local | Ubuntu 26.04.1 LTS (Linux 7.0.0-43), Node 22.22.1, npm 11.21.1 (through `npx npm@11.21.1`), dependencies from `npm ci`. PostgreSQL 18.6 (`docker.io/library/postgres:18.6`, server `18.6 (Debian 18.6-1.pgdg13+2)`) in a podman 5.7.0 container of its own on port 55432, removed after the run. The API as `node dist/main.js` on port 3055, built from the tree at `7f66b7a`. |
| Browser | Chromium 156.0.8078.4, headless, through Playwright 1.64.1 (`playwright-core`). Viewport 1280×800 unless a case says otherwise; 1280×1500 for PLAN-01g. Vietnamese screens, light theme, with English where a case asks. |
| Test data | Made-up `example.com` accounts only, password `correct horse battery`, display name `Test Student`. On staging: 19 accounts named `b1-run-07ef42-<role>@example.com` (§7). Locally: the accounts the cases name, in the disposable database only. Transcripts: the `ZZ` rows of the cases, the catalog rows the cases list, and the completion fixture `apcs-2024-completion.json` (SHA-256 `d0a0493f…facde`, checked before each use). No real name, student ID, transcript or secret. |
| Model calls | None. No route of B1 calls a model, and nothing in this run spent AI credit. |

Dũng's manual run used Chrome 144.0.7559.110 on Windows 10, headed, with Playwright 1.64.1 driving the installed Chrome for PERF-01 and A11Y-01 and axe-core 4.10.2, on production with the accounts the cases name (`b1-01` to `b1-04`, `b1-s1`, `b1-s2`, `b1-perf`) and one more, `b1-a11y`. His setup, accounts and notes are in [`results-2026-11-15.md`](evidence/b1/results-2026-11-15.md). The cases prescribe staging; his file says production was used as Lâm's bot asked. Both servers ran `7f66b7a`.

Where each group of cases ran in the scripted run:

- **Staging, through the API** (`b1-api-cases.mjs`, `b1-user-api-cases.mjs`): ACAD-01a–g, ACAD-02a–f, PLAN-01a, b, d, f, USER-01m, o, s, t, v, DB-01b, d, e, DEP-01b, d and the API part of GUIDE-01n.
- **Staging, through the screens** (the `a-*` and `p-*` scripts): USER-01a–l, p, u, the screen parts of ACAD-01a, c, e, g and ACAD-02d, PLAN-01b, c, e, g–n, UI-01a–p, DEP-01a, c, and the three guide pages seen with no guide published.
- **Local disposable database** (the `local-*` files and `b0-regression-local.mjs`): the cases that §1 of the cases keeps off staging or that need `psql`: DATA-01a–e, DB-01a, c, f, USER-01n, q, r, y, z and the API and database parts of w and x; the test suites behind AI-01, COV-01, DATA-01c–d and UI-01q; and the B0 regression AUTH-01a–p and SESS-01a–k, which count rows in `users` with `psql`.

How this differs from the cases:

- **Scripts and a headless browser did the work, not a person in Chrome with the Swagger page.** Each script sends the routes and bodies, or does the clicks and keys, of its cases and prints the value it saw for every check. Drags, keys and clicks are Playwright events. Dũng's manual run is the check by a person.
- **The accounts have run names**, not `b1-01` to `b1-09`, `b1-s1` to `b1-s3` or `b1-perf`. Those names belong to Dũng's manual run, and a second sign-up of one would get 409. Each run account stands for the account its case names, as §4 says.
- **Request blocking** (PLAN-01e, the blocked part of PLAN-01g, UI-01p) used Playwright's request routing in place of DevTools blocking or stopping the backend. The server was never touched.
- **"Read the CI result" cases.** The log of [CI run 43666344959](https://github.com/LLaammTTeerr/omnicourses/actions/runs/43666344959) on `1decf4a` gives totals per suite, not each test's title. So the named tests were also run locally with the verbose reporter, and both are recorded.
- **COV-01c** used a throwaway copy of `src/backend` outside the repository, not a branch.
- **Rate limits.** Sign-up and sign-in were kept under 10 a minute across the whole run. The cases that mean to exceed a limit (AUTH-01o and p locally; UI-01g and PLAN-01m on staging) ran apart from the others. No request got a 429 it did not ask for, except that UI-01g met the limit two attempts early (§4).

Raw evidence, in [`evidence/b1/`](evidence/b1/). No file holds a token or a password hash; the scripts keep tokens in a file outside the repository.

| Files | What they hold |
| --- | --- |
| [`lib.mjs`](evidence/b1/lib.mjs), [`b1-api-cases.mjs`](evidence/b1/b1-api-cases.mjs), [`b1-api-cases-output.txt`](evidence/b1/b1-api-cases-output.txt) | The API cases on staging: ACAD-01, ACAD-02, PLAN-01a, b, d, f, the plans part of ACAD-01e, DB-01b, d, e, DEP-01b, d and GUIDE-01n. Each check with its actual value. |
| [`b1-user-api-cases.mjs`](evidence/b1/b1-user-api-cases.mjs), [`b1-user-api-cases-output.txt`](evidence/b1/b1-user-api-cases-output.txt) | USER-01m, o, s, t, v and the API side of r, on staging |
| `a-*.mjs`, `a-*-output.txt`, `a-*.png` | The account, onboarding, audit, explorer, sign-in and guide screens on staging: [`a-user-01k`](evidence/b1/a-user-01k-output.txt), [`a-onboarding`](evidence/b1/a-onboarding-output.txt) and [`a-onboarding-2`](evidence/b1/a-onboarding-2-output.txt) (USER-01a–i, l, DEP-01a, c), [`a-acad-screens`](evidence/b1/a-acad-screens-output.txt), [`a-ui-01`](evidence/b1/a-ui-01-output.txt) (UI-01, USER-01p), [`a-user-01u`](evidence/b1/a-user-01u-output.txt), [`a-guides`](evidence/b1/a-guides-output.txt), [`a-followup`](evidence/b1/a-followup-output.txt) (UI-01b, UI-01g, USER-01u as S1), [`a-a11y-01c`](evidence/b1/a-a11y-01c-output.txt) |
| [`g-guides-local.mjs`](evidence/b1/g-guides-local.mjs), [`g-guides-local-output.txt`](evidence/b1/g-guides-local-output.txt), `g-*.png` | Not on the tested build: GUIDE-01i, j, k and the published G01 and G07 as seen on a local test database on the later commit `47e4ba3` |
| `p-*.mjs`, `p-*-output.txt`, `p-*.png` | The planner on staging: [`p-plan-01n-01h`](evidence/b1/p-plan-01n-01h-output.txt), [`p-plan-01b-c-l-k-j`](evidence/b1/p-plan-01b-c-l-k-j-output.txt), [`p-plan-01j-locked-drag`](evidence/b1/p-plan-01j-locked-drag-output.txt), [`p-user-01j-plan-01i`](evidence/b1/p-user-01j-plan-01i-output.txt), [`p-acad-01e-planner`](evidence/b1/p-acad-01e-planner-output.txt) and [`p-acad-01e-issues-api`](evidence/b1/p-acad-01e-issues-api-output.txt), [`p-plan-01g`](evidence/b1/p-plan-01g-output.txt), [`p-plan-01g-h-e-first-run`](evidence/b1/p-plan-01g-h-e-first-run-output.txt) (PLAN-01h part 1 and PLAN-01e), [`p-plan-01m`](evidence/b1/p-plan-01m-output.txt) |
| [`local-db-01a-output.txt`](evidence/b1/local-db-01a-output.txt), [`local-db-01f.sql`](evidence/b1/local-db-01f.sql), [`local-db-01f-output.txt`](evidence/b1/local-db-01f-output.txt), [`local-db-01c-01d-output.txt`](evidence/b1/local-db-01c-01d-output.txt), [`local-pages.mjs`](evidence/b1/local-pages.mjs) | DB-01a, f, c and d on the local database, with the home page and the docs page in headless Chromium |
| [`local-data-01-output.txt`](evidence/b1/local-data-01-output.txt) | DATA-01a, b, c, e and `\d ai_usage` for AI-01f |
| [`local-cov-01-output.txt`](evidence/b1/local-cov-01-output.txt) | COV-01a–c: the rules files, covered and total statements for each, and the run that fails below 80 % |
| [`local-ci-named-tests.txt`](evidence/b1/local-ci-named-tests.txt), [`local-e2e-output.txt`](evidence/b1/local-e2e-output.txt), [`local-ui-01q-output.txt`](evidence/b1/local-ui-01q-output.txt) | The CI result on `1decf4a`, and each test the cases name, run locally with the verbose reporter; the whole e2e suite; the browser suite |
| [`b0-regression-local.mjs`](evidence/b1/b0-regression-local.mjs), [`b0-regression-local-output.txt`](evidence/b1/b0-regression-local-output.txt) | AUTH-01a–p, SESS-01a–k and DB-01b, d, e again, on the local build. B0's script, with `psql` through podman and the health body of B1. |
| [`local-user-01-db.mjs`](evidence/b1/local-user-01-db.mjs), [`local-user-01-db-output.txt`](evidence/b1/local-user-01-db-output.txt) | USER-01n, q, r, s, t, v, y, z and the API and database parts of w and x, on the local database |
| [`cleanup.mjs`](evidence/b1/cleanup.mjs), [`cleanup-output.txt`](evidence/b1/cleanup-output.txt) | The deletion of every account the run made on staging, with each `purgeAfter` |
| From pull request #118, merged as `47e4ba3`: [`results-2026-11-15.md`](evidence/b1/results-2026-11-15.md), `perf-01.mjs` and `perf-01-2026-11-15T03-57-28-615Z.json`, `a11y-01.mjs`, `a11y-01-2026-11-15T04-31-36-554Z-results.json` and `a11y-01c-widths-2026-11-15T04-40-50-767Z-results.json`, `guide-01o.sh` and `guide-01o-burst*.txt` | Dũng's manual run on production: a result and a note for every case of USER-01, GUIDE-01, PERF-01 and A11Y-01; every timed run of PERF-01b–h; the axe-core, language and width results; the three rate-limit bursts. His USER-01, GUIDE-01n, PERF-01a and A11Y-01b, f, g results are notes in the results file, with no raw output beside them. |

Some evidence files hold lines that are not results, each explained inside the file: `a-onboarding-output.txt` (a first run whose script reused a token the page had rotated; `a-onboarding-2-output.txt` is the result), `p-plan-01g-h-e-first-run-output.txt` and `p-plan-01g-second-run-output.txt` (the pointer missed a row at that viewport height; `p-plan-01g-output.txt` is the result), and two mistyped queries in `local-data-01-output.txt`, rerun correctly below them. An aborted script-error log from `p-user-01j-plan-01i` was removed during evidence cleanup (`p-user-01j-plan-01i-output.txt` holds the full rerun).

## 3. Automated checks

[CI run 43666344959](https://github.com/LLaammTTeerr/omnicourses/actions/runs/43666344959) ran on `1decf4a` (push to `main`, 15 November 2026) and is green. It counts as the B1 commit's automated results. [CI run 43667330474](https://github.com/LLaammTTeerr/omnicourses/actions/runs/43667330474) on `7f66b7a` is green too.

| CI job | What it ran | Result on `1decf4a` |
| --- | --- | --- |
| `backend` | typecheck, 849 unit tests in 43 files with coverage, build, 151 e2e tests in 17 files on PostgreSQL 18.6, OpenAPI export | passed |
| `frontend` | typecheck, 598 unit tests in 51 files, 36 browser tests in 8 files, build | passed |
| `signed-commits`, `changeset`, `scope` | every commit signed, a changeset present, the change's scope | passed |

The same suites on the local machine, on the tree at `7f66b7a`: backend unit tests 849 of 849, e2e 151 of 151, browser 36 of 36, all with exit 0 ([`local-cov-01-output.txt`](evidence/b1/local-cov-01-output.txt), [`local-e2e-output.txt`](evidence/b1/local-e2e-output.txt), [`local-ui-01q-output.txt`](evidence/b1/local-ui-01q-output.txt)).

## 4. Results

"Staging" and "local" say where the case ran (§2). Run accounts are written without their prefix: `m06` is `b1-run-07ef42-m06@example.com`.

### TC-B1-ACAD-01: Rules, audit and explorer

API parts as `m06`, standing for `b1-06`: onboarded to APCS 2024, no transcript before ACAD-01a. Evidence: [`b1-api-cases-output.txt`](evidence/b1/b1-api-cases-output.txt), [`a-acad-screens-output.txt`](evidence/b1/a-acad-screens-output.txt), [`p-acad-01e-planner-output.txt`](evidence/b1/p-acad-01e-planner-output.txt).

| ID | Result | What happened |
| --- | --- | --- |
| ACAD-01a | passed | API: 200; `credits` `{accumulated 0, towardTotal 0, inProgressTowardTotal 0, totalRequired 163, remaining 163, yearLevel 1}`; both averages `null`; `terms` and `unmatchedCourses` empty. Eight groups: (A) bắt buộc 40, (A) tự chọn 16, Math 16, Non Computer Science 26, Physics 12, Kiến thức tốt nghiệp 10, Tự chọn Math (B) 8, each 0 passed and all remaining. (C): `requiredCredits` and `remainingCredits` `null`, `met` true. **Kiến thức tự chọn** 0 of 43. `graduation.status` `not_yet`. No graduation term. Screen (`a04`, before its transcript): "0 / 163 TC", "còn 163 TC", "Chưa đủ điều kiện tốt nghiệp"; (C) reads "0 TC · Không có tối thiểu riêng", never "0 / 0"; the notice "Chưa có bảng điểm. Kết quả dưới đây coi như bạn chưa đạt học phần nào…" links to `/transcript` ([screenshot](evidence/b1/a-acad-01a-dashboard.png)). |
| ACAD-01b | passed | `accumulated` 8, `towardTotal` 8, `remaining` 155. Averages 7.5 and 7.5, `good`. (A) bắt buộc 4 of 40 with CS160 `passed`; Non Computer Science 4 of 26 with CM102 `passed`. Term 2024-1: 8 credits, one `below_minimum` with `credits` 8, `limit` 10. The save answered 200. |
| ACAD-01c | passed | SHA-256 matches; `PUT` with the file as the body 200; 45 rows. `graduation.status` `done`, `unmet` empty. `credits` `{172, 164, 0, 163, 0, yearLevel 4}`. `gpa` `{7.77, 7.77, 3.3, good, gradedCredits 164}`. All eight groups met; Kiến thức tự chọn 44 of 43. 12 terms of 10 to 20 credits, no cap violation, no warning, no unmatched course. `notChecked` still lists the five conditions. Screen (`a04`): "Đạt mọi điều kiện kiểm tra được", "164 / 163 TC", 7,77 twice, Khá, every group "✓ Đã đạt", and "Còn 5 điều kiện OmniCourse không kiểm tra được, phòng đào tạo sẽ xét."; the audit page shows 3,3. No graduation-guide link ([dashboard](evidence/b1/a-acad-01c-dashboard.png), [audit](evidence/b1/a-acad-01c-audit.png)). |
| ACAD-01d | passed | (A) tự chọn 0 of 16, `met` false. `graduation.unmet` has `Requirement group "Kiến thức Computer Science (A): tự chọn"` with id `group:<uuid>` and citation `QĐ 1175/QĐ-KHTN Điều 17.3.b`. `notChecked` is exactly `no_prosecution_or_suspension`, `defence_education_certificate`, `foreign_language_standard`, `it_standard`, `study_time_limit`, citing Điều 17.3.a, 17.3.c, 17.3.d, 17.3.e and 2.7. None is listed as met. |
| ACAD-01e | passed | Audit: all four saves 200, `trainingType` `advanced`, term 2024-1 `main` with caps `{min 10, max 22}`. 9 credits: one `below_minimum` (9, 10). 10 and 22: none. 23: one `above_maximum` (23, 22). Each with citation `QĐ 1175/QĐ-KHTN Điều 7.2` and a petition note. Plans API: `PUT …/placements` 200 at 9, 10, 22 and 23; `GET …/issues` gives caps `{10, 22}`, `load_below_minimum` (`flag`, 9, 10, Điều 7.2) at 9, `load_above_maximum` (`flag`, 23, 22) at 23, no load issue at 10 and 22. Screen (planner, `p01`): the count chips, the amber card with the info icon, both titles and all four texts in Vietnamese and English, the term chip, the **Điều 7.2** link (regulation PDF, new tab, the tooltip of the case), the row loads "9 / 22 TC" to "23 / 22 TC", the ticks at 10 and 22 and the meter colours all match the case ([9](evidence/b1/p-acad-01e-9-credits-vi.png), [23 VI](evidence/b1/p-acad-01e-23-credits-vi.png), [23 EN](evidence/b1/p-acad-01e-23-credits-en.png)). |
| ACAD-01f | passed | 12, 13 and 22 credits in 2024-3: each time `kind` `main`, caps `{10, 22}`, no cap violation, and nothing names a summer term or a limit of 12. |
| ACAD-01g | passed | API: 200 with the eight groups; CS163 in (A) bắt buộc, "Cấu trúc dữ liệu", 4 credits; all 69 courses have `prerequisites` and `offeringTerms` `null`. Screen: 8 groups, 69 courses; `cau truc du lieu` and `cấu trúc dữ liệu` both find CS163 only; clearing brings back 69. The drawer shows CS163, Cấu trúc dữ liệu, 4 TC, (A): bắt buộc and "Chưa ghi nhận môn tiên quyết và học kỳ mở môn." ([screenshot](evidence/b1/a-acad-01g-drawer.png)). |
| ACAD-01h | blocked | **Blocked: §6 item 14 of the cases.** No APCS prerequisite or offering term is entered: the three tables hold 0 rows after the seed (DATA-01e), and the curriculum API returns `null` for every course. Owner: Thắng (data), Triết (engine). On 15 November 2026 Lâm confirmed that "APCS has no prerequisite" covers every APCS course of both cohorts; pull request #111 records it as data and merges after B1 ends, so it is not in the tested build. |

Cohort selection is USER-01i, which passed.

### TC-B1-ACAD-02: Audit counting and freshness

Evidence: [`b1-api-cases-output.txt`](evidence/b1/b1-api-cases-output.txt), [`a-acad-screens-output.txt`](evidence/b1/a-acad-screens-output.txt).

| ID | Result | What happened |
| --- | --- | --- |
| ACAD-02a | passed | CS160 `passed` (5.0), CS163 `failed` (4.9), CS201 `passed`, CS202 `failed`, CS250 `passed` (exempt), CS300 `in_progress`. Group: passed 12, in progress 4, remaining 24. `accumulated` 12, `inProgressTowardTotal` 4. `average` 4.95, `accumulatedAverage` 5, `gradedCredits` 4. Term 2024-1 `failedCourseCodes` CS163, CS202. |
| ACAD-02b | passed | First save: CS160 `passed` with 8.0, `accumulated` 4, both averages 8; term 2024-1 keeps `average` 3 and `failedCourseCodes` CS160. Second save: CS160 grade 6.0, `accumulated` still 4, `accumulatedAverage` 6. |
| ACAD-02c | passed | (A) bắt buộc 40 of 40, met. (A) tự chọn 20 of 16, met, `overflowOutCredits` 4 toward (C). (C): `requiredCredits` `null`, `overflowInCredits` 4, met. Kiến thức tự chọn: 4, remaining 39. `towardTotal` 60, `remaining` 103. Terms of 16, 16, 16 and 12 credits, no cap violation. |
| ACAD-02d | passed | API (`m07`): first save `accumulated` 4, `average` 8; second save 8, 7, (A) bắt buộc 8. Screen (`a03`): the dashboard showed 4 / 163 and 8; after the second save, made through the API with the page open, and a reload: 8 / 163, 7, (A) bắt buộc 8 / 40 ([screenshot](evidence/b1/a-acad-02d-dashboard.png)). |
| ACAD-02e | passed | `m08` holds only CM102, `accumulated` 4, `average` 7.0, before and after `m07` saved CS201 9.0 (200). No course, credit or average of `m07` in either of `m08`'s responses. |
| ACAD-02f | passed | `unmatchedCourses` is exactly ZZ999, `passed` true; warning `not_in_curriculum` for ZZ999; `accumulated` 4 and `average` 8 from CS160 alone; term 2025-1 shows 4 credits of load. |

### TC-B1-PLAN-01: Basic plans and the planner

API cases as `ms1` and `ms2` (S1 and S2) and `m09` (`b1-09`). Screens as `p01` (S1, with the `ZZ` transcript), `p03` (`b1-02` after USER-01j) and `p06` (`b1-06` with the completion fixture). Evidence: [`b1-api-cases-output.txt`](evidence/b1/b1-api-cases-output.txt) and the `p-*` files.

| ID | Result | What happened |
| --- | --- | --- |
| PLAN-01a | passed | Both `POST`s 201 with an id. The list holds "Standard 4-Year" and "Fast Track", each `APCS2024`; S2's own plan is not in it. |
| PLAN-01b | passed | API: the first read has CS160 in 2024-1 and CS163 in 2024-2, terms as `{year, number}`; after the `PUT` of 2024-2 only, `terms` holds only 2024-2; the `PUT` with an empty 2024-1 term is refused, 400 "terms.0.placements must contain at least 1 elements", and the plan is unchanged; "Fast Track" has no placements. Screen: in "Screen 01b", CS160 went to the first row and CS163 to the second, **Đã lưu**; both were there after a reload; after removing CS160 and a second reload only CS163, in the second row ([screenshot](evidence/b1/p-plan-01b-after-first-reload.png)). |
| PLAN-01c | passed | Two browser contexts with their own sessions. A added CS201 and saved; B, after a reload, showed the same board. |
| PLAN-01d | passed | Each of S2's eight calls on S1's plan answered 404 "No plan with this id", byte for byte the answer for an id that does not exist. Read as S1, the plan was unchanged, and S2 got no copy. |
| PLAN-01e | passed | With writes to `/api/plans` aborted in the browser, adding CS163 showed "Chưa lưu được thay đổi. Kế hoạch đã trở về lần lưu gần nhất." and the chip **Chưa lưu**; **Đã lưu** never showed. After the reload, screen and API held the last saved board ([screenshot](evidence/b1/p-plan-01e-save-failed.png)). |
| PLAN-01f | passed | Export 200. `tables.plans` holds the plan and `tables.plan_placements` its CS160 placement, both with the account's `user_id`. |
| PLAN-01g | passed | Picking up CS160 sent one `POST …/issues/drops` (200) for the whole drag, and no `PUT` before the drop. First row: blue outline, "Chưa kiểm tra được: CS160: chưa ghi nhận môn tiên quyết.", "12 / 22 TC" with "+4", green meter, the panel line of the case, the row's card tagged "Sẽ hết". Second row: amber outline, "4 / 22 TC" with "+4", a new card tagged "Mới". On release: CS160 in the first row, one `PUT`, **Đã lưu**. The slot: green outline, no words, "16 / 22 TC"; Esc placed nothing. Blocked: "Không xem trước được. Trỏ vào hàng này để thử lại." in grey on the pointed row only; Esc placed nothing. "Đang kiểm tra…" was not seen, which the case allows. Viewport 1280×1500 ([first row](evidence/b1/p-plan-01g-over-first-row.png), [second row](evidence/b1/p-plan-01g-over-second-row.png), [blocked](evidence/b1/p-plan-01g-preview-blocked.png)). |
| PLAN-01h | passed | "Preview 01g": "Không thấy vi phạm · 6 mục chưa kiểm tra được" and "Chưa đủ để tốt nghiệp" on a red icon, in English "No violation found · 6 not checked" and "Not enough to graduate yet"; (A) bắt buộc "12/40" in red with the tooltip of the case; **Đã lưu**; no term and no estimate. As `p06` with the fixture: "Đủ các yêu cầu kiểm tra được" on a green cap icon; never "can graduate" ([screenshot](evidence/b1/p-plan-01h-strip-vi.png)). |
| PLAN-01i | passed | One plan: one marked tab, no trash button. The dialog names CTĐT APCS 2024 while Settings holds cohort 2025. "Tabs 01i" opened with "Đã tạo Tabs 01i." and a trash button. The delete dialog's texts match; **Giữ lại** kept it; **Xóa** deleted it, said "Đã xóa Tabs 01i." and opened the other plan ([screenshot](evidence/b1/p-plan-01i-new-plan-dialog.png)). |
| PLAN-01j | passed | Locked: the button reads **Mở khóa**, the note matches, the **+**, arrows, **×** and **Thêm HK…** are hidden; a drag, Space, Delete and Ctrl+Z sent no request; **Hoàn tác** disabled; tabs, What-if and the new-plan dialog still work. Still locked after a reload. Browser B, not locked, removed CS160 (`PUT` 200); A then showed it gone. After **Mở khóa**, adding worked ([screenshot](evidence/b1/p-plan-01j-locked.png)). |
| PLAN-01k | passed | The three Undo toasts match the case word for word, each Undo sent one `PUT` and showed **Đã lưu**. After the third, **Hoàn tác** was disabled and Ctrl+Z said "Không còn gì để hoàn tác." In the search box Ctrl+Z undid only the typing. A reload and a plan switch start with nothing to undo. English: "Undone: Removed CS160 from the plan." |
| PLAN-01l | passed | "What-if: Screen 01b" opened at once with its toast and a tab of its own, with the same courses in the same rows. CS202, added to the copy, is not in "Screen 01b". The button reads "What-if" in Vietnamese too. |
| PLAN-01m | **failed** | [#117](https://github.com/LLaammTTeerr/omnicourses/issues/117). Expected: after the script's 120 saves, the browser's save gets 429 and is sent again after 2, 5 and 10 seconds. Observed, twice: the script printed `120 200`, and the browser's save, request 121, was answered 200 in 0.3 s (**Đã lưu**, CS160 saved). The second time the 120 saves were sent from the browser page itself, so the address was the same. A third run sent saves until the first 429: 121 answered 200 and the 122nd 429, with `x-ratelimit-remaining` 119 on both of the first two answers. Then the planner did what the case expects: the `PUT` got 429 at +0.2, +2.3, +7.4 and +17.6 s, CS160 stayed on the board with **Đang lưu…**, the board did not go back at the first 429, and after the last 429 it went back with "Chưa lưu được thay đổi. Kế hoạch đã trở về lần lưu gần nhất." and **Chưa lưu** (the second ending the case allows) ([output](evidence/b1/p-plan-01m-output.txt), [first run](evidence/b1/p-plan-01m-first-run-output.txt), [second run](evidence/b1/p-plan-01m-second-run-output.txt), [screenshot](evidence/b1/p-plan-01m-saving-after-429.png)). |
| PLAN-01n | **failed** | Known issue [#101](https://github.com/LLaammTTeerr/omnicourses/issues/101), now seen on screen. Expected: the span, the figure and the tags describe the same terms, 102 credits for the six terms named. Observed: the span reads "6 học kỳ · HK1 2024–2025 → HK3 2025–2026", the figure "172 tín chỉ tích lũy" ("172 credits accumulated"), and 45 tags show, 18 of them for courses of HK1 2026–2027 or later, CS468 included. A tag does open `/explorer?course=<code>` ([screenshot](evidence/b1/p-plan-01n-strip-vi.png)). |

### TC-B1-DATA-01: APCS integration

Local database. Evidence: [`local-data-01-output.txt`](evidence/b1/local-data-01-output.txt), [`local-ci-named-tests.txt`](evidence/b1/local-ci-named-tests.txt).

| ID | Result | What happened |
| --- | --- | --- |
| DATA-01a | passed | First seed inserted programs 10, curriculums 11, requirement_groups 133, courses 249, links 1823, combined_minimums 2, overflows 2. Second seed: `Inserted:` 0 for all seven. The shared counts were 10, 11, 133, 249 and 1823 after both. |
| DATA-01b | passed | `UPDATE 1`; the seed ran with exit 0 and kept `admin note` on APCS 2024's Math group; APCS 2025's stayed `4 học phần`. Restored to `4 học phần`. |
| DATA-01c | passed | By hand: the seed exited 1 with "Course catalog conflict: 1 value(s) differ for the same course code." and `CS160.name_vi: "Renamed" (database) vs "Nhập môn Tin học" (seed)`; CS160 kept `Renamed` and the counts did not change; after the restore the seed ran with exit 0. Automated: the `backend` job of CI is green on `1decf4a`, and "keeps an admin edit to a group, and aborts on a catalog course edited to a new name" passed locally. |
| DATA-01d | passed | "rolls back everything when one insert fails" passed locally by name; the `backend` job of CI is green on `1decf4a`. |
| DATA-01e | passed | APCS 2024 `total_credits_min` 163. 249 courses, none breaking `^[A-Z0-9]{2,20}$`. (A) bắt buộc: `compulsory`, 40 credits, 10 courses. (A) tự chọn: `elective`, at least 16, 6 courses. `course_prerequisite_lists`, `course_prerequisites` and `course_offering_terms` hold 0 rows: prerequisites and offering terms are **unresolved**, not made up (§5). |

### TC-B1-AI-01: Gateway regression

Each case reads a test result. CI on `1decf4a` is green; the named tests were also run locally by name ([`local-ci-named-tests.txt`](evidence/b1/local-ci-named-tests.txt)). No model was called.

| ID | Result | What happened |
| --- | --- | --- |
| AI-01a | passed | `ai.e2e-spec.ts`, "boots without a key and answers ai_unavailable before reserving, so the attempt does not count": passed. |
| AI-01b | passed | "counts a call the student stopped, and refuses once the daily cap is reached": passed. |
| AI-01c | passed | "lets exactly the cap through when calls arrive in parallel": passed. |
| AI-01d | passed | `sse.spec.ts`: "throws a failure before the first event, so Nest can still answer 503" and "turns a failure after the first event into an error event" passed. |
| AI-01e | passed | `gateway-llm.service.spec.ts`, "passes only user and assistant messages from the client to the model": passed. The OpenAPI document of the build has no advisor or AI route. |
| AI-01f | passed | `account.e2e-spec.ts`: "every user_id key to users cascades, and every other key cascades or sets null (AGENTS.md rule)" and "purges only the accounts whose deadline has passed, with their rows" passed. `\d ai_usage`: exactly `id`, `user_id`, `feature`, `model`, `input_tokens`, `output_tokens`, `latency_ms`, `succeeded`, `created_at`; `user_id` references `users(id) ON DELETE CASCADE`. No column for a prompt, a reply or tool arguments. |
| AI-01g | passed | The six named tests of `gateway-llm.service.spec.ts` passed (30 of 30 in the two AI spec files). |

### TC-B1-COV-01: Rule-engine coverage

Evidence: [`local-cov-01-output.txt`](evidence/b1/local-cov-01-output.txt).

| ID | Result | What happened |
| --- | --- | --- |
| COV-01a | passed | `src/backend/src/rules/` exists with 12 production files (`attempts`, `audit`, `audit-types`, `coverage`, `credit-caps`, `gpa`, `grades`, `graduation`, `plan-issues`, `prerequisites`, `rules.module`, `rules.service`). The statement denominator is 459. |
| COV-01b | passed | `npm test -w src/backend`: 849 tests passed, exit 0. `src/rules/**`: **459 of 459 statements, 100 %** (branches 97.68 %). The whole backend is at 73.31 %, which is not the gated figure. |
| COV-01c | passed | In a throwaway copy, with an uncalled function of 402 statements added to `rules/gpa.ts`: all 849 tests pass and the run exits 1 with "ERROR: Coverage for statements (53.31%) does not meet "src/rules/**" threshold (80%)". The worktree's file was not changed. |

### TC-B1-USER-01: Onboarding and account privacy

Two runs. "Scripted" is this report's run: staging, or the local database for the cases that need `psql`. "Manual" is Dũng's run on production ([`results-2026-11-15.md`](evidence/b1/results-2026-11-15.md)). The two agree on every case both ran. They differ only where one could not run a case: the last column says so. For USER-01a–m, o, p, s, t, u and v, Dũng's result on production is the same as the row's.

| ID | Result | Where | What happened |
| --- | --- | --- | --- |
| USER-01a | passed | staging | After sign-up, `/onboarding?redirect=/dashboard` opens at "Câu 1 / 4 · Chương trình". The only typed field in the wizard is credits per term. |
| USER-01b | passed | staging | Programs: APCS only. Cohorts: 2024 and 2025. No free text, no faculty question. Nine other programs are named in a list and cannot be chosen ([screenshot](evidence/b1/a-user-01b-programs.png)). |
| USER-01c | passed | staging | **Xong** with empty goals opened `/dashboard` ("APCS2024 · sinh viên năm 1"), seen on `a03`. A second context signed in to `/dashboard`, seen on `a02`. The API returns `null` for the three goals; Settings shows "Chưa biết", an empty field and "Chưa chọn". |
| USER-01d | passed | staging | Saved and reloaded: `{2027, 2}`, 18, `{2027, 1}`; on screen HK2 2027–2028, 18, HK1 2027–2028. |
| USER-01e | passed | staging | 23 came back as 23, then 9 as 9. No message. |
| USER-01f | passed | staging | `-1`, `2.5` and `abc`: nothing sent, "Nhập một số nguyên từ 1 trở lên." at the field, the earlier 9 stayed. Cleared: `null`. |
| USER-01g | passed | staging | `0` refused with the same message, 9 stayed. `40` saved and came back as 40. |
| USER-01h | passed | staging | "Không thực tập" came back as `'none'`; cleared, it is `null`. |
| USER-01i | passed | staging | Cohort 2025 saved. Dashboard "APCS2025 · …", explorer "Khóa tuyển 2025 · 71 học phần", audit `curriculumCode` `APCS2025`. Goals unchanged. |
| USER-01j | passed | staging | **Lộ trình** made and opened "Kế hoạch mặc định"; CS160 added, **Đã lưu**. After the cohort change to 2025, the same plan opened, the line still said "CTĐT APCS2024", CS160 was still placed, and the course list held APCS 2024's courses ([screenshot](evidence/b1/p-user-01j-plan-after-cohort-change.png)). |
| USER-01k | **failed** | staging, production | [#115](https://github.com/LLaammTTeerr/omnicourses/issues/115). Failed in both runs, with the same observations. See below. |
| USER-01l | passed | staging | After the cohort step the context was closed. Signing in again resumed at "Câu 3 / 4 · Mục tiêu", with APCS 2024 kept and `finished` false. |
| USER-01m | passed | staging | Both onboarding routes answer 401 without a token. With S2's token, only S2's answers. Neither route takes a user id; a `PUT` with S2's token and S1's id as extra fields changed only S2's own answers, and S1's were unchanged. |
| USER-01n | passed | local | The hash starts with `$argon2id$`. The data dump and the backend log do not contain the password (0 matches each). **On production: blocked** (Dũng): it needs `psql` and the backend log there, with Lâm's OK. The case allows a local disposable database (§1 of the cases), so the local result is the one counted. |
| USER-01o | passed | staging | The bodies of sign-up, sign-in, refresh, `GET /api/users/me`, sessions, both onboarding routes and the export have no key named `password`, `passwordHash` or `password_hash`, and none contains an argon2 hash. The hash itself cannot be read on staging, so the search was for `$argon2`, which every such hash starts with (USER-01n). |
| USER-01p | passed | staging | `/privacy` opens signed out, from the link beside the consent box. In Vietnamese and English it states what is stored, that data is kept until the account is deleted, the 30 days and that signing in cancels, the 14 pre-deploy copies, the nightly backups kept 7 days and not running yet, and how to export or delete. The 30 days match the server: every deletion in §7 answered a `purgeAfter` 30 days ahead ([screenshot](evidence/b1/a-user-01p-privacy-en.png)). |
| USER-01q | passed | local | `consent_at` was 58 ms after the sign-up was sent. **On production: blocked** (Dũng): needs `psql`. |
| USER-01r | passed | local | 200, `attachment; filename="omnicourse-account.json"`. `tables` has the eight tables of the §1 query with the same counts (onboarding_answers 1, plans 1, sessions 2, transcript_rows 3, the rest 0). Goals as prepared. On staging the API side gave the same, without the `psql` comparison. **On production: blocked** (Dũng) for the `psql` comparison; the API half passed there too, with 3 transcript rows, 2 sessions, 1 plan and 1 placement. |
| USER-01s | passed | local, staging | No key at any depth ends in a secret suffix. The file holds no password hash, no session token hash and no bearer token. |
| USER-01t | passed | local, staging | S2's id, email and `ZZ201` are nowhere in S1's file; the same search finds S1's own. |
| USER-01u | passed | staging | As `us1` (S1 with the Prepare data): **Xuất dữ liệu** saved `omnicourse-account.json` with the same eight tables and row counts as the API export taken right after. |
| USER-01v | passed | local, staging | 403 "Wrong password"; still 200 on `GET /api/users/me`; `deletion_requested_at` still null. |
| USER-01w | **failed** | production (manual); local for the database part | As written (#116). Dũng, on production: after **Xóa tài khoản**, browser A goes to the public home page with a toast, not the sign-in screen (`DeleteAccountDialog.vue` sends it to `home`). The rest held: the dialog explains the 30 days before asking for the password; 202 with `purgeAfter` 2026-12-15T03:31:19Z, 30 days to the minute; browser B gets 401 and shows the sign-in screen; sign-up again 409; S2 still 200. He could not read `purge_after` in the production database. The scripted run did not do the screen part; locally it saw the API and database parts: `purgeAfter` exactly 30 days after the request and equal to `purge_after`, both sessions 401, 409, S2 200. |
| USER-01x | passed | production (manual); local for the database part | Dũng, on production: 200 with `accountRestored: true`; the toast "Chào mừng trở lại…" seen on a second round; the deletion fields null in the export; E2 equals E1 except the allowed fields. Locally: `deletion_requested_at` and `purge_after` null in the database, and the same E1 and E2 comparison. The scripted run did not do the screen part. |
| USER-01y | passed | local | After the `UPDATE`, S3 and `nobody-b1@example.com` both got 401 with identical bodies. S3's row still existed. **On production: blocked** (Dũng): needs a `psql` `UPDATE` there. |
| USER-01z | passed | local | After the restart the log says "Purged 1 account(s) after the deletion grace period". S3 has no `users` row and 0 rows in all eight user tables. S2's counts and the shared counts are unchanged. The new sign-up answered 201, and its export holds only its own session. **On production: blocked** (Dũng): needs the backend restarted and `psql`. |

**USER-01k, expected and observed** ([output](evidence/b1/a-user-01k-output.txt), [program question](evidence/b1/a-user-01k-program-question.png), [after opening `/dashboard`](evidence/b1/a-user-01k-dashboard.png), [Settings](evidence/b1/a-user-01k-settings.png)):

| The case expects | Observed on B1 |
| --- | --- |
| A **My program isn't listed** choice; the screen says only the listed programs are supported | **No such choice.** The program question shows one card, APCS, a collapsed list "9 chương trình khác chưa hỗ trợ trong bản này", the note "Bản này chỉ có APCS; chương trình khác sẽ có khi dữ liệu được kiểm tra xong." and a **Làm sau** (Later) link, which goes to the home page. |
| No program is saved | As expected: `program` `null`, `finished` false. |
| Guides open normally | `/guides` opens, with no guide in it (#114). |
| The dashboard asks the student to finish onboarding, with a link | **The dashboard does not open.** The app goes from `/dashboard` to `/onboarding?redirect=/dashboard` and shows the program question again; `/audit` does the same. The dashboard has a notice for this state in its code, but the redirect comes first, so it is never shown. Only **Settings** opens: "Bạn chưa xong phần bắt đầu. Chọn chương trình, khóa và mục tiêu để dùng các trang khác." with a **Làm tiếp** link to onboarding. |
| No error, and no audit worked out without a program | As expected: `GET /api/users/me/audit` answers 409 `onboarding_required`; no error on screen or in the console. |
| After signing in again, onboarding opens | As expected: `/onboarding?redirect=/dashboard`. |

So the answer to "does the dashboard ask, or does the app redirect first?" is: **the app redirects to onboarding first.** Dũng saw the same on production, and reads `router.ts` as doing it on purpose. Whether the app or the case and UC-01 A7 changes is Lâm's call (#115).

### TC-B1-GUIDE-01: Public guides

**Blocked: no guide is published** ([#114](https://github.com/LLaammTTeerr/omnicourses/issues/114)). The eight content files of G01, G02, G06 and G07 have `status: 'draft'` and `lastChecked: null`: nobody has recorded following them on the real portal (§6 item 10 of the cases). The seed prints `Guides: {"inserted":0,…,"drafts":8}` on staging and locally, and `GET /api/guides` answers `{"guides":[]}` on staging and on production. Both runs saw it. After both runs, pull request #112 was approved and merged as `e20bdc1` (15 November 2026, about 07:35 UTC). Production now serves G01 (`accounts-and-portals`) and G07 (`grades-and-transcript`) as published; G02 and G06 are still drafts. So #114 is resolved for G01 and G07 only. The guide results below stay as seen on the tested build; the cases for G01 and G07 can be run again on production and have not been yet. GUIDE-01b–e still cannot fully pass while G02 and G06 are drafts.

| ID | Result | What happened |
| --- | --- | --- |
| GUIDE-01a | blocked | The files are drafts with no last-checked date or name, so there is no published guide and no publishing pull request to review. |
| GUIDE-01b | blocked | Seen on staging, signed out: "Chưa có hướng dẫn nào được đăng." and no group ([screenshot](evidence/b1/a-guide-01b-list.png)). |
| GUIDE-01c | blocked | No guide to find. |
| GUIDE-01d | blocked | `xyzzy` gives the same "Chưa có hướng dẫn nào được đăng.", not the no-match message with the task groups. There is no **Suggest a guide** and no advisor link ([screenshot](evidence/b1/a-guide-01d-no-match.png)). |
| GUIDE-01e, f | blocked | No guide to open. |
| GUIDE-01g | blocked | `/guides/register-courses` shows "Không tìm thấy hướng dẫn" and its API request answers 404, because the guide is a draft. The second half was seen: `/guides/no-such-guide` shows the not-found page with a link to **Guides**, and its API request answers 404 ([screenshot](evidence/b1/a-guide-01g-not-found.png)). |
| GUIDE-01h, l, m | blocked | No guide to read. Seen meanwhile: the guide requests carry no `Authorization` header. |
| GUIDE-01i, j, k | not run | Not run on the tested build `7f66b7a`. They need the test-only `zz-*` guides, which load only on a local test database (§6 item 12), and neither run did that on `7f66b7a`. They were seen passing afterwards on the later commit `47e4ba3`: see the table below, which does not count for B1. Dũng records them as blocked: needs a test database. |
| GUIDE-01n | blocked | **The two runs record it differently.** Dũng, on production: **pass**: the only guide routes are the two `GET`s, both public (200, and 404 for an unknown guide), the other 44 routes answer 401, and the guide routes joined `PUBLIC_ROUTES` in #54 with the routes. The scripted run, on staging, saw the same and records **blocked**, because one expectation cannot be seen without a published guide: a 200 from `GET /api/guides/{id}`; only its 404 was seen. This report counts it as blocked. Also seen: the five tests of `public-routes.e2e-spec.ts` pass on the candidate. |
| GUIDE-01o | passed | Dũng, on production, not staging as the case says. Requests 1–120 answered 200 and request 121 answered 429 in two bursts; in a third the 429 came at request 120 (`guide-01o-burst.txt`, `-2`, `-3`). His notes add what the files do not hold: 200 again after the minute, and a phone on mobile data opened **Guides** while his address was refused, so the limit counts each visitor, not the proxy. The scripted run did not run it. On staging's `PUT …/placements` 121 requests got through (PLAN-01m, #117). |

**Seen on a later commit, not on the tested build.** From 07:41:39 UTC, after the decision of §8, a local test database was set up as the cases prescribe for the test-only guides (§3 and §6 item 12 of the cases): PostgreSQL 18.6 in a podman container of its own on port 55433, removed afterwards; migrated and seeded with `npm run db:seed -w src/backend -- --guide-fixtures`, which loaded 12 guide texts and left 6 drafts; the API as `node dist/main.js`, the screens from the Vite dev server; headless Chromium 156.0.8078.4, 1280×800. **The build was `47e4ba3`, current `main`, not the tested `7f66b7a`.** The only commit between them that touches code is `e20bdc1` (#112): the texts of the four guides with G01 and G07 published, `guide-file.ts` (2 lines), the test-only guide fixtures and their spec, and `guides.e2e-spec.ts`. The three test-only guide cases could have been run on `7f66b7a` as well: there no guide is published, so the fixtures load, and CI on `7f66b7a` passed `guides.e2e-spec.ts` with them. They were not run on it. So, by the same rule as DEP-01f, nothing in this table is a B1 result: GUIDE-01i, j and k stay not run, and the other cases stay blocked. Script and output: [`g-guides-local.mjs`](evidence/b1/g-guides-local.mjs), [`g-guides-local-output.txt`](evidence/b1/g-guides-local-output.txt).

The rows for GUIDE-01b to h and l to n are the mechanical parts of those cases, tried for the published G01 and G07. It does not cover GUIDE-01a (the review of the content and its pull request), GUIDE-01e (reading a guide against UC-10, and G02's note), the portal pages that open (GUIDE-01f), the signed-in half of GUIDE-01l, or anything about G02 and G06, which are still drafts.

| Case | Seen on `47e4ba3`: for G01 (`accounts-and-portals`) and G07 (`grades-and-transcript`), and for the test-only guides in GUIDE-01i, j, k |
| --- | --- |
| GUIDE-01b | Signed out, both are listed under their groups, each with its task, portal, account and direct link. The list also held the test-only guides. |
| GUIDE-01c | In Vietnamese and in English: `bảng điểm`, `bang diem` and `transcript` list G07 alone among the real guides; `tài khoản` and `tai khoan` list G01. `%`, `_`, `'`, `\` and 500 letters `a` list nothing, with the no-match message and no error. The queries for G02 and G06 cannot be tried. |
| GUIDE-01d | `xyzzy` gives the no-match message with the task groups; no **Suggest a guide** and no advisor link. Cleared, both guides are back. |
| GUIDE-01f | The list link and **Open** *portal* are `<a>` elements whose `href` is exactly the content file's address, with `target="_blank"` and a `rel` that includes `noopener`. |
| GUIDE-01g | `/guides/accounts-and-portals` and `/guides/grades-and-transcript` open directly, signed out, and again after a reload. |
| GUIDE-01h | Title and text change language ("Xem điểm" and "View your grades" for G07); the address does not; the version line is written in each language's date format. |
| GUIDE-01i | `zz-vi-only` with the screen in English shows its Vietnamese text and the note "This guide is only available in Vietnamese."; `zz-en-only` in Vietnamese shows its English text and "Hướng dẫn này hiện chỉ có bằng tiếng Anh.". Neither is blank or "not found". A search for each ID finds it in both languages, with the chip "Chỉ có tiếng Anh" or "Vietnamese only" ([screenshot](evidence/b1/g-guide-01i-vi-only-in-english.png)). |
| GUIDE-01j | Test day 15 November 2026 in Vietnam. `zz-fresh` (checked 15/11/2026) and `zz-six-months` (15/05/2026) show version 1 and their date and no warning. Only `zz-six-months-and-a-day` (14/05/2026) warns: "Hướng dẫn này có thể đã cũ. Nhóm kiểm tra lần cuối ngày 14/05/2026, đã hơn 6 tháng. Cổng có thể đã thay đổi…", in English "This guide may be out of date… 14 May 2026…". It stays fully readable: both steps and the portal link are there ([screenshot](evidence/b1/g-guide-01j-out-of-date.png)). |
| GUIDE-01k | A search for `zz-draft` and for `zz-withdrawn` lists nothing, in both languages, and neither is in `GET /api/guides`. `/guides/zz-draft` and `/guides/zz-withdrawn` show the same "Không tìm thấy hướng dẫn" page as `/guides/no-such-guide`, and their API requests answer 404 with a body identical to the unknown guide's ([screenshot](evidence/b1/g-guide-01k-draft.png)). |
| GUIDE-01l | Signed out, no API request carries an `Authorization` header, and the responses hold no email, name, program, cohort, transcript or plan field. |
| GUIDE-01m | No password field and no form on either guide page; the page sent no request to a portal address. |
| GUIDE-01n | `GET /api/guides/{id}` without a token answers 200 for a published guide: the one expectation that was missing. |

### TC-B1-PERF-01: Dashboard and audit load time

Dũng's manual run, on production. Chrome 144.0.7559.110, headed; profile 50 ms, 10 Mbps down, 2 Mbps up; account `b1-perf` with the completion fixture (SHA-256 `d0a0493f…facde`, 45 rows, the same before and after). Every timed run is in `perf-01-2026-11-15T03-57-28-615Z.json` (pull request #118); the script is `perf-01.mjs`. Not as the case says: production, not staging, and other people may have used the server during timing. The scripted run did not time anything.

| ID | Result | What happened |
| --- | --- | --- |
| PERF-01a | passed | Checksum matches, 45 rows, and both pages show every expected value: 164 / 163 TC, 7,77 twice, 3,3, Khá, done. Recorded in Dũng's notes. The scripted run saw the same values on staging (ACAD-01c). |
| PERF-01b | passed | 10 health requests took 92–110 ms, all at least 50. The largest JavaScript file, `index-BK7zc12x.js`, 362,352 bytes unpacked (121,864 on the wire), took 334 ms, about its unpacked size ÷ 1.25 MB/s plus 50 ms. |
| PERF-01c | passed | Dashboard, cold cache, 5 runs: median 773 ms, maximum 889 ms. |
| PERF-01d | passed | Dashboard, warm cache, 30 runs after 5 warm-ups: median 443, p95 471, maximum 472 ms. |
| PERF-01e | passed | Dashboard, in-app, 30 runs: median 111, p95 125, maximum 130 ms. |
| PERF-01f | passed | Audit, cold cache, 5 runs: median 780, maximum 831 ms. |
| PERF-01g | passed | Audit, warm cache, 30 runs: median 504, p95 520, maximum 1047 ms. In that slowest run the server took 663 ms on `/users/me/onboarding`, against about 106 ms normally. |
| PERF-01h | passed | Audit, in-app, 30 runs: median 124, p95 136, maximum 137 ms. |

No run reached 2 seconds, and no run had an error. Dũng's script took about three minutes for all the series.

### TC-B1-A11Y-01: Keyboard, languages, widths and contrast

Dũng's manual run, on production: 21 screen states, light and dark, Vietnamese, with English for the language scan; axe-core 4.10.2 with the four tags of the case. Raw output: `a11y-01-2026-11-15T04-31-36-554Z-results.json` and `a11y-01c-widths-2026-11-15T04-40-50-767Z-results.json` (pull request #118). His 84 screenshots are not in the repository. The failures are in [#119](https://github.com/LLaammTTeerr/omnicourses/issues/119).

| ID | Result | What happened |
| --- | --- | --- |
| A11Y-01a | passed | Dũng: pass after a fix. `router.ts` has `/transcript`, which the screen table of the cases lacks; he adds the row (no rows, rows saved, a field error, save failed). The other 14 routes are in the table. The scripted run saw the same gap (#116). The row is not in the cases yet. |
| A11Y-01b | **failed** | Journeys 1–4, 6 and 7 can be finished by keyboard; journey 5 needs a guide (#114). Expected: focus always visible and never lost, and a skip link that jumps to the main content. Observed: after removing a placed course, focus goes to the course search box, scrolled out of view; after adding a course, saving in Settings, exporting and closing the revoke-session dialog, focus falls to the page body; on sign-up, sign-in and onboarding the skip link targets a `<main>` that wraps the top bar, so it skips nothing. Dialogs and the drawer do close with Esc and give focus back. |
| A11Y-01c | passed | `scrollWidth <= innerWidth` in all 21 states at 28 widths: 360, 768, 1280, 1920 and each CSS breakpoint (420, 620, 760, 860, 900, 960, 1100, 1180) with 1 px either side. 588 checks, none failing. The scripted run, on staging, found the same on 17 states at 25 widths ([output](evidence/b1/a-a11y-01c-output.txt)); it missed the breakpoint at 860. |
| A11Y-01d | **failed** | In Vietnamese the planner's **What-if** button stays in English; the scripted run saw the same (PLAN-01l). In English every state sets `lang="en"` and an English title; what stays Vietnamese is data that exists in one language. |
| A11Y-01e | **failed** | `color-contrast` violations in 65 of the 84 runs (21 states, two themes, 360 and 1280 px). Light theme: small and secondary text. Dark theme: the primary buttons and many nodes of the plan editor. Also `scrollable-region-focusable` on the audit at 360 px. |
| A11Y-01f | **failed** | Text-field borders 1.42:1 (light) and 1.78:1 (dark), 3:1 needed. Dark placeholder 3.89:1 and the light hint "Không cần tên thật…" 4.45:1, 4.5:1 needed. Progress bar against its track 2.55 to 2.85, 3:1 needed. Passed: body, secondary and sidebar text, status labels, group glyphs (5.1 to 9.0), focus outlines (5.48 and 5.81). The pairs are in Dũng's notes. |
| A11Y-01g | passed | Every group has its glyph, statuses are in words, field errors are written out, the chosen card has a check mark, and the graduation chip has words and an icon. |

States Dũng's run did not reach, listed in his file: the API degraded, too many attempts, server unreachable, account restored, program not listed, the planner's drag, lock, Taken strip and save-failed states, guides with content, and session expired. The scripted run saw several of those states work (UI-01g, UI-01p, PLAN-01e, g, j, n) but did not check their contrast, languages or widths.

### B0 cases run on B1

AUTH-01, SESS-01 and DB-01 ran locally, as in B0, because they count rows with `psql` and stop the database: on a build of the tested tree, not on the deployed server. Of them, staging saw only AUTH-01a and k (DEP-01d) and DB-01b, d, e. UI-01 and DEP-01 ran on staging. Evidence: [`b0-regression-local-output.txt`](evidence/b1/b0-regression-local-output.txt), [`a-ui-01-output.txt`](evidence/b1/a-ui-01-output.txt), [`a-followup-output.txt`](evidence/b1/a-followup-output.txt).

| ID | Result | What happened |
| --- | --- | --- |
| AUTH-01a–p | passed | All 16, with the statuses and messages of the [B0 report](report-b0.md). AUTH-01o: ten 401, then 429, then 200 after a minute. AUTH-01p: ten 201, then 429. |
| SESS-01a–k | passed | All 11. |
| SESS-01l | not run | Not run by hand, by design. The check in its place passed: every `expiresAt` was 7 days ahead, locally and on staging (2026-11-22). |
| DB-01a | passed | Empty database; the first migrate applied the 10 migrations, the second said "Database is up to date."; both exit 0 ([output](evidence/b1/local-db-01a-output.txt)). |
| DB-01b | passed | `{"status":"ok","database":"up"}`, with no version, locally and on staging. |
| DB-01c | passed | Database stopped: health 200 `{"status":"degraded","database":"down"}`, and the home page says "API degraded · database down". After the start: `ok` from 5 seconds on, for 60 seconds, without restarting the API (same process id) ([output](evidence/b1/local-db-01c-01d-output.txt), [screenshot](evidence/b1/local-db-01c-home-db-down.png)). |
| DB-01d | passed | The docs page shows one **Authorize** button and the groups health, users, auth, guides, curriculum, plans and curriculum-admin; the JSON starts with `{"openapi":"3.2.0"` ([screenshot](evidence/b1/local-db-01d-docs-page.png)). On staging the docs page and the JSON are served too; on production both answer 404. |
| DB-01e | passed | All 44 routes outside health, sign-up, sign-in and the two guide routes answered 401 without a token, locally and on staging. |
| DB-01f | passed | The five valid rows went in. The seven refusals failed on exactly the named constraints, in order. After `ROLLBACK`, `zztest_programs_left` is 0 and the shared counts are as before ([output](evidence/b1/local-db-01f-output.txt)). |
| UI-01a | **failed** | As written. A private address (`/dashboard`, `/settings`) goes to `/sign-in?redirect=…` with no signed-in content. But the app's own address shows a public home page, not the sign-in screen (#116). |
| UI-01b | passed | Sign-up on the screen answered 201 and signed in; the dashboard's sidebar and Settings show "Test Student" ([screenshot](evidence/b1/a-ui-01b-dashboard.png)). |
| UI-01c | passed | Four field errors in words, nothing sent. With 9 characters the password error says "Còn thiếu 1 ký tự."; the rule itself, "Ít nhất 10 ký tự", is the field's placeholder (#116) ([screenshot](evidence/b1/a-ui-01c-errors.png)). |
| UI-01d | passed | "Cần đồng ý xử lý dữ liệu để tạo tài khoản." at the consent box; no request sent. |
| UI-01e | passed | 409; "Email này đã có tài khoản. Đăng nhập", with a link to sign-in. |
| UI-01f | passed | 401; "Email hoặc mật khẩu không đúng." ("Wrong email or password."); the form stays usable. |
| UI-01g | passed | 11 wrong-password attempts in 6 seconds. The 11th said "Quá nhiều lần thử từ mạng này. Đợi một phút rồi thử lại." (429), not the wrong-password message. The 429 began at the 9th attempt: two sign-ins from the same address fell in the same minute, so the limit of 10 was reached at 2 + 8 ([screenshot](evidence/b1/a-ui-01g-11th.png)). |
| UI-01h | passed | After a reload, still on `/dashboard`; exactly one `POST /api/auth/refresh`, 200. |
| UI-01i | passed | Local Storage holds only `omnicourse.lang`. The token is in Session Storage (`omnicourse.session`) and in memory. |
| UI-01j | passed | Sign-out through the API 204; the reload landed on `/sign-in?redirect=/dashboard`, with no loop. |
| UI-01k | **failed** | As written. **Sign out** lands on the public home page, not the sign-in screen (#116). The rest holds: **Back** shows no signed-in content, neither storage holds a token, and the copied token answers 401. |
| UI-01l | **failed** | As written. A new tab has no token and is signed out; `/dashboard` goes to sign-in. But the app's address shows the public home page, not the sign-in screen (#116). |
| UI-01m | passed | Sign-up and sign-in by keyboard alone: skip link, theme, language, brand, fields, consent with Space, Enter to submit. Every stop has a visible focus outline or ring. |
| UI-01n | passed | Both forms change language fully, errors included, and `<html lang>` follows. The email placeholder `ban@example.com` is the same in English. |
| UI-01o | passed | No sideways scroll and every control inside the page at 360, 768, 1280 and 1920 px ([360 px](evidence/b1/a-ui-01o-sign-up-360.png)). |
| UI-01p | passed | With every `/api/` request aborted in the browser, in place of stopping the backend: "Chưa kết nối được OmniCourse. Kiểm tra mạng rồi thử lại sau ít phút." ([screenshot](evidence/b1/a-ui-01p-unreachable.png)). |
| UI-01q | passed | `npm run test:browser` on the tree at `7f66b7a`, whose frontend is that of `1decf4a`: 36 of 36 in 8 files, with the three tests of `SignIn.browser.spec.ts` ([output](evidence/b1/local-ui-01q-output.txt)). CI on `1decf4a` shows the same 36. |
| DEP-01a | passed | `https://`; the home page says "API ok · database up", with no version ([screenshot](evidence/b1/a-dep-01a-home.png)). The PostgreSQL version on the server was not read: that needs the server (B1 cases §8). |
| DEP-01b | passed | `{"status":"ok","database":"up"}`. |
| DEP-01c | passed | No CORS error and no console error through loading, sign-up, sign-in, onboarding and Settings. |
| DEP-01d | passed | AUTH-01a and AUTH-01k through the API on staging (201, then 200 with a new token), and UI-01b on the screen. |
| DEP-01e | not run | Needs a second tester on another network. Owner: Dũng with a second person. |
| DEP-01f | **failed** | As written. The `B1` tag is `1decf4a`, and the deploy run that created it (43666848017) deployed `1decf4a`: those two are the same. The commit tested is `7f66b7a`, one documents-only commit later, because #103 merged after the tag and both servers followed `main` and `staging`. No app code differs (see **Tested commit** at the top). Whether that is accepted is Lâm's call (#116). |

## 5. Carried to B2

| Cases | Result | Reason | Owner | Next action |
| --- | --- | --- | --- | --- |
| A11Y-01b, d, e, f | failed | #119 | Hoà (screens), Dũng (retest) | Fix, then rerun A11Y-01 with the states the run did not reach. |
| USER-01w | failed as written | The app shows the home page after deletion (#116) | Lâm (decision), Dũng (case) | Decide which is right; rerun. |
| USER-01n, q, r, y, z | passed locally, blocked on production | Need database access on a server | Lâm or Thắng | Run on staging with Lâm's OK if a server result is wanted. |
| USER-01k | failed | #115 | Lâm (decision), Hoà (screens), Dũng (case) | Decide: change the app, or the case and UC-01 A7. Then rerun. |
| GUIDE-01a–h, l, m, n | blocked | No guide was published on the tested build (#114) | Dũng, Lâm | #112 merged after the runs (`e20bdc1`): run them again on production for G01 and G07. G02 and G06 need their portal check before GUIDE-01b–e can fully pass. |
| GUIDE-01i, j, k | not run | Not run on the tested build; seen passing on the later commit `47e4ba3` | Dũng | Run on the B2 candidate with `--guide-fixtures`. |
| DEP-01e | not run | Needs two networks | Dũng and a second tester | Run on staging. GUIDE-01o showed on production that the limit counts each visitor. |
| ACAD-01h | blocked | No prerequisite or offering-term data (§6 item 14) | Thắng, Triết | Lâm confirmed on 15 November 2026 that "APCS has no prerequisite" covers every APCS course of both cohorts. Pull request #111 records that as data and merges after B1 ends. Then write the expected results and run; offering terms are still to enter. |
| PLAN-01n | failed | #101 | Hoà | Fix with a regression test; Dũng retests. |
| UI-01a, k, l, DEP-01f | failed as written | The cases describe a sign-in landing and a single commit (#116) | Dũng (cases), Lâm (DEP-01f) | Update the cases; rerun on B2. |
| SESS-01l | not run (by design) | Sessions last 7 days | Dũng | None. |
| PLAN-01m | failed as written | #117 | Lâm (rate limits), Dũng (case) | Find which is off by one, the limit on that route or the case; rerun. |

Missing academic data, kept visible as [test plan §5](test-plan.md#b1-checks) asks: **no prerequisite and no offering term is recorded for any course** (0 rows in the three tables; `null` in the API; the planner and the explorer say "chưa ghi nhận", never "none"). The audit does not check five graduation conditions and says so (ACAD-01d): no prosecution or suspension, the defence-education certificate, the foreign-language standard, the IT standard and the study time limit.

## 6. Defects

| Issue | Case | What |
| --- | --- | --- |
| [#101](https://github.com/LLaammTTeerr/omnicourses/issues/101) (known, open) | PLAN-01n | The planner's **Đã học / Taken** strip shows the whole transcript's credits and course tags beside a span of fewer terms. Seen on screen in this run; a comment on the issue gives the figures. |
| [#114](https://github.com/LLaammTTeerr/omnicourses/issues/114) (new) | GUIDE-01 | No guide is published in B1: G01, G02, G06 and G07 were drafts on the tested build. Missing content, not a code defect. Resolved for G01 and G07 by #112 after the runs; G02 and G06 are still drafts. |
| [#115](https://github.com/LLaammTTeerr/omnicourses/issues/115) (new) | USER-01k | No **My program isn't listed** choice, and the dashboard's finish-onboarding notice cannot be reached. Needs a decision. |
| [#116](https://github.com/LLaammTTeerr/omnicourses/issues/116) (new) | UI-01a, c, k, l, USER-01w, DEP-01f, A11Y-01a | The cases no longer match the screens as built: the app lands on a public home page where they expect the sign-in screen. A documentation fix, or a decision for USER-01w. |
| [#117](https://github.com/LLaammTTeerr/omnicourses/issues/117) (new) | PLAN-01m | On staging, `PUT /api/plans/{id}/placements` answered 200 to 121 requests in a minute against a documented 120; the 122nd was the first 429. Cause not established: on production's guide list the 121st request got 429 (GUIDE-01o), and the limit of 10 behaved as documented. |
| [#119](https://github.com/LLaammTTeerr/omnicourses/issues/119) (new) | A11Y-01b, d, e, f | Focus lost after some actions, a skip link that skips nothing on three screens, **What-if** not translated, and contrast below WCAG 2.1 AA. From Dũng's manual run. |

Seen and not filed, for the owners to judge:

- Staging serves the Swagger page and `/api/docs-json` although the cases say it runs like production (§6 item 12); production answers 404 for both. It helped this run. Lâm decides whether staging should keep it.
- In English, the planner's load tooltip reads "10–22" with no unit, where Vietnamese has "10–22 TC".
- The seed's "Already present, left untouched" line counts 11 programs where the table has 10.
- From Dũng's notes: the custom select keeps its list open after a mouse click on an option; reaching the planner board by keyboard takes about 90 Tabs; and test plan §5 still says drag-and-drop is B2 while B1 has the drag preview.

## 7. Accounts and data left by the run

On staging the run created 19 accounts, all `b1-run-07ef42-<role>@example.com`: `a01`–`a05`, `p01`, `p02`, `p03`, `p06`, `m06`–`m09`, `ms1`, `ms2`, `us1`, `us2`, `uo1` and `dep01d`. With them: their onboarding answers, synthetic transcripts, sessions and about 25 plans. Nothing else was written: no curriculum data, no guide, no grant.

All 19 were deleted through the app's own account deletion (`DELETE /api/users/me` with the password) at 03:27–03:30 UTC. Each answered 202, and the token used stopped working at once (401) ([`cleanup-output.txt`](evidence/b1/cleanup-output.txt)). **Deletion has a 30-day grace period, so the rows remain on staging until the purge on 15 December 2026** (`purgeAfter` 2026-12-15T03:27–03:30Z), or until staging's database is reset. Nobody should sign in to them before then: a sign-in restores the account.

On production, Dũng's manual run left the accounts his file lists: `b1-01` to `b1-04`, `b1-s1`, `b1-s2` and a new `b1-a11y`, beside `b1-perf` and `b1-06` to `b1-09` from 12 November. All are synthetic `example.com` accounts. `b1-02` has a password other than the one in the cases. They are to be deleted after the decision of §8 (Lâm, 15 November 2026); at the time of writing they are still there.

Locally, the container with both databases was removed, and the throwaway copy for COV-01c was deleted. Production was only read without an account: `GET /api/health`, `/api/guides`, `/api/docs` and `/api/docs-json`.

## 8. Decision

**Decision: B1 is accepted with exceptions** (Lâm, on Discord, 15 November 2026, 07:40 UTC). The Project Lead decided after both runs, on these figures: 127 passed, 12 failed, 12 blocked and 5 not run (156 cases). What was observed stays as recorded above; the decision changes no result. The local guide run on the later commit `47e4ba3` started at 07:41:39 UTC, after the decision, and changed no B1 result or figure.

The exceptions, each kept visible and carried to B2 (§5):

- **The 12 failed cases carry under their issues:** PLAN-01n (#101), USER-01k (#115), USER-01w, UI-01a, UI-01k, UI-01l and DEP-01f (#116), PLAN-01m (#117), and A11Y-01b, d, e, f (#119). None of them is in the audit, data or rule checks: ACAD-01a–g, ACAD-02, DATA-01, AI-01 and COV-01 all passed.
- **The 12 blocked cases carry as listed:** GUIDE-01a–h, l, m, n (#114, resolved for G01 and G07 only, after the runs; to run again on production) and ACAD-01h (prerequisite data: #111 merges after B1 ends).
- **The 5 not-run cases carry as listed:** GUIDE-01i, j, k (a local test database; not run on the tested build), DEP-01e (a second network) and SESS-01l (by design).
- **The synthetic test accounts on production are deleted after this decision** (§7).

As in B0, these are accepted exceptions for B1, never passes, and they do not waive B2's requirements ([test plan §7](test-plan.md#7-when-a-build-is-ready)).

Against the acceptance criteria of test plan §7:

- **Typecheck, tests, build, e2e and browser checks pass for the candidate:** yes (§3).
- **All required detailed cases pass:** no; accepted as exceptions. 127 of 156 passed; 12 failed, 12 are blocked and 5 are not run (§1).
- **No open defect exposes another student's data, loses data, gives a known wrong academic result or blocks a required task:** none of the first three was found. #101 shows a wrong credit figure on the planner's Taken strip; the audit's own figures are right. #114 left the guides task with nothing to read on the tested build. #119 leaves keyboard and low-vision use below the Vision's WCAG 2.1 AA target. #117 is a rate limit one request looser than documented on one route.
- **The report identifies the commit, the environment, the evidence, the coverage and the measured NFRs:** yes. Coverage 100 % of the rule engine's statements; load time under 2 seconds in every run (on production); accessibility measured and failing.
