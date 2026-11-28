# B1 regression on B2: results, 28 November 2026

Tester: Dũng, with Claude Code running the scripts and the browser. The B1 cases ([test-cases-b1.md](../../test-cases-b1.md), version 0.10 after #209, and 0.12 for the rows Lâm's calls of 28 November moved; the B0 cases of its §8 at [test-cases-b0.md](../../test-cases-b0.md) version 0.2, and 0.3 for DB-01c) run again on the build staging serves ([test-cases-b2.md §12](../../test-cases-b2.md#12-b1-regression-on-b2)). These are working notes and raw results, in the format of [the 27 November run](results-b1-regression-2026-11-27.md), which this run repeats with the same scripts.

**Summary.** Every recorded row ran on staging **`4b038fe`** or, for the local track, on a build of the same commit; no row is carried over from an earlier build. The open B1 defects fail again as §12 expects: #101 (PLAN-01n), #114 (G02 and G06 still drafts), #115 (USER-01k) and #119 (A11Y-01b, d, e, f; e is much reduced). The run found that the dashboard rebuilt by #214 no longer shows several figures the cases checked there, and that `/api/health` answers 503 when the database is down (#207). Lâm moved those checks to the audit page and updated the cases (B1 cases 0.12, B0 cases 0.3, 28 November); the rows they touch ran again on the new wording and are marked **case updated** with their result. It also found two defects, now filed: the dashboard sends one audit request per past term, so the rate limit answers 429 after about 17 loads a minute (#254), and a reload during the session refresh signs the student out (#255). PERF-01b–h are not recorded: they wait for a normal connection (§4).

## Build and setup

| Item | Value |
| --- | --- |
| Server | Staging, https://stag-omnicourses.lamter.cc |
| Commit | **`4b038fe`** (`main` after #246). Staging deploys from the `staging` branch; the deploy of `4b038fe` ran 07:37:25–07:38:20Z ([run 46122049317](https://github.com/LLaammTTeerr/omnicourses/actions/runs/46122049317)). `git ls-remote origin refs/heads/staging` gave `4b038fe` at 07:43:04Z, 08:01:10Z and 08:56:03Z. Since `778d120` it adds #228–#232, #245 (credit totals and training type), #250 and #246. |
| Earlier build | This run started at 06:34Z on `778d120`. When staging moved, every staging script was run again on `4b038fe` from 07:43Z, with new accounts (`r28c`); the `778d120` outputs are not recorded here (see "Runs on `778d120`"). Every script line read the same on both builds, except where a row says so. |
| CI on the commit | CI run [46121878509](https://github.com/LLaammTTeerr/omnicourses/actions/runs/46121878509) on `main`, all five jobs green: backend unit 78 files, 1169 tests; backend e2e 24 files, 368 tests; frontend unit 90 files, 1385 tests; frontend browser 13 files, 68 tests; `src/rules` statements 98.67 % |
| Browser | Chromium 156.0.8078.4, headless, through playwright-core 1.64.1, 1280×800, Vietnamese, light theme, unless a case says otherwise. A11Y-01: Chrome 144.0.7559.110 headed. |
| Scripts | The scripts of [`b1-regression/`](b1-regression/), unchanged, run from that folder with `RUN=r28c`. Their outputs are in [`b1-regression/r28/`](b1-regression/r28/), under the same names as on 27 November. New, in `r28/`: `a-audit-r28.mjs` (the steps B1 cases 0.12 moved to the audit page: USER-01c, i, ACAD-01a, c, 02d), `a-acad-r28.mjs` and `a-acad-01c-audit-text-r28.mjs` (the ACAD screen parts on the rebuilt dashboard, before 0.12), `a11y-01e-dashboard-recheck-r28.mjs`, `dashboard-audit-calls-r28.mjs`, `perf-01-timeout-probe-r28.mjs` and `perf-01d-probe-r28.mjs` (the PERF-01 probes), and `perf-01-r28.mjs` (PERF-01 adapted to the rebuilt dashboard, for the rerun; not recorded). The old scripts write fixed-name screenshots into `b1-regression/`; those were copied outside git and the committed 27 November files restored with `git checkout`. Screenshots are on Dũng's machine in `E:\Project\omnicourses-b2-evidence\b1-regression-r28\`. |
| Local track | AUTH-01, SESS-01, DB-01a, c, d, f, USER-01n, q, r (psql half), s–z (API and database parts), DATA-01a–c, e, AI-01f, COV-01 and GUIDE-01i–k: `git archive 4b038fe` unpacked into a scratch folder, `npm ci` and `npm run build` there, against disposable PostgreSQL 18.6 containers, 07:44–07:56Z. The branch checked out in the repository could not be switched. |
| Time | 06:34Z to 08:56Z; the recorded runs 07:43Z to 08:56Z (14:43 to 15:56 Vietnam time) |

Accounts, all `example.com`, all with the §1 password, all on staging:

| Account | Used for |
| --- | --- |
| `b1-run-r28c-a01` | USER-01k (onboarding not finished) |
| `b1-run-r28c-a02` | USER-01a–i (S of the screens), USER-01u, GUIDE-01e/l signed in, S2 of USER-01w |
| `b1-run-r28c-a03` | USER-01c Finish, USER-01l, ACAD-01a, 01g and 02d screens |
| `b1-run-r28c-a04` | ACAD-01c screen (completion fixture) |
| `b1-run-r28c-a05` | UI-01m keyboard sign-up, A11Y-01c onboarding states |
| `b1-run-r28c-a06` | S1 of USER-01w and x |
| `b1-run-r28c-m06`–`m09`, `ms1`, `ms2`, `dep01d`, `us1`, `us2`, `uo1` | The API cases of `b1-api-cases.mjs` and `b1-user-api-cases.mjs` |
| `b1-run-r28c-p01`, `p02`, `p06` | The planner scripts |
| `b1-run-r28f-ac1` | USER-01c and USER-01i on the 0.12 wording (signed up and onboarded on the screens) |
| `b1-run-r28f-ac2` | ACAD-01a (no transcript) and ACAD-02d on the 0.12 wording |
| `b1-run-r28f-ac3` | ACAD-01c on the 0.12 wording (completion fixture) |
| `b1-run-r28c-perf` | P of PERF-01 and A11Y-01: APCS 2024, the completion fixture from the committed bytes of `95ea154`, 45 rows ([output](b1-regression/r28/p-setup-perf-output.txt)) |
| `b1-run-r28a-*`, `r28b-*`, `r28probe-a02`, `r28d-ac1`–`ac3`, `r28e-ac1`, `r28e-ac2` | Left by the runs on `778d120` and by the two stopped runs of `a-audit-r28.mjs`; no recorded row uses them |

## Runs on `778d120`, not recorded

From 06:34Z to 07:35Z the same scripts ran on staging `778d120`. The first screen scripts (`RUN=r28a`) were started out of the 27 November order: `a-ui-01.mjs` ran before `a-onboarding.mjs`, so its UI-01e step (which expects 409 for an address that exists) signed up `b1-run-r28a-a02` instead, and `a-onboarding.mjs` and `a-onboarding-2.mjs` then stopped on that address; a probe signed up `b1-run-r28probe-a02`. Everything was run again with `RUN=r28b` in the 27 November order, and every script line read as it reads on `4b038fe` below. The local track first ran on a build of `931d809` (the repository's working tree); it was run again on `4b038fe`. Three first tries of PERF-01 on `778d120` stopped on runs that never drew their figures; the cause was found on `4b038fe` (§4). Two versions of `a-acad-r28.mjs` failed their own checks on wording before the recorded one (it looked for "8 / 40" where the dashboard writes "8/40", and read the five not-checked conditions from the first 900 characters of the page). On `4b038fe`, `a-audit-r28.mjs` (the 0.12 audit-page steps) ran twice before the recorded run: at 09:06Z its USER-01c check read the address too early (it waited for any address containing "dashboard", which `/onboarding?redirect=/dashboard` matched) and failed although every other check passed; at 09:07Z it stopped when the audit page of a newly signed-in account did not draw in 20 s, while other runs were using staging from the same address (cause not established; the recorded run at 09:09Z drew every page). None of these outputs is kept, as #250 asks.

## Results

"Same as 27 Nov" compares with [the 27 November run](results-b1-regression-2026-11-27.md). A case that failed in B1 on a bug still open is marked **failed, still open #N**. Every row below ran on `4b038fe`.

### §8: B0 cases run on B1

AUTH-01, SESS-01 and DB-01a, c, d, f ran locally; UI-01 and DEP-01 ran on staging, with DB-01b, d and e also run there. Scripts: `a-ui-01.mjs`, `a-followup.mjs` (UI-01b, g), `a-onboarding.mjs` (DEP-01a, c, d), `b1-api-cases.mjs` (DB-01b, d, e and DEP-01b, d on staging), `b0-regression-local.mjs` and the `local-*` outputs (local track). Every line of `a-ui-01.mjs`, `a-onboarding.mjs`, `a-followup.mjs` and `b1-api-cases.mjs` reads the same as on 27 November, account names aside.

| ID | Result | Notes |
| --- | --- | --- |
| AUTH-01a–p | passed | Same as 27 Nov, locally. AUTH-01o: ten 401, then 429, then 200 after a minute. AUTH-01p: ten 201, then 429 ([output](b1-regression/r28/b0-regression-local-output.txt)). |
| SESS-01a–k | passed | Same as 27 Nov, locally. |
| SESS-01l | not run, by design | The check in its place passed: every `expiresAt` 7 days ahead. |
| DB-01a | passed | Empty database: the first migrate applied 16 migrations (13 on 27 Nov), the second said "Database is up to date."; both exit 0 ([output](b1-regression/r28/local-db-01a-output.txt)). |
| DB-01b | passed | `{"status":"ok","database":"up"}`, no version, locally and on staging. |
| DB-01c | passed, case updated (#207) | Locally, with the database stopped: **503** with `{"status":"degraded","database":"down"}`, no version, and the home page says "API degraded · database down"; after the start, `ok` from +0 s to +61 s with the same API process ([output](b1-regression/r28/local-db-01c-01d-output.txt)). B0 cases 0.3 expect the 503, which lets the deploy roll back (TC-B2-OPS-01c); on 27 Nov (`1bde552`) the answer was 200. |
| DB-01d | passed | Same as 27 Nov. One **Authorize** button; the same groups; the JSON starts with `{"openapi":"3.2.0"`. As on 27 Nov, `b1-api-cases.mjs`'s byte-for-byte comparison of staging's document with the committed one fails on path order, which the case does not ask for. |
| DB-01e | passed | 68 of 69 routes answer 401 without a token, locally and on staging (66 of 67 on 27 Nov). The other is `GET /api/shared-plans/{token}` (404), public on purpose and listed in B1 cases 0.10; the script still checks the 0.9 list and prints its line as failed. |
| DB-01f | passed | Same as 27 Nov. Five valid rows in, seven refusals on exactly the named constraints, counts unchanged (10/11/133/249/1823) ([output](b1-regression/r28/local-db-01f-output.txt)). |
| UI-01a, c, k, l | passed | Same as 27 Nov, on the 0.2 wording; the script's lines for the old wording fail as before. |
| UI-01b, d–f, h–j, m–p | passed | Same as 27 Nov. |
| UI-01g | passed | Same as 27 Nov: 11 wrong sign-ins in 5 seconds; 401 eight times, then "Quá nhiều lần thử từ mạng này. Đợi một phút rồi thử lại." (429) from the 9th, because two sign-ins of the same minute came just before. |
| UI-01q | passed | From CI on `4b038fe`: `SignIn.browser.spec.ts` (3 tests) passed among 68 browser tests in 13 files. |
| DEP-01a–d | passed | Same as 27 Nov. |
| DEP-01e | not run | Needs a second tester on another network (Dũng's phone on mobile data). It passed on 27 Nov. |
| DEP-01f | not run | B2 has no tag yet. What can be checked holds: staging's deploy run 46122049317 deployed `4b038fe`, the commit tested. |

### §2: TC-B1-USER-01, onboarding and account privacy

Screens at 1280×800. Scripts as on 27 Nov: `a-onboarding.mjs` and `a-onboarding-2.mjs` (a–i, l), `a-user-01k.mjs`, `b1-user-api-cases.mjs` (m, o, r API half, s, t, v), `a-ui-01.mjs` (p), `a-user-01u.mjs` and `a-followup.mjs` (u), `a-user-01wx.mjs` (w, x), `p-user-01j-plan-01i.mjs` (j). n, q, r (psql half), y and z, and the API and database parts of s–x, ran in the local track ([output](b1-regression/r28/local-user-01-db-output.txt): every check ok).

| ID | Result | Notes |
| --- | --- | --- |
| USER-01a, b | passed | Same as 27 Nov. |
| USER-01c | passed, case updated (#214) | On the 0.12 wording, as the new account `r28f-ac1` ([output](b1-regression/r28/a-audit-r28-output.txt)): signed up and onboarded on the screens, APCS 2024, goals empty, **Xong** opens `/dashboard`, and so do the reload and a sign-in in a second browser; both browsers show "APCS2024 · sinh viên năm 1" on `/audit`; the API returns `null` for the three goals; Settings shows "Chưa biết" / empty / "Chưa chọn". The old scripts' dashboard check (`a-onboarding-2.mjs`) still fails on the 0.9 wording, as its output shows. |
| USER-01d–h | passed | Same as 27 Nov. |
| USER-01i | passed, case updated (#214) | On the 0.12 wording, same account: cohort 2025 saved in Settings (PUT 200); after a reload `/audit` shows "APCS2025 · sinh viên năm 1", the explorer "Khóa tuyển 2025", and `GET /api/users/me/audit` gives `curriculumCode` `APCS2025`; the goals unchanged. |
| USER-01j | passed | Same as 27 Nov. |
| USER-01k | **failed, still open #115** | Same as 27 Nov. |
| USER-01l, m, o, p, t, u, v | passed | Same as 27 Nov. |
| USER-01n, q, y | passed | Same as 27 Nov, locally. q: `consent_at` 28 ms after the sign-up was sent. |
| USER-01r | passed | Staging (API half) and locally (psql half): the export holds a key for every user table with as many rows. |
| USER-01s | passed | Same as 27 Nov: no credential-named key among 47 key names. New since 27 Nov, as #217 intends: `student_id` and `class_name` on the user row. |
| USER-01w | passed | Same as 27 Nov, on the screen ([output](b1-regression/r28/a-user-01wx-output.txt)): the dialog explains the 30-day grace period before the password; 202 with `purgeAfter` 30 days later to the minute; A shows `/`, signed out, with the toast naming that time; B's next request (`POST /api/auth/refresh`) gets 401 and B shows sign-in; sign-up again 409; S2 still 200. The database part passed locally. |
| USER-01x | passed | Sign-in 200 with `accountRestored: true` and the restored toast; `deletion_requested_at` and `purge_after` null in the export; E2 equals E1 except `exportedAt`, `user.updated_at` and `sessions`. |
| USER-01z | passed | Same as 27 Nov, locally: after the restart the log says "Purged 1 account(s) after the deletion grace period". |

### §3: TC-B1-GUIDE-01, public guides

Staging still publishes G01 and G07, version 1, last checked 15 Nov 2026; G02 and G06 are still drafts (#114). Scripts: `guide-01-g01-g07.mjs` (signed out, 07:43–07:45Z, [output](b1-regression/r28/guide-01-g01-g07-output.txt): 37 ok, 1 failed, 1 blocked, as on 27 Nov), `a-guide-01el-signed-in.mjs` ([output](b1-regression/r28/a-guide-01el-signed-in-output.txt)), `g-guides-local.mjs` (locally, [output](b1-regression/r28/g-guides-local-output.txt): 84 checks, 0 failed), `guide-01o-parallel.sh`.

| ID | Result | Notes |
| --- | --- | --- |
| GUIDE-01a–f, l | blocked, still open #114 | Same as 27 Nov: each passes for G01 and G07 and is blocked for G02 and G06 (drafts). |
| GUIDE-01g, h, m | passed | Same as 27 Nov. |
| GUIDE-01i, j, k | passed | Same as 27 Nov, locally with `--guide-fixtures` (D = 28 Nov 2026). |
| GUIDE-01n | passed | The two guide routes are public `GET`s, and the only other route that answers without a token is `GET /api/shared-plans/{token}`, which B1 cases 0.10 list. The script still checks the 0.9 list and prints that line as failed. |
| GUIDE-01o | passed, first reader only | 08:43:36–08:44:47Z, 12 at a time: 120 × 200 and 1 × 429 in 4.9 s, then 200 after a minute ([output](b1-regression/r28/guide-01o-parallel-output.txt), [each request](b1-regression/r28/guide-01o-burst-parallel.txt)). The second reader on another network (Dũng's phone) was not run this time; it passed on 27 Nov. |

### §4: TC-B1-PERF-01, dashboard and audit load time

| ID | Result | Notes |
| --- | --- | --- |
| PERF-01a | passed, case updated (#214) | The committed bytes of the fixture hash to `d0a0493f…facde` and P holds 45 rows ([output](b1-regression/r28/p-setup-perf-output.txt)). On the 0.12 wording: the dashboard shows 164 of 163 and the accumulated average 7,77 and no 4-point value; the audit page shows "Đạt mọi điều kiện kiểm tra được", "164 / 163 TC", 7,77 twice, Khá and 3,3 (`a-acad-r28-output.txt`, `a-audit-r28-output.txt`). |
| PERF-01b–h | not recorded | Two causes, both found on this build. (1) The case's dashboard series cannot run as written: one dashboard load sends 7 `GET /api/users/me/audit` requests for P, where the audit page sends 1 ([output](b1-regression/r28/dashboard-audit-calls-r28-output.txt)), so back-to-back reloads reach the 120-a-minute limit after about 17 loads; from then on the audit answers 429 and the dashboard shows "Chưa tải được kết quả xét tốt nghiệp." ([output](b1-regression/r28/perf-01-timeout-probe-settled-r28-output.txt): reloads 18–21 of 30). That made a few runs of every dashboard series, and the audit's cold series right after them, never draw their figures. Filed as #254 (Lâm); B1 cases 0.12 now leave at least 4 s between two dashboard loads. (2) A rerun paced at one run per 4 seconds (`perf-01-r28.mjs`, `PACE_MS`) started at 08:28Z on a connection about three times slower than earlier in the day: health 190–381 ms under the profile where the earlier tries saw 77–125 ms, and 0.28–0.54 s without it, on staging and production alike. It was stopped at 08:43Z. For information only, from runs that are not recorded: dashboard cold medians 951–1293 ms, warm 456–499 ms, in-app 139–158 ms; audit cold 903–1052 ms, warm 457 ms, in-app 129 ms, apart from the runs that hit 429. Lâm's call (28 Nov): rerun PERF-01b–h when the connection is normal ("Still to do"). |

The pointer also matters on the rebuilt dashboard: while it rests over the donut or a group row, the donut's centre shows that group's credits in place of `credits-toward-total`. On `4b038fe`, with the pointer left where the sign-in button had been, 4 of 20 reloads showed no `credits-toward-total` while the average was drawn; parked in the corner, 20 of 20 showed it (`perf-01d-probe-r28.mjs`, [output](b1-regression/r28/perf-01d-probe-r28-output.txt), [parked](b1-regression/r28/perf-01d-probe-r28-parked-output.txt)). `perf-01-r28.mjs` parks the pointer after each click. That is hover behaviour, not a defect.

### §5: TC-B1-A11Y-01, keyboard, languages, widths and contrast

`a11y-01.mjs` in the installed Chrome 144.0.7559.110 with axe-core 4.10.2 (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`), as P: the 21 states of B1, light and dark, Vietnamese, plus English for the language scan, 08:44:54–08:49:02Z ([output](b1-regression/r28/a11y-01-output.txt), [results JSON](b1-regression/r28/a11y-01-2026-11-28T08-44-54-900Z/results.json)). The 84 screenshots are outside git. `a-a11y-01c.mjs` ran the onboarding states at their widths ([output](b1-regression/r28/a-a11y-01c-output.txt)).

| ID | Result | Notes |
| --- | --- | --- |
| A11Y-01a | passed | `router.ts` at `4b038fe` has the B1 routes of the table and the B2 routes the B2 cases cover (`/calendar`, `/notifications`, `/shared/:token`, `/admin` with `curriculum`, `calendar`, `catalog`, `import`, `access`). No B1 screen is missing. |
| A11Y-01b | **failed, still open #119** | Not run again by hand: #119 is open. What the script checks again passes as in B1: the explorer drawer, the delete dialog and the new-plan dialog close on Esc and give focus back to their opener. |
| A11Y-01c | passed | `scrollWidth <= innerWidth` in all 21 states at 16 widths (360, 768, 1280, 1920 and each CSS breakpoint at 420, 620, 960 and 1180 px, at its value and ±1 px): 336 checks, 0 failing; the onboarding states of `a-a11y-01c.mjs` at 13 widths, all passing. |
| A11Y-01d | **failed, still open #119** | Same as 27 Nov. In Vietnamese the planner's "What-if" button still reads "What-if" (`plans/messages.ts`, Vietnamese block). In English every state sets `lang="en"`; what stays Vietnamese is data in one language. |
| A11Y-01e | **failed, still open #119**, much reduced | `color-contrast` in **7 of 84** state/theme/width runs of `a11y-01.mjs` (65 of 84 on 27 Nov and in B1), and no other axe rule (the audit's `scrollable-region-focusable` of 27 Nov is gone). Left: the quote block of sign-up (`.quote > b`, `.quote > p`) at 1280 px in both themes, empty and with field errors; and on the rebuilt dashboard the `.delta` chip and the group list. **Dashboard recheck** (`a11y-01e-dashboard-recheck-r28.mjs`, [output](b1-regression/r28/a11y-01e-dashboard-recheck-r28-output.txt)), with `reducedMotion: 'reduce'` and after every animation had finished, both themes at 360 and 1280 px: the group list passes, so its failures in `a11y-01.mjs` were measured during the opening animation; the `.delta` chip still fails in the light theme at both widths, `#0e7d4d` on `#e5efe8`, **4.39:1** where 4.5:1 is needed (12 px normal text); dark passes. The `.delta` chip and the sign-up quote block are #119 failures. |
| A11Y-01f | **failed, still open #119** | Not measured again by hand: #119 is open. |
| A11Y-01g | passed | Same as B1, on this run's screenshots: statuses in words on the audit and in the dashboard's groups, field errors written out under each field on sign-up. |

### §7: Other B1 checks

Scripts: `b1-api-cases.mjs` (ACAD API parts, PLAN-01a, b, d, f; [output](b1-regression/r28/b1-api-cases-output.txt), every line as on 27 Nov), `a-acad-screens.mjs` and `a-acad-01c.mjs` (both stop on the rebuilt dashboard, as their outputs show), `a-acad-r28.mjs` ([output](b1-regression/r28/a-acad-r28-output.txt): 12 checks, all ok) and `a-acad-01c-audit-text-r28.mjs` ([output](b1-regression/r28/a-acad-01c-audit-text-r28-output.txt)), and the `p-*` planner scripts (each prints the same lines as on 27 Nov except where noted).

| ID | Result | Notes |
| --- | --- | --- |
| ACAD-01a | passed, case updated (#214) | API: same as 27 Nov. On the 0.12 wording, as the new account `r28f-ac2` with no transcript, `/audit`: "Chưa đủ điều kiện tốt nghiệp" (`not_yet`), "0 / 163 TC", 163 remaining, no average; each group with a minimum at 0 of it (40, 16, 16, 26, 12, 10, 8) and **Kiến thức tự chọn** 0 / 43; **Tự chọn Computer Science (C)** "Không có tối thiểu riêng · tính trong Kiến thức tự chọn", never "0 / 0"; the no-transcript notice with its link to `/transcript`; no estimated graduation term ([output](b1-regression/r28/a-audit-r28-output.txt)). |
| ACAD-01b, d, f | passed | Same as 27 Nov. |
| ACAD-01c | passed, case updated (#214) | On the 0.12 wording, as the new account `r28f-ac3` with the fixture from the committed bytes (SHA-256 `d0a0493f…facde`): API `done`, nothing unmet, `towardTotal` 164, `remaining` 0, every group and the combined minimum met, five conditions not checked. `/audit`: "Đạt mọi điều kiện kiểm tra được", "164 / 163 TC", "còn 0 TC", 7,77 twice, Khá, 3,3, every group met, and **Trường sẽ xét** (`conditions-not-checked`) listing the five conditions, "không bao giờ được coi là đã đạt"; no graduation-guide link. The dashboard names only the language condition, under **Cần chú ý**, as 0.12 notes. As on 27 Nov, `a-acad-01c.mjs`'s checksum line fails on the CRLF checkout. |
| ACAD-01e | passed | Audit and plans parts as on 27 Nov, on the 0.10 wording (one "not checked" per placed course). The planner script prints the same 14 differing lines as on 27 Nov. |
| ACAD-01g | passed | API as on 27 Nov. Screen: 8 groups; both searches find CS163; clearing restores the list; the drawer shows CS163, "Cấu trúc dữ liệu", 4 TC, "(A): bắt buộc", "Không có môn tiên quyết." and offering terms not recorded, as B1 cases 0.10 expect. |
| ACAD-01h | blocked | Same as 27 Nov (offering terms). |
| ACAD-02a–c, e, f | passed | Same as 27 Nov (API). |
| ACAD-02d | passed, case updated (#214) | On the 0.12 wording, account `r28f-ac2`: first save, API 4 credits and 8.0, `/audit` "4 TC tích lũy" and 8; second save made outside the open audit page, then a reload: API 8, 7.0 and (A) bắt buộc 8; `/audit` 8 credits, 7 and "(A): bắt buộc … 8 / 40". |
| PLAN-01a, b, d, f | passed | Same as 27 Nov (API). |
| PLAN-01b (screen), c, e, i–l | passed | Same as 27 Nov. |
| PLAN-01g | passed | Same as 27 Nov on the 0.10 wording ("…chưa ghi nhận học kỳ mở môn."); row 2 is read at the first try ([probe output](b1-regression/r28/p-plan-01g-row2-probe-output.txt) agrees). |
| PLAN-01h | passed | Same as 27 Nov on the 0.10 wording ("3 mục chưa kiểm tra được"). |
| PLAN-01m | passed | Same as 27 Nov: exactly 120 saves answered 200; the browser's next save 429 and again at +2.2, +7.3 and +17.3 s; "Đang lưu…" for 17.5 s, then the board went back with "Chưa lưu được thay đổi…" and **Chưa lưu**; not saved after a reload. #117 not reproduced again. |
| PLAN-01n | **failed, still open #101** | Same as 27 Nov. |
| DATA-01a, c, e | passed | Same as 27 Nov, locally ([output](b1-regression/r28/local-data-01-output.txt)). |
| DATA-01b | passed | Same as 27 Nov, locally, on `official_notes` of the group "Kiến thức Math" of APCS 2024. |
| DATA-01d | passed | "rolls back everything when one insert fails" exists at `4b038fe` in `curriculum-seed.e2e-spec.ts`, which passed in CI (11 tests). |
| AI-01a–g | passed | Every named test title exists at `4b038fe`, and its file passed in CI run 46121878509: `test/ai.e2e-spec.ts` (4 tests), `src/ai/sse.spec.ts` (7), `src/ai/gateway-llm.service.spec.ts` (26), `test/account.e2e-spec.ts` (14). AI-01f locally: `ai_usage.user_id` references `users` with `ON DELETE CASCADE`. |
| COV-01a | passed | `src/backend/src/rules/` has 13 production files ([output](b1-regression/r28/local-cov-01-output.txt)). |
| COV-01b | passed | `src/rules/**` 98.67 % statements locally (142 tests) and in CI (≥ 80 %). |
| COV-01c | passed | 500 uncovered statements added to `gpa.ts` in the scratch build: 50.58 % and "Coverage for statements (50.58%) does not meet "src/rules/**" threshold (80%)", exit 1; the file restored from its copy. |

## Findings

1. **The rebuilt dashboard (#214) no longer showed several figures the B1 cases checked there** (the graduation status, the accumulated credits, the average, the classification, group (C), the curriculum code and the five unchecked conditions). Lâm's call (28 November): the checks move to the audit page. B1 cases 0.12 made the change for USER-01c, i, ACAD-01a, c, 02d and PERF-01; those rows passed on the new wording.
2. **The dashboard sends one audit request per past term**: 7 `GET /api/users/me/audit` per load for P (the current one, and one with `asOfYear`/`asOfNumber` for each of 2024 terms 1–3 and 2025 terms 1–3), against 120 a minute per address, so it shows its 429 error after about 17 loads a minute. Filed as **#254** (Lâm). B1 cases 0.12 pace PERF-01's dashboard loads at least 4 s apart.
3. **`/api/health` answers 503 when the database is down (#207).** Deliberate (TC-B2-OPS-01c); B0 cases 0.3 expect it, and DB-01c passed on that wording.
4. **A reload during the session refresh signs the student out.** In `perf-01-timeout-probe-r28.mjs` (first part, [output](b1-regression/r28/perf-01-timeout-probe-r28-output.txt)), the first load's `POST /api/auth/refresh` was cancelled by the reload (`net::ERR_ABORTED`), the reload's own refresh answered 401, and the page went to `/sign-in?redirect=/dashboard` for good. Filed as **#255**.
5. **Not app defects: script lines that check old wording.** As on 27 Nov: UI-01a, c, k; UI-01g (429 from the 9th); GUIDE-01n and DB-01e (the 0.9 public-route list); ACAD-01c's checksum line (CRLF); PLAN-01g, h and ACAD-01e's "not checked" words and counts (0.9); and now the dashboard checks of `a-onboarding-2.mjs`, `a-acad-screens.mjs` and `a-acad-01c.mjs` (0.11 and before).

## Still to do

| What | Who | How |
| --- | --- | --- |
| PERF-01b–h | Dũng | Lâm's call (28 Nov): rerun with `perf-01-r28.mjs` (0.12 dashboard figures, 4 s pacing) when the connection is normal, tonight or on the morning of 29 November, with the screen on. If it is still slow by midday on 29 November, record PERF-01b–h as **not run: slow tester connection**, and they move to B3. |
| #254, #255 | Lâm | Fix or accept; then retest the dashboard's request count and the reload. |
| DEP-01e and GUIDE-01o's second reader | Dũng, with his phone on mobile data | As on 27 Nov. |
| DEP-01f | Dũng, when B2 is tagged | Compare the tag, its deploy run and `4b038fe`. |
| A11Y-01b, f by hand; A11Y-01e's `.delta` chip and sign-up quote block | When #119 is fixed | Its retest in test-cases-b2.md §13. |

## Evidence

Everything is in [`b1-regression/r28/`](b1-regression/r28/): each `*-output.txt` is the output of the recorded run of the script of the same name in `b1-regression/` (or in `r28/` for the new ones). No aborted attempt is kept, no state or token file, and no file holds a token, a password hash or a session token. Screenshots (the scripts' fixed-name ones, the new ACAD and audit-page ones, the A11Y states, the dashboard recheck and the local DB-01c/d pages) are outside git in `E:\Project\omnicourses-b2-evidence\b1-regression-r28\`.
