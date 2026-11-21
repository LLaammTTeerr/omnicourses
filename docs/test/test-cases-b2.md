# B2 test cases

- Owner: Dũng
- Build: B2, 29 November 2026. Test window 16–29 November ([test plan §8](test-plan.md#8-schedule-and-remaining-work)).
- Version: 0.3, 21 November 2026. 0.3 follows Lâm's review of #130: it adds TRN-02g (a refused save keeps the earlier transcript) and TRN-02h (the other result types and a term 3 row), quotes PLAN-02e's malformed-code message with its field path, adds a 5xx answer to PLAN-02b, says that only `GET /api/plans/{id}` counts as PLAN-02c's re-read, corrects CM102's name, and marks TRN-02f's purge step blocked until Lâm decides on database access. 0.2 (21 November) wrote the cases of TC-B2-TRN-02 (§5) and TC-B2-PLAN-02 (§3), the two checks whose features are on staging and whose expected results are agreed, with the B2 accounts and synthetic transcripts of §1. Their steps were read from the code on `main` at `c7cf753` and have not been run. 0.1 (21 November) was the scaffold.
- Parent checks: test plan §5, rows `TC-B2-PLAN-01`, `TC-B2-PLAN-02`, `TC-B2-TRN-01`, `TC-B2-TRN-02` and `TC-B2-ADM-01` to `TC-B2-ADM-07`, `TC-B2-SHARE-01` and `TC-B2-NOTIF-01` of [B2 checks](test-plan.md#b2-checks), and `TC-B2-PERF-01`, `TC-B2-A11Y-01` and `TC-B2-OPS-01` of [Coverage and speed](test-plan.md#coverage-and-speed). Each detailed case has its parent's ID plus a letter, such as `TC-B2-PLAN-01a`. The text around the tables shortens it to `PLAN-01a`.

This file is a scaffold. Each section below gives one parent check from the test plan, its owners and what must be built before it can run. Dũng writes the detailed cases in each table. Do not add steps or expected results that the test plan, the use cases or the feature owner do not state. Where the expected result is not agreed yet, the case is **blocked** and names what it waits for.

## 1. Before you start

**Where to test.** On staging, as for B1 ([B1 cases §1](test-cases-b1.md#1-before-you-start)). The local setup, the network profile and the rules for database cases are the same as in B1 unless a case says otherwise.

**Test accounts.** Synthetic accounts only: made-up `example.com` addresses with synthetic data, never a real student, transcript, student ID or name (AGENTS.md, hard rule 3). Use the prefix `b2-`. Each account below has password `correct horse battery` and display name `Test Student`, and is onboarded to APCS 2024 with the goal fields unset. The first case that needs an account signs it up; later cases sign in. The password is in this file and in the repository, so the accounts hold synthetic data only.

| Name | Email | Used for |
| --- | --- | --- |
| S1 | `b2-s1@example.com` | TRN-02a–e, g and h: transcript saves, the audit and the planner |
| S2 | `b2-s2@example.com` | TRN-02f: export, then deletion and purge |
| A | `b2-s3@example.com` | PLAN-02d and e: the student who sends crafted IDs |
| B | `b2-s4@example.com` | PLAN-02d and e: the other student, whose plan must stay unchanged |
| P | `b2-s5@example.com` | PLAN-02a–c: the planner's saved and unsaved states |

**Synthetic transcripts.** Saved with `PUT /api/users/me/transcript`. They use catalog codes of APCS 2024 with made-up grades, and `ZZ` codes, which are in no curriculum. A save replaces the whole transcript.

T-A:

```json
{ "rows": [
  { "courseCode": "CS160", "courseName": "Nhập môn Tin học", "credits": 4, "result": "graded", "grade": 8.5, "term": { "year": 2024, "number": 1 } },
  { "courseCode": "CM102", "courseName": "Tư duy độc lập", "credits": 4, "result": "graded", "grade": 7.5, "term": { "year": 2024, "number": 1 } },
  { "courseCode": "MTH251", "courseName": "Vi tích phân I", "credits": 4, "result": "graded", "grade": 7.0, "term": { "year": 2024, "number": 1 } }
] }
```

T-B, with no course of T-A:

```json
{ "rows": [
  { "courseCode": "PH211", "courseName": "Vật lý đại cương I", "credits": 4, "result": "graded", "grade": 6.5, "term": { "year": 2024, "number": 1 } },
  { "courseCode": "CS163", "courseName": "Cấu trúc dữ liệu", "credits": 4, "result": "graded", "grade": 8.0, "term": { "year": 2024, "number": 2 } }
] }
```

T-R, one course taken twice:

```json
{ "rows": [
  { "courseCode": "CS160", "courseName": "Nhập môn Tin học", "credits": 4, "result": "graded", "grade": 3.0, "term": { "year": 2024, "number": 1 } },
  { "courseCode": "CS160", "courseName": "Nhập môn Tin học", "credits": 4, "result": "graded", "grade": 8.0, "term": { "year": 2024, "number": 2 } }
] }
```

T-Z, with a course in no curriculum:

```json
{ "rows": [
  { "courseCode": "CS160", "courseName": "Nhập môn Tin học", "credits": 4, "result": "graded", "grade": 8.5, "term": { "year": 2024, "number": 1 } },
  { "courseCode": "ZZ901", "courseName": "Synthetic Outside Course", "credits": 3, "result": "graded", "grade": 8.0, "term": { "year": 2024, "number": 2 } }
] }
```

T-K, every result type and a term 3 row. Only a `graded` row has a grade:

```json
{ "rows": [
  { "courseCode": "CS160", "courseName": "Nhập môn Tin học", "credits": 4, "result": "graded", "grade": 8.5, "term": { "year": 2024, "number": 1 } },
  { "courseCode": "BAA00030", "courseName": "Giáo dục quốc phòng - An ninh", "credits": 4, "result": "pass", "grade": null, "term": { "year": 2024, "number": 1 } },
  { "courseCode": "MTH252", "courseName": "Vi tích phân II", "credits": 4, "result": "exempt", "grade": null, "term": { "year": 2024, "number": 2 } },
  { "courseCode": "PH212", "courseName": "Vật lý đại cương II", "credits": 4, "result": "fail", "grade": null, "term": { "year": 2024, "number": 2 } },
  { "courseCode": "CS202", "courseName": "Các hệ thống lập trình", "credits": 4, "result": "graded", "grade": 9.0, "term": { "year": 2024, "number": 3 } },
  { "courseCode": "CS201", "courseName": "Lập trình hệ thống", "credits": 4, "result": "in_progress", "grade": null, "term": { "year": 2025, "number": 1 } }
] }
```

**API calls.** Cases marked **API** use the Swagger page at https://stag-omnicourses.lamter.cc/api/docs (only staging serves it, [deploy/README.md](../../deploy/README.md)): sign in with `POST /api/auth/sign-in`, then **Authorize** with the token it returns, as in [B0 cases §1](test-cases-b0.md#1-before-you-start). TRN-02b, PLAN-02b and PLAN-02c run a snippet in the DevTools console of the app's tab instead. Chrome refuses the first paste into its console: type `allow pasting`, press Enter, then paste again. The TRN-02b snippet reads the tab's session token from session storage to send its requests; it never prints it. The rate limits are B1's ([B1 cases §1](test-cases-b1.md#1-before-you-start)): 120 requests a minute on each route.

**Database.** TRN-02f's database steps use `psql` and the user-table query of [B1 cases §1](test-cases-b1.md#1-before-you-start). On staging they need Lâm's OK and database access, as in B1; Lâm restarts the backend so the purge runs, or you wait up to an hour for the hourly purge. Lâm has not decided yet; his assistant offered to run these steps, so the tester would need no database access. Until he answers, record TRN-02f's database steps as **blocked: waiting for Lâm**, and the API steps as they run.

**Recording results.** This file is not a test report and holds no result. Record each run as in [B1 cases §1](test-cases-b1.md#1-before-you-start) ("Recording results"): case ID, result (**passed**, **failed**, **blocked** or **not run**, with the reason for the last two), build tag and commit, browser and version, and the screen width for screen cases. Write the results of a run in `docs/test/evidence/b2/results-<date>.md`, as B1 did in `evidence/b1/results-2026-11-15.md`. A case whose feature is not in the B2 candidate is **not run: feature not merged** ([test plan §7](test-plan.md#7-when-a-build-is-ready)). Never record a token, a password or a password hash.

**Evidence.** Store screenshots, logs and measurements in `docs/test/evidence/b2/`. The folder is created with the first evidence file. Name the files as in `evidence/b1/`: lowercase, with a prefix and the case ID, for example `a-plan-01a-planner.png`.

**Build status on 21 November 2026.** The "Depends on" line of each section uses this status:

- Done: calendar API (#108) and calendar page (#99); transcript storage.
- In progress: planner drag-and-drop and live validation; curriculum administration API (part done).
- Not started: transcript paste/type entry screen; curriculum administration screens and CSV import; notifications inbox; plan sharing and PDF export; nightly backup.

## 2. TC-B2-PLAN-01: Editing and live validation

The student adds, removes and moves courses by drag-and-drop and by keyboard, and the rule engine validates each edit. Prerequisite, offering-term, credit-cap and coverage violations show correctly, a late response never replaces the current result, and several plans save, reload and compare without mixing their state ([test plan row](test-plan.md#b2-checks)).

- Owners: Hoà, Triết
- Depends on: planner drag-and-drop and live validation (in progress).

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-PLAN-01a | TODO | TODO |

## 3. TC-B2-PLAN-02: Failure and ownership

An expired sign-in, denied access, an API failure or a lost save response keeps a clear saved or unsaved state, and the app reads the plan again after an unknown outcome. Crafted plan or course IDs cannot reach another student's plan, and unrelated plans and transcript rows stay unchanged ([test plan row](test-plan.md#b2-checks)).

- Owner: Hoà
- Depends on: the plans API (#71) and the planner (#80, #90), both on staging. The B2 drag-and-drop work (in progress) may change the planner's words: check the labels below against the screen before the run.

**Read from the code, not run.** On `main` at `c7cf753`, two behaviours do not meet the expected results below; Lâm's review of #130 confirmed both and keeps the expected results as written, since the test plan row asks for them. If the run confirms one, record the case as **failed** and open an issue against the planner screen for Hoà:

- PLAN-02a: when a save answers 401, the planner puts back the last saved board, sets the status chip to **Saved**, and the app opens sign-in with "Your session has ended. Please sign in again." Nothing says the last change was not saved.
- PLAN-02c: when a save gets no answer within 30 seconds (`REQUEST_TIMEOUT_MS` in `api.ts`), the planner puts back the board it last saw saved and says "The change could not be saved." It does not read the plan again (no `GET /api/plans/{id}`), so if the server did save the change, the screen and the server disagree until a reload.

**Prepare (P).** Sign up as P and finish onboarding to APCS 2024, with the screen in English. Open **Plans** in the sidebar: the first time, it creates "Default plan" and opens it. Note the plan's id from the address bar (`/plans/<id>`). Add CS160 with its **+** button and wait for the status chip to say **Saved**. Keep DevTools open on the **Network** tab. In Vietnamese the chip reads **Đã lưu**, **Đang lưu…** and **Chưa lưu**.

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-PLAN-02a | **Screen.** Sign in as P in two browsers, A and B: Chrome and Edge, so the session list tells them apart. In A, open P's plan. In B, open **Settings → Devices signed in** and revoke A's session. In A, without reloading, add CS163 with its **+** button. Sign in again in A. Then, in B, call `GET /api/plans/{id}`. A session that expires after 7 days without use ends the same way (401), so revoking it stands in for the expiry. | A says what is saved and what is not: it never shows **Saved** for the CS163 change, and it tells the student that this change was not saved. After signing in, A is back on the plan, which shows CS160 and not CS163. The API holds the same: CS160 only. |
| TC-B2-PLAN-02b | **Screen.** In A, with P's plan open and the chip on **Saved**, open **Network request blocking** in DevTools (Ctrl+Shift+P, then "Show Network request blocking"), add the pattern `*/api/*` and tick **Enable network request blocking**. Add CS163. Then untick the box, reload, and call `GET /api/plans/{id}`. Next, a server error: paste the 5xx snippet below into the console (it answers the next save with **500** and does not send it), add CS163 again, then reload and call `GET /api/plans/{id}`. | Both times, blocked and 500: a clear error on the plan, "The change could not be saved. The plan is back to its last saved state." The chip says **Not saved**, CS163 is not on the board, and no **Saved** chip or message appears after the change. The Issues panel may say "The plan could not be checked." After each reload, the board and the API both hold CS160 only. |
| TC-B2-PLAN-02c | **Screen.** Reload A (P's plan, CS160 only, chip **Saved**). Paste the snippet below into the DevTools console: it sends the next save to the server and hides the answer. Add CS163. Watch the chip and the **Network** tab for 40 seconds: the planner gives up on a request after 30. Then reload, which removes the snippet, and call `GET /api/plans/{id}`. | Until the outcome is known, the chip says **Saving…**, never **Saved** or **Not saved**. When the PUT fails, the planner reads the plan again before it says anything: a `GET /api/plans/{id}` follows the failed PUT, and the board then shows what the server holds, CS160 and CS163. Only `GET /api/plans/{id}` counts as the re-read: the planner sends `GET /api/plans/{id}/issues` after every failed save, and that one does not count. It never says the change was not saved while the server holds it. After the reload, the board and the API both hold CS160 and CS163. |
| TC-B2-PLAN-02d | **API.** As B, create a plan with the body below and keep the answer as B0. As A, call each route of the table below with B's plan id, then again with the unknown id `00000000-0000-4000-8000-000000000000`. Then call `GET /api/plans` as A, and `GET /api/plans/{B's id}` as B. Last, **Screen**: as A, open `/plans/<B's id>` in the app. | Every call answers **404** "No plan with this id", the same for B's id as for the unknown one, so A cannot tell that B's plan exists. A's list holds no plan of B's and no copy of it. B's plan equals B0, `updatedAt` included. The screen says "This plan is not among your plans." and shows nothing of B's plan. |
| TC-B2-PLAN-02e | **API.** As A, save T-A (§1) and create two plans with the body below: P1 with CS160 and the name "A plan 1", P2 with CS163 and the name "A plan 2". Keep `GET` of P1, P2, B's plan from PLAN-02d and A's transcript. Read the id of any requirement group of APCS 2025 from `GET /api/programs/APCS/curricula/2025`: call it G25. As A, send each crafted board of the table below to `PUT /api/plans/{P1}/placements`. Then send the first one to `POST /api/plans` as a new plan (`"name": "Crafted"`). Read P1, P2, B's plan and A's transcript again, and call `GET /api/plans` as A. | Each PUT answers **400** with the message of the table and changes nothing. The POST answers **400** and creates no plan: A still has exactly P1 and P2. P1 and P2 (with `updatedAt`), B's plan and A's transcript equal what you kept. |

Already automated: `plans.e2e-spec.ts` covers d for `GET`, `PATCH`, `PUT …/placements`, `POST …/duplicate` and `DELETE` ("answers 404 for another student's plan…"), and e for a refused board ("replaces every placement at once, and a refused board changes nothing"). `PlanEditorView.spec.ts` covers b's message and **Not saved** chip ("puts back the saved board and says so when a save fails…"). The manual run checks them on staging, with the screens.

The PLAN-02b 5xx snippet. It works until the page is reloaded:

```js
const realFetch = window.fetch.bind(window);
window.fetch = (url, init = {}) =>
  init.method === 'PUT' && String(url).endsWith('/placements')
    ? Promise.resolve(new Response(JSON.stringify({ statusCode: 500, message: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } }))
    : realFetch(url, init);
```

The PLAN-02c snippet. It works until the page is reloaded:

```js
const realFetch = window.fetch.bind(window);
window.fetch = (url, init = {}) => {
  if (init.method === 'PUT' && String(url).endsWith('/placements')) {
    realFetch(url, { ...init, signal: undefined }); // the server gets the save…
    return new Promise((_, reject) => init.signal?.addEventListener('abort', () => reject(init.signal.reason))); // …the planner never gets the answer
  }
  return realFetch(url, init);
};
```

The plan body for PLAN-02d (B's plan, with CS163) and PLAN-02e (P1 with CS160, P2 with CS163), sent to `POST /api/plans`:

```json
{ "name": "B plan", "programCode": "APCS", "cohortYear": 2024,
  "terms": [ { "term": { "year": 2026, "number": 2 }, "placements": [ { "kind": "course", "courseCode": "CS163" } ] } ] }
```

The routes of PLAN-02d. Each body is valid, so a refusal can only come from the plan id:

| Route | Body |
| --- | --- |
| `GET /api/plans/{id}` | none |
| `GET /api/plans/{id}/issues` | none |
| `POST /api/plans/{id}/issues` | `{ "terms": [] }` |
| `POST /api/plans/{id}/issues/drops` | `{ "terms": [], "placement": { "kind": "course", "courseCode": "CS160" }, "targets": [ { "year": 2026, "number": 2 } ] }` |
| `PATCH /api/plans/{id}` | `{ "name": "Mine now" }` |
| `PUT /api/plans/{id}/placements` | `{ "terms": [] }` |
| `POST /api/plans/{id}/duplicate` | `{}` |
| `DELETE /api/plans/{id}` | none |

The crafted boards of PLAN-02e. Each is `{ "terms": [ { "term": { "year": 2026, "number": 2 }, "placements": [ … ] } ] }` with these placements:

| Crafted | Placements | Message |
| --- | --- | --- |
| Unknown code | `{ "kind": "course", "courseCode": "ZZ999" }` | "No course in the catalog has the code ZZ999" |
| Malformed code | `{ "kind": "course", "courseCode": "CS160' OR '1'='1" }` | "terms.0.placements.0.courseCode must be 2–20 capital letters or digits" |
| Another curriculum's group | `{ "kind": "slot", "requirementGroupId": "<G25>", "credits": 4 }` | "Requirement group <G25> is not in the plan's curriculum" |
| Unknown group | `{ "kind": "slot", "requirementGroupId": "00000000-0000-4000-8000-000000000000", "credits": 4 }` | "Requirement group 00000000-0000-4000-8000-000000000000 is not in the plan's curriculum" |
| The same course twice | `{ "kind": "course", "courseCode": "CS160" }`, `{ "kind": "course", "courseCode": "CS160" }` | "course CS160 is placed twice" |

## 4. TC-B2-TRN-01: Import and manual review

The student enters transcript rows, then reviews, corrects, adds or removes rows before saving. Incomplete rows block the save, and cancel keeps the earlier record ([test plan row](test-plan.md#b2-checks)).

> **Note: the plan row describes PDF import, which is dropped.** On 15 November 2026 the Project Lead decided that F2 is "paste the grades table, or type it in". PDF upload is dropped because the school portals give no transcript PDF. Write the cases in this section for paste and type entry, not for PDF upload. The test plan row and its 5 MB upload limit need an update to match: issue [#127](https://github.com/LLaammTTeerr/omnicourses/issues/127). Remove this note when #127 closes.

- Owner: Lâm
- Depends on: transcript storage (done); transcript paste/type entry screen (not started).

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-TRN-01a | TODO | TODO |

## 5. TC-B2-TRN-02: Student-record integration

Saving a transcript replaces the old one in one step, concurrent saves run one after the other, retakes stay separate, and unknown catalog courses stay in the transcript. The audit and planner recompute from the saved rows, export and deletion cover all rows, and the import never decides which attempt passes or counts ([test plan row](test-plan.md#b2-checks)).

- Owners: Lâm, Triết
- Depends on: transcript storage (#29, done). These cases save through the API, or on today's **Transcript** screen (#70) in TRN-02e, and read the results on that screen, the audit (#79) and the planner (#90), all on staging. They do not wait for the paste screen, which TRN-01 tests: TRN-02 tests the student record, not the entry screen. Rerun TRN-02e with the paste screen when it lands.

**Prepare (S1).** Sign up as S1 and finish onboarding to APCS 2024, with the screen in English. The transcripts T-A, T-B, T-R, T-Z and T-K are in §1. Which attempt counts and whether a grade passes are the rule engine's to decide (AGENTS.md hard rule 1): these cases check what is stored and that the audit and planner read it, not which attempt counts.

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-TRN-02a | **API.** As S1, save T-A, then save T-B. Call `GET /api/users/me/transcript`. **Screen:** open **Transcript** (`/transcript`). | Both saves answer **200**, and the second answer holds T-B's rows only. The `GET` returns exactly T-B's 2 rows, PH211 and CS163, and none of T-A's (CS160, CM102, MTH251). The Transcript screen lists the same 2 rows. |
| TC-B2-TRN-02b | **API, from the console.** As S1, signed in on the app's tab, paste the snippet below into the DevTools console. It sends T-A and T-B at the same moment, 10 times, and after each round prints which transcript the API holds. | Every save answers **200** (each line shows `200 200`). After each round the transcript is exactly T-A or exactly T-B: every line ends in `A` or `B`, never `MIX`. |
| TC-B2-TRN-02c | **API.** As S1, save T-R. Call `GET /api/users/me/transcript`. **Screen:** open **Transcript**. | **200**. The `GET` returns 2 CS160 rows, the one of 2024 term 1 graded 3.0 first, then the one of 2024 term 2 graded 8.0. The Transcript screen lists both. The save neither merges them nor drops one. |
| TC-B2-TRN-02d | **API.** As S1, save T-Z. Call `GET /api/users/me/transcript` and `GET /api/users/me/audit`. **Screen:** open **Transcript**, then **Audit** (`/audit`). | The transcript keeps ZZ901, in the API and on the screen. In the audit, `unmatchedCourses` lists ZZ901 and not CS160, and `warnings` holds a `not_in_curriculum` warning for ZZ901. The Audit screen lists ZZ901 under "Courses not counted" ("Học phần không được tính"). |
| TC-B2-TRN-02e | **Screen.** As S1, save T-A (API). Open **Audit**, then **Plans** (the first time, it creates "Default plan"), and note what each shows of T-A's courses. Then open **Transcript**, remove T-A's 3 rows, add T-B's 2 rows with **Add row**, and press **Save transcript**. Without reloading, open **Audit** through the sidebar, then **Plans**. Then reload both, and call `GET /api/users/me/audit`. | The save says "Saved 2 rows." Without a reload, the Audit screen shows T-B's courses with their grades and nothing of T-A's, and the planner's **Taken** strip changes the same way: T-B's courses in, T-A's out. The reload changes nothing, and the API's audit agrees with the screen. Known issue: [#101](https://github.com/LLaammTTeerr/omnicourses/issues/101), the **Taken** strip's credit and course counts; record it under #101, not as a TRN-02e failure. |
| TC-B2-TRN-02f | **API, then database.** Sign up as S2, finish onboarding to APCS 2024 and save the completion fixture, [`apcs-2024-completion.json`](../../src/backend/test/fixtures/apcs-2024-completion.json) (45 rows). Call `GET /api/users/me/transcript` and `GET /api/users/me/export`. *Database:* run the user-table query of B1 §1 for S2's id. Note S1's transcript. Delete S2 with `DELETE /api/users/me` and the password. *Database:* purge it as [B1's USER-01y and z](test-cases-b1.md#deletion-restoration-and-purge) do: set `purge_after` in the past, then restart the backend or wait for the hourly purge, and run the user-table query for S2's id again. Read S1's transcript. The *Database* steps are **blocked: waiting for Lâm** (§1, "Database"). | The export answers **200**. `tables.transcript_rows` holds 45 rows, as many as the `GET` returns and the query counts, with the same code, name, credits, result, grade and term on each. The deletion answers **202**. After the purge, S2 has no `users` row and 0 rows in every user table, `transcript_rows` included. S1's transcript is unchanged. |
| TC-B2-TRN-02g | **API.** As S1, save T-A. Then save T-B with a third row: a copy of CS163's row with `"credits": 31`. Call `GET /api/users/me/transcript`. **Screen:** open **Transcript**. | The second save answers **400**, and its message contains `rows.2.credits must not be greater than 30`. Nothing of it is saved: the `GET` returns exactly T-A's 3 rows, and the Transcript screen lists them. |
| TC-B2-TRN-02h | **API.** As S1, save T-K. Call `GET /api/users/me/transcript`. **Screen:** open **Transcript**. Then, for each of the four rows of T-K that is not `graded` (`pass`, `exempt`, `fail`, `in_progress`), save T-K with that row's `grade` set to `7.0`, and call `GET` after each. | T-K answers **200**. The `GET` returns its 6 rows as sent, oldest term first: each result kept, `grade` null on the four rows that are not `graded`, and CS202 in term `{ "year": 2024, "number": 3 }`. The Transcript screen lists all 6. Each of the four saves with a grade answers **400**, its message contains "grade must be null unless result is graded", and the `GET` still returns T-K unchanged. |

Already automated: `transcript.e2e-spec.ts` covers a ("replaces the whole transcript on the next save"), b ("waits for a save in progress instead of merging with it", with the database lock held by hand), f ("is included in the account export and removed with the account"), g ("keeps the saved transcript when a save is refused") and h's grade rule ("stores a grade exactly when the result is graded, even past the API"). The manual run checks them on staging, with the screens and real HTTP requests sent at once.

The TRN-02b snippet. It sends 20 saves and 10 reads, within the rate limit of 120 a minute on each route:

```js
const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionStorage.getItem('omnicourse.session')}` };
const row = (courseCode, courseName, grade, number) => ({ courseCode, courseName, credits: 4, result: 'graded', grade, term: { year: 2024, number } });
const TA = { rows: [row('CS160', 'Nhập môn Tin học', 8.5, 1), row('CM102', 'Tư duy độc lập', 7.5, 1), row('MTH251', 'Vi tích phân I', 7.0, 1)] };
const TB = { rows: [row('PH211', 'Vật lý đại cương I', 6.5, 1), row('CS163', 'Cấu trúc dữ liệu', 8.0, 2)] };
const save = (body) => fetch('/api/users/me/transcript', { method: 'PUT', headers, body: JSON.stringify(body) }).then((r) => r.status);
const codes = (t) => t.rows.map((r) => r.courseCode).sort().join(',');
for (let i = 1; i <= 10; i++) {
  const statuses = await Promise.all([save(TA), save(TB)]);
  const held = await fetch('/api/users/me/transcript', { headers }).then((r) => r.json());
  console.log(i, statuses.join(' '), codes(held) === codes(TA) ? 'A' : codes(held) === codes(TB) ? 'B' : 'MIX');
}
```

## 6. Curriculum administration (TC-B2-ADM-01 to ADM-07)

For ADM-01 to ADM-07, [UC-11's Examples to test](../requirements/use-cases/UC-11-maintain-curriculum.md#examples-to-test) is the reference for expected behaviour ([test plan, B2 checks](test-plan.md#b2-checks)).

**Decision blockers.** Test plan §2 and §8 say the F12 writes also wait for two decisions. Without them the expected results are not agreed, so the affected cases stay **blocked** even after the screens are merged:

- The reviewed ADR 0011 for grants, roles, bootstrap and deletion. Its PR [#93](https://github.com/LLaammTTeerr/omnicourses/pull/93) is still open. It blocks every ADM case.
- Triết's rule-interface handoff for manual and CSV group links and for group-total checks. It blocks the cases that write group links or check group totals (ADM-03, ADM-04 and ADM-07 in particular).

### TC-B2-ADM-01: Global catalog permission

A catalog maintainer with no program grant edits a shared course after reviewing every affected curriculum, and both programs read the correction. A program-only administrator cannot make that write, and cohort-specific values are refused ([test plan row](test-plan.md#b2-checks)).

- Owner: Thắng
- Depends on: curriculum administration API (part done); administration screens (not started); reviewed ADR 0011 (#93, open).

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-ADM-01a | TODO | TODO |

### TC-B2-ADM-02: Program and access boundaries

Program A's administrator edits only program A, also through nested IDs. Only an access manager creates programs or changes grants, and that role gives no editing grant; signed-out, ungranted and revoked users cannot write ([test plan row](test-plan.md#b2-checks)).

- Owner: Thắng
- Depends on: curriculum administration API (part done); administration screens (not started); reviewed ADR 0011 (#93, open).

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-ADM-02a | TODO | TODO |

### TC-B2-ADM-03: Cohorts and membership

Adding a second cohort, with its groups and links to existing catalog courses, leaves the first cohort's membership, saved plans and audit results unchanged and creates no duplicate courses. Duplicate program or cohort identifiers and invalid links are refused ([test plan row](test-plan.md#b2-checks)).

- Owners: Thắng, Triết
- Depends on: curriculum administration API (part done); administration screens (not started); reviewed ADR 0011 (#93, open); Triết's rule-interface handoff.

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-ADM-03a | TODO | TODO |

### TC-B2-ADM-04: Removal

Removing one group link keeps the course and its other links. Deleting a course or other data that saved records still need is refused, deleting an unreferenced course needs catalog permission, and changing a linked course code is not an ordinary edit ([test plan row](test-plan.md#b2-checks)).

- Owners: Thắng, Triết
- Depends on: curriculum administration API (part done); administration screens (not started); reviewed ADR 0011 (#93, open); Triết's rule-interface handoff.

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-ADM-04a | TODO | TODO |

### TC-B2-ADM-05: Validation, atomicity and impact

Codes are normalized and checked, and invalid values change nothing. Cancel discards the edit, a failed save leaves no partial change, and an unknown response leads to a re-read. If linked curricula change during the catalog impact review, the maintainer must review the impact again (UC-11 A8). Transcript rows and saved course placements are never rewritten ([test plan row](test-plan.md#b2-checks)).

- Owner: Thắng
- Depends on: curriculum administration API (part done); administration screens (not started); reviewed ADR 0011 (#93, open).

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-ADM-05a | TODO | TODO |

### TC-B2-ADM-06: Grant lifecycle

The first access manager is set up in a controlled way, sign-up gives no privilege, and every write checks the current grant. Grant rows reference users as AGENTS.md requires, and account export and deletion cover them without deleting shared program or catalog data ([test plan row](test-plan.md#b2-checks)).

- Owners: Thắng, Lâm
- Depends on: curriculum administration API (part done), with grant storage and bootstrap as the reviewed ADR 0011 (#93, open) defines them.

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-ADM-06a | TODO | TODO |

### TC-B2-ADM-07: CSV bulk import

A synthetic CSV of courses or group links is parsed deterministically and shown as a preview with errors by row number. A file with any bad row saves nothing, a valid file saves in one transaction after confirmation with the same permission checks as manual entry, and importing it again creates no duplicates ([test plan row](test-plan.md#b2-checks)).

- Owner: Thắng
- Depends on: curriculum administration API (part done); CSV import and administration screens (not started); reviewed ADR 0011 (#93, open); Triết's rule-interface handoff.

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-ADM-07a | TODO | TODO |

## 7. TC-B2-SHARE-01: Export and sharing

A signed-out reader of a shared plan sees only the allowed read-only data, with rule-engine violations shown in the view and the PDF. Revoked, old, dead and unknown links stay closed, the page is `noindex`, and every new public route joins the allow-list in `src/backend/test/public-routes.e2e-spec.ts` ([test plan row](test-plan.md#b2-checks)).

- Owners: Dũng, Hoà
- Depends on: plan sharing and PDF export (not started).

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-SHARE-01a | TODO | TODO |

## 8. TC-B2-NOTIF-01: Notifications

Registration-window reminders, the term-start check-in and the warning after a saved transcript change reach the right student from the right event, and never come from a cancelled or failed save. Exact delivery, timing and repeat checks wait for the F10 contract ([test plan row](test-plan.md#b2-checks)).

- Owner: Dũng
- Depends on: calendar API (#108) and calendar page (#99) (done); notifications inbox (not started).

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-NOTIF-01a | TODO | TODO |

## 9. TC-B2-PERF-01: Planner validation time

A planner edit shows its validation result in under 300 ms, measured in the browser from the edit to the rendered result. API time is measured separately for diagnosis only ([test plan row](test-plan.md#coverage-and-speed)).

- Owners: Thắng, Hoà, Triết
- Depends on: planner drag-and-drop and live validation (in progress).

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-PERF-01a | TODO | TODO |

## 10. TC-B2-A11Y-01: Usability of the B2 screens

The B1 usability checks extend to the planner, transcript review, administration, sharing and notifications. This includes a keyboard alternative to dragging, labels, focus and error messages, words as well as colour, and a readable PDF ([test plan row](test-plan.md#coverage-and-speed)).

- Owners: Dũng and the feature owners
- Depends on: each screen it checks (see the sections above).

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-A11Y-01a | TODO | TODO |

## 11. TC-B2-OPS-01: Nightly backups

Backups run every night, and the job results and retention notice are kept. Restoration and the availability measure are B3 ([test plan row](test-plan.md#coverage-and-speed)).

- Owner: Lâm (hosting decisions)
- Depends on: nightly backup (not started).

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-OPS-01a | TODO | TODO |

## 12. B1 regression on B2

Run the [B1 cases](test-cases-b1.md) again on the B2 candidate. Before the run, update the cases that no longer match the screens as built: they are listed in issue [#116](https://github.com/LLaammTTeerr/omnicourses/issues/116).

| ID | Steps | Expected |
| --- | --- | --- |
| TODO | TODO | TODO |

## 13. Retests of B1 defects

Retest each B1 defect on the B2 candidate once its fix is merged. Write the steps and the expected result from the case that found the defect and from the issue's own steps.

| Issue | Title | Found by | Steps | Expected |
| --- | --- | --- | --- | --- |
| [#101](https://github.com/LLaammTTeerr/omnicourses/issues/101) | Planner Taken strip shows credits and courses from terms it does not list | PLAN-01n | TODO | TODO |
| [#114](https://github.com/LLaammTTeerr/omnicourses/issues/114) | No guide is published in B1: G01, G02, G06 and G07 are still drafts | GUIDE-01b, d, g | TODO | TODO |
| [#115](https://github.com/LLaammTTeerr/omnicourses/issues/115) | Unfinished onboarding never reaches the dashboard notice, and there is no "My program isn't listed" choice (USER-01k) | USER-01k | TODO | TODO |
| [#117](https://github.com/LLaammTTeerr/omnicourses/issues/117) | The 120-a-minute rate limit lets 121 requests through (PLAN-01m) | PLAN-01m | TODO | TODO |
| [#119](https://github.com/LLaammTTeerr/omnicourses/issues/119) | B1 accessibility run: focus lost after actions, skip link, What-if label and contrast (A11Y-01b, d, e, f) | A11Y-01b, d, e, f | TODO | TODO |
