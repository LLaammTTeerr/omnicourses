# B2 test report

- **Status: partial, in progress.** This report collects the B2 staging runs recorded on 21–25 November 2026 and updates the case inventory and branch readiness as of **27 November 2026**. It is updated as each open item in §6 runs on the B2 candidate, and it has no acceptance decision yet.
- Owner: Dũng. Drafted with Claude Code from Dũng's staging runs of 21–25 November 2026. The raw results and notes of each run are in its results file under [`evidence/b2/`](evidence/b2/) (§2); this report summarises them and does not repeat them.
- Build: B2 is due on 29 November 2026 ([test plan §8](test-plan.md#8-schedule-and-remaining-work)) and is not tagged yet. Every manual/scripted run so far was on staging, on the commit staging served that day (§2). Between 25 and 27 November, `#170` was fixed on `main` (#210), `NOTIF-01j` merged to `main` and reached staging (`1bde552`, #204/#205), and the remaining B2 features and defect fixes landed on this branch (`PLAN-01` planner live validation & `#137`/`#138` reconciliation, `TRN-01` deterministic paste parser & **Cancel changes**, `SHARE-01` Share dialog / `/shared/:token` / Print-PDF layout, `#119` contrast fixes, and `OPS-01` nightly `omnicourse-backup.timer` + HTTP 503 `/api/health` rollback) with unit, e2e and browser test coverage. Before the decision, those newly unblocked cases and retests run on staging / the tagged B2 candidate (§6).
- Cases: [B2 test cases](test-cases-b2.md) v0.14. Parent checks: [test plan §5](test-plan.md#5-required-checks).
- Decision: **not made.** Lâm decides once the candidate is tagged and the open items in §6 are run or explained.

## 1. Summary

122 detailed cases are written (`PLAN-01a–f` and `OPS-01a–c` added in v0.14). The B1 regression run (cases §12) and the retests of B1 defects (cases §13) are tracked separately in §6.

| Result | Cases |
| --- | --- |
| Passed | 92. TRN-01a–e, TRN-02a–h, PLAN-02b, d, e, ADM-01a–e, ADM-02a–l, ADM-03a–f, ADM-04a–f, ADM-05a–g, ADM-06a–g, ADM-07a–i, SHARE-01a–k, NOTIF-01a–c, e–i, A11Y-01a, b, c, g, h |
| Failed (21–25 Nov runs) | 5. The planner's saved state on `086d49c`: PLAN-02a ([#137](https://github.com/LLaammTTeerr/omnicourses/issues/137)), PLAN-02c ([#138](https://github.com/LLaammTTeerr/omnicourses/issues/138)) — both fixed in `src/frontend/src/plans/session.ts` on this branch and awaiting staging retest. Accessibility of the administration screens on `5a5b9d5`: A11Y-01d ([#170](https://github.com/LLaammTTeerr/omnicourses/issues/170), fixed by #210 on `main`), A11Y-01e and f ([#119](https://github.com/LLaammTTeerr/omnicourses/issues/119), contrast tokens hardened in `styles.css` on this branch) — awaiting staging retest |
| Blocked | 5. Group credit totals and `trainingType` (Triết): ADM-03g, ADM-04g, ADM-07k. Staging's proxy: ADM-07j (nginx answered 413 in HTML on 25 Nov; Lâm runs `deploy/server/setup.sh` for `client_max_body_size 8m`). Streamed advisor updates (B3): A11Y-01i (dragging and Print/PDF layout are now built on the branch; streamed updates wait for F8) |
| Not run on staging yet | 20. Newly written & shipped on branch: PLAN-01a–f (6), OPS-01a–c (3). Unblocked since the 25 Nov run: TRN-01f (paste parser), TRN-01g (**Cancel changes**), SHARE-01l (Share dialog, `/shared/:token`, Print/PDF), NOTIF-01j (`/notifications` inbox & unread bell, #204/#205 — #204 is already on staging `1bde552`, so it can run now). Scheduled / candidate-timed: NOTIF-01d(2) (runs 28 November 2026), PERF-01a–f (6, ready to time against shipped live validation) |
| **Total** | **122** |

What matters so far:

- **No ADM, TRN-02 or SHARE-01 API case failed.** Every permission boundary, impact review, cohort, removal, CSV import and grant case that could run passed, through the API and on the administration screens. No case found one student's data reaching another, or a write that a refused request left half done.
- **All previously missing B2 screens, parsers and ops units are now built on this branch.**
  - **Planner (`TC-B2-PLAN-01`, `PLAN-02a, c`):** pointer drag-and-drop, keyboard lift/arrow/drop/cancel, batched drop validation (`POST /api/plans/:id/issues/drops`), monotonic stale-response protection, the 30-term cap (`MAX_PLAN_TERMS = 30`), and fixes for `#137` (401 sets `Chưa lưu` / `Not saved`) and `#138` (`recoverSaved` re-reads `GET /api/plans/:id` on lost save response) are shipped and covered by `PlanEditorView.spec.ts` and `Plans.browser.spec.ts`.
  - **Transcript paste & Cancel (`TRN-01f, g`):** deterministic TSV/pipe/semicolon grades-table parser (`paste.ts`, `PasteTranscriptDialog.vue`), curriculum auto-fill, pre-save added/changed/removed diff summary, and **Cancel changes** (`TranscriptView.vue`) are shipped and covered by `paste.spec.ts` and `TranscriptView.spec.ts`.
  - **Sharing UI & PDF (`SHARE-01l`):** `SharePlanDialog.vue`, public `/shared/:token` (`SharedPlanView.vue` with `<meta name="robots" content="noindex, nofollow">`), and A4 `@media print` / `window.print()` PDF layout are shipped and covered by `SharePlanDialog.spec.ts` and `SharedPlanView.spec.ts`.
  - **Notifications UI (`NOTIF-01j`):** `/notifications` inbox (`NotificationsView.vue`) and unread badge (`UnreadBadge.vue`) merged in [#204](https://github.com/LLaammTTeerr/omnicourses/pull/204) and [#205](https://github.com/LLaammTTeerr/omnicourses/pull/205).
  - **Backups & deploy rollback (`TC-B2-OPS-01a–c`):** `omnicourse-backup.timer` (`20:00 UTC` / `03:00` ICT, 14 daily dumps), the isolated `omnicourse_rehearsal` restore procedure (`deploy/README.md`), and HTTP **503** `/api/health` (`HealthController`) paired with `omnicourse-deploy` automatic symlink rollback are shipped; host execution runs once `setup.sh` is applied.
- **Staging candidate execution remains to close B2.** `NOTIF-01j` (#204) is already on staging (`1bde552`) and can run now; the remaining newly written and newly unblocked cases (`PLAN-01a–f`, `PERF-01a–f`, `TRN-01f–g`, `SHARE-01l`, `OPS-01a–c`) plus the retests of `#137`, `#138`, `#170` (on `main`) and `#119` run on staging once the B2 candidate is deployed.

By parent check. A parent passes only when all its required detailed outcomes pass ([test plan §5](test-plan.md#5-required-checks)).

| Parent check | Result so far | Why |
| --- | --- | --- |
| TC-B2-PLAN-01 | not run on staging yet | `PLAN-01a–f` written; drag-and-drop, keyboard controls, batched `issues/drops`, stale-response guards, 30-term cap and `#137`/`#138` fixes shipped and unit/browser-tested on this branch; awaiting staging candidate run. |
| TC-B2-PLAN-02 | failed on 22 Nov; fix on branch | `PLAN-02b, d, e` passed on `086d49c`. `PLAN-02a` (#137) and `PLAN-02c` (#138) failed on 22 Nov; both are fixed in `session.ts` and covered by `PlanEditorView.spec.ts`, awaiting staging retest. |
| TC-B2-TRN-01 | not passed yet | `a–e` passed on typed entry (`5a5b9d5`). `f` (deterministic paste parser) and `g` (**Cancel changes**) were blocked on 25 Nov and are now built (`PasteTranscriptDialog.vue`, `paste.ts`, `TranscriptView.vue`) and unit-tested, awaiting staging run (with `a–e` rechecked for curriculum auto-fill and pre-save diff). |
| TC-B2-TRN-02 | passed | `a–h` passed. |
| TC-B2-ADM-01 | passed | `a–e` passed. |
| TC-B2-ADM-02 | passed | `a–l` passed. |
| TC-B2-ADM-03 | not passed yet | `a–f` passed. `g` blocked on group credit totals and `trainingType`. |
| TC-B2-ADM-04 | not passed yet | `a–f` passed. `g` blocked on group credit totals. |
| TC-B2-ADM-05 | passed | `a–g` passed. |
| TC-B2-ADM-06 | passed | `a–g` passed. |
| TC-B2-ADM-07 | not passed yet | `a–i` passed. `j` blocked on running `setup.sh` on staging's nginx, `k` on group credit totals. |
| TC-B2-SHARE-01 | not passed yet | `a–k` passed through the API (`e7bd617`). `l` was blocked on 25 Nov (#178) and is now built on this branch (`SharePlanDialog.vue`, `SharedPlanView.vue` at `/shared/:token`, A4 Print/PDF layout) and unit-tested, awaiting staging run. |
| TC-B2-NOTIF-01 | not passed yet | `a–c, e–i` passed (`e7bd617`). `d(2)` runs on 28 November. `j` was blocked on 25 Nov (#177) and is now on staging (`1bde552`, #204; #205 on `main`), ready to run now. |
| TC-B2-PERF-01 | not run | `PERF-01a–f` written; planner live validation is shipped on this branch and ready to time on the B2 candidate. |
| TC-B2-A11Y-01 | failed on 25 Nov | Administration screens on `5a5b9d5`: `a, b, c, g, h` passed; `d` (#170, fixed by #210 on `main`) and `e, f` (#119, contrast tokens updated in `styles.css` on this branch) await staging retest; `i` remains blocked only on F8 streamed updates (dragging and Print/PDF are built). |
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
| 25 Nov, 14:35 | `e7bd617` | ADM-03a–g | the same file, ADM-03 section | #176 |

| Item | Used |
| --- | --- |
| API client | Node `fetch` scripts with no dependencies, in place of the Swagger page: the same requests and bodies as the cases. Each prints `OK` / `ok` or `MISMATCH` / `FAIL` per expected result, and no token. Each output is next to its results file. |
| Browser | Chrome 144 on Windows 10. Headed through Claude in Chrome for TRN-02 and PLAN-02; headless through playwright-core 1.64.1 at 1280 × 800 for the 25 November screens. axe-core 4.10.2 for A11Y-01e. |
| Server steps | ADM-06b, ADM-06e–f, TRN-02f and NOTIF-01i(4) need the staging host or its database. Lâm's bot ran them on request; its output is copied into the results files. |
| Test data | Synthetic `example.com` accounts `b2-s1` to `b2-s14` and `b2-a1` to `b2-a6`, password `correct horse battery` (cases §1); synthetic `ZZ` courses and test groups, removed after each run. No real name, student ID, transcript or secret. |
| Model calls | None. |

Rate limits: sign-in allows 10 requests a minute from one address (and per `(IP, email)` pair on the current branch). The first attempts at ADM-05b–d (22 November) and ADM-07c–i (25 November) were refused with 429 because the test client sent sign-ins too fast; they were run again, and each results file explains what the refused attempt wrote. Two other first attempts stopped on a fault in the script (TRN-01b, SHARE-01a–j) and are recorded in the results files.

## 3. Automated checks

To record once B2 is tagged: the CI run on the candidate commit, with the backend unit/coverage, frontend unit, browser and PostgreSQL e2e results, as in [B1 §3](report-b1.md#3-automated-checks).

## 4. Results

One line per group of cases from the same run with the same result. The results file of the run (§2) has a line for each case.

### TC-B2-PLAN-01 and PLAN-02: planner editing, live validation, failure and ownership

| IDs | Result | What happened |
| --- | --- | --- |
| PLAN-01a–f | not run on staging yet | Detailed cases written in `test-cases-b2.md` §2 covering pointer drag-and-drop, keyboard placement controls, batched live drop validation (`POST /api/plans/:id/issues/drops`), stale-response race protection, the 30-term cap (`MAX_PLAN_TERMS = 30`), and `#137`/`#138` save failure handling. Shipped and covered by `PlanEditorView.spec.ts`, `Plans.browser.spec.ts` and `plans.e2e-spec.ts`; ready to run on staging. |
| PLAN-02a | **failed** (22 Nov); fix on branch | On `086d49c`: session revoked from another client, then an edit: the `PUT` answered 401, the chip showed **Saved**, and sign-in opened with nothing saying the change was lost (#137). Fixed on this branch (`failSave` marks `saveState = 'failed'` / **Chưa lưu** on 401); retest on candidate. |
| PLAN-02b | passed | A blocked save and a 500 each showed **Not saved** and put the board back to the saved plan. |
| PLAN-02c | **failed** (22 Nov); fix on branch | On `086d49c`: the save's answer was lost after the server saved it; the planner said **Not saved** without reading the plan again (#138). Fixed on this branch (`recoverSaved` calls `GET /api/plans/{id}` on network error or 5xx and reconciles to **Saved** when terms match); retest on candidate. |
| PLAN-02d, e | passed | Another student's plan ID answers 404 on all 8 routes, the same as an unknown ID; crafted boards answer 400; nothing of the other student changed. |

### TC-B2-TRN-01 and TRN-02: transcript entry and student-record integration

| IDs | Result | What happened |
| --- | --- | --- |
| TRN-01a–e | passed | Typed entry on **Transcript** (`5a5b9d5`): incomplete rows block the save and say what to fix; a removed row changes nothing until a save; the save sends one `PUT` and the API holds exactly the rows saved; leaving with unsaved rows asks first; a blocked save keeps the rows. |
| TRN-01f | not run on staging yet (unblocked) | Blocked on 25 Nov; deterministic TSV/pipe/semicolon paste parser (`paste.ts`, `PasteTranscriptDialog.vue`), curriculum auto-fill and pre-save diff summary are now shipped on this branch and unit-tested (`paste.spec.ts`, `TranscriptView.spec.ts`). Ready for staging run. |
| TRN-01g | not run on staging yet (unblocked) | Blocked on 25 Nov; `[data-test="cancel-edits"]` (**Cancel changes**) and `[data-test="paste-cancel"]` are now shipped in `TranscriptView.vue` and `PasteTranscriptDialog.vue` and unit-tested. Ready for staging run. |
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
| ADM-03g, ADM-04g, ADM-07k | blocked | Group credit totals and `trainingType` wait for the final-state validation interface (Triết). |
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
| SHARE-01l | not run on staging yet (unblocked) | Blocked on 25 Nov (#178); `SharePlanDialog.vue`, public `/shared/:token` (`SharedPlanView.vue` with `<meta name="robots" content="noindex, nofollow">`), and A4 `@media print` / `window.print()` PDF layout are now shipped on this branch and covered by `SharePlanDialog.spec.ts` and `SharedPlanView.spec.ts`. Ready for staging run. |

### TC-B2-NOTIF-01: notifications

| IDs | Result | What happened |
| --- | --- | --- |
| NOTIF-01a–c | passed | Routes, validation and not-found; a registration date makes one `registration_soon` or `registration_open`, a term start one `term_start`, and other kinds none. |
| NOTIF-01d | not run yet | (1) passed: a registration date entered three days ahead, after its 7-day reminder day, made no notification. (2), which expects one `registration_open`, runs on 28 November 2026 (Vietnam), `STATE_DIR=docs/test/evidence/b2 node docs/test/evidence/b2/a-notif-01.mjs d2`, which then deletes the test date `E-d`. |
| NOTIF-01e–i | passed | A student who joins later gets the current notices; another program's dates reach nobody here; moved and deleted dates make no repeat and keep what was sent; a saved transcript change makes one `transcript_changed`, a refused, cancelled or failed save none; read, unread and paging; another student's IDs give 404; an account waiting for deletion gets nothing until it is restored. |
| NOTIF-01j | not run on staging yet (unblocked) | Blocked on 25 Nov (#177); the `/notifications` inbox page (`NotificationsView.vue`) and unread bell badge (`UnreadBadge.vue`) merged in [#204](https://github.com/LLaammTTeerr/omnicourses/pull/204) (already on staging at `1bde552`) and [#205](https://github.com/LLaammTTeerr/omnicourses/pull/205), so `NOTIF-01j` can run now on staging without waiting for the candidate. |

### TC-B2-PERF-01: planner validation time

| IDs | Result | What happened |
| --- | --- | --- |
| PERF-01a–f | not run | Steps and fixture (`perf-01-plan.json`) are ready; planner live validation is shipped on this branch and ready to time on the B2 candidate. |

### TC-B2-A11Y-01: usability of the B2 screens (administration run on 25 Nov)

| IDs | Result | What happened |
| --- | --- | --- |
| A11Y-01a, b, c, g, h | passed | Every administration route at `5a5b9d5` is in the table; keyboard journeys; no sideways scroll in 46 states at 8 widths; every status in words; names and roles. |
| A11Y-01d | **failed** (25 Nov); fixed on `main` | On `5a5b9d5`, after switching to English, the green "saved after all" line of ADM-05f(3) stayed Vietnamese (#170); fixed by #210 (on `main`); awaiting staging retest. The API's own field messages stay English on a Vietnamese page (`lang="en"`): a known deviation ([#154](https://github.com/LLaammTTeerr/omnicourses/issues/154)). |
| A11Y-01e | **failed** (25 Nov); fix on branch | On `5a5b9d5`, axe-core `color-contrast` failed in 105 of 184 runs (38 of 46 states) on `#119`'s grey small text and dark-theme blue chips/buttons; token contrast updated in `styles.css` on this branch, awaiting staging retest. |
| A11Y-01f | **failed** (25 Nov); fix on branch | On `5a5b9d5`, dark permission chips (4.19:1), text-field borders (1.28–1.65:1) and card separators (1.18–1.20:1) were below WCAG ratios (#119); updated in `styles.css` on this branch, awaiting staging retest. |
| A11Y-01i | blocked (F8 part) | Keyboard alternative to dragging (`PLAN-01b`) and readable Print/PDF (`SHARE-01l`) are now built on this branch; non-disruptive streamed updates remain blocked until F8 advisor chat lands in B3. |

### TC-B2-OPS-01: nightly backups, restore rehearsal and deploy health rollback

| IDs | Result | What happened |
| --- | --- | --- |
| OPS-01a–c | not run on host yet | Detailed cases written in `test-cases-b2.md` §11; `omnicourse-backup.timer` (`20:00 UTC` / `03:00` ICT, 14 daily dumps), `omnicourse_rehearsal` restore rehearsal (`deploy/README.md`), and HTTP 503 `/api/health` (`HealthController`, unit-tested in `health.controller.spec.ts`) + `omnicourse-deploy` symlink rollback are shipped on this branch, awaiting host execution after `deploy/server/setup.sh`. |

## 5. Defects and deviations

| Issue | Found by | State on 27 November |
| --- | --- | --- |
| [#137](https://github.com/LLaammTTeerr/omnicourses/issues/137) A save refused with 401 shows Saved and hides the lost change | PLAN-02a | fixed on branch (`session.ts`, `PlanEditorView.spec.ts`); awaiting staging retest |
| [#138](https://github.com/LLaammTTeerr/omnicourses/issues/138) A save with no answer says Not saved without reading the plan | PLAN-02c | fixed on branch (`recoverSaved` in `session.ts`, `PlanEditorView.spec.ts`); awaiting staging retest |
| [#170](https://github.com/LLaammTTeerr/omnicourses/issues/170) The saved-after-all notice ignores a language switch | A11Y-01d | fixed by #210 (on `main`); awaiting staging retest |
| [#119](https://github.com/LLaammTTeerr/omnicourses/issues/119) Contrast (B1), with the administration's cases added on 25 November | A11Y-01e, f | contrast tokens hardened on branch (`styles.css`); awaiting axe-core / manual staging retest |
| [#154](https://github.com/LLaammTTeerr/omnicourses/issues/154) Per-field server errors in English on a Vietnamese page | A11Y-01d | deviation (`lang="en"` marked), Lâm decides at acceptance |
| [#171](https://github.com/LLaammTTeerr/omnicourses/issues/171) Deleting a group a saved plan names answers 500 | ADM-04d probe | fixed by #172 before ADM-04 ran (verified **409** in ADM-04d) |
| [#174](https://github.com/LLaammTTeerr/omnicourses/issues/174) The export writes date columns as the day before | seen in NOTIF-01i | fixed by #175 (`50f6ce2`); recheck export on candidate |

## 6. Open items

Each item updates this report when it runs on the B2 candidate.

| # | Item | Owner | Next |
| --- | --- | --- | --- |
| 1 | Carry 21–25 Nov results to the B2 candidate | Dũng, Lâm | When B2 is deployed and tagged: diff `src/` since each run's build (§2) and rerun touched cases (including #175 export dates and #179 text code-point limits). |
| 2 | NOTIF-01d(2) | Dũng | 28 November 2026 (Vietnam): `STATE_DIR=docs/test/evidence/b2 node docs/test/evidence/b2/a-notif-01.mjs d2`. |
| 3 | Host `setup.sh`, `OPS-01a–c` and `ADM-07j` (4)–(5) | Lâm, then Dũng | Lâm runs `deploy/server/setup.sh` on the host, executes `OPS-01a–c` (`omnicourse-backup.timer`, `omnicourse_rehearsal` restore, `/api/health` 503 rollback), and Dũng reruns `ADM-07j` (4)–(5) against `client_max_body_size 8m`. |
| 4 | CSV import and `/admin/calendar` screen checks | Dũng, Thắng | Run screen checks on `/admin/import` (#165) and `/admin/calendar` (`CalendarAdmin.vue`) at 360 and 1280 px. |
| 5 | `SHARE-01l` and sharing screens in `A11Y-01` | Dũng, Hoà | Run `SHARE-01l` (`SharePlanDialog.vue`, `/shared/:token`, Print/PDF) once deployed to staging. |
| 6 | `NOTIF-01j` and `/notifications` in `A11Y-01` | Dũng | #204 is already on staging (`1bde552`); can run now (#205 on `main`). |
| 7 | `PLAN-01a–f` and `PERF-01a–f` | Hoà, Triết; Dũng runs | Run `PLAN-01a–f` and time `PERF-01a–f` on the staging candidate. |
| 8 | `TRN-01f, g` and `TRN-01a–e` rerun | Lâm, Dũng | Run `TRN-01f–g` (paste parser, pre-save diff, **Cancel changes**) and re-verify `TRN-01a–e` on staging. |
| 9 | `ADM-03g`, `ADM-04g`, `ADM-07k` | Triết | Blocked until the final-state validation interface supports group credit totals and `trainingType`. |
| 10 | B1 regression on B2 (cases §12) | Dũng | Update the cases listed in #116, then run the B1 cases on the candidate. |
| 11 | Retests of B1 defects (cases §13) | Dũng | For each of #101, #114, #115, #117 and #119 once its fix is merged. SHARE-01k already saw the 121st request refused, where #117 had let it through. |
| 12 | Retests of B2 defects | Dũng | Retest `PLAN-02a, c` (#137, #138) and `A11Y-01d–f` (#170 fixed by #210 on `main`; #119 on branch) on staging / the candidate. |
| 13 | §3 Automated checks | Dũng | Record the green CI run and `src/rules/**` coverage on the tagged B2 commit. |

## 7. Test data left on staging

From the 21–25 November runs, as each results file's "State after the run" says:

- Accounts `b2-s1`, `b2-s3` to `b2-s6`, `b2-s8` to `b2-s14` and `b2-a1` to `b2-a4`, with the transcripts and plans their files list. `b2-s2`, `b2-a5` and `b2-a6` are deleted and purged.
- A1 to A4 hold the grants of cases §1; A4 is the only active access manager.
- APCS has an empty third cohort, APCS2099 (`c11cd85d-6ab8-4902-8146-eba313b46b05`), which no route deletes (Lâm's bot agreed, 25 November).
- The test date `E-d` (`63ec99b6-e70c-4cde-8479-76afbb837f74`) stays until NOTIF-01d(2). The notifications that NOTIF-01's dates made stay in every APCS inbox on staging (ADR 0018, decision 7).
- O (`b2-s12`) keeps "SHARE-01 plan (renamed)" with a live share link.
- No `ZZ` test course and no test group is left.
