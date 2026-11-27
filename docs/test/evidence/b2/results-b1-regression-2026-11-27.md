# B1 regression on B2: results, 27 November 2026

Tester: Dũng, with Claude Code running the scripts and the browser. The B1 cases ([test-cases-b1.md](../../test-cases-b1.md), version 0.9, and the B0 cases of its §8 at [test-cases-b0.md](../../test-cases-b0.md) version 0.2) run again, unchanged, on the newest build ([test plan §2](../../test-plan.md), [test-cases-b2.md §12](../../test-cases-b2.md#12-b1-regression-on-b2)). These are working notes and raw results, in the format of [the B1 results](../b1/results-2026-11-15.md).

## Build and setup

| Item | Value |
| --- | --- |
| Server | Staging, https://stag-omnicourses.lamter.cc |
| Commit | `1bde552` (main after #206). Staging was reset to it by Deploy run [45970418322](https://github.com/LLaammTTeerr/omnicourses/actions/runs/45970418322), finished 09:03:40Z; before that, staging ran `50f6ce2`, 30 commits behind. The page bundle `index-CAWT2Yk5.js` is the same as production's. It includes the B2 cleanup (#182–#203) and the notifications inbox (#204). |
| CI on the commit | CI run [45959333443](https://github.com/LLaammTTeerr/omnicourses/actions/runs/45959333443) on `main`, all five jobs green |
| Browser | Chromium 156.0.8078.4, headless, through playwright-core 1.64.1, 1280×800, Vietnamese, light theme, unless a case says otherwise. PERF-01 and A11Y-01: see their sections. |
| Scripts | The B1 scripts, copied to [`b1-regression/`](b1-regression/) and run there (list under Evidence). Changes to the copies: the account prefix (`RUN`), paths one folder deeper, the screenshot path on Windows, the address of staging, and the account of PERF-01. No expected value was changed. |
| Local track | DB-01, AUTH-01, SESS-01, USER-01n, q, y, z, DATA-01, COV-01c and UI-01q ran on this machine against a disposable PostgreSQL 18.6 container, on the tree of `1bde552`: see "Local track" |
| Time | 09:06Z to 10:43Z (16:06 to 17:43 Vietnam time) |

Accounts, all `example.com`, all with the §1 password, all on staging:

| Account | Used for |
| --- | --- |
| `b1-run-r27a-a01` | USER-01k (onboarding not finished) |
| `b1-run-r27a-a02` | USER-01a–i (S of the screens), USER-01u, GUIDE-01e/l signed in, S2 of USER-01w |
| `b1-run-r27a-a03` | USER-01c Finish, USER-01l, ACAD-01a, 01g and 02d screens |
| `b1-run-r27a-a04` | ACAD-01c screen (completion fixture) |
| `b1-run-r27a-a05` | UI-01m keyboard sign-up, A11Y-01c onboarding states |
| `b1-run-r27a-a06`, `a07` | S1 of USER-01w and x: a06 on the first run, a07 on the second (see USER-01x) |
| `b1-run-r27a-m06`–`m09`, `ms1`, `ms2`, `dep01d` | The API cases of `b1-api-cases.mjs` (ACAD, PLAN-01a, b, d, f, DEP-01d) |
| `b1-run-r27a-us1`, `us2`, `uo1` | The API cases of `b1-user-api-cases.mjs` (USER-01m, o, r, s, t, v) and USER-01u as written |
| `b1-run-r27a-p01`, `p03`, `p06` | The first, stopped run of the planner scripts (see PLAN-01) |
| `b1-run-r27b-p01`, `p03`, `p06` | The planner scripts: p01 is S1's stand-in, p03 is b1-02's (USER-01j, PLAN-01i), p06 is b1-06's (completion fixture) |
| `b1-run-r27a-perf` | P of PERF-01 and A11Y-01 (b1-perf exists on production only): APCS 2024, the completion fixture saved from the committed bytes of `95ea154` ([output](b1-regression/p-setup-perf-output.txt)) |

## Results

"Same as B1" compares with the [B1 report](../../report-b1.md). A case that failed in B1 on a bug still open is marked **failed, still open #N**, not as a new bug.

### §8: B0 cases run on B1

As in B1, AUTH-01, SESS-01 and DB-01 ran locally, because they count rows with `psql` and stop the database; UI-01 and DEP-01 ran on staging, with DB-01b, d and e also run there. Screens at 1280×800 unless noted. Scripts: `a-ui-01.mjs`, `a-followup.mjs` (UI-01b, g), `a-onboarding.mjs` (DEP-01a, c, d), `b1-api-cases.mjs` (DB-01b, d, e and DEP-01b, d on staging), `b0-regression-local.mjs` and the `local-*` files (local track).

| ID | Result | Notes |
| --- | --- | --- |
| AUTH-01a–p | passed | Same as B1, locally. AUTH-01o: ten 401, then 429, then 200 after a minute. AUTH-01p: ten 201, then 429 ([output](b1-regression/b0-regression-local-output.txt)). |
| SESS-01a–k | passed | Same as B1, locally (11 cases). |
| SESS-01l | not run, by design | The check in its place passed: every `expiresAt` 7 days ahead (2026-12-04), locally and on staging. |
| DB-01a | passed | Empty database: the first migrate applied 13 migrations (10 in B1), the second said "Database is up to date."; both exit 0 ([output](b1-regression/local-db-01a-output.txt)). |
| DB-01b | passed | `{"status":"ok","database":"up"}`, no version, locally and on staging. |
| DB-01c | passed | Locally: with the database stopped, health 200 `{"status":"degraded","database":"down"}` and the home page says "API degraded · database down"; after the start, `ok` from +0 s to +61 s with the same API process ([output](b1-regression/local-db-01c-01d-output.txt)). |
| DB-01d | passed | One **Authorize** button; groups now also include academic-calendar, sharing and notifications (B2); the JSON starts with `{"openapi":"3.2.0"`. On staging the served document has the same content as the committed `openapi.json` but lists its paths in another order, so `b1-api-cases.mjs`'s byte-for-byte comparison failed; the case does not ask for that comparison. |
| DB-01e | passed, with a case to update | 66 of 67 routes answer 401 without a token, locally and on staging. The one that does not is `GET /api/shared-plans/{token}` (404, "This plan is not shared"), public on purpose since #153, as under GUIDE-01n (finding 1). |
| DB-01f | passed | Same as B1. Five valid rows in, seven refusals on exactly the named constraints, counts unchanged (10/11/133/249/1823) ([output](b1-regression/local-db-01f-output.txt)). |
| UI-01a | passed | **First run of the wording of B0 cases 0.2** (#116, #128; B1 failed it as then written). The app's address shows the public home page, signed out; `/dashboard` and `/settings` go to `/sign-in?redirect=…`. The script's line "the app address itself shows the sign-in screen (as the case is written)" checks the old wording and fails as in B1. |
| UI-01b | passed | Same as B1. 201, signed in, sidebar and Settings show "Test Student". |
| UI-01c | passed | First run of the 0.2 wording. Four field errors in words, nothing sent; with 9 characters "Còn thiếu 1 ký tự.", placeholder "Ít nhất 10 ký tự". The script's line for the old wording fails as in B1. |
| UI-01d | passed | Same as B1. |
| UI-01e | passed | Same as B1. 409, "Email này đã có tài khoản. Đăng nhập" with a link. |
| UI-01f | passed | Same as B1. 401, "Email hoặc mật khẩu không đúng." / "Wrong email or password." |
| UI-01g | passed | Same as B1. 11 wrong sign-ins in 8 seconds; the 11th said "Quá nhiều lần thử từ mạng này. Đợi một phút rồi thử lại." (429). As in B1 the 429 began at the 9th attempt, because two sign-ins from the same address (UI-01b and USER-01u, just before) fell in the same minute. The script's own line fails on that count, as in B1. |
| UI-01h | passed | Same as B1. |
| UI-01i | passed | Same as B1. Local Storage only `omnicourse.lang`; the token in Session Storage. |
| UI-01j | passed | Same as B1. |
| UI-01k | passed | First run of the 0.2 wording. **Sign out** lands on the public home page `/`; Back shows sign-in, no signed-in content; no token in either storage; the copied token 401. The script's line for the old wording fails as in B1. |
| UI-01l | passed | First run of the 0.2 wording. The app's address shows the public home page, signed out; `/dashboard` goes to sign-in. |
| UI-01m | passed | Same as B1. |
| UI-01n | passed | Same as B1. |
| UI-01o | passed | Same as B1 (360, 768, 1280, 1920 px). |
| UI-01p | passed | Same as B1, with `/api/` requests aborted in the browser: "Chưa kết nối được OmniCourse. Kiểm tra mạng rồi thử lại sau ít phút." |
| UI-01q | passed | Locally, `npm run test:browser`: 63 of 63 in 11 files, the three tests of `SignIn.browser.spec.ts` included. The first run on a cold Vite cache failed to import 9 files and is recorded as not counted ([output](b1-regression/local-ui-01q-output.txt)). CI on `1bde552` shows the same 63. |
| DEP-01a | passed | Same as B1. `https://`; "API ok · database up", no version. |
| DEP-01b | passed | Same as B1. |
| DEP-01c | passed | Same as B1. No CORS or console error through loading, sign-up, sign-in, onboarding and Settings. |
| DEP-01d | passed | Same as B1. AUTH-01a and k through the API on staging, and UI-01b on the screen. |
| DEP-01e | passed | **First run** (not run in B1). While this address was refused on sign-in (12 × 429 in each of the minutes 10:38 and 10:39Z, `phone-flood.sh`, under GUIDE-01o), Dũng signed in on his phone on mobile data (5G) as `b1-run-r27a-a02` at 17:39 Vietnam time: the dashboard opened ("APCS2025 · year 1", no transcript), with no "too many attempts" message. So the limit counts each reader, not staging's proxy. |
| DEP-01f | not run | B2 has no tag yet. What can be checked holds: the staging deploy run 45970418322 deployed `1bde552`, the commit tested. |

### §2: TC-B1-USER-01, onboarding and account privacy

Screens at 1280×800. Scripts: `a-onboarding.mjs` and `a-onboarding-2.mjs` (a–i, l), `a-user-01k.mjs`, `b1-user-api-cases.mjs` (m, o, r API half, s, t, v), `a-ui-01.mjs` (p), `a-user-01u.mjs` and `a-followup.mjs` (u), `a-user-01wx.mjs` (w, x, new: B1 ran them by hand), `p-user-01j-plan-01i.mjs` (j). The database cases n, q, r (psql half), y and z ran in the local track.

| ID | Result | Notes |
| --- | --- | --- |
| USER-01a | passed | Same as B1. Sign-up goes straight to "Câu 1 / 4 · Chương trình"; the question has no input field (no portal password, student ID or real name). |
| USER-01b | passed | Same as B1. Only APCS, cohorts 2024 and 2025; no free text, no faculty question. |
| USER-01c | passed | Same as B1. "Xong" with the goals empty lands on `/dashboard` on APCS 2024; the API returns `null` for the three goals and Settings shows "Chưa biết" / empty / "Chưa chọn". A second browser signs in to `/dashboard`. As in B1, `a-onboarding.mjs` read the API with a token the page had already rotated (its USER-01c–i lines fail with 401 on the API read-back); `a-onboarding-2.mjs`, which B1 wrote for this, reads it fresh and passes every check. |
| USER-01d | passed | Same as B1. `{year: 2027, number: 2}`, 18, `{year: 2027, number: 1}` after a reload. |
| USER-01e | passed | Same as B1. 23 and 9 saved as typed, no cap message. |
| USER-01f | passed | Same as B1. -1, 2.5 and abc refused at the field ("Nhập một số nguyên từ 1 trở lên."), nothing sent, 9 kept; cleared saves `null`. |
| USER-01g | passed | Same as B1. 0 refused the same way; 40 saved. |
| USER-01h | passed | Same as B1. "Không thực tập" stored as `"none"`, cleared gives `null`. |
| USER-01i | passed | Same as B1. Cohort 2025 saved; dashboard, explorer and audit use APCS2025; goals unchanged. |
| USER-01j | passed | Same as B1. After the cohort change to 2025 the same plan opens with "CTĐT APCS2024" and CS160 still placed. The script's line "Lộ trình creates Kế hoạch mặc định and opens it" differs on "tabs []" exactly as in B1 (one plan shows no tab bar), and B1 counted the case passed. |
| USER-01k | **failed, still open #115** | Same as B1. No "My program isn't listed" choice; opening the dashboard sends the student to `/onboarding?redirect=/dashboard` instead of a notice. The rest holds: no program saved, the audit API answers 409 `onboarding_required`, Guides open (two guides now, so the script's "4 guides" line differs), onboarding opens after signing in again. |
| USER-01l | passed | Same as B1. Resumes at "Câu 3 / 4 · Mục tiêu" with APCS 2024 kept. |
| USER-01m | passed | Same as B1. Both onboarding routes 401 without a token; S2's token reads and changes only S2's answers; neither route takes a user id. |
| USER-01n | passed | Same as B1, locally. The hash starts with `$argon2id$` (only 10 characters read); 0 matches of the password in `pg_dump --data-only` and in the backend log ([output](b1-regression/local-user-01-db-output.txt)). |
| USER-01o | passed | Same as B1. Sign-up, sign-in, refresh, `/users/me`, sessions, onboarding GET and PUT, export: no `password`, `passwordHash` or `password_hash` key, no `$argon2`, no test password. |
| USER-01p | passed | Same as B1. Opens signed out from the link beside the consent box; English and Vietnamese state what is stored, kept until deletion, 30 days with sign-in cancelling, 14 pre-deploy copies and nightly backups kept 7 days ("planned"), export and deletion. |
| USER-01q | passed | Same as B1, locally. `consent_at` 38 ms after the sign-up was sent. |
| USER-01r | passed | Staging (API half): 200 as `omnicourse-account.json`; `user` with id, email, display name and `consent_at`; 3 transcript rows, 2 sessions, the Prepare answers, 1 plan. Locally (psql half): the user-table query lists 10 tables, the B2 ones `notifications` and `plan_shares` included, and the export has the same rows in each. |
| USER-01s | passed | Same as B1. No credential-named key at any depth among 45 key names; neither bearer token, no session token hash, no `$argon2`, no test password. The export now also has the B2 tables `global_admin_grants`, `notifications`, `plan_shares` and `program_admin_grants` (empty for this account). |
| USER-01t | passed | Same as B1. S2's id, email and ZZ201 absent; the control search finds S1's own. |
| USER-01u | passed | Same as B1. "Xuất dữ liệu" saves `omnicourse-account.json` with the same tables and counts as the API export (a02, and us1 with the Prepare data). |
| USER-01v | passed | Same as B1. 403 "Wrong password", still signed in, `deletion_requested_at` and `purge_after` null. |
| USER-01w | passed | **First run of the wording of cases 0.8** (#129; B1 failed it as then written). The dialog says "…bị xóa vĩnh viễn sau 30 ngày…" before the password field. 202 with `purgeAfter` 43,200.0 minutes after the request. A shows `/`, signed out, toast "Tài khoản sẽ bị xóa vĩnh viễn sau 16:42 27/12/2026. Đăng nhập lại trước đó để hủy." (the `purgeAfter` time in Vietnam time). B's next request, `POST /api/auth/refresh`, gets 401 and B shows `/sign-in?redirect=/settings`. Sign-up again: 409. S2: 200. `purge_after` in the database: see the local track. |
| USER-01x | passed | Sign-in 200 with `accountRestored: true` and the toast "Chào mừng trở lại. Việc xóa tài khoản đã được hủy…". The export's user row has `deletion_requested_at` and `purge_after`, both null. E2 equals E1 except `exportedAt`, `user.updated_at` and `sessions`. **Two runs:** the first (a06, [output](b1-regression/a-user-01wx-attempt1-output.txt)) passed every check, but its log of the two deletion fields printed `{}` (the script read them with `??`, which skipped the null), so the check was rewritten to test that both keys exist and are null, and run again on a new account a07 ([output](b1-regression/a-user-01wx-output.txt)). The first run left a06 deleted and then restored, with 4 sessions; a07 started fresh. |
| USER-01y | passed | Same as B1, locally. S3 and an unregistered address get identical 401 bodies; S3's row still exists. |
| USER-01z | passed | Same as B1, locally. After the restart the log says "Purged 1 account(s) after the deletion grace period"; S3 has no `users` row and 0 rows in every user table; S2's and the shared counts unchanged; the new sign-up's export holds nothing from the old account. |

### §3: TC-B1-GUIDE-01, public guides

Staging publishes G01 (`accounts-and-portals`) and G07 (`grades-and-transcript`), version 1, last checked 15 Nov 2026; G02 and G06 are still drafts (#114). Since B1 the content files changed only by losing their code comments (#192): `git diff e20bdc1 1bde552 -- src/backend/src/guides/content/` removes 51 comment lines and nothing else. Scripts: `guide-01-g01-g07.mjs` (signed out, headless, a new context per check, 09:06–09:08Z, [output](b1-regression/guide-01-g01-g07-output.txt): 37 ok, 1 failed, 1 blocked), `a-guide-01el-signed-in.mjs` (signed in as a02, new: B1 did this half by hand, [output](b1-regression/a-guide-01el-signed-in-output.txt)), `guide-01o-parallel.sh`.

As in B1, a case that passes for G01 and G07 and is blocked for G02 and G06 counts as **blocked**.

| ID | Result | Notes |
| --- | --- | --- |
| GUIDE-01a | blocked, still open #114 | Same as B1: passes for G01 and G07 (content unchanged but for comments), blocked for G02 and G06 (drafts). |
| GUIDE-01b | blocked, still open #114 | Same as B1. G01 and G07 each under its group with task, portal, account and direct link; G02 and G06 not listed. |
| GUIDE-01c | blocked, still open #114 | Same as B1. Every query in Vietnamese and English lists exactly its expected guides among G01 and G07, or the no-match message; typing `tai khoan` narrows 2 → 1 and never widens; no error. |
| GUIDE-01d | blocked, still open #114 | Same as B1. "xyzzy" gives the no-match message with the two groups that have a guide; no Suggest a guide, no advisor link; cleared, G01 and G07 are back. |
| GUIDE-01e | blocked, still open #114 | Same as B1: the case opens G02, a draft. On G01 and G07, signed out and signed in, the page shows the guide with its numbered steps, and the content is identical (same digest). **The B1 defect is fixed:** G01's step links no longer fall into the number column (#121; 5 steps on G01, 4 on G07, no link narrower than 40 px). |
| GUIDE-01f | blocked, still open #114 | Same as B1. G01: 11 outside links, G07: 2, each an `<a href>` equal to an address of its content file, new tab, `rel="noopener noreferrer"`. "Mở Portal Chương trình đề án" opens the portal (its sign-in, with the page as `returnurl`) in a new tab; the OmniCourse tab stays. |
| GUIDE-01g | passed | Same as B1. Both guides open directly in a new private context and after a reload; `/guides/no-such-guide` shows "Không tìm thấy hướng dẫn" with a link to `/guides`, API 404; the draft addresses show the same. |
| GUIDE-01h | passed | Same as B1. On the list and both guides, titles, groups and text change language; the version stays; the address does not change. |
| GUIDE-01i | passed | Same as B1, locally (staging refuses the test-only guides, §6 item 12): a new container seeded with `--guide-fixtures`, API :3056, app :5176, 10:21–10:24Z, `g-guides-local.mjs`, 84 checks, 0 failed ([output](b1-regression/g-guides-local-output.txt)). `zz-vi-only` in English and `zz-en-only` in Vietnamese show their text with the one-language note; search finds each in both languages. |
| GUIDE-01j | passed | Same as B1, with D = 27 Nov 2026: `zz-fresh` (27/11/2026) and `zz-six-months` (27/05/2026) show no warning; `zz-six-months-and-a-day` (26/05/2026) warns with its date ("26/05/2026", "26 May 2026") and stays readable. |
| GUIDE-01k | passed | Same as B1. `zz-draft` and `zz-withdrawn` are not listed or found and get the same 404 page and API answer as an unknown guide. |
| GUIDE-01l | blocked, still open #114 | Same as B1 against the wording of cases 0.5. Signed out: one guide request per page, no `Authorization`, no personal field. Signed in as a02: all six guide routes (list, G01, G07, G02, G06, unknown) answer the same status and byte-identical bodies with and without the token, with no email, name or identity key; the guide content has the same digest signed in and out. The sidebar shows the display name, which is not guide content (0.5). Blocked for G02 and G06. |
| GUIDE-01m | passed | Same as B1. G01 and G07: no password field and no form, signed out and signed in; the OmniCourse tab sends nothing to a portal address before or after pressing the link; G01 tells the student never to give the portal password to anyone, OmniCourse included. |
| GUIDE-01n | passed, with a case to update | The two guide routes are public `GET`s (200, 404 unknown) and the OpenAPI document has no other guide route. The script's check that every other route answers 401 except health, sign-up and sign-in **fails as written**: `GET /api/shared-plans/{token}` answers 404 without a token. That route is B2's read-only plan sharing, public on purpose: #153 added it to `PUBLIC_ROUTES` in `public-routes.e2e-spec.ts` in the same PR, and that test passed in CI on `1bde552`. The other 66 routes answer 401; health 200, sign-up and sign-in 400 to an empty body. Not a bug; the case's list of public routes predates B2 (finding 1). |
| GUIDE-01o | passed | 120 × 200, then 429, then 200 after a minute. Tester Y on another network, as in B1: Dũng's phone on 5G opened Guides at 17:38 Vietnam time (10:38Z) and saw both guides while this address got 429 (see the second reader below). `guide-01o.sh` (one request at a time, as in B1) took 63 s on staging, longer than the minute, so all 121 answered 200 and proved nothing ([output](b1-regression/guide-01o-output.txt)); `guide-01o-parallel.sh` sent them 12 at a time from 09:12:09.2Z to 09:12:21.6Z: 120 × 200 and one 429 (request 113 in sending order), then 200 at 09:13:27Z ([output](b1-regression/guide-01o-parallel-output.txt), [each request](b1-regression/guide-01o-burst-parallel.txt)). **Second reader:** `phone-flood.sh` kept this address over both limits from 10:38:08Z to about 10:43Z, sending 125 guide requests and 11 wrong-password sign-ins (for a01) about every 30 seconds ([rounds](b1-regression/phone-flood-output.txt), [each status](b1-regression/phone-flood-statuses.txt)). In the minutes 10:38 and 10:39, this address got 130 × 429 on the guide list and 12 × 429 on sign-in in each minute. Meanwhile Dũng's phone, on mobile data (5G, Wi-Fi off), opened `/guides` at 17:38 and saw both guides with no error. The phone screenshots are outside git, because the status bar shows the phone's notifications: `E:\Project\omnicourses-b2-evidence\b1-regression\`. A first flood at 10:28–10:32Z is kept as `phone-flood-attempt1-*`; it does not count, because the phone check was not made during it. |

### §4: TC-B1-PERF-01, dashboard and audit load time

`perf-01.mjs` in the installed Chrome 144.0.7559.110, headed, on Dũng's PC with nobody using it, 10:06:25–10:09:30Z, profile 50 ms, 10 Mbps down, 2 Mbps up ([output](b1-regression/perf-01-output.txt), [every run with its API server waits](b1-regression/perf-01-2026-11-27T10-06-25-336Z.json)). Account P = `b1-run-r27a-perf` (staging has no `b1-perf`). Fixture: the committed bytes of `95ea154`, SHA-256 `d0a0493f…facde`, 45 rows, 12 terms; after the last series the API still held 45 rows equal to the fixture ([output](b1-regression/perf-01a-after-output.txt)). Nothing else ran against staging during this run; P was the only account in use.

**First attempt, not counted.** A first run from 09:43:40Z ([output](b1-regression/perf-01-attempt1-output.txt)) passed PERF-01b, c and e, but all 30 warm reloads of PERF-01d ran into the script's 30-second timeout ("n/a"), and it was stopped at 10:03Z before PERF-01f–h. A probe right after ([`perf-01d-probe.mjs`](b1-regression/perf-01d-probe.mjs), [output](b1-regression/perf-01d-probe-output.txt)) saw the dashboard complete after each reload, with every expected value and nothing busy, so the page was not at fault. The cause is not established. The likeliest one is that the headed window was not visible: the script checks each animation frame, and Chrome pauses those for a hidden window. The local track was also running on the same PC until 09:59Z. Before the second run the script was changed to print each failed run's error, and Dũng made sure the screen was on and unlocked.

| ID | Result | Notes |
| --- | --- | --- |
| PERF-01a | passed | Same as B1. Checksum of the committed bytes, 45 rows, and both pages show every expected value: 164 / 163 TC, 7,77 twice, Khá, done, and 3,3 on the audit only (ACAD-01c's screens and every PERF run). |
| PERF-01b | passed | Health 93–249 ms (all ≥ 50). Largest JS `index-CAWT2Yk5.js`, 170,172 bytes on the wire (B1: 121,864) in 227 ms; the profile predicts about 186 ms for that size. |
| PERF-01c | passed | Dashboard cold, 5 runs: median 995, max 1095 ms (B1: 773, 889). |
| PERF-01d | passed | Dashboard warm, 30 runs: median 464, p95 816, max 845 ms (B1: 443, 471, 472). |
| PERF-01e | passed | Dashboard in-app, 30 runs: median 128, p95 141, max 190 ms (B1: 111, 125, 130). |
| PERF-01f | passed | Audit cold, 5 runs: median 1228, max 1398 ms (B1: 780, 831). |
| PERF-01g | passed | Audit warm, 30 runs: median 495, p95 852, max 880 ms (B1: 504, 520, 1047). |
| PERF-01h | passed | Audit in-app, 30 runs: median 130, p95 205, max 227 ms (B1: 124, 136, 137). |

Every run is under 2 seconds. The cold loads are about 220 ms (dashboard) and 450 ms (audit) slower than in B1, and the main bundle grew by 48 KB on the wire. Not a failure, but the margin on a cold audit load is now 0.6 s (finding 4).

### §5: TC-B1-A11Y-01, keyboard, languages, widths and contrast

`a11y-01.mjs` in the installed Chrome 144.0.7559.110 with axe-core 4.10.2 (tags `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`), as P: the 21 states of B1, light and dark, Vietnamese, plus English for the language scan, 10:10:35–10:16:09Z ([output](b1-regression/a11y-01-output.txt), [results JSON](b1-regression/a11y-01-2026-11-27T10-10-35-868Z/results.json)). Then `B1_WIDTHS_ONLY=1` for the widths, 10:17–10:19Z ([output](b1-regression/a11y-01c-widths-output.txt), [JSON](b1-regression/a11y-01-2026-11-27T10-17-15-330Z/results.json)). The 84 screenshots (23 MB) are not in git: they are on Dũng's machine in `E:\Project\omnicourses-b2-evidence\b1-regression\a11y-01-shots`. The script covers B1's screens; B2's new screens (notifications, calendar, sharing, admin) are B2's own A11Y-01 cases (test-cases-b2.md §10), not this regression.

| ID | Result | Notes |
| --- | --- | --- |
| A11Y-01a | passed | `router.ts` on `1bde552` has the B1 routes of the table (with `/transcript`, added in cases 0.7) and B2 routes that the B2 cases cover (`/notifications`, `/calendar`, and `/admin` with `catalog`, `curriculum`, `import` and `access`). No B1 screen is missing from the table. |
| A11Y-01b | **failed, still open #119** | Not run again by hand: #119 (focus after actions, the skip link on sign-up, sign-in and onboarding) is open with no fix merged. What the script checks again passes as in B1: the explorer drawer, the delete dialog and the new-plan dialog close on Esc and give focus back to their opener (clean browser). |
| A11Y-01c | passed | `scrollWidth <= innerWidth` in all 21 states at 31 widths (360, 768, 1280, 1920 and each CSS breakpoint at its value and ±1 px): 651 checks, 0 failing. The build now has a breakpoint at 600 px besides B1's eight. |
| A11Y-01d | **failed, still open #119** | Same as B1. In Vietnamese the planner's "What-if" button still reads "What-if" (`plans/messages.ts`). In English every state sets `lang="en"`; what stays Vietnamese is data in one language, as in B1. |
| A11Y-01e | **failed, still open #119** | Same as B1, in the same count: `color-contrast` in 65 of 84 state/theme/width runs (B1: 65 of 84). Light: `.cite`, small and secondary text (`.small`, `.t3`, `.xs`), group labels, the sign-up hints, the "updated" line. Dark: the primary buttons and planner tiles. Also `scrollable-region-focusable` on the audit at 360 px, as in B1. |
| A11Y-01f | **failed, still open #119** | Not measured again by hand: #119 (field borders, dark placeholder, light hint, progress bars) is open with no fix merged. |
| A11Y-01g | passed | Same as B1 (glyphs, statuses in words, field errors written out, check mark on the chosen card, words and icon on the graduation chip), checked on this run's screenshots of the dashboard (each group with its glyph and "✓ Đã đạt", the chip "✓ Đạt mọi điều kiện kiểm tra được") and of sign-up's field errors, each written out under its field. |

### §7: Other B1 checks

Scripts: `b1-api-cases.mjs` (ACAD API parts, PLAN-01a, b, d, f, the plans part of ACAD-01e; 09:16–09:19Z, [output](b1-regression/b1-api-cases-output.txt)), `a-acad-screens.mjs` and `a-acad-01c.mjs` (screens), and the `p-*` planner scripts (1280×800; PLAN-01g at 1280×1500).

**Cause shared by four results below.** The B1 cases were written when no APCS prerequisite was recorded (§6 item 14), so they expect every course's `prerequisites` to be `null` and every placed course to be "not checked" twice (prerequisites and offering terms). Since #111 (merged after B1) and #140, the seed records the Project Lead's decision that APCS courses have no prerequisites except CS469 before CS470 ([`apcs-prerequisites.ts`](../../../../src/backend/src/database/seeds/apcs-prerequisites.ts)). On staging, `GET /api/programs/APCS/curricula/2024` gives 68 courses `prerequisites: []` and CS470 `["CS469"]`; `offeringTerms` is still `null` for all 69. That intended data change moves ACAD-01g, ACAD-01e (the planner's "Chưa ghi nhận (n)" count), PLAN-01g (the words of the "not checked" preview) and PLAN-01h (the "n not checked" count). None of them is a bug; the cases need updating (finding 2).

**The fixture checksum.** Three scripts hash the completion fixture from the file on disk and print `508b3e1a…`: this Windows checkout has `core.autocrlf` and writes it with CRLF, as PERF-01a warns. The committed bytes, `git show 95ea154:src/backend/test/fixtures/apcs-2024-completion.json | sha256sum`, give `d0a0493f…facde`, the case's value, and the JSON is the same either way (45 rows saved, every value as §6 item 13).

| ID | Result | Notes |
| --- | --- | --- |
| ACAD-01a | passed | Same as B1. API: 0 of 163, 163 remaining, year 1, averages null, every group 0 of its minimum, (C) with no minimum and `met`, combined 0 of 43, `not_yet`. Dashboard (a03): the same figures, (C) as "Không có tối thiểu riêng", the no-transcript notice with its link, no estimated term. |
| ACAD-01b | passed | Same as B1. |
| ACAD-01c | passed | Same as B1. API: `done`, `unmet` empty, credits `{172, 164, 0, 163, 0, 4}`, gpa `{7.77, 7.77, 3.3, good, 164}`, every group met, 44 of 43, 12 terms of 10–20 credits, no warning. Dashboard (a04): "Đạt mọi điều kiện kiểm tra được", "164 / 163 TC", 7,77 twice, and "Còn 5 điều kiện OmniCourse không kiểm tra được, phòng đào tạo sẽ xét."; no guide link. The script's "five unchecked conditions" line fails on its own wording exactly as in B1, where the case was counted passed on this text. |
| ACAD-01d | passed | Same as B1. |
| ACAD-01e | passed, with a case to update | Audit part: same as B1 (caps 10–22, `main`, `below_minimum` at 9, none at 10 and 22, `above_maximum` at 23, citation Điều 7.2). Plans part, API (`p-acad-01e-issues-api.mjs`): `load_below_minimum` at 9 and `load_above_maximum` at 23 with kind `flag` and Điều 7.2, none at 10 and 22; `PUT` 200 each time. Screen: cards, chips, meter and link as in B1. The planner script differs on 14 lines: the 6 that differed in B1 (its own extraction of the load issue, and the range "10–22" in the English tooltip and screen-reader text, which the case allows), and 8 on the "Chưa ghi nhận (n)" count, which is now one per placed course (3, 3, 6, 7) where the script expects two (the shared cause above). |
| ACAD-01f | passed | Same as B1. |
| ACAD-01g | **failed as written**, case to update | API 200 with the eight groups; CS163 in (A) bắt buộc, "Cấu trúc dữ liệu", 4 credits. But `prerequisites` is `[]`, not `null` (the shared cause above), and the CS163 drawer says "Không có môn tiên quyết. Chưa ghi nhận học kỳ mở môn." where the case expects prerequisites "not recorded, never 'none'". Searches and clearing behave as in B1. Not a bug: the data now records "none" on purpose (finding 2). |
| ACAD-01h | blocked | Still blocked on offering terms (§6 item 14); the prerequisite half could now be written from CS469 → CS470 (finding 2). |
| ACAD-02a–f | passed | Same as B1 (API; 02d's dashboard and 02e's isolation too). |
| PLAN-01a, b, d, f | passed | Same as B1 (API). PLAN-01f's export now also lists `plan_shares` (empty). |
| PLAN-01b (screen), c | passed | Same as B1. |
| PLAN-01e | passed | Same as B1. The blocked save shows "Chưa lưu được thay đổi. Kế hoạch đã trở về lần lưu gần nhất." at once. |
| PLAN-01g | passed, with a case to update | Same as B1 for the drag: one `POST …/issues/drops` for the whole drag, no `PUT` before the drop, row 1 blue with "12 / 22 TC" and "+4", panel "Xem trước: CS160 → HK1 2026–2027 · số vi phạm không đổi", card tagged "Sẽ hết", release in row 1 with one `PUT` and **Đã lưu**, slot green with "16 / 22 TC", Esc places nothing, blocked preview grey. Two differences: (1) the row's words are "Chưa kiểm tra được: CS160: chưa ghi nhận học kỳ mở môn." (offering terms), not "…môn tiên quyết." (shared cause above); (2) the script read row 2 while the row was still moving (row 1 grows a placeholder while the pointer crosses it) and saw nothing. A probe that aims again until row 2 has the pointer ([`p-plan-01g-row2-probe.mjs`](b1-regression/p-plan-01g-row2-probe.mjs), [output](b1-regression/p-plan-01g-row2-probe-output.txt)) saw what the case expects: amber outline, the same words, "4 / 22 TC" with "+4", meter under, panel "Xem trước: CS160 → HK2 2026–2027 · số vi phạm không đổi", a new card for HK2 tagged "Mới"; released there, CS160 lands in row 2. Its two earlier runs are kept: the first released outside the row, the second printed "ố vi phạm" through a broken regular expression. |
| PLAN-01h | passed, with a case to update | Same as B1 but for the count: "Không thấy vi phạm · 3 mục chưa kiểm tra được" ("3 not checked") for three placed courses, where the case expects 6 (shared cause above). The completion-fixture part (b1-06's stand-in) passes as in B1. |
| PLAN-01i | passed | Same as B1. |
| PLAN-01j | passed | Same as B1, with the locked drag at 1280×1500. |
| PLAN-01k | passed | Same as B1. |
| PLAN-01l | passed | Same as B1, including the one script line that differed in B1 too ("the copy has a tab of its own": the tab bar is read before it redraws). |
| PLAN-01m | passed | **Differs from B1, for the better.** Exactly 120 saves from this address answered 200 (`x-ratelimit-remaining` 119 on the first, 0 on the last), and the browser's next save got 429, then again at +2.2, +7.4 and +17.6 s (gaps 2.1, 5.2, 10.2 s); CS160 stayed with "Đang lưu…" for 17.9 s, then the board went back with "Chưa lưu được thay đổi…" and **Chưa lưu**; after a reload, not saved. In B1, 121 saves got through (remaining 1 on the last) and the case failed as written (#117). No commit since B1 names the rate limit, so the cause is still not established; #117 stays open for its retest (test-cases-b2.md §13). |
| PLAN-01n | **failed, still open #101** | Same as B1. The Taken strip shows 172 credits for six listed terms that hold 102, and tags from HK1 2026–2027 on, CS468 included. |
| DATA-01a | passed | Same as B1, locally: the second seed prints `Inserted:` 0 for every table and the counts match ([output](b1-regression/local-data-01-output.txt)). The seed now also lists 140 prerequisite lists and 2 prerequisites. |
| DATA-01b | passed | Same as B1, locally. |
| DATA-01c | passed | Same as B1: by hand, exit 1 with the exact message and the `CS160.name_vi` line, CS160 kept "Renamed", restored; the named test passes locally and in CI. |
| DATA-01d | passed | Same as B1: "rolls back everything when one insert fails" passes ([local](b1-regression/local-ci-named-tests.txt); `curriculum-seed.e2e-spec.ts` green in CI). |
| DATA-01e | passed | Same as B1: APCS 2024 163 credits, 249 codes match the pattern, (A) seeded as two groups. New since B1, as expected: CS470 requires CS469 in APCS 2024 and 2025; offering terms still empty. |
| AI-01a–g | passed | Read from CI run 45959333443: every named test still exists with the same title (`ai.e2e-spec.ts`, `sse.spec.ts`, `gateway-llm.service.spec.ts`, `account.e2e-spec.ts`) and its file passed: `test/ai.e2e-spec.ts` (4 tests), `src/ai/sse.spec.ts` (6), `src/ai/gateway-llm.service.spec.ts` (24), `test/account.e2e-spec.ts` (14). AI-01f by hand, locally: `ai_usage` has the expected columns and `ON DELETE CASCADE`. |
| COV-01a | passed | `src/backend/src/rules/` has 12 production files (new since B1: `types.ts`), 476 statements ([output](b1-regression/local-cov-01-output.txt)). |
| COV-01b | passed | `src/rules/**` 476 of 476 statements, 100 % (≥ 80 %), locally and in CI. Locally `npm test` exits 1 for failures outside the rules (see "Local track"); CI on `1bde552` is green. |
| COV-01c | passed | Same as B1: a 500-statement uncovered function added to `gpa.ts` in the working tree makes the run exit 1 with "Coverage for statements (48.62%) does not meet "src/rules/**" threshold (80%)"; reverted with `git checkout`, nothing left changed under `src/`. |

**Local track.** Tree `1bde552`, Node v24.19.0 (the repo pins 22.22.1; there is no Node 22 on this machine), npm 11.21.1, PostgreSQL 18.6 in a new Docker container on port 55432 (removed afterwards), API `node dist/main.js` on :3055, 09:20–09:59Z. Two script copies take `CONTAINER_CLI=docker` (B1 used podman), and `local-user-01-db.mjs` counts the dump's lines in Node in place of `grep -c`; its first start stopped on a syntax error in that edit before sending a request (noted in its output). Local totals, which no case counts: backend unit 1025 of 1030 on the first run and 1023 of 1030 on the second (the four known CRLF failures of `regulation.spec.ts` and `openapi-document.spec.ts`; `csv-file.spec.ts` "takes exactly 1 MiB…" and, on the second run, two tests of `import-body-limit.spec.ts` timing out at 5 s under the full parallel run with coverage; they pass alone and in CI); e2e 344 of 345 on the second attempt with `--hookTimeout=60000` (the known CRLF fixture-hash test of `audit.e2e-spec.ts`); the first e2e attempt timed out in four `beforeAll` hooks on this machine and is not counted ([output](b1-regression/local-e2e-output.txt)).

**CI on `1bde552`** (run 45959333443, all jobs green): backend unit 67 files, 1030 tests; backend e2e 23 files, 345 tests; frontend unit 71 files, 1072 tests; frontend browser 11 files, 63 tests. `src/rules` statement coverage 100 % (branches 97.84 %). In B1 (run 43666344959): 43/849, 17/151, 51/598 and 8/36.

## Findings

**No new bug.** Nothing that passed in B1 fails now because of a defect, so no new issue was opened. The B1 bugs still open fail again as expected: #101 (PLAN-01n), #114 (GUIDE-01a–f, l: G02 and G06 still drafts), #115 (USER-01k), #119 (A11Y-01b, d, e, f).

1. **Cases to update (Dũng): B2's public shared-plans route.** GUIDE-01n and DB-01e list the routes that may answer without a token as health, sign-up, sign-in and the two guide routes. B2 adds `GET /api/shared-plans/{token}` on purpose (#153, F9, ADR 0010's shared-plans amendment, `@Public()` in `sharing.controller.ts`, listed in `PUBLIC_ROUTES`). Add it to both cases, as B1 did for the guide routes.
2. **Cases to update (Dũng, with Triết for ACAD-01h): APCS prerequisites are now recorded.** Since #111 and #140, APCS courses have `prerequisites: []`, and CS470 has `["CS469"]`; offering terms are still not recorded. ACAD-01g fails as written ("not recorded, never 'none'"; the drawer now says "Không có môn tiên quyết."). ACAD-01e's "Chưa ghi nhận (n)", PLAN-01g's "…chưa ghi nhận môn tiên quyết." and PLAN-01h's "6 mục chưa kiểm tra được" all assumed two unknowns per course, and now there is one (offering terms). ACAD-01h's prerequisite half can now be written from CS469 → CS470; its offering-term half stays blocked (§6 item 14).
3. **#117 (Lâm): not reproduced.** PLAN-01m passed as written: 120 saves were counted and the 121st got 429, where B1 let 121 through. No commit since B1 names the rate limit, so the cause is still not established. The retest of #117 belongs to test-cases-b2.md §13.
4. **Note (Hoà, Lâm): the cold-load margin is smaller.** PERF-01 passed, but cold loads are 220 ms (dashboard) and 450 ms (audit) slower than in B1, and the main bundle is 48 KB larger on the wire (170 KB). A cold audit load now takes up to 1.4 s against the 2 s limit.
5. **Not app defects: B1 script lines that check old wording.** Some lines in the B1 scripts still differ, exactly as they did in B1: UI-01a, c and k (the wording before B0 cases 0.2), UI-01g (the 429 starts at the 9th attempt), ACAD-01c ("not checked" wording), PLAN-01l and USER-01j (tab bar read too early), and the CRLF fixture checksum. Each is explained in its row.

## Still to do

| What | Who | How |
| --- | --- | --- |
| DEP-01f | Dũng, when B2 is tagged | Compare the B2 tag, its deploy run and the commit tested; list `git diff --stat` from `1bde552` to the tag (test-cases-b2.md §12 and the B2 report's §6 item 1) |
| Findings 1 and 2: case updates | Dũng (ACAD-01h with Triết) | A docs PR on test-cases-b1.md (GUIDE-01n, DB-01e, ACAD-01e, g, h, PLAN-01g, h) |
| GUIDE-01a–f, l for G02 and G06 | Dũng, after the next registration and tuition periods | As in B1 (#114) |
| A11Y-01b and f by hand | When #119 is fixed | Its retest in test-cases-b2.md §13 |

## Evidence

Everything is in [`b1-regression/`](b1-regression/). Each script is the B1 script of the same name (in `../b1/`), copied, with the changes listed under "Build and setup" and noted in the scripts it touched. Each `*-output.txt` is that script's output; `*-attemptN-output.txt` keeps a run that was not counted, and the row that uses the script says why. The `.png` files are public pages or synthetic accounts only.

| Files | What |
| --- | --- |
| `a-*.mjs`, `a-lib.mjs` | Screen track on staging: UI-01, USER-01 screens, ACAD screens, A11Y-01c onboarding states, GUIDE-01 signed in (`a-guide-01el-signed-in.mjs`, new) and USER-01w/x (`a-user-01wx.mjs`, new) |
| `b1-api-cases.mjs`, `b1-user-api-cases.mjs`, `lib.mjs` | API cases on staging |
| `p-*.mjs`, `p-lib.mjs` | Planner screens on staging; `p-setup-perf.mjs` (new) makes P; `p-plan-01g-row2-probe.mjs` (new) |
| `guide-01-g01-g07.mjs`, `guide-01o.sh`, `guide-01o-parallel.sh` (new), `guide-01o-burst*.txt` | GUIDE-01 signed out and GUIDE-01o |
| `perf-01.mjs`, `perf-01-2026-11-27T10-06-25-336Z.json`, `perf-01d-probe.mjs` | PERF-01 and its probe |
| `a11y-01.mjs`, `a11y-01-2026-11-27T10-10-35-868Z/`, `a11y-01-2026-11-27T10-17-15-330Z/` | A11Y-01c, d, e and the Esc checks; widths only. Screenshots outside git (see §5) |
| `b0-regression-local.mjs`, `local-*.mjs`, `local-db-01f.sql`, `g-guides-local.mjs`, `local-*-output.txt`, `local-ci-named-tests.txt`, `g-guides-local-output.txt` | Local track |

No file here holds a token, a password hash or a session token. The test password appears only as "the §1 password", except where B1's scripts already carried it.
