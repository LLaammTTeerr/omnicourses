# B2 test report

- **Status: partial, in progress.** This report collects the B2 staging runs recorded on 21–28 November 2026 and updates the case inventory as of **28 November 2026**. It is updated as each open item in §6 runs on the B2 candidate, and it has no acceptance decision yet.
- Owner: Dũng. Drafted with Claude Code from Dũng's staging runs of 21–28 November 2026. The raw results and notes of each run are in its results file under [`evidence/b2/`](evidence/b2/) (§2); this report summarises them and does not repeat them.
- Build: B2 is due on 29 November 2026 ([test plan §8](test-plan.md#8-schedule-and-remaining-work)) and is not tagged yet. Every manual/scripted run so far was on staging, on the commit staging served that day (§2). The 28 November runs were on staging `778d120` (#214), which holds every B2 feature and the fixes of #137, #138, #170, #174 and #163. After it, `main` took #220–#227, code clean-ups with no new feature (Lâm, 28 November), so the 28 November runs count toward the B2 candidate. Staging then moved to `4b038fe` (#246, at 07:37Z), with #245 and the clean-ups #228–#232: ADM-03g ran there, and the 28 November cases whose screens or routes changed were rerun there with the same results (§6 item 1), except PERF-01, which waits for a normal test connection. The B1 regression on B2 also ran on `4b038fe`.
- Cases: [B2 test cases](test-cases-b2.md) v0.15. Parent checks: [test plan §5](test-plan.md#5-required-checks).
- Decision: **not made.** Lâm decides once the candidate is tagged and the open items in §6 are run or explained.

## 1. Summary

122 detailed cases are written (`PLAN-01a–f` and `OPS-01a–c` added in v0.14). The B1 regression run (cases §12) and the retests of B1 defects (cases §13) are tracked separately in §6.

| Result | Cases |
| --- | --- |
| Passed | 108. TRN-01a–g, TRN-02a–h, PLAN-01a, c, d, e, f, PLAN-02a–e, ADM-01a–e, ADM-02a–l, ADM-03a–g, ADM-04a–f, ADM-05a–g, ADM-06a–g, ADM-07a–i, SHARE-01a–l, NOTIF-01a–j, PERF-01a, b, A11Y-01a, b, c, d, g, h |
| Failed | 7, on staging `778d120` (28 Nov); PLAN-01b and A11Y-01e, f failed again on `4b038fe` (carry-over, 28 Nov), and PERF-01c–f is not rerun there yet. PLAN-01b: during a keyboard lift the arrow keys never announce the target term ([#247](https://github.com/LLaammTTeerr/omnicourses/issues/247)). PERF-01c–f: a planner edit takes about 300 ms (medians 298–307 ms; 15, 28, 16 and 19 of 30 runs at or over 300 ms; [#248](https://github.com/LLaammTTeerr/omnicourses/issues/248)). A11Y-01e and f: contrast, [#119](https://github.com/LLaammTTeerr/omnicourses/issues/119) (a light hover at 4.47:1, a light field border on a tinted panel at 2.79:1, card separators at 1.18 / 1.20:1) |
| Blocked | 2. Staging's proxy: ADM-07j (nginx answered 413 in HTML on 25 Nov; Lâm runs `deploy/server/setup.sh` for `client_max_body_size 8m`). Streamed advisor updates (B3): A11Y-01i (dragging and Print/PDF layout are built; streamed updates wait for F8) |
| Not applicable | 2. ADM-04g, ADM-07k (Lâm, 28 Nov: no total check; [ADR 0011, amendment of 28 November 2026](../analysis-and-design/adr/0011-curriculum-administration.md#amendment-28-november-2026-credit-totals-entered-through-f12)) |
| Not run yet | 3. OPS-01a–c, on the host after `deploy/server/setup.sh` (Lâm) |
| **Total** | **122** |

What matters so far:

- **28 November, staging `778d120`: the newly built screens pass, and the earlier B2 defects are fixed.** NOTIF-01d(2), NOTIF-01j, SHARE-01l (signed-out read-only page, A4 PDF), TRN-01f–g (paste with tabs, `|` or `;`, the change summary, **Cancel changes**) and PLAN-01a, c–f passed. The retests of #137 (PLAN-02a), #138 (PLAN-02c), #170 (A11Y-01d), #174 (export dates) and #163 (null characters and lengths counted in characters) passed.
- **New defects, and #119 still open.** The planner misses the 300 ms limit by a little in every edit type (PERF-01c–f, [#248](https://github.com/LLaammTTeerr/omnicourses/issues/248)): an edit sends the save and then the check one after the other, two network round trips in a row; their request times, network included, add up to 255–275 ms at the median, and `/api/health` alone takes about 115 ms under the same profile. A screen-reader user does not hear which term a keyboard lift points at (PLAN-01b, [#247](https://github.com/LLaammTTeerr/omnicourses/issues/247)). The transcript's summary buttons cover the result counts at 1280 px ([#249](https://github.com/LLaammTTeerr/omnicourses/issues/249), seen in the TRN-01 screenshots; TRN-01 still passes). #119 still has three colour pairs under their ratios (A11Y-01e, f).
- **No ADM, TRN-02 or SHARE-01 API case failed.** Every permission boundary, impact review, cohort, removal, CSV import and grant case that could run passed, through the API and on the administration screens. No case found one student's data reaching another, or a write that a refused request left half done.
By parent check. A parent passes only when all its required detailed outcomes pass ([test plan §5](test-plan.md#5-required-checks)).

| Parent check | Result so far | Why |
| --- | --- | --- |
| TC-B2-PLAN-01 | **failed** | `a, c–f` passed on `778d120`. `b` failed on one point: the keyboard lift does not announce the target term ([#247](https://github.com/LLaammTTeerr/omnicourses/issues/247)). |
| TC-B2-PLAN-02 | passed | `b, d, e` passed on `086d49c`; the retests of `a` (#137) and `c` (#138) passed on `778d120`. |
| TC-B2-TRN-01 | passed | `f, g` passed and `a–e` passed again on `778d120`. |
| TC-B2-TRN-02 | passed | `a–h` passed. |
| TC-B2-ADM-01 | passed | `a–e` passed. |
| TC-B2-ADM-02 | passed | `a–l` passed. |
| TC-B2-ADM-03 | passed | `a–f` passed (`e7bd617`); `g`, and the reruns of `c` (5) and `d` (3) with #245's bodies, passed on `4b038fe`. |
| TC-B2-ADM-04 | not passed yet | `a–f` passed. `g` not applicable (Lâm, 28 Nov: no total check). |
| TC-B2-ADM-05 | passed | `a–g` passed. |
| TC-B2-ADM-06 | passed | `a–g` passed. |
| TC-B2-ADM-07 | not passed yet | `a–i` passed. `j` blocked on running `setup.sh` on staging's nginx, `k` not applicable (Lâm, 28 Nov: no total check). |
| TC-B2-SHARE-01 | passed | `a–k` passed through the API (`e7bd617`); `l` passed on `778d120`. |
| TC-B2-NOTIF-01 | passed | `a–c, e–i` and `d(1)` passed (`e7bd617`); `d(2)` and `j` passed on `778d120`. |
| TC-B2-PERF-01 | **failed** | `a, b` passed; `c–f` failed on `778d120`: every edit type has runs at or over 300 ms ([#248](https://github.com/LLaammTTeerr/omnicourses/issues/248)). |
| TC-B2-A11Y-01 | **failed** | Administration screens: `a, b, c, g, h` passed (`5a5b9d5`); `d` passed on retest (`778d120`, #170 fixed); `e, f` failed again on `778d120` (#119, three colour pairs). `i` blocked on F8 streamed updates. The planner, transcript, sharing and notification screens are not yet in §10's table, nor are `/admin/calendar` and `/admin/import`. |
| TC-B2-OPS-01 | not run on host yet | `OPS-01a–c` written; `omnicourse-backup.timer`, isolated `pg_dump` rehearsal procedure and HTTP 503 `/api/health` deploy rollback shipped on this branch, awaiting host execution after `setup.sh`. |

## 2. Runs and environment

Every run recorded so far was on staging, https://stag-omnicourses.lamter.cc. Staging serves no version, so each run's build was read from the staging deploy runs; each results file gives the deploy run and its time. Note: on this branch `HealthController` now returns HTTP **200** `{"status":"ok","database":"up"}` when PostgreSQL is reachable and HTTP **503** `{"status":"degraded","database":"down"}` when unreachable (`OPS-01c`).

| Run (UTC) | Staging build | Cases | Results | Pull request |
| --- | --- | --- | --- | --- |
| 21 Nov, 09:33–09:44 | `c804c3f` | ADM-02a–h | [`results-2026-11-21.md`](evidence/b2/results-2026-11-21.md) | #133 |
| 21 Nov 17:16 – 22 Nov 01:44 | `086d49c` | TRN-02a–h, PLAN-02a–e | [`results-2026-11-22.md`](evidence/b2/results-2026-11-22.md) | #135 |
| 22 Nov, 02:31–04:52 | `7f7974f` | ADM-01a–c, ADM-05a–d, ADM-06a–f | [`results-2026-11-22-adm.md`](evidence/b2/results-2026-11-22-adm.md) | #139 |
| 25 Nov, 06:02–06:35 | `5a5b9d5` | ADM-01d–e, ADM-02i–l, ADM-05e–g, ADM-06g, ADM-07a–k, TRN-01a–g, A11Y-01a–i (administration) | [`results-2026-11-25.md`](evidence/b2/results-2026-11-25.md) | #167 |
| 25 Nov, 13:17–13:51 | `e7bd617` | NOTIF-01a–j, SHARE-01a–l, ADM-04a–g | [`results-2026-11-25-notif-share-adm04.md`](evidence/b2/results-2026-11-25-notif-share-adm04.md) | #173 |
| 25 Nov, 14:35 | `e7bd617` | ADM-03a–f | the same file, ADM-03 section | #176 |
| 28 Nov, 05:51–06:30 | `778d120` | NOTIF-01d(2), NOTIF-01j, SHARE-01l, TRN-01a–g, PLAN-01a–f, PLAN-02a and c (retests), A11Y-01d–f (retests), export and text-limit retests (#174, #163), PERF-01a–f | [`results-2026-11-28.md`](evidence/b2/results-2026-11-28.md) | #246 |
| 28 Nov, 07:44–09:20 | `4b038fe` | ADM-03g, ADM-03c (5) and ADM-03d (3) (reruns); carry-over of TRN-01a–g, PLAN-01a–f, PLAN-02a and c, SHARE-01l, NOTIF-01j, A11Y-01d–f and the text-limit retest (#163) | [`results-2026-11-28-4b038fe.md`](evidence/b2/results-2026-11-28-4b038fe.md) | #251 |
| 28 Nov, 07:43–09:18 | `4b038fe` | B1 regression on B2 (cases §12) | [`results-b1-regression-2026-11-28.md`](evidence/b2/results-b1-regression-2026-11-28.md) | #251 |

| Item | Used |
| --- | --- |
| API client | Node `fetch` scripts with no dependencies, in place of the Swagger page: the same requests and bodies as the cases. Each prints `OK` / `ok` or `MISMATCH` / `FAIL` per expected result, and no token. Each output is next to its results file. |
| Browser | Chrome 144 on Windows 10. Headed through Claude in Chrome for TRN-02 and PLAN-02 (22 November); headless through playwright-core 1.64.1 for the 25 and 28 November screens; headed through playwright-core for PERF-01 (28 November). axe-core 4.10.2 for A11Y-01e. |
| Server steps | ADM-06b, ADM-06e–f, TRN-02f and NOTIF-01i(4) need the staging host or its database. Lâm's bot ran them on request; its output is copied into the results files. |
| Test data | Synthetic `example.com` accounts `b2-s1` to `b2-s15` and `b2-a1` to `b2-a6`, the §1 password; synthetic `ZZ` courses and test groups, removed after each run. No real name, student ID, transcript or secret. |
| Model calls | None. |

Rate limits: sign-in allows 10 requests a minute from one address (and per `(IP, email)` pair on the current branch). The first attempts at ADM-05b–d (22 November) and ADM-07c–i (25 November) were refused with 429 because the test client sent sign-ins too fast; they were run again, and each results file explains what the refused attempt wrote. Two other first attempts stopped on a fault in the script (TRN-01b, SHARE-01a–j) and are recorded in the results files.

## 3. Automated checks

To record once B2 is tagged: the CI run on the candidate commit, with the backend unit/coverage, frontend unit, browser and PostgreSQL e2e results, as in [B1 §3](report-b1.md#3-automated-checks).

## 4. Results

One line per group of cases from the same run with the same result. The results file of the run (§2) has a line for each case.

### TC-B2-PLAN-01 and PLAN-02: planner editing, live validation, failure and ownership

| IDs | Result | What happened |
| --- | --- | --- |
| PLAN-01a, c–f | passed (28 Nov) | Mouse drag with one batched drop preview and no save until the drop; the 24-credit flag; the drop bin; the prerequisite and not-offered previews and violations, cleared when moved back; the elective slot's coverage; a late answer for an older edit or drag ignored; the 30-term cap, and 31 terms or targets refused with 400; saving blocks leaving the page; a 401 never shows **Saved**; a lost answer re-reads the plan. |
| PLAN-01b | **failed** (28 Nov; again on `4b038fe`) | Keyboard add, lift, move, drop, cancel, Ctrl+Z, Delete and the What-if copy all worked, but the arrow keys never announce the target term: the live region gets the target row's drop reason in the same tick, and today every row has one (no APCS course has offering terms recorded). [#247](https://github.com/LLaammTTeerr/omnicourses/issues/247). |
| PLAN-02a | passed on retest (28 Nov) | Failed on `086d49c` (#137). On `778d120` the 401 signs the student out at once with the toast "Your session has ended — your last change was not saved. Please sign in again."; **Saved** never shows; after signing in, the plan and the API hold CS160 only. |
| PLAN-02b | passed | A blocked save and a 500 each showed **Not saved** and put the board back to the saved plan. |
| PLAN-02c | passed on retest (28 Nov) | Failed on `086d49c` (#138). On `778d120` the chip says **Saving…** until the 30 s timeout, `GET /api/plans/{id}` follows the failed `PUT`, and the chip then says **Saved** with CS160 and CS163, as the server holds. |
| PLAN-02d, e | passed | Another student's plan ID answers 404 on all 8 routes, the same as an unknown ID; crafted boards answer 400; nothing of the other student changed. |

### TC-B2-TRN-01 and TRN-02: transcript entry and student-record integration

| IDs | Result | What happened |
| --- | --- | --- |
| TRN-01a–e | passed | Typed entry on **Transcript** (`5a5b9d5`, and again on `778d120`): incomplete rows block the save and say what to fix; a removed row changes nothing until a save; the save sends one `PUT` and the API holds exactly the rows saved; leaving with unsaved rows asks first; a blocked save keeps the rows. |
| TRN-01f | passed (28 Nov) | The same 3 rows from a table pasted with tabs, `|` or `;`, the header line skipped; bad lines listed by number with both load buttons disabled; **Replace draft rows** fills the review table with "+3 added / ~0 changed / -3 removed" and saves nothing. |
| TRN-01g | passed (28 Nov) | **Cancel** in the paste dialog leaves the table; **Cancel changes** brings back the saved rows, clears the summary, disables **Save transcript** and sends nothing. |
| TRN-02a–e, g, h | passed | A save replaces the transcript; two saves sent at the same moment, 10 times, never mixed; repeated and unknown courses are kept; the audit and the planner's **Taken** strip follow a save without a reload; a bad row or grade answers 400 and changes nothing. |
| TRN-02f | passed | The export matched the saved rows. After deletion and purge (by Lâm's bot), S2 had no row in any user table, and S1's transcript was unchanged. |

### TC-B2-ADM-01 to ADM-07: curriculum administration

| IDs | Result | What happened |
| --- | --- | --- |
| ADM-01a–c | passed | A shared-course edit needs the impact review (409 with the 11 curricula), then saves everywhere; a program administrator is refused; cohort fields in a catalog edit answer 400. |
| ADM-01d, e | passed | The catalog screen's impact review, and the refused section for a program-only administrator. |
| ADM-02a–h | passed | Signed-out 401, no-role 403, own-program writes, another program refused with nothing of it leaked, catalog and access roles kept apart, a revoked grant refused at once with the old token, the last access manager kept. |
| ADM-02i–l | passed | Each role sees only its sections; a grant revoked while a form is open is refused and the form is kept; group writes in the own program, refused in another. |
| ADM-03a–f | passed | A second cohort, APCS2099, with its groups and links, leaves the first cohort's plans, audit and curriculum unchanged; duplicates, bad values and other programs are refused. |
| ADM-03g | passed (28 Nov, `4b038fe`) | A cohort's `totalCreditsMin` and a group's `creditsTotal` / `creditsTotalMin` save as whole numbers ≥ 0, clear with `null`, and a negative or decimal value answers 400; a group keeps the total of its kind (compulsory: `creditsTotal`, elective: `creditsTotalMin`); another program's administrator gets 403. The access manager sets `trainingType` when creating a program, and a later `PATCH` of it answers 400. The test program `ZZ-ADM03G` stays (§7). The audit with a new total: #245's e2e test "lets the administrator enter the cohort and group credit totals, and the audit then checks them" (`curriculum-admin-programs.e2e-spec.ts`: `totalCreditsMin` 130 → audit `totalRequired` 130, `remaining` 126); ADM-03g as written has no audit step (Lâm, 28 Nov). [`results-2026-11-28-4b038fe.md`](evidence/b2/results-2026-11-28-4b038fe.md) |
| ADM-04g, ADM-07k | not applicable | Lâm, 28 Nov: no total check. A link removal or a group-link file may leave a group off its credit total, and the audit shows the gap. |
| ADM-04a–f | passed | Unlinking, a course a rule still names (409), a linked course (409), a group a saved plan uses (409, fixed by #172 before the run), catalog deletion by role, codes that cannot change. |
| ADM-05a–d | passed | Field validation, duplicate codes, an impact list that changed during the review, deletions refused while a transcript or plan names the course, and edits that leave saved transcripts and plans unchanged. |
| ADM-05e–g | passed | The same on the screens: field errors, Cancel, the three lost-answer outcomes, and the review after `impact_changed`. |
| ADM-06a–g | passed | A new account has no grant; the bootstrap refuses when an access manager exists; grants and revocations take effect at once; the export holds the user's own grants only; a granter's purge keeps the grants it gave; the user ID and the access screen. |
| ADM-07a–i | passed | CSV import of courses and group links: roles, per-record errors in order, nothing saved from a file with an error, preview and confirmation with a review version, re-import with no duplicate, an impact change or a revoked grant at confirmation refused. |
| ADM-07j | blocked | The 1000-record and 1 MiB limits answered as expected; the two larger bodies got staging nginx's HTML 413, not the app's JSON. Rerun (4) and (5) after Lâm runs `setup.sh` on the host. |

### TC-B2-SHARE-01: export and sharing

| IDs | Result | What happened |
| --- | --- | --- |
| SHARE-01a–k | passed | A share link reads only the allowed keys, with no ID, email, grade or transcript row; the owner's choices for name and transcript checks; the reader cannot write; revoked, replaced, deleted, unknown and deleted-owner links all give the same 404 page; the export holds no token; 120 guesses then 429, with `noindex` and `no-store` on every answer. |
| SHARE-01l | passed (28 Nov) | The Share dialog starts with both choices off and warns before the transcript choice is saved; signed out, `/shared/{token}` is read-only, `noindex, nofollow`, shows the owner's name and transcript checks only when chosen, and no grade or email; the A4 PDF (3 pages) is readable with nothing clipped; after **Stop sharing** the link shows "This plan is not shared". |

### TC-B2-NOTIF-01: notifications

| IDs | Result | What happened |
| --- | --- | --- |
| NOTIF-01a–c | passed | Routes, validation and not-found; a registration date makes one `registration_soon` or `registration_open`, a term start one `term_start`, and other kinds none. |
| NOTIF-01d | passed | (1) on 25 Nov: a registration date entered three days ahead, after its 7-day reminder day, made no notification. (2) on 28 Nov: exactly one `registration_open`, made at 00:00 Vietnam time on the opening day; the test date `E-d` was then deleted. |
| NOTIF-01e–i | passed | A student who joins later gets the current notices; another program's dates reach nobody here; moved and deleted dates make no repeat and keep what was sent; a saved transcript change makes one `transcript_changed`, a refused, cancelled or failed save none; read, unread and paging; another student's IDs give 404; an account waiting for deletion gets nothing until it is restored. |
| NOTIF-01j | passed (28 Nov) | At 1280 and 360 px, in Vietnamese and English: the badge equals the API's unread count; cards newest first in the page language, no course code or grade on `transcript_changed`; **Mark as read** and the audit link each mark one read and lower the badge; **Mark all as read** clears every marker and the badge. |

### TC-B2-PERF-01: planner validation time

| IDs | Result | What happened |
| --- | --- | --- |
| PERF-01a, b | passed (28 Nov) | The fixture's checksum, Q's empty transcript and 46 placements, CS420 `null`; V, P and C each draw their expected result and undo; the network profile (health requests 109–123 ms). |
| PERF-01c–f | **failed** (28 Nov) | 30 measured runs each, under the profile, every run with its expected result: V median 297.8 ms (15 at or over 300 ms), P 307.5 ms (28), C 303.0 ms (16), O 305.1 ms (19, max 720.7 ms). The save and the check are two requests in a row; their request times, network included (the profile adds 50 ms), add up to 255–275 ms, while `/api/health` alone takes about 115 ms. [#248](https://github.com/LLaammTTeerr/omnicourses/issues/248) (Hoà, Triết). |

### TC-B2-A11Y-01: usability of the B2 screens (administration run on 25 Nov)

| IDs | Result | What happened |
| --- | --- | --- |
| A11Y-01a, b, c, g, h | passed | Every administration route at `5a5b9d5` is in the table; keyboard journeys; no sideways scroll in 46 states at 8 widths; every status in words; names and roles. |
| A11Y-01d | passed on retest (28 Nov) | Failed on `5a5b9d5` (#170). On `778d120` the green "saved after all" line follows the language, and `<html lang>` follows in all 46 states. The API's own field messages stay English on a Vietnamese page (`lang="en"`): a known deviation ([#154](https://github.com/LLaammTTeerr/omnicourses/issues/154)). |
| A11Y-01e | **failed** again (28 Nov; again on `4b038fe`, the same 1 of 184) | On `5a5b9d5`, 105 of 184 axe runs failed `color-contrast`. On `778d120`, 1 of 184: the hovered primary **Lưu** of the prerequisites dialog, light theme, white on `#4671df`, 4.47:1 (4.5 needed) (#119). |
| A11Y-01f | **failed** again (28 Nov; again on `4b038fe`, the same pairs) | On `778d120` the dark chips and field borders now pass; still under 3:1: the light text-field border on the group panel's tint (`#848d9f` on `#e4ebfb`, 2.79:1) and the card separators at 760 px and below (1.18 light, 1.20 dark) (#119). |
| A11Y-01i | blocked (F8 part) | Keyboard alternative to dragging (`PLAN-01b`) and readable Print/PDF (`SHARE-01l`) are now built on this branch; non-disruptive streamed updates remain blocked until F8 advisor chat lands in B3. |

### TC-B2-OPS-01: nightly backups, restore rehearsal and deploy health rollback

| IDs | Result | What happened |
| --- | --- | --- |
| OPS-01a–c | not run on host yet | Detailed cases written in `test-cases-b2.md` §11; `omnicourse-backup.timer` (`20:00 UTC` / `03:00` ICT, 14 daily dumps), `omnicourse_rehearsal` restore rehearsal (`deploy/README.md`), and HTTP 503 `/api/health` (`HealthController`, unit-tested in `health.controller.spec.ts`) + `omnicourse-deploy` symlink rollback are shipped on this branch, awaiting host execution after `deploy/server/setup.sh`. |

## 5. Defects and deviations

| Issue | Found by | State on 28 November |
| --- | --- | --- |
| [#137](https://github.com/LLaammTTeerr/omnicourses/issues/137) A save refused with 401 shows Saved and hides the lost change | PLAN-02a | fixed; retest passed on `778d120` |
| [#138](https://github.com/LLaammTTeerr/omnicourses/issues/138) A save with no answer says Not saved without reading the plan | PLAN-02c | fixed; retest passed on `778d120` |
| [#170](https://github.com/LLaammTTeerr/omnicourses/issues/170) The saved-after-all notice ignores a language switch | A11Y-01d | fixed by #210; retest passed on `778d120` |
| [#119](https://github.com/LLaammTTeerr/omnicourses/issues/119) Contrast (B1), with the administration's cases added on 25 November | A11Y-01e, f | open: on `778d120` a light hover (4.47:1), a light field border on a tinted panel (2.79:1) and the card separators (1.18 / 1.20:1) |
| [#154](https://github.com/LLaammTTeerr/omnicourses/issues/154) Per-field server errors in English on a Vietnamese page | A11Y-01d | deviation (`lang="en"` marked), Lâm decides at acceptance |
| [#171](https://github.com/LLaammTTeerr/omnicourses/issues/171) Deleting a group a saved plan names answers 500 | ADM-04d probe | fixed by #172 before ADM-04 ran (verified **409** in ADM-04d) |
| [#174](https://github.com/LLaammTTeerr/omnicourses/issues/174) The export writes date columns as the day before | seen in NOTIF-01i | fixed by #175; retest passed on `778d120` (RETEST-175) |
| [#163](https://github.com/LLaammTTeerr/omnicourses/issues/163) Text fields with a null character or a variation selector answer 500 | review | fixed by #179; retest passed on `778d120` (RETEST-179a, b) |
| [#247](https://github.com/LLaammTTeerr/omnicourses/issues/247) The keyboard lift never announces the target term | PLAN-01b | new on `778d120`, open |
| [#248](https://github.com/LLaammTTeerr/omnicourses/issues/248) An edit takes about 300 ms because the save and the check run one after the other | PERF-01c–f | new on `778d120`, open (Hoà, Triết) |
| [#254](https://github.com/LLaammTTeerr/omnicourses/issues/254) One dashboard load sends one audit request per past term | B1 regression (PERF-01) | new on `4b038fe`, open (Lâm); B1 PERF-01 leaves 4 s between dashboard loads meanwhile |
| [#255](https://github.com/LLaammTTeerr/omnicourses/issues/255) A reload during the session refresh signs the student out | B1 regression (PERF-01 probe) | new on `4b038fe`, open (Lâm) |
| [#249](https://github.com/LLaammTTeerr/omnicourses/issues/249) Transcript summary buttons overlap the result counts at 1280 px | TRN-01 screenshots | new on `778d120`, open; outside TRN-01's expected results, so TRN-01 stays passed |

## 6. Open items

Each item updates this report when it runs on the B2 candidate.

| # | Item | Owner | Next |
| --- | --- | --- | --- |
| 1 | Carry the results to the B2 candidate | Dũng, Lâm | Done for staging `4b038fe` (28 November, [`results-2026-11-28-4b038fe.md`](evidence/b2/results-2026-11-28-4b038fe.md)): the 28 November cases whose screens or routes changed since `778d120` were rerun with the same results; RETEST-175 and NOTIF-01d(2) keep their `778d120` result (no change to the export; #229 only moved the same SQL, pinned by `account-state.spec.ts`). PERF-01c–f is not rerun yet: the test connection was slow (health 185–199 ms against 109–123 ms); rerun tonight or on the morning of 29 November. When B2 is tagged, repeat for the `src/` changes after `4b038fe`. |
| 2 | Host `setup.sh`, `OPS-01a–c` and `ADM-07j` (4)–(5) | Lâm, then Dũng | Lâm runs `deploy/server/setup.sh` on the host, executes `OPS-01a–c` (`omnicourse-backup.timer`, `omnicourse_rehearsal` restore, `/api/health` 503 rollback), and Dũng reruns `ADM-07j` (4)–(5) against `client_max_body_size 8m`. |
| 3 | CSV import and `/admin/calendar` screen checks | Thắng | At 360 and 1280 px: no overflow, the keyboard reaches every control, readable errors. Thắng runs both screens (28 November). |
| 4 | B1 regression on B2 (cases §12) | Dũng | Ran on `4b038fe` on 28 November ([`results-b1-regression-2026-11-28.md`](evidence/b2/results-b1-regression-2026-11-28.md)): as expected, with the cases updated for the dashboard rebuilt in #214 (B1 cases 0.12) and for #207's 503 (B0 cases 0.3); new defects #254 and #255; the light `.delta` chip of the dashboard added to #119. Left: B1 PERF-01b–h (rerun on a normal connection; if still slow by midday 29 November, "not run: slow tester connection", carried to B3), the phone checks (DEP-01e, GUIDE-01o second reader) and DEP-01f (waits for the tag). |
| 5 | Retests of B1 defects (cases §13) | Dũng | For each of #101, #114, #115, #117 and #119 once its fix is merged. #119 still fails (A11Y-01e, f on `778d120` and `4b038fe`; on the B1 screens, the sign-up quote block and the light dashboard `.delta` chip). |
| 6 | New defects of 28 November | Hoà, Triết; Dũng retests | [#247](https://github.com/LLaammTTeerr/omnicourses/issues/247) (PLAN-01b, keyboard lift announcement), [#248](https://github.com/LLaammTTeerr/omnicourses/issues/248) (PERF-01c–f, edit validation about 300 ms) and [#249](https://github.com/LLaammTTeerr/omnicourses/issues/249) (transcript buttons over the result counts). Retest after the fixes. |
| 7 | Planner, transcript, sharing and notification screens in A11Y-01 | Dũng | Add them, and `/admin/calendar` and `/admin/import`, to §10's table of screens (A11Y-01a), then run A11Y-01 on them. |
| 8 | Case wording | Dũng | Update TRN-01a, b, f, SHARE-01l, PLAN-01a, b, d, f and PLAN-02a to the screens as built (each listed in [`results-2026-11-28.md`](evidence/b2/results-2026-11-28.md)). |
| 9 | §3 Automated checks | Dũng | Record the green CI run and `src/rules/**` coverage on the tagged B2 commit. |

## 7. Test data left on staging

From the 21–28 November runs, as each results file's "State after the run" or "Test data left" says:

- Accounts `b2-s1`, `b2-s3` to `b2-s15` and `b2-a1` to `b2-a4`, with the transcripts and plans their files list. `b2-s2`, `b2-a5` and `b2-a6` are deleted and purged. Q (`b2-s7`) and L (`b2-s15`) were signed up on 28 November: Q keeps the plan "PERF-01" with the fixture's board; L keeps "Default plan" and "What-if: Default plan".
- A1 to A4 hold the grants of cases §1; A4 is the only active access manager.
- APCS has an empty third cohort, APCS2099 (`c11cd85d-6ab8-4902-8146-eba313b46b05`), which no route deletes (Lâm's bot agreed, 25 November); ADM-03g left it with no group and `totalCreditsMin` `null`.
- A test program, **ZZ-ADM03G** "Chương trình thử ADM-03g" (`478bc0e5-0ba7-4e82-9875-b71210a683bd`, `trainingType` `standard`, no cohort), made by ADM-03g (14), which no route deletes (Lâm's bot agreed, 28 November).
- No NOTIF-01 test date is left: `E-d` was deleted on 28 November after NOTIF-01d(2). The notifications that NOTIF-01's dates made stay in every APCS inbox on staging (ADR 0018, decision 7).
- O (`b2-s12`) keeps "SHARE-01 plan (renamed)" with **no** live share link: SHARE-01l stopped the 25 November link and its own.
- CS420's offering terms are `null` again (PLAN-01c and PERF-01f set and cleared them).
- No `ZZ` test course and no test group is left.
