# B2 run: NOTIF-01, SHARE-01 (API) and ADM-04 results, 25 November 2026

Tester: Dũng, with Claude Code sending the API requests and driving Chrome. These are working notes and raw results, not the B2 report. Times are UTC; Vietnam time is UTC+7. Lâm's bot asked for this run on 25 November 2026 at 13:07Z: "run the cases you wrote in #168 on staging … ADM-03 (second cohort) and ADM-04 (removal; 04d should now give 409). SHARE-01 API parts and NOTIF-01." The cases are those of `test-cases-b2.md` as merged by #168 (`e7a2ff4`).

**Not in this run.** ADM-03 waits for Lâm's agreement in #168, which the case asks for before ADM-03b makes a cohort that no route deletes ([question of 13:14Z](https://github.com/LLaammTTeerr/omnicourses/pull/168#issuecomment-7163482482)); it is recorded below as **not run**, and `a-adm-03.mjs` is ready. The CSV screen checks on the **Nhập CSV** tab are left out until Dũng has asked Thắng, so the two do not overlap. NOTIF-01d(2) runs on D+3, 28 November 2026.

## Build and setup

| Item | Value |
| --- | --- |
| Server | Staging, https://stag-omnicourses.lamter.cc |
| Build | Staging `e7bd617` (#165), build tag none. Staging serves no version, so the build was read from the deploy runs: the staging deploy of `e7bd617` ran at 11:40:03Z ([run 45606544880](https://github.com/LLaammTTeerr/omnicourses/actions/runs/45606544880)); the deploys after it (`85342b2`, `e7a2ff4`) went to production. `e7bd617` holds #161 (`bd1d46e`), #169 (`8bcc498`) and #172 (`72ae3f1`). |
| API client | Node `fetch` scripts with no dependencies (Node 24.19.0 on Windows 10; the repository pins 22.22.1, and the scripts use only `fetch`), instead of the Swagger page: the same requests, with the bodies of §6–§8. `c-lib.mjs` holds the shared helpers. Each script checks the expected results and prints `ok` or `FAIL` per expected result. Tokens are printed as `…`, and share tokens as `{T1}`, `{T2}` … (see "Share tokens in the output" below). |
| Scripts | `a-notif-01.mjs` (NOTIF-01, in parts: `main`, `i5`, `cleanup`, `d2`), `a-share-01.mjs` (SHARE-01a–j), `a-share-01k.sh` (SHARE-01k, the case's bash loop, Git Bash 5.2 with `curl`, `openssl`, `tr`), `a-adm-04.mjs` (ADM-04a–f), `a-adm-03.mjs` (ADM-03, not run yet). |
| Screen client | NOTIF-01g(6) and (7) only: `a-notif-01.mjs` with `b-lib.mjs`, Chrome 144.0.7559.110 headless, playwright-core 1.64.1, 1280 × 800, light theme, English. *Block a request* is `b-lib.mjs`'s `block()`, which aborts the request as blocked by the client. |
| Rate limit | Sign-in, sign-up and account deletion are spaced 7 s apart across every script (`c-lib.mjs`, the same stamp file as `b-lib.mjs`). SHARE-01k ran a minute after the last read of a shared link. |
| Output | The full output of each run is in the `*-output.txt` file named after it, next to this file. |

Accounts, all synthetic, with the §1 password, display name "Test Student", signed up in this run and onboarded to APCS 2024 unless said: N1 `b2-s9` (`c84ae892-7ab8-4b8d-b878-05538669d4d4`), N2 `b2-s10` (`69162420-060a-4a1e-b32e-a760641076b3`, onboarding saved with `finished: false`, NOTIF-01e), N3 `b2-s11` (`a90cbcb4-03c6-46bc-b2a8-9a21dd349362`), O `b2-s12` (`883dd5e5-2409-405f-a561-b03809bbe4be`), R `b2-s13` (`687cca7a-1a7b-4c9b-a6e8-159a0dd16122`), C `b2-s14` (`4c0578d2-8cf1-4c89-8ba5-79e1d8748ae9`, signed up by ADM-04 at 13:22:14Z, since ADM-03a has not run). A1–A4 held their §1 grants (each script used them as granted; ADM-04e's 403s confirm A1's and A4's).

Values: `{APCS}` `d3f524f8-e51b-42dd-91ac-013b15d5e033`, `{APCS24}` `4a941965-834b-4d5a-a9c3-91a0607c3cbc`, `{KHMT}` `74ce84b9-c698-43ea-8470-1988a50656a8`, `{KHMT25}` `f7622c13-3e5b-4d6c-95b0-17308c767846`, `{AC}` `c052bbaf-ceda-4f6d-aad6-16be64e37324`. The test dates of NOTIF-01 and their IDs are in `omnicourses-b2-notif-01-state.json`, which `a-notif-01.mjs d2` reads.

## Results

### TC-B2-NOTIF-01: notifications, D = 2026-11-25, 13:17–13:51Z (20:17–20:51 Vietnam time)

Before the run, A1's `GET /api/academic-calendar?program=APCS` listed **0** dates: no school date of staging made notifications of its own, and no NOTIF-01 date was left from an earlier run (`a-notif-01-main-output.txt`).

| ID | Result | Notes |
| --- | --- | --- |
| NOTIF-01a | passed | (1) **200**, N1's list empty, `{ "unread": 0 }`. (2) The four routes signed out: **401** each. (3) The eight queries: **400** each. (4) **404** `not_found`, "No notification with this ID". (5) Both **404** `not_found`, the same message. |
| NOTIF-01b | passed | `E-b` (registration, 2026-12-02 to 12-08) **201**. At once, N1 had exactly one notification of `E-b`: `registration_soon`, `readAt` `null`, `links` `["calendar", "planner"]`, `event` exactly as entered (`term` `null`, both titles), and exactly the keys `id`, `kind`, `createdAt`, `readAt`, `event`, `links`. No `registration_open`. Unread count 0 → 1. The second read still one. |
| NOTIF-01c | passed | `E-c`, `E-c2`, `E-c3`, `E-c4` **201** each. `E-c`: one `registration_open`, `["calendar", "planner"]`, no `registration_soon`. `E-c2`: one `term_start`, `["calendar"]`. `E-c3` (`add_drop`) and `E-c4` (`exam_period`): none. |
| NOTIF-01d | (1) passed; (2) **not run yet** | (1) `E-d` (registration, 11-28 to 11-30) **201**, no notification of `E-d`. (2) runs on 28 November 2026 (Vietnam), `node a-notif-01.mjs d2` with `STATE_DIR` set to this folder; it then deletes `E-d`. |
| NOTIF-01e | passed | (1) N2's onboarding (`finished: false`) **200**; N2 had exactly one notification each of `E-b` (`registration_soon`), `E-c` (`registration_open`) and `E-c2` (`term_start`), none of `E-c3`, `E-c4`, `E-d`. (2) A2's `E-e` in CNTT-TCTA-KHMT **201**; neither N1 nor N2 had a notification of `E-e`, and none of theirs had `programCode` `CNTT-TCTA-KHMT`. |
| NOTIF-01f | passed | (1) `E-c` moved to 11-26: **200**, N1's notifications of `E-c` unchanged (one, `startsOn` 11-25). (2) Moved to 12-02 – 12-08: **200**, one new `registration_soon` of `E-c` with `startsOn` 12-02; the `registration_open` unchanged, with `startsOn` 11-25; no second `registration_open`. (3) `E-c2` changed to `registration`: **200**, one new `registration_open` of `E-c2`; its `term_start` unchanged. (4) `E-b` deleted **204**; N1's `registration_soon` of `E-b` equal to the one kept (event, `createdAt`, `readAt`); the calendar no longer listed `E-b`. |
| NOTIF-01g | passed | (1)–(3) **200** each, no `transcript_changed`. (4) T-B **200**, exactly one: `event` `null`, `links` `["audit"]`; the answer holds none of CS160, PH211, 6.5, 8.5. (5) **400**, still one. (6) **Screen**, English: PH211's grade changed, **Degree audit**, the browser asked "Your transcript has unsaved changes. Leave the page and discard them?", **OK** opened `/audit`, no write sent; still one. (7) **Screen**: the blocked save showed "Could not save. Your rows are still here; try again in a moment." (the `PUT` failed `net::ERR_BLOCKED_BY_CLIENT`); after unblocking and reloading, still one. (8) `{ "rows": [] }` **200**, two. (9) T-A **200**, still two. N2 had none. |
| NOTIF-01h | passed | (1) U = 7. (2) **200** with `readAt` 13:18:03.238Z, the second **200** with the same `readAt`; count 6. (3) `?unread=true` 6, all unread, not that one; `?unread=false` 1, that one. (4) Only `registration_open` and `term_start` (3 notifications). (5) `?limit=2`: 4 pages, 7 notifications, newest first (`createdAt`, then `id`), equal to the whole list once each. (6) `read-all` **200** `{ "unread": 0 }` twice; the notification of (2) kept its first `readAt`. (7) N2's two `POST …/read` with N1's IDs: **404** `not_found`, "No notification with this ID"; N1's list unchanged. |
| NOTIF-01i | passed | (1) N3 signed up, onboarded, `DELETE /api/users/me` **202** (13:18:12Z). (2) `E-i` (`term_start`, 11-25) **201** at 13:18:12Z; N1 sent nothing for 11 minutes. (3) N1's export **200** at 13:29:12Z: `tables.notifications` held N1's `term_start` of `E-i`, `created_at` 13:20:59.510Z, made by the timer, with no read by N1 (`a-notif-01-main-output.txt`). (4) The bot ran the query on staging at 13:50Z: **0 rows** for N3, so no row of `E-i` (`a-notif-01i4-db-output.txt`). (5) N3's sign-in at 13:51:10Z **200** with `"accountRestored": true`; the read held `E-i`'s `term_start`, made at that read (`a-notif-01-i5-output.txt`). Clean-up at 13:51Z: `E-c`, `E-c2`, `E-c3`, `E-c4`, `E-i` (A1) and `E-e` (A2) deleted, **204** each (`a-notif-01-cleanup-output.txt`); `E-d` stays until NOTIF-01d(2). |
| NOTIF-01j | blocked | Not run: the inbox screen and the bell are not built (the case). |

**Seen, not a failure of the case: the export writes notification dates as a timestamp of the day before.** In N1's export (NOTIF-01i(3)), `E-i`'s row has `"starts_on": "2026-11-24T17:00:00.000Z"` and `"ends_on"` the same, for a date of 25 November; the API gives `"startsOn": "2026-11-25"`. The `date` columns come out as midnight in Vietnam written in UTC, so a reader of the file who takes the date part reads 24 November. The case checks only `kind`, `calendar_event_id` and `created_at`. Other `date` columns of the export may do the same; not checked.

### TC-B2-SHARE-01: export and sharing, API, 13:18–13:24Z

| ID | Result | Notes |
| --- | --- | --- |
| SHARE-01a | passed | The plan **201** (`{P}` `580c48d3-1ad9-4c74-8625-c78eb5ed7c36`). `GET …/share` **200** `{ "share": null }`. `PUT` **200** with `token` (43 base64url characters), `showName` and `showTranscriptChecks` `false`, `createdAt`, and `Cache-Control: no-store`. The `GET` returned the same object under `share`. `PUT` with `{}`: the same `token` and `createdAt`. |
| SHARE-01b | passed | The reader: **200**, both headers, exactly the seven keys, no `coverage`. "SHARE-01 plan", `ownerName` `null`; `curriculum` `APCS2024`, 2024, the names, `program` `APCS` with its names. One term, 2026 term 1, `credits` 24, the six placements in order with the six keys. `issueCodesNotShown` the four codes. `issues`: O's report without the four codes, in the same order (`load_above_maximum` with `kind` `flag`, `credits` 24, `limit` 22, then six `offering_terms_not_recorded`). Each issue holds the owner's fields except `requirementGroupId`, `combinedMinimumId` and `missingCourseCodes`, as `shared-plan.ts` builds it. No key `id` at any depth, no email, no `grade`, no transcript row. R's and O's answers equal the reader's. |
| SHARE-01c | passed | `showName: true` **200**, same token; `ownerName` "Test Student". `null` **400** "showName must be a boolean value", `[]` **400** "The body must be a JSON object", `"yes"` **400** "showTranscriptChecks must be a boolean value"; the link as before them. `showName: false` **200**; `ownerName` `null`. |
| SHARE-01d | passed | Rename and placements **200** each; the reader saw "SHARE-01 plan (renamed)", a later `updatedAt`, five placements, 20 credits, no `load_above_maximum`. The token unchanged. |
| SHARE-01e | passed | T-A saved **200**; V1 equal to the answer before, `updatedAt` included. O's report: `already_passed` for CS160 and MTH251. With the choice on, the reader's `issues` were the report's 16 in the same order (each with the owner's fields except `requirementGroupId` and `combinedMinimumId`, and with names in their place), `issueCodesNotShown` `[]`, `coverage` present, no `grade`, `id` or transcript row. Off again: equal to V1. |
| SHARE-01f | passed | The reader's `POST`, `PUT`, `PATCH`, `DELETE` on `/api/shared-plans/{T1}`: **404** "Cannot POST /api/shared-plans/{T1}" (and so on), each with both headers, never "This plan is not shared". `Bearer {T1}` on the four owner routes: **401** each. R's three calls: **404** "No plan with this id". The reader's answer and O's link unchanged. |
| SHARE-01g | passed | `DELETE` **204**; `{T1}` the 404 page at once, with both headers. `{ "share": null }`; the second `DELETE` **204**. `PUT`: `{T2}` ≠ `{T1}`, both choices off. `{T2}` **200**, `{T1}` the 404 page. A random 43-character token, `x`, `{P}` and `{T2}` without its last character: the same 404 page, word for word. |
| SHARE-01h | passed | "SHARE-01 plan 2" (`{P2}`) shared, read **200**; its `DELETE` **204**; `{T3}` the 404 page. |
| SHARE-01i | passed | R's plan shared (`{TR}`). O's `DELETE /api/users/me` **202**; `{T2}` the 404 page at once, `{TR}` **200**. O's sign-in **200** with `"accountRestored": true`. `{ "share": null }`, `{T2}` still the 404 page. `PUT` gave `{T4}`, new, which opened. R's plan deleted **204**. |
| SHARE-01j | passed | O's export **200**: `tables.plan_shares` one row, of `{P}`, with the keys `id`, `plan_id`, `user_id`, `show_name`, `show_transcript_checks`, `created_at`, no `share_token`; `{T4}` nowhere in the file. |
| SHARE-01k | passed | 13:22:28–13:23:21Z (53 s), from Git Bash (`a-share-01k-output.txt`): **120** × 404 and **1** × 429. `curl -sI`: **429** with `X-Robots-Tag: noindex, nofollow`, `Cache-Control: no-store` and `Retry-After: 60`. At 13:24:27Z, after a minute, a guess **404**. The 121st guess was refused this time, so #117 did not show. |
| SHARE-01l | blocked | Not run: the Share panel, the shared page and the PDF are not built (the case). |

**SHARE-01a–j ran twice.** The first run (13:18:44Z, `a-share-01-attempt1-output.txt`) recorded two `FAIL`s that were faults of the script: SHARE-01b and e compared each shared issue with the owner's issue as whole objects, but the shared view leaves out the fields that hold IDs (`requirementGroupId`, `combinedMinimumId`, and, with the choice off, `missingCourseCodes`), by design. Every other check of the first run passed. What the first run wrote: O and R signed up and onboarded; O's plan `6e0c1405-…` with a live link, T-A saved as O's transcript, "SHARE-01 plan 2" made and deleted, O's deletion requested and cancelled, R's plan made and deleted. The script was changed to compare the fields the reader gets (and to name the ones it lacks), and, when O already exists, to start by deleting O's SHARE-01 plans and saving an empty transcript. The second run (13:20:05Z, `a-share-01-output.txt`) did that first (`DELETE` of `6e0c1405-…` **204**, transcript **200**), so it started with O holding no plan and an empty transcript, not "no transcript": a saved empty transcript, which the case's checks do not tell apart. The results above are the second run's.

**Share tokens in the output.** Both runs printed `{T1}` in clear inside SHARE-01f's 404 messages, and the second run printed `{T2}` without its last character in SHARE-01g, because the checks' text did not go through the script's redaction. Both links were stopped by the end of the run (`{T1}` in SHARE-01g, `{T2}` by O's deletion in SHARE-01i). The two output files were edited after the run to replace them with `{T1}` and `{T2} without its last character`; nothing else in them was changed. `c-lib.mjs` now redacts every printed line, and `a-share-01.mjs` registers the shortened `{T2}`.

### TC-B2-ADM-04: removal, API, 13:21:45–13:22:20Z

| ID | Result | Notes |
| --- | --- | --- |
| ADM-04a | passed | Test data: `GET /api/courses/ZZADM04` **404**; ZZADM04 **201**; `{TG4}` "Nhóm thử ADM-04" **201** (`b0b342b7-5099-4800-abbb-9c808a64552d`); both links **204**. The first unlink **204**, the second **404** `not_found`, "ZZADM04 is not in this group". ZZADM04 **200**, one membership, "Tự chọn Computer Science (C)" of APCS2024. `{AC}` still listed ZZADM04 among its 28 courses; `{TG4}` none. |
| ADM-04b | passed | Offering terms **200** `{"courseCode":"ZZADM04","terms":[1]}`. The unlink **409** `referenced_item`, "ZZADM04 would leave the curriculum while its rules still name it; clear them first", `references` `["offering terms of ZZADM04 are recorded"]`; `{AC}` still listed it. Clearing **200** `"terms": null`. The unlink again **204**; no membership. |
| ADM-04c | passed | The link **204**. A3's `DELETE` **409** `referenced_item`, "ZZADM04 is still referenced", `["linked in APCS2024"]`; the `GET` **200**. The unlink **204**. |
| ADM-04d | passed | C's plan with a slot of `{TG4}` **201**. A1's `DELETE` of `{TG4}` **409** `referenced_item`, "Saved plans use the group; it stays while they name it", `references` `["1 saved plans use it"]`; the answer names no plan and no student. `{TG4}` still in APCS 2024; the plan equal to what was kept. Clean-up: the plan **204**, the group **204**. The 500 of the probe (#171) is gone: #172 is on staging. |
| ADM-04e | passed | A1 and A4: **403** `permission_required`, `catalog_maintainer`. A3: **204**; the `GET` **404**; the second `DELETE` **404** `not_found`, "No catalog course has the code ZZADM04". |
| ADM-04f | passed | `PATCH` BAA00104 with `code`: **400** `validation_failed`, `["code: property code should not exist"]`, no 409 first. BAA00104 **200** with 11 memberships; BAA00105 **404**. The group `PATCH` with `curriculumId`: **400**, `["curriculumId: property curriculumId should not exist"]`. |
| ADM-04g | blocked | Not run: group credit totals wait for the final-state validation interface (Triết), as the case says. |

ADM-04 was run while NOTIF-01 waited for its timer and after SHARE-01; no TRN, PLAN or PERF case of this run was running. Whether a teammate ran one on staging at that minute is not known.

### TC-B2-ADM-03: cohorts

| ID | Result | Notes |
| --- | --- | --- |
| ADM-03a–f | **not run** | Waiting for Lâm's agreement in #168 (asked at 13:14Z): ADM-03b makes a cohort of APCS that no route deletes. `a-adm-03.mjs` is ready. C exists already (ADM-04), with no transcript and no plan. |
| ADM-03g | blocked | Credit totals and the training type (the case). |

## State after the run

At 13:51Z: no NOTIF-01 test date in APCS or CNTT-TCTA-KHMT but `E-d` (`63ec99b6-e70c-4cde-8479-76afbb837f74`, registration 2026-11-28 to 11-30), which NOTIF-01d(2) deletes on 28 November. The notifications made by the test dates stay, as decision 7 of ADR 0018 says: in N1's, N2's and N3's inboxes, and in the inbox of every other APCS account on staging that existed during the run. No test group and no ZZADM04 in the catalog (`a-adm-04-output.txt`, last check). New synthetic accounts: N1–N3, O, R, C. O keeps "SHARE-01 plan (renamed)" (`{P}`) with a live link `{T4}` and T-A as its transcript; N1 holds T-A; C holds nothing.

## For the bot

- NOTIF-01a–i passed (d(2) on 28 Nov); j blocked.
- SHARE-01a–k passed (a–j on the second run; the first run's two FAILs were the script's); l blocked. #117 did not show (120 × 404, then 429).
- ADM-04a–f passed, 04d **409** as fixed by #172; g blocked.
- ADM-03 not run: waiting for Lâm's agreement in #168.
- Seen: the account export writes the `date` columns of `notifications` as the previous day's 17:00Z.
