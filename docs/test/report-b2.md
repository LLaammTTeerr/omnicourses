# B2 test report

- **Status: partial, in progress.** This report collects the B2 runs recorded so far. It is updated as each open item in §6 runs, and it has no decision yet. Counts in §1 are as of 26 November 2026.
- Owner: Dũng. Drafted with Claude Code from Dũng's staging runs of 21–25 November 2026. The raw results and notes of each run are in its results file under [`evidence/b2/`](evidence/b2/) (§2); this report summarises them and does not repeat them.
- Build: B2 is due on 29 November 2026 ([test plan §8](test-plan.md#8-schedule-and-remaining-work)) and is not tagged yet. Every run so far was on staging, on the commit staging served that day (§2). Before the decision, each result is either carried to the candidate or run again (§6, item 1).
- Cases: [B2 test cases](test-cases-b2.md) v0.11. Parent checks: [test plan §5](test-plan.md#5-required-checks).
- Decision: **not made.** Lâm decides once the candidate is tagged and the open items in §6 are run or explained.

## 1. Summary

113 detailed cases are written. PLAN-01, OPS-01, the B1 regression run (cases §12) and the retests of B1 defects (cases §13) have no detailed cases yet, so they are not counted here; §6 lists them.

| Result | Cases |
| --- | --- |
| Passed | 92. TRN-01a–e, TRN-02a–h, PLAN-02b, d, e, ADM-01a–e, ADM-02a–l, ADM-03a–f, ADM-04a–f, ADM-05a–g, ADM-06a–g, ADM-07a–i, SHARE-01a–k, NOTIF-01a–c, e–i, A11Y-01a, b, c, g, h |
| Failed | 5. The planner's saved state: PLAN-02a ([#137](https://github.com/LLaammTTeerr/omnicourses/issues/137)), PLAN-02c ([#138](https://github.com/LLaammTTeerr/omnicourses/issues/138)). Accessibility of the administration screens: A11Y-01d ([#170](https://github.com/LLaammTTeerr/omnicourses/issues/170)), A11Y-01e and f ([#119](https://github.com/LLaammTTeerr/omnicourses/issues/119)) |
| Blocked | 9. Screens not built: TRN-01f (paste entry), TRN-01g (no Cancel button), SHARE-01l (share panel, shared page, PDF), NOTIF-01j (inbox, bell), A11Y-01i (dragging, PDF, streamed updates). Group credit totals (Triết): ADM-03g, ADM-04g, ADM-07k. Staging's proxy: ADM-07j (nginx answers 413 in HTML; Lâm runs `setup.sh`) |
| Not run | 7. NOTIF-01d: part (1) passed, part (2) runs on 28 November 2026. PERF-01a–f: wait for live validation in the planner |
| **Total** | **113** |

What matters so far:

- **No ADM, TRN-02 or SHARE-01 case failed.** Every permission boundary, impact review, cohort, removal, CSV import and grant case that could run passed, through the API and on the administration screens. No case found one student's data reaching another, or a write that a refused request left half done.
- **The planner can hide a lost change** (PLAN-02a, c). A save refused with 401 shows **Saved** before sign-in opens (#137). A save whose answer is lost says **Not saved** without reading the plan again, while the server saved it (#138). Both were predicted when the cases were written.
- **Accessibility of the administration screens fails on contrast and one message.** Contrast fails in 38 of 46 states, in #119's colours, and field borders and card separators are below 3:1. One green notice stays in Vietnamese after a switch to English (#170). Keyboard use, widths, words beside colour, and names and roles all passed.
- **Large parts of B2 have not run.** The planner's drag-and-drop and live validation (PLAN-01, PERF-01), the share and notification screens, transcript paste, and backups (OPS-01) are not on staging, or not built. The B1 regression run and the B1 retests are not written.

By parent check. A parent passes only when all its required detailed outcomes pass ([test plan §5](test-plan.md#5-required-checks)).

| Parent check | Result so far | Why |
| --- | --- | --- |
| TC-B2-PLAN-01 | not written | Waits for drag-and-drop and live validation (Hoà, Triết). |
| TC-B2-PLAN-02 | failed | PLAN-02a (#137) and PLAN-02c (#138) failed. b, d, e passed. |
| TC-B2-TRN-01 | not passed yet | a–e passed on typed entry. f (paste) and g (Cancel) blocked. |
| TC-B2-TRN-02 | passed | a–h passed. |
| TC-B2-ADM-01 | passed | a–e passed. |
| TC-B2-ADM-02 | passed | a–l passed. |
| TC-B2-ADM-03 | not passed yet | a–f passed. g blocked on group credit totals. |
| TC-B2-ADM-04 | not passed yet | a–f passed. g blocked on group credit totals. |
| TC-B2-ADM-05 | passed | a–g passed. |
| TC-B2-ADM-06 | passed | a–g passed. |
| TC-B2-ADM-07 | not passed yet | a–i passed. j blocked on staging's proxy, k on group credit totals. |
| TC-B2-SHARE-01 | not passed yet | a–k passed through the API. l blocked: the screens are in [#178](https://github.com/LLaammTTeerr/omnicourses/issues/178). |
| TC-B2-NOTIF-01 | not passed yet | a–c, e–i passed. d(2) runs on 28 November. j blocked: the screens are in [#177](https://github.com/LLaammTTeerr/omnicourses/issues/177). |
| TC-B2-PERF-01 | not run | Waits for live validation. |
| TC-B2-A11Y-01 | failed | Administration screens only: d, e, f failed; a, b, c, g, h passed; i blocked. The planner, transcript, share and notification screens are not in the cases yet. |
| TC-B2-OPS-01 | not written | Nightly backups are not started (Lâm). |

## 2. Runs and environment

Every run was on staging, https://stag-omnicourses.lamter.cc. Staging shows no version (`GET /api/health` answers `{"status":"ok","database":"up"}`), so each run's build was read from the staging deploy runs; each results file gives the deploy run and its time.

| Run (UTC) | Staging build | Cases | Results | Pull request |
| --- | --- | --- | --- | --- |
| 21 Nov, 09:33–09:44 | `c804c3f` | ADM-02a–h | [`results-2026-11-21.md`](evidence/b2/results-2026-11-21.md) | #133 |
| 21 Nov 17:16 – 22 Nov 01:44 | `086d49c` | TRN-02a–h, PLAN-02a–e | [`results-2026-11-22.md`](evidence/b2/results-2026-11-22.md) | #135 |
| 22 Nov, 02:31–04:52 | `7f7974f` | ADM-01a–c, ADM-05a–d, ADM-06a–f | [`results-2026-11-22-adm.md`](evidence/b2/results-2026-11-22-adm.md) | #139 |
| 25 Nov, 06:02–06:35 | `5a5b9d5` | ADM-01d–e, ADM-02i–l, ADM-05e–g, ADM-06g, ADM-07a–k, TRN-01a–g, A11Y-01a–i (administration) | [`results-2026-11-25.md`](evidence/b2/results-2026-11-25.md) | #167 |
| 25 Nov, 13:17–13:51 | `e7bd617` | NOTIF-01a–j, SHARE-01a–l, ADM-04a–g | [`results-2026-11-25-notif-share-adm04.md`](evidence/b2/results-2026-11-25-notif-share-adm04.md) | #173 |
| 25 Nov, 14:35 | `e7bd617` | ADM-03a–g | the same file, ADM-03 section | #176 |

| Item | Used |
| --- | --- |
| API client | Node `fetch` scripts with no dependencies, in place of the Swagger page: the same requests and bodies as the cases. Each prints `OK` / `ok` or `MISMATCH` / `FAIL` per expected result, and no token. The scripts and their full output are beside each results file. |
| Browser | Chrome 144 on Windows 10. Headed through Claude in Chrome for TRN-02 and PLAN-02; headless through playwright-core 1.64.1 at 1280 × 800 for the 25 November screens. axe-core 4.10.2 for A11Y-01e. |
| Server steps | ADM-06b, ADM-06e–f, TRN-02f and NOTIF-01i(4) need the staging host or its database. Lâm's bot ran them on request; its output is copied into the results files. |
| Test data | Synthetic `example.com` accounts `b2-s1` to `b2-s14` and `b2-a1` to `b2-a6`, password `correct horse battery` (cases §1); synthetic `ZZ` courses and test groups, removed after each run. No real name, student ID, transcript or secret. |
| Model calls | None. |

Rate limits: sign-in allows 10 requests a minute from one address. The first attempts at ADM-05b–d (22 November) and ADM-07c–i (25 November) were refused with 429 because the test client sent sign-ins too fast; they were run again, and each results file says what the refused attempt wrote. Two other first attempts stopped on a fault in the script (TRN-01b, SHARE-01a–j) and are recorded the same way.

## 3. Automated checks

To add once B2 is tagged: the CI run on the candidate commit, with the backend, frontend, e2e and coverage results, as in [B1 §3](report-b1.md#3-automated-checks).

## 4. Results

One line per group of cases from the same run with the same result. The results file of the run (§2) has a line for each case.

### TC-B2-TRN-01 and TRN-02: transcript entry and student-record integration

| IDs | Result | What happened |
| --- | --- | --- |
| TRN-01a–e | passed | Typed entry on **Transcript**: incomplete rows block the save and say what to fix; a removed row changes nothing until a save; the save sends one `PUT` and the API holds exactly the rows saved; leaving with unsaved rows asks first; a blocked save keeps the rows. |
| TRN-01f | blocked | Paste entry is not built. |
| TRN-01g | blocked | The screen has no Cancel button (design difference, UC-02 A9). |
| TRN-02a–e, g, h | passed | A save replaces the transcript; two saves sent at the same moment, 10 times, never mixed; repeated and unknown courses are kept; the audit and the planner's **Taken** strip follow a save without a reload; a bad row or grade answers 400 and changes nothing. |
| TRN-02f | passed | The export matched the saved rows. After deletion and purge (by Lâm's bot), S2 had no row in any user table, and S1's transcript was unchanged. |

### TC-B2-PLAN-02: failure and ownership

| IDs | Result | What happened |
| --- | --- | --- |
| PLAN-02a | **failed** | Session revoked from another client, then an edit: the `PUT` answered 401, the chip showed **Saved**, and sign-in opened with nothing saying the change was lost. #137. |
| PLAN-02b | passed | A blocked save and a 500 each showed **Not saved** and put the board back to the saved plan. |
| PLAN-02c | **failed** | The save's answer was lost after the server saved it. The planner said **Not saved** and never read the plan again, while its own term header and Plan check showed the saved course. #138. |
| PLAN-02d, e | passed | Another student's plan ID answers 404 on all 8 routes, the same as an unknown ID; crafted boards answer 400; nothing of the other student changed. |

### TC-B2-ADM-01 to ADM-07: curriculum administration

| IDs | Result | What happened |
| --- | --- | --- |
| ADM-01a–c | passed | A shared-course edit needs the impact review (409 with the 11 curricula), then saves everywhere; a program administrator is refused; cohort fields in a catalog edit answer 400. |
| ADM-01d, e | passed | The catalog screen's impact review, and the refused section for a program-only administrator. |
| ADM-02a–h | passed | Signed-out 401, no-role 403, own-program writes, another program refused with nothing of it leaked, catalog and access roles kept apart, a revoked grant refused at once with the old token, the last access manager kept. |
| ADM-02i–l | passed | Each role sees only its sections; a grant revoked while a form is open is refused and the form is kept; group writes in the own program, refused in another. |
| ADM-03a–f | passed | A second cohort, APCS2099, with its groups and links, leaves the first cohort's plans, audit and curriculum unchanged; duplicates, bad values and other programs are refused. |
| ADM-03g, ADM-04g, ADM-07k | blocked | Group credit totals wait for the final-state validation interface (Triết). |
| ADM-04a–f | passed | Unlinking, a course a rule still names (409), a linked course (409), a group a saved plan uses (409, fixed by #172 before the run), catalog deletion by role, codes that cannot change. |
| ADM-05a–d | passed | Field validation, duplicate codes, an impact list that changed during the review, deletions refused while a transcript or plan names the course, and edits that leave saved transcripts and plans unchanged. |
| ADM-05e–g | passed | The same on the screens: field errors, Cancel, the three lost-answer outcomes, and the review after `impact_changed`. |
| ADM-06a–g | passed | A new account has no grant; the bootstrap refuses when an access manager exists; grants and revocations take effect at once; the export holds the user's own grants only; a granter's purge keeps the grants it gave; the user ID and the access screen. |
| ADM-07a–i | passed | CSV import of courses and group links: roles, per-record errors in order, nothing saved from a file with an error, preview and confirmation with a review version, re-import with no duplicate, an impact change or a revoked grant at confirmation refused. |
| ADM-07j | blocked | The 1000-record and 1 MiB limits answered as expected; the two larger bodies got staging nginx's HTML 413, not the app's JSON. Rerun (4) and (5) after Lâm runs `setup.sh` on the host. |

### TC-B2-SHARE-01: export and sharing (API)

| IDs | Result | What happened |
| --- | --- | --- |
| SHARE-01a–k | passed | A share link reads only the allowed keys, with no ID, email, grade or transcript row; the owner's choices for name and transcript checks; the reader cannot write; revoked, replaced, deleted, unknown and deleted-owner links all give the same 404 page; the export holds no token; 120 guesses then 429, with `noindex` and `no-store` on every answer. |
| SHARE-01l | blocked | The share panel, the shared page and the PDF are not built (#178). |

### TC-B2-NOTIF-01: notifications

| IDs | Result | What happened |
| --- | --- | --- |
| NOTIF-01a–c | passed | Routes, validation and not-found; a registration date makes one `registration_soon` or `registration_open`, a term start one `term_start`, and other kinds none. |
| NOTIF-01d | not run yet | (1) passed: a registration date entered three days ahead, after its 7-day reminder day, made no notification. (2), which expects one `registration_open`, runs on 28 November 2026 (Vietnam), `node a-notif-01.mjs d2`, which then deletes the test date `E-d`. |
| NOTIF-01e–i | passed | A student who joins later gets the current notices; another program's dates reach nobody here; moved and deleted dates make no repeat and keep what was sent; a saved transcript change makes one `transcript_changed`, a refused, cancelled or failed save none; read, unread and paging; another student's IDs give 404; an account waiting for deletion gets nothing until it is restored. |
| NOTIF-01j | blocked | The inbox screen and the bell are not built (#177). |

### TC-B2-PERF-01: planner validation time

| IDs | Result | What happened |
| --- | --- | --- |
| PERF-01a–f | not run | The steps are written against the planner on `main` of 24 November. Live validation is not merged; Hoà confirms the stop condition before the run. |

### TC-B2-A11Y-01: usability of the B2 screens (administration only)

| IDs | Result | What happened |
| --- | --- | --- |
| A11Y-01a, b, c, g, h | passed | Every administration route is in the table; the keyboard journeys; no sideways scroll in 46 states at 8 widths; every status in words; names and roles. |
| A11Y-01d | **failed** | After a switch to English, the green "saved after all" line of ADM-05f(3) stays Vietnamese (#170). The API's own field messages stay English on a Vietnamese page: a known deviation, [#154](https://github.com/LLaammTTeerr/omnicourses/issues/154), for Lâm to decide. |
| A11Y-01e | **failed** | axe-core `color-contrast` in 105 of 184 runs, 38 of 46 states: #119's grey small text (4.32:1) and dark-theme white on blue (4.19:1). No other rule failed. |
| A11Y-01f | **failed** | Dark permission chips 4.19:1; text-field borders 1.28–1.65:1 and card separators 1.18–1.20:1, where 3:1 is needed (#119). |
| A11Y-01i | blocked | Dragging, the PDF and streamed updates are not in the candidate. |

## 5. Defects and deviations

| Issue | Found by | State on 26 November |
| --- | --- | --- |
| [#137](https://github.com/LLaammTTeerr/omnicourses/issues/137) A save refused with 401 shows Saved and hides the lost change | PLAN-02a | open (Hoà) |
| [#138](https://github.com/LLaammTTeerr/omnicourses/issues/138) A save with no answer says Not saved without reading the plan | PLAN-02c | open (Hoà) |
| [#170](https://github.com/LLaammTTeerr/omnicourses/issues/170) The saved-after-all notice ignores a language switch | A11Y-01d | open |
| [#119](https://github.com/LLaammTTeerr/omnicourses/issues/119) Contrast (B1), with the administration's cases added on 25 November | A11Y-01e, f | open |
| [#154](https://github.com/LLaammTTeerr/omnicourses/issues/154) Per-field server errors in English on a Vietnamese page | A11Y-01d | deviation, Lâm decides at acceptance |
| [#171](https://github.com/LLaammTTeerr/omnicourses/issues/171) Deleting a group a saved plan names answers 500 | ADM-04d probe | fixed by #172 before ADM-04 ran |
| [#174](https://github.com/LLaammTTeerr/omnicourses/issues/174) The export writes date columns as the day before | seen in NOTIF-01i | fixed by #175, merged after the run; not checked again yet |

## 6. Open items

Each item is added to this report when it runs. "Next" says what starts it.

| # | Item | Owner | Next |
| --- | --- | --- | --- |
| 1 | Carry the results to the candidate | Dũng, Lâm | When B2 is tagged: list the `src/` changes between each run's build (§2) and the candidate, and rerun the cases they touch. On 26 November `main` has 4 to 16 `src/` commits beyond those builds, among them #175 (export dates) and #179 (text fields). |
| 2 | NOTIF-01d(2) | Dũng | 28 November 2026 (Vietnam): `STATE_DIR=docs/test/evidence/b2 node a-notif-01.mjs d2`. |
| 3 | ADM-07j (4) and (5) | Lâm, then Dũng | Lâm runs `setup.sh` on the staging host, then the two large bodies are sent again. |
| 4 | CSV import screen checks (**Nhập CSV** tab, English at 360 px) | Dũng, Thắng | Dũng agrees with Thắng who runs them, so the two runs do not overlap. |
| 5 | SHARE-01l and the share screens in A11Y-01 | Dũng, Hoà | After #178 is on staging: write the screen steps, then run. |
| 6 | NOTIF-01j and the inbox in A11Y-01 | Dũng | After #177 is on staging: write the screen steps, then run. |
| 7 | PLAN-01 and PERF-01a–f | Hoà, Triết; Dũng runs | After drag-and-drop and live validation are on staging: write PLAN-01, confirm PERF-01's stop condition, run both. |
| 8 | TRN-01f, TRN-01g | Lâm | When paste entry, or a Cancel button, is built; then rerun TRN-01a–e on it. |
| 9 | ADM-03g, ADM-04g, ADM-07k | Triết | When the final-state validation interface gives group credit totals. |
| 10 | OPS-01 | Lâm | When nightly backups exist: write the cases, then run. |
| 11 | B1 regression on B2 (cases §12) | Dũng | Update the cases listed in #116, then run the B1 cases on the candidate. |
| 12 | Retests of B1 defects (cases §13) | Dũng | For each of #101, #114, #115, #117 and #119 once its fix is merged. SHARE-01k already saw the 121st request refused, where #117 had let it through. |
| 13 | Retests of B2 defects | Dũng | PLAN-02a and c after #137 and #138; A11Y-01d–f after #170 and #119. |
| 14 | §3 Automated checks | Dũng | The CI run on the candidate. |

## 7. Test data left on staging

From the runs so far, as each results file's "State after the run" says:

- Accounts `b2-s1`, `b2-s3` to `b2-s6`, `b2-s8` to `b2-s14` and `b2-a1` to `b2-a4`, with the transcripts and plans their files list. `b2-s2`, `b2-a5` and `b2-a6` are deleted and purged.
- A1 to A4 hold the grants of cases §1; A4 is the only active access manager.
- APCS has an empty third cohort, APCS2099 (`c11cd85d-6ab8-4902-8146-eba313b46b05`), which no route deletes (Lâm's bot agreed, 25 November).
- The test date `E-d` (`63ec99b6-e70c-4cde-8479-76afbb837f74`) stays until NOTIF-01d(2). The notifications that NOTIF-01's dates made stay in every APCS inbox on staging (ADR 0018, decision 7).
- O (`b2-s12`) keeps "SHARE-01 plan (renamed)" with a live share link.
- No `ZZ` test course and no test group is left.
