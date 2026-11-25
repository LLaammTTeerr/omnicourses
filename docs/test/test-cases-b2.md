# B2 test cases

- Owner: Dũng
- Build: B2, 29 November 2026. Test window 16–29 November ([test plan §8](test-plan.md#8-schedule-and-remaining-work)).
- Version: 0.8, 25 November 2026. 0.8 records that the CSV import API exists (#147): §1 and the ADM sections say so, and the links to ADR 0011's implementation notes follow its new heading. No case changes. 0.7 (25 November) writes the steps of TC-B2-PERF-01 (§9), with the new account Q (§1) and the board in `evidence/b2/perf-01-plan.json`, and follows Lâm's review of #142. It also records #141's change: §4 is now "TC-B2-TRN-01: Paste or type, then review", and its #127 note is removed. The steps were read from the code on `main` at `53ad408`; they have not been run. 0.6 (22 November) writes the cases of TC-B2-ADM-01 (a shared course corrected for every curriculum), TC-B2-ADM-05 (validation, impact review and references) and TC-B2-ADM-06 (grant lifecycle) in §6, through the API only, with the new accounts S6, A5 and A6 (§1). Their steps were read from the code on `main` at `7f7974f` and from staging, and Lâm checked them on 22 November. After his review of #136, ADM-05a also sends a duplicate code and two bad links, ADM-06d searches the export for credentials, ADM-06c(3) checks the revocation with a write, and ADM-06 points to A4's bootstrap of 21 November. They have not been run. 0.5 (21 November) adds TC-B2-ADM-02h (the last active access manager cannot remove its own grant), which Lâm suggested in his review of #132. 0.4 (21 November) writes the cases of TC-B2-ADM-02 (§6), program, catalog and access boundaries through the API, with the accounts A1–A4 (§1), and records that ADR 0011 is accepted. Their steps were read from the code on `main` at `fd1f1ce` and from staging's routes; they have not been run. 0.3 follows Lâm's review of #130: it adds TRN-02g (a refused save keeps the earlier transcript) and TRN-02h (the other result types and a term 3 row), quotes PLAN-02e's malformed-code message with its field path, adds a 5xx answer to PLAN-02b, says that only `GET /api/plans/{id}` counts as PLAN-02c's re-read, corrects CM102's name, and marks TRN-02f's purge step blocked until Lâm decides on database access. 0.2 (21 November) wrote the cases of TC-B2-TRN-02 (§5) and TC-B2-PLAN-02 (§3), the two checks whose features are on staging and whose expected results are agreed, with the B2 accounts and synthetic transcripts of §1. Their steps were read from the code on `main` at `c7cf753` and have not been run. 0.1 (21 November) was the scaffold.
- Parent checks: test plan §5, rows `TC-B2-PLAN-01`, `TC-B2-PLAN-02`, `TC-B2-TRN-01`, `TC-B2-TRN-02` and `TC-B2-ADM-01` to `TC-B2-ADM-07`, `TC-B2-SHARE-01` and `TC-B2-NOTIF-01` of [B2 checks](test-plan.md#b2-checks), and `TC-B2-PERF-01`, `TC-B2-A11Y-01` and `TC-B2-OPS-01` of [Coverage and speed](test-plan.md#coverage-and-speed). Each detailed case has its parent's ID plus a letter, such as `TC-B2-PLAN-01a`. The text around the tables shortens it to `PLAN-01a`.

This file is a scaffold. Each section below gives one parent check from the test plan, its owners and what must be built before it can run. Dũng writes the detailed cases in each table. Do not add steps or expected results that the test plan, the use cases or the feature owner do not state. Where the expected result is not agreed yet, the case is **blocked** and names what it waits for.

## 1. Before you start

**Where to test.** On staging, as for B1 ([B1 cases §1](test-cases-b1.md#1-before-you-start)). The local setup, the network profile and the rules for database cases are the same as in B1 unless a case says otherwise.

**Test accounts.** Synthetic accounts only: made-up `example.com` addresses with synthetic data, never a real student, transcript, student ID or name (AGENTS.md, hard rule 3). Use the prefix `b2-`. Each account below has password `correct horse battery` and display name `Test Student`, and is onboarded to APCS 2024 with the goal fields unset. The first case that needs an account signs it up; later cases sign in. The password is in this file and in the repository, so the accounts hold synthetic data only.

| Name | Email | Used for |
| --- | --- | --- |
| S1 | `b2-s1@example.com` | TRN-02a–e, g and h: transcript saves, the audit and the planner. ADM-02b: a student with no role; ADM-02f: the grant's recipient |
| S2 | `b2-s2@example.com` | TRN-02f: export, then deletion and purge |
| A | `b2-s3@example.com` | PLAN-02d and e: the student who sends crafted IDs |
| B | `b2-s4@example.com` | PLAN-02d and e: the other student, whose plan must stay unchanged |
| P | `b2-s5@example.com` | PLAN-02a–c: the planner's saved and unsaved states |
| S6 | `b2-s6@example.com` | ADM-05c and d: the student whose transcript and plan name the test course |
| Q | `b2-s7@example.com` | PERF-01 only: no transcript, one plan, the [PERF-01 board](evidence/b2/perf-01-plan.json) |
| A1 | `b2-a1@example.com` | ADM-02 and ADM-05a and b: program administrator of APCS. ADM-01b: the program-only administrator |
| A2 | `b2-a2@example.com` | ADM-02 and ADM-05b: program administrator of CNTT-TCTA-KHMT, a CLC program |
| A3 | `b2-a3@example.com` | ADM-02, ADM-01 and ADM-05: catalog maintainer only. ADM-06c: deletes the test course in the clean-up |
| A4 | `b2-a4@example.com` | ADM-02 and ADM-06: access manager only |
| A5 | `b2-a5@example.com` | ADM-06a–c and e: a new sign-up, then given and refused each role; the granter whose account is purged |
| A6 | `b2-a6@example.com` | ADM-06c–f: the recipient of A5's grant, whose account is purged last |

A1–A6 are kept apart from the TRN and PLAN accounts. Sign-up gives them no role. On staging, on 21 November 2026, the bot made A4 the first access manager with `npm run admin:bootstrap`, and recorded A1–A3's grants as given by A4. A5, A6 and S6 are signed up by the first case that uses them; ADM-06 deletes A5 and A6, so a rerun signs them up again.

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

**Database.** The *Database* steps of TRN-02f, ADM-06e and ADM-06f use `psql`, with the user-table query and the shared-data query of [B1 cases §1](test-cases-b1.md#1-before-you-start); ADM-06b runs the bootstrap command in the server's shell. On staging the bot runs them for the tester, who needs no database access (Lâm, 21 November 2026): ask it in the PR's Discord thread, and record the output it posts. After the `UPDATE` of `purge_after`, the hourly purge removes the account within an hour.

**Recording results.** This file is not a test report and holds no result. Record each run as in [B1 cases §1](test-cases-b1.md#1-before-you-start) ("Recording results"): case ID, result (**passed**, **failed**, **blocked** or **not run**, with the reason for the last two), build tag and commit, browser and version, and the screen width for screen cases. Write the results of a run in `docs/test/evidence/b2/results-<date>.md`, as B1 did in `evidence/b1/results-2026-11-15.md`. A case whose feature is not in the B2 candidate is **not run: feature not merged** ([test plan §7](test-plan.md#7-when-a-build-is-ready)). Never record a token, a password or a password hash.

**Evidence.** Store screenshots, logs and measurements in `docs/test/evidence/b2/`. The folder is created with the first evidence file. Name the files as in `evidence/b1/`: lowercase, with a prefix and the case ID, for example `a-plan-01a-planner.png`.

**Build status on 21 November 2026.** The "Depends on" line of each section uses this status:

- Done: calendar API (#108) and calendar page (#99); transcript storage.
- In progress: planner drag-and-drop and live validation; curriculum administration API (part done).
- Not started: transcript paste/type entry screen; curriculum administration screens (the CSV import API is on `main` since 25 November 2026, with no screen); notifications inbox; plan sharing and PDF export; nightly backup.

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

## 4. TC-B2-TRN-01: Paste or type, then review

The student enters transcript rows, then reviews, corrects, adds or removes rows before saving. Incomplete rows block the save, and cancel keeps the earlier record ([test plan row](test-plan.md#b2-checks)).

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
| TC-B2-TRN-02f | **API, then database.** Sign up as S2, finish onboarding to APCS 2024 and save the completion fixture, [`apcs-2024-completion.json`](../../src/backend/test/fixtures/apcs-2024-completion.json) (45 rows). Call `GET /api/users/me/transcript` and `GET /api/users/me/export`. *Database:* run the user-table query of B1 §1 for S2's id. Note S1's transcript. Delete S2 with `DELETE /api/users/me` and the password. *Database:* purge it as [B1's USER-01y and z](test-cases-b1.md#deletion-restoration-and-purge) do: set `purge_after` in the past, then wait for the hourly purge, and run the user-table query for S2's id again. Read S1's transcript. The bot runs the *Database* steps on staging (§1, "Database"). | The export answers **200**. `tables.transcript_rows` holds 45 rows, as many as the `GET` returns and the query counts, with the same code, name, credits, result, grade and term on each. The deletion answers **202**. After the purge, S2 has no `users` row and 0 rows in every user table, `transcript_rows` included. S1's transcript is unchanged. |
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

- The reviewed ADR 0011 for grants, roles, bootstrap and deletion. *Closed:* Lâm accepted it on 12 November 2026, and [#93](https://github.com/LLaammTTeerr/omnicourses/pull/93) merged it. The cases take their expected results from its [response table](../analysis-and-design/adr/0011-curriculum-administration.md#validation-errors-and-removal) and [implementation notes](../analysis-and-design/adr/0011-curriculum-administration.md#implementation-notes-as-of-25-november-2026).
- Triết's rule-interface handoff for manual and CSV group links and for group-total checks. It blocks the cases that write group links or check group totals (ADM-03, ADM-04 and ADM-07 in particular).

### TC-B2-ADM-01: Global catalog permission

A catalog maintainer with no program grant edits a shared course after reviewing every affected curriculum, and both programs read the correction. A program-only administrator cannot make that write, and cohort-specific values are refused ([test plan row](test-plan.md#b2-checks)).

- Owner: Thắng
- Depends on: the catalog route `PATCH /api/admin/catalog/courses/{code}` of [#74](https://github.com/LLaammTTeerr/omnicourses/pull/74), on staging; ADR 0011 (accepted). These cases call the API only, as ADM-02 does. The administration screens are not built: the catalog screen's impact review (UC-11 A8, the affected curricula shown before the maintainer confirms) and its refusal message are checked when the screens land.
- How the review works on `main`: there is no preview route. The first `PATCH` of a course that a curriculum links answers `409 impact_confirmation_required`, with the affected curricula and a `reviewVersion`, and saves nothing. The same `PATCH` sent again with `"confirmImpact"` set to that `reviewVersion` saves it ([implementation notes](../analysis-and-design/adr/0011-curriculum-administration.md#implementation-notes-as-of-25-november-2026)). The version covers the course's current values, the proposed values and the affected curricula, so it confirms exactly one change.

**Accounts.** A1 (APCS program administrator, no catalog grant) and A3 (catalog maintainer, no program grant), with the grants of ADM-02: check them as ADM-02's "Accounts and grants" says. `{APCS24}` is in ADM-02's values table.

**The course.** BAA00104, Lịch sử Đảng Cộng sản Việt Nam, 2 credits. On 22 November 2026, staging links it in 11 curricula: APCS2024, APCS2025 and the nine CLC curricula of 2025, CNTT-TCTA-KHMT-2025 among them. Every course that APCS and CNTT-TCTA-KHMT share is such a BAA course, linked by all 11. The cases change only its English name, from N0 `History of Vietnamese Communist Party` to N1 `History of the Communist Party of Vietnam`, and change it back: no credit, audit or plan result depends on it. No other case changes BAA00104; ADM-05a and c only send it refused requests.

**Read-back R1**: `GET /api/courses/BAA00104` (its `nameEn` and `memberships`); BAA00104 in `GET /api/programs/APCS/curricula/2024`, group "Kiến thức Non Computer Science"; and BAA00104 in `GET /api/programs/CNTT-TCTA-KHMT/curricula/2025`, group "Lý luận chính trị - Pháp luật".

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-ADM-01a | **API, catalog maintainer.** Run R1 and keep it. As A3, `PATCH /api/admin/catalog/courses/BAA00104` with `{ "nameEn": "History of the Communist Party of Vietnam" }`. Run R1. Send the same `PATCH` again with `"confirmImpact"` set to the answer's `reviewVersion`. Run R1. *Restore:* as A3, `PATCH` with `{ "nameEn": "History of Vietnamese Communist Party" }`, then the same with the `reviewVersion` it answers. Run R1. | The first `PATCH` answers **409** `"code": "impact_confirmation_required"`, with a `reviewVersion` and `affectedCurricula`: 11 entries, each with `curriculumId`, `curriculumCode`, `programCode` and `cohortYear`, by program code then cohort: `APCS2024`, `APCS2025`, then the nine `CNTT-TCTA-…-2025`, `CNTT-TCTA-KHMT-2025` among them. They are the curricula of R1's `memberships`. Nothing is saved yet: R1 still reads N0 in all three places. The confirmed `PATCH` answers **200** with `"code": "BAA00104"`, `"nameEn"` N1 and the other values as before (2 credits). R1 now reads N1 in the course, in APCS 2024 and in CNTT-TCTA-KHMT 2025: "The authorized correction reaches both curricula" (UC-11). The restore answers **409** with another `reviewVersion` (the proposed value differs), then **200**, and R1 reads N0 again. |
| TC-B2-ADM-01b | **API, program only.** As A1, send ADM-01a's first `PATCH`. Send it again with `"confirmImpact"` set to ADM-01a's first `reviewVersion`. Run R1. | Both answer **403** `"code": "permission_required"` with `"permission": "catalog_maintainer"`: an APCS grant gives no catalog right, even for a course of APCS. Neither answer lists curricula or gives a `reviewVersion`. R1 still reads N0. |
| TC-B2-ADM-01c | **API, cohort-specific value.** As A3, `PATCH /api/admin/catalog/courses/BAA00104` with `{ "nameEn": "History of the Communist Party of Vietnam", "curriculumId": "{APCS24}" }`. Then the same with `"cohortYear": 2024` in place of `curriculumId`. Run R1. | Each answers **400** `"code": "validation_failed"`, and its message contains `property curriculumId should not exist`, then `property cohortYear should not exist`. The body is refused before any impact review: no 409 comes first. A course has one set of values for every curriculum that links it ("Refuse cohort-specific course values", ADR 0011). R1 still reads N0. |

Already automated: `curriculum-admin.e2e-spec.ts` covers a with credits on APCS 2024 and 2025 ("warns before changing a shared course, lists the curricula, and applies only the confirmed impact"), b for a catalog `POST` only ("lets the APCS administrator list APCS…": "A program grant gives no catalog right"), and c's kind of refusal with a `code` field in the `PATCH` ("rejects malformed codes, unknown fields and a gated credit total with 400 validation_failed"). No e2e test sends the catalog `PATCH` as a program administrator, or reads one change through two programs. The manual run checks them on staging, with the seeded course shared by 11 curricula.

### TC-B2-ADM-02: Program and access boundaries

Program A's administrator edits only program A, also through nested IDs. Only an access manager creates programs or changes grants, and that role gives no editing grant; signed-out, ungranted and revoked users cannot write ([test plan row](test-plan.md#b2-checks)).

- Owner: Thắng
- Depends on: the curriculum administration API of [#74](https://github.com/LLaammTTeerr/omnicourses/pull/74), on staging; ADR 0011 (accepted). These cases call the API directly, as UC-11 A4 asks ("requests sent directly without using the screen"). They do not wait for the administration screens (not started): the screen's words for a refusal ("explains whether program, catalog or access-manager permission is missing", UC-11 A4) are checked when the screens land.
- Not built, so not tested here: program creation (`POST /api/admin/programs`), which the ADR gives to the access manager ([implementation notes](../analysis-and-design/adr/0011-curriculum-administration.md#implementation-notes-as-of-25-november-2026)). When it lands, add it to ADM-02f: an access manager creates a program and gets no editing grant on it.

**Accounts and grants.** A1–A4 and S1 of §1. Sign-up gives no role. On staging, the bot set the grants up from the user IDs that `GET /api/users/me` gives (§1); on another server, bootstrap A4 first, then grant A1–A3 as A4. A4 is the only active access manager, so removing A4's own grant is refused (ADR 0011, last-active-manager protection). Check the grants before the run: as A4, `GET /api/admin/access/users/{id}/grants` for each of A1–A4 and S1 shows exactly the grant of the table in §1, and none for S1. ADM-02a and b need no grant. Run the cases in order: ADM-02e and f clean up what they create, and ADM-02g removes A1's grant, then gives it back.

**The values.** Program and cohort IDs are UUIDs; read them on staging before the run:

| Name | Value | Where to read it |
| --- | --- | --- |
| `{APCS}` | APCS's program ID | As A1, `GET /api/admin/programs`: the `id` of `APCS`. Before A1 has the grant, as A4, `GET /api/admin/access/programs`. On staging it is `d3f524f8-e51b-42dd-91ac-013b15d5e033`. |
| `{APCS24}` | The APCS 2024 cohort (curriculum) ID | The same answer, `curricula` with `cohortYear` 2024; or `id` of `GET /api/programs/APCS/curricula/2024`. |
| `{KHMT}` | CNTT-TCTA-KHMT's program ID (CLC, Khoa học máy tính) | As A2, `GET /api/admin/programs`. |
| `{KHMT25}` | The CNTT-TCTA-KHMT 2025 cohort ID | The same answer; or `id` of `GET /api/programs/CNTT-TCTA-KHMT/curricula/2025`. |
| `{KG}` | A requirement group of CNTT-TCTA-KHMT 2025 | `GET /api/programs/CNTT-TCTA-KHMT/curricula/2025`: the `id` of "Kiến thức bắt buộc chuyên ngành". |
| `{S1}`, `{A1}` | S1's and A1's user IDs | `GET /api/users/me` as each. |

**The three writes**, one of each kind. Each body is valid, so a refusal can only come from the sign-in or the grant:

| Name | Request | Kind |
| --- | --- | --- |
| W | `PUT /api/admin/programs/{APCS}/cohorts/{APCS24}/courses/CS420/offering-terms` with `{ "terms": [1, 2] }`. CS420 is an APCS 2024 elective that no other B2 case uses, except PERF-01f, which sets and clears the same offering terms; on 21 November its offering terms were not recorded (`null`). | Program write |
| C | `POST /api/admin/catalog/courses` with `{ "code": "ZZADM02", "nameVi": "Học phần thử ADM-02", "credits": 3 }`. `ZZ` codes are in no curriculum (§1). | Catalog write |
| G | `PUT /api/admin/access/users/{S1}/programs/{APCS}`, no body: give S1 the APCS program grant. | Access-manager work |

**Read-back R**, which shows that nothing changed: `GET /api/programs/APCS/curricula/2024` lists CS420 with `"offeringTerms": null`; `GET /api/courses/ZZADM02` answers **404**; as S1, `GET /api/admin/programs` answers `{ "programs": [] }`.

A refusal answers **403** with `"code": "permission_required"` and `permission` naming the missing grant: `program_admin` for W, `catalog_maintainer` for C, `access_manager` for G ([ADR 0011, response table](../analysis-and-design/adr/0011-curriculum-administration.md#validation-errors-and-removal): "the response identifies the permission kind, without disclosing another program's data"). In every refused case, "No data changes" (UC-11 A4).

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-ADM-02a | **API, signed out.** In Swagger, **Logout** from **Authorize**, so requests carry no token. Send W, C and G. Then sign in as S1 and run R. | W, C and G each answer **401**. R shows nothing changed. |
| TC-B2-ADM-02b | **API, no role.** Sign in as S1, a student with no F12 grant. Call `GET /api/admin/programs`, then send W, C and G. Run R. | The list is `{ "programs": [] }`. W, C and G each answer **403** `permission_required`, with `permission` `program_admin`, `catalog_maintainer` and `access_manager` in turn. R shows nothing changed. |
| TC-B2-ADM-02c | **API, own program.** As A1, call `GET /api/admin/programs`. Send W. Call `GET /api/programs/APCS/curricula/2024`. *Clean-up:* as A1, `DELETE /api/admin/programs/{APCS}/cohorts/{APCS24}/courses/CS420/offering-terms`. | The list holds one program, APCS, with its cohorts 2024 and 2025. W answers **200** `{ "courseCode": "CS420", "terms": [1, 2] }`, and the curriculum lists CS420 with `"offeringTerms": [1, 2]`. The clean-up answers **200** with `"terms": null`, and CS420 reads `null` again. |
| TC-B2-ADM-02d | **API, other program.** Call `GET /api/programs/CNTT-TCTA-KHMT/curricula/2025` and keep it as K0. As A1: (1) send W on CLC, `PUT /api/admin/programs/{KHMT}/cohorts/{KHMT25}/courses/CSC14001/offering-terms` with `{ "terms": [1, 2] }`; (2) the same request with APCS's ID and CLC's cohort, `PUT /api/admin/programs/{APCS}/cohorts/{KHMT25}/courses/CSC14001/offering-terms`; (3) CLC's group in an APCS path, `PUT /api/admin/programs/{APCS}/cohorts/{APCS24}/requirement-groups/{KG}/courses/CS420`, no body. Then, as A2, send W. Call `GET /api/programs/CNTT-TCTA-KHMT/curricula/2025` again, and run R. | (1) **403** `permission_required`, `program_admin`. (2) and (3) **404** `"code": "not_found"`: "No such cohort in this program" and "No such requirement group in this cohort". The ADR answers 404 for "item absent within the authorized scope, including mismatched nested IDs", and "a grant for program A with a group ID from B never authorizes a write to B". No answer shows CLC's data. A2's W answers **403** `program_admin`: a CLC grant gives nothing in APCS. CLC equals K0: CSC14001 still has `"offeringTerms": null`, and "Kiến thức bắt buộc chuyên ngành" has the same courses as in K0, without CS420. R shows nothing changed. |
| TC-B2-ADM-02e | **API, catalog only.** As A3, call `GET /api/admin/programs`. Send C. Then `PATCH /api/admin/catalog/courses/ZZADM02` with `{ "credits": 4 }`, and `GET /api/courses/ZZADM02`. Send W. Run R's first read. *Clean-up:* as A3, `DELETE /api/admin/catalog/courses/ZZADM02`, then `GET /api/courses/ZZADM02`. | The list is `{ "programs": [] }`: a catalog grant edits no program. C answers **201**. The PATCH answers **200** with `"credits": 4`, saved at once because no curriculum links ZZADM02 (ADR 0011 amendment: "A course no curriculum links is saved directly"). The GET shows 4 credits and no memberships. W answers **403** `program_admin`, and CS420 is still `null`. The clean-up answers **204**, then **404**. |
| TC-B2-ADM-02f | **API, access manager only.** As A4, send G, then call `GET /api/admin/access/users/{S1}/grants`. Then `DELETE /api/admin/access/users/{S1}/programs/{APCS}` and call the grants again. Then, as A4, call `GET /api/admin/programs`, send W and send C. Run R. | G answers **200**: S1's grants hold APCS in `programs`, with `grantedBy` A4's ID, and no `permissions`. The DELETE answers **200** with `"programs": []` and `"permissions": []`, and the grants read the same. A4's list is `{ "programs": [] }`. W answers **403** `program_admin` and C **403** `catalog_maintainer`: "No automatic curriculum/catalog editing rights" (ADR 0011, permission table). R shows nothing changed, S1 included. |
| TC-B2-ADM-02g | **API, revoked.** Sign in as A1 and keep that token. As A4, `DELETE /api/admin/access/users/{A1}/programs/{APCS}`. As A1, with the same token, send W, then call `GET /api/admin/programs`. Run R's first read. *Restore:* as A4, `PUT /api/admin/access/users/{A1}/programs/{APCS}`, so the later ADM cases have A1. | The DELETE answers **200** with `"programs": []`. W answers **403** `program_admin`: the sign-in still works, but "completed revocation blocks the next write" (ADR 0011, transaction contract). A1's list is `{ "programs": [] }`. CS420 is still `null`. The restore answers **200** with APCS in `programs`. |
| TC-B2-ADM-02h | **API, last access manager.** Run it only while A4 is the only active access manager (§1). As A4, call `GET /api/admin/access/users/{A4}/grants` and keep it. Then `DELETE /api/admin/access/users/{A4}/global/access_manager`. Call the grants again, then `GET /api/admin/access/programs`. If the DELETE answers 200, staging has no access manager left: tell Lâm, who restores one with `admin:bootstrap` (ADR 0011, "Bootstrap and recovery"). | The DELETE answers **409** `"code": "last_access_manager"`: "The grant API rejects revoking the last active access manager with `409 last_access_manager`" (ADR 0011, bootstrap and recovery). A4's grants are unchanged: `access_manager`, with `grantedBy` `null`. `GET /api/admin/access/programs` answers **200**: A4 is still an access manager. |

Already automated: `curriculum-admin.e2e-spec.ts` covers a ("refuses the admin routes without a token"), b ("gives a signed-in user without a grant 403 on every kind of write, and no program to edit"), c and d with a CLC cohort in an APCS path ("lets the APCS administrator list APCS with its cohorts, and not write CLC, even through nested IDs"; it does not send a CLC group ID) g ("blocks the next write once a grant is revoked") and h ("delegates, protects the last active access manager, and recovers when the last one is deleted", on a schema of its own, through the service rather than HTTP). `grant-scope.spec.ts` covers e's and f's default deny ("gives an access manager or a catalog maintainer no program and not each other") as a unit test only: no e2e test sends a program write as a catalog maintainer or an access manager. The manual run checks all of them on staging, with real accounts and grants.

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
- Depends on: the catalog and group-link routes of [#74](https://github.com/LLaammTTeerr/omnicourses/pull/74), on staging; ADR 0011 (accepted). These cases call the API only. Checked when the screens land: **Cancel** discards the edit and sends no write, and after a lost response the screen reloads the saved resource before it retries or reports success (ADR 0011, "Validation, errors and removal"). At the API, ADM-01a already shows that an unconfirmed impact warning saves nothing.
- Not tested by hand: "a failed transaction leaves no partial save" needs a failure injected in the middle of a write, which staging cannot do. No automated test injects one yet either: [#134](https://github.com/LLaammTTeerr/omnicourses/issues/134) (Lâm). ADM-05a checks the refusals that come before any write.

**Accounts and values.** A1, A2 and A3 with their ADM-02 grants, and S6. `{APCS}`, `{APCS24}`, `{KHMT}`, `{KHMT25}` and `{KG}` are in ADM-02's values table. `{AC}` is the `id` of the APCS 2024 group "Tự chọn Computer Science (C)" in `GET /api/programs/APCS/curricula/2024`. `{AC}` is an elective group with no credit minimum. `{KG}`, "Kiến thức bắt buộc chuyên ngành", is named "required", but its printed rule is a choice ("Sinh viên tích lũy tối thiểu 16 tín chỉ, được chọn trong danh sách các học phần dưới đây"), and the seed stores it as `"kind": "elective"` with `"creditsTotalMin": 16` (`clc-2025-shared.ts`). Linking a course to either group adds a choice and requires nothing more of a student. ADM-05b removes the links again.

ADM-05b uses the group-link routes, which are built, only to make A3's review out of date. It checks no group credit total, so Triết's handoff (§6, "Decision blockers") does not block it (Lâm, 22 November 2026).

**The test course** ZZADM05 is created in ADM-05a and deleted at the end of ADM-05d. Run the cases in order. ADM-05b links it to a curriculum for a few minutes; otherwise it is in none (§1).

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-ADM-05a | **API, bad codes and numbers.** As A3, send `POST /api/admin/catalog/courses` with `"nameVi": "Học phần thử ADM-05"` and `"credits": 3`, and with: (1) `"code": "cs-1"`; (2) `"code": "Z"`; (3) `"code": "ZZADM05ZZADM05ZZADM05"` (21 characters); (4) `"code": "ZZADM05"` and `"credits": 0`; (5) the same with `"credits": -1`; (6) with `"credits": 2.5`. Call `GET /api/courses/ZZADM05`. (7) Send it with `"code": " zzadm05 "` and 3 credits, and call the `GET` again. Then `PATCH /api/admin/catalog/courses/ZZADM05` with (8) `{ "credits": 0 }` and (9) `{ "credits": -1 }`; (10) `PATCH /api/admin/catalog/courses/cs-1` with `{ "credits": 3 }`; and (11) `PATCH /api/admin/catalog/courses/BAA00104` with `{ "credits": 0 }`. Call `GET /api/courses/ZZADM05` and `GET /api/courses/BAA00104`. (12) Send (7) again, with `"code": " zzadm05 "`. Then, as A1, send two bad links to `{AC}`: (13) `PUT /api/admin/programs/{APCS}/cohorts/{APCS24}/requirement-groups/{AC}/courses/ZZADM99`, a code the catalog does not have; (14) the same path ending in `courses/cs-1`. Both have no body. Read "Tự chọn Computer Science (C)" in `GET /api/programs/APCS/curricula/2024`. | (1)–(6) each answer **400** `"code": "validation_failed"`. The message of (1)–(3) is `code: "<the code sent>" is not a course code (letters A-Z and digits, 2 to 20)`; that of (4) and (5) contains `credits must not be less than 1`, and that of (6) `credits must be an integer number`. The `GET` answers **404**: nothing was saved. (7) answers **201** with `"code": "ZZADM05"`: the code is trimmed and upper-cased, then checked (ADR 0011). (8) and (9) answer **400**, `credits must not be less than 1`, and (10) **400**, `courseCode: "cs-1" is not a course code (letters A-Z and digits, 2 to 20)`. (11) answers **400** `validation_failed`, not a 409 impact warning: a bad value is refused before the review. ZZADM05 still has 3 credits, and BAA00104 2. (12) answers **409** `"code": "duplicate_code"`, "The catalog already has ZZADM05": the trimmed, upper-cased code is the same code. (13) answers **404** `"code": "not_found"`, "No catalog course has the code ZZADM99; a catalog maintainer adds it first". (14) answers **400** `validation_failed`, `courseCode: "cs-1" is not a course code (letters A-Z and digits, 2 to 20)`. The group has the same courses as before, without ZZADM99. |
| TC-B2-ADM-05b | **API, links change during the review.** As A1, link ZZADM05 to `{AC}`: `PUT /api/admin/programs/{APCS}/cohorts/{APCS24}/requirement-groups/{AC}/courses/ZZADM05`, no body. As A3, `PATCH /api/admin/catalog/courses/ZZADM05` with `{ "credits": 4 }`, and keep its `reviewVersion` as V1. As A2, link it to `{KG}`: `PUT /api/admin/programs/{KHMT}/cohorts/{KHMT25}/requirement-groups/{KG}/courses/ZZADM05`. As A3, send the `PATCH` again with `"confirmImpact"` V1. Call `GET /api/courses/ZZADM05`. Send the `PATCH` with the `reviewVersion` of the last answer (V2), and call the `GET` again. *Clean-up:* as A1, `DELETE` the first link (the same path as its `PUT`); as A2, the second. Call the `GET`. | Each link answers **204**. The first `PATCH` answers **409** `impact_confirmation_required`, with `affectedCurricula` holding `APCS2024` only. The `PATCH` with V1 answers **409** `"code": "impact_changed"`: its `affectedCurricula` holds `APCS2024` and `CNTT-TCTA-KHMT-2025`, and its `reviewVersion` V2 differs from V1. The maintainer must review the new list (UC-11 A8). The `GET` still shows 3 credits, with a membership in each group. The `PATCH` with V2 answers **200** with `"credits": 4`, and the `GET` shows 4 credits. Each unlink answers **204**, and the `GET` shows no membership. |
| TC-B2-ADM-05c | **API, referenced course.** As A3, `DELETE /api/admin/catalog/courses/BAA00104`, then `GET /api/courses/BAA00104`. Sign up as S6 and finish onboarding to APCS 2024. As S6, save T-A with a fourth row (T-A5): `{ "courseCode": "ZZADM05", "courseName": "Học phần thử ADM-05", "credits": 4, "result": "graded", "grade": 8.0, "term": { "year": 2025, "number": 1 } }`. As A3, `DELETE /api/admin/catalog/courses/ZZADM05`, then `GET /api/courses/ZZADM05`. | BAA00104's `DELETE` answers **409** `"code": "referenced_item"`. Its `references` include `linked in APCS2024` and `linked in CNTT-TCTA-KHMT-2025`. The `GET` answers **200** with the same 11 memberships as before. T-A5's save answers **200**. ZZADM05's `DELETE` answers **409** `referenced_item` with `references` exactly `["1 transcript rows name it"]`: a transcript names a course by plain code, with no foreign key, and still counts ("absence of a foreign key is not proof of no reference", ADR 0011). The `GET` answers **200**. |
| TC-B2-ADM-05d | **API, transcripts and plans keep their values.** As S6, `POST /api/plans` with `{ "name": "ADM-05 plan", "programCode": "APCS", "cohortYear": 2024, "terms": [ { "term": { "year": 2026, "number": 1 }, "placements": [ { "kind": "course", "courseCode": "ZZADM05" } ] } ] }`. Keep `GET /api/users/me/transcript` and `GET /api/plans/{id}`. As A3, `PATCH /api/admin/catalog/courses/ZZADM05` with `{ "credits": 5, "nameVi": "Học phần thử ADM-05 (sửa)" }`. As S6, call both `GET`s again. As A3, `DELETE /api/admin/catalog/courses/ZZADM05`. *Clean-up:* as S6, save T-A, then `DELETE /api/plans/{id}`. As A3, delete ZZADM05 again, then `GET /api/courses/ZZADM05`. | The plan answers **201**. The `PATCH` answers **200** at once, with 5 credits and the new name: no curriculum links ZZADM05, and a transcript or a plan needs no impact review. The transcript is unchanged: ZZADM05's row still has `"courseName": "Học phần thử ADM-05"` and 4 credits. The plan's `terms` are unchanged: ZZADM05 alone in 2026 term 1, `credits` `null` (a placed course stores no credits of its own). The `DELETE` answers **409** `referenced_item` with `references` `["1 transcript rows name it", "1 saved plans place it"]`. In the clean-up, the save answers **200**, the plan's `DELETE` **204**, the course's `DELETE` **204** and the `GET` **404**. |

Already automated: `curriculum-admin.e2e-spec.ts` covers a's code check, for a 1-character code in a catalog `POST` and a malformed code in a prerequisite path ("rejects malformed codes, unknown fields and a gated credit total…"), and a's duplicate code without the spaces ("warns before changing a shared course…"); b with a link removed rather than added ("warns before changing a shared course…": "The links change during the review"); c for a linked course ("refuses to strand a rule…"); and d's refused deletion for a plan ("refuses to delete a catalog course that a saved plan places…"). No e2e test sends a credit of 0 or less to the catalog, links an unknown or malformed code, or deletes a course that only a transcript names. The manual run checks all of them on staging.

### TC-B2-ADM-06: Grant lifecycle

The first access manager is set up in a controlled way, sign-up gives no privilege, and every write checks the current grant. Grant rows reference users as AGENTS.md requires, and account export and deletion cover them without deleting shared program or catalog data ([test plan row](test-plan.md#b2-checks)).

- Owners: Thắng, Lâm
- Depends on: the grant routes and `admin:bootstrap` of [#74](https://github.com/LLaammTTeerr/omnicourses/pull/74), on staging; account export and deletion (B1); ADR 0011 (accepted). These cases call the API; the bootstrap and the purge need the server, and Lâm's bot runs them (§1, "Database"). When a case reaches its server step, write "ADM-06b ready", "ADM-06e ready" or "ADM-06f ready" in the PR's thread, one at a time, and record the output the bot posts. Before purging A5, the bot checks that A6 still exists. The grant screen and the account screen's **User ID** field with **Copy** (ADR 0011) are not built, and are checked when the screens land.
- Not tested on staging: recovery when no active access manager is left. It would take A4's role away; `curriculum-admin.e2e-spec.ts` covers it.
- A bootstrap that succeeds is not repeated here. The bot bootstrapped A4 on 21 November 2026 (§1), and [the ADM-02 run](evidence/b2/results-2026-11-21.md) recorded the result: A4 holds `access_manager` with `grantedBy: null`. The command's output was not kept, so that run shows the outcome only. `curriculum-admin.e2e-spec.ts` covers the command itself ("refuses an unknown account and one waiting for deletion, then makes the first access manager once").

**Accounts.** A4, the only active access manager (check it as ADM-02's "Accounts and grants" says), A3 and the new accounts A5 and A6 of §1. `{A5}` and `{A6}` are their user IDs, from `GET /api/users/me`. W is ADM-02's program write. ZZADM06 is a test course: `POST /api/admin/catalog/courses` with `{ "code": "ZZADM06", "nameVi": "Học phần thử ADM-06", "credits": 3 }`. Run the cases in order: ADM-06c leaves A6 holding a grant from A5, which ADM-06d–f need.

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-ADM-06a | **API, new sign-up.** Sign up as A5 and finish onboarding to APCS 2024. As A5, call `GET /api/admin/programs`, `GET /api/admin/access/programs` and `GET /api/users/me/export`. As A4, `GET /api/admin/access/users/{A5}/grants`. | `GET /api/admin/programs` answers `{ "programs": [] }`: choosing APCS at onboarding gives no editing right ("Selecting a faculty, program or cohort during onboarding does not grant access", ADR 0011). `GET /api/admin/access/programs` answers **403** `permission_required`, `access_manager`. In the export, `tables.program_admin_grants` and `tables.global_admin_grants` are `[]`. A4 reads `"programs": []` and `"permissions": []`. |
| TC-B2-ADM-06b | **Server, bootstrap refused.** The bot runs `npm run admin:bootstrap -w src/backend -- --user-id {A5}` on staging and posts its output. As A4, `GET /api/admin/access/users/{A5}/grants`. | The command fails with exit code 1 and prints exactly `An active access manager already exists; they grant further permissions through the API`: A4 is one, and the bootstrap "refuses when any active access manager already exists" (ADR 0011). A5 still has no grant. |
| TC-B2-ADM-06c | **API, each role given, used and removed.** (1) *Catalog.* As A4, `PUT /api/admin/access/users/{A5}/global/catalog_maintainer`. As A5, create ZZADM06. As A4, `DELETE` the same grant. As A5, `DELETE /api/admin/catalog/courses/ZZADM06`, then `GET /api/courses/ZZADM06`. (2) *Program.* As A4, `PUT /api/admin/access/users/{A5}/programs/{APCS}`. As A5, send W, then ADM-02c's clean-up. As A4, `DELETE` the grant. As A5, send W, and read CS420 in `GET /api/programs/APCS/curricula/2024`. (3) *Access.* Sign up as A6 and finish onboarding to APCS 2024. As A4, `PUT /api/admin/access/users/{A5}/global/access_manager`. As A5, `PUT /api/admin/access/users/{A6}/global/catalog_maintainer`. As A5, `DELETE /api/admin/access/users/{A5}/global/access_manager`, then send the grant to A6 again, a write. As A4, `DELETE /api/admin/access/users/{A4}/global/access_manager`. *Clean-up:* as A3, `DELETE /api/admin/catalog/courses/ZZADM06`. | Each grant by A4 answers **200**, with the role in A5's grants and `grantedBy` A4's ID; each removal answers **200** without it. (1) The course answers **201**. After the removal, A5's `DELETE` answers **403** `permission_required`, `catalog_maintainer`, and the `GET` still answers **200**. (2) W and its clean-up answer **200**. After the removal, W answers **403** `program_admin`, and CS420 reads `"offeringTerms": null`. (3) A5's grant to A6 answers **200**: A6 holds `catalog_maintainer` with `grantedBy` A5's ID. A5's removal of its own role answers **200**: A4 is still an active access manager. A5's repeated grant answers **403** `permission_required`, `access_manager`: "Completed revocation blocks the next write" (ADR 0011). A6's grant stays as it was, from A5's first grant. A4's removal of its own role answers **409** `"code": "last_access_manager"`, as in ADM-02h, and A4 keeps it. The clean-up answers **204**. |
| TC-B2-ADM-06d | **API, export.** As A4, `GET /api/users/me/export`. As A6, the same. Search A4's file for credentials, as [B1's USER-01s](test-cases-b1.md#export) does. | Both answer **200**. A4's file has no key, at any depth, ending in `_hash`, `_token`, `_secret`, `_key`, `_password`, `_sub`, `_salt` or `_seed`, or their camelCase forms, and does not contain the bearer token used for the request ("export omits … all credentials", ADR 0011). A4's `tables.global_admin_grants` holds one row, its own: `user_id` A4's ID, `permission` `access_manager`, `granted_by` `null`; its `tables.program_admin_grants` is `[]`. None of the grants A4 gave (A1's, A2's, A3's) is there, though their `granted_by` is A4: a row that names A4 only in another column is someone else's (ADR 0004, AGENTS.md). A6's `tables.global_admin_grants` holds one row: `user_id` A6's ID, `catalog_maintainer`, `granted_by` A5's ID; its `program_admin_grants` is `[]`. |
| TC-B2-ADM-06e | **API, then database: the granter is purged.** As A5, `DELETE /api/users/me` with the password. As A4, `GET /api/admin/access/users/{A6}/grants`, then `PUT /api/admin/access/users/{A5}/global/catalog_maintainer`. *Database:* run the user-table query for A5's ID. Set A5's `purge_after` in the past and wait for the hourly purge, as TRN-02f does. Run the user-table query again. As A4, `GET /api/admin/access/users/{A6}/grants` and `GET /api/admin/access/users/{A5}/grants`. As A6, create ZZADM06, then `DELETE /api/admin/catalog/courses/ZZADM06`. The bot runs the *Database* steps. | The deletion answers **202**. A6's grant is unchanged, `grantedBy` A5's ID. The `PUT` answers **409** `"code": "recipient_deletion_pending"`. After the purge, A5 has no `users` row and 0 rows in every user table. A6 still holds `catalog_maintainer`, now with `"grantedBy": null`: "purging a granter nulls `granted_by` and preserves other recipients' grants" (ADR 0011). A5's grants answer **404** `not_found`. A6's course answers **201** and its `DELETE` **204**: the grant still works. |
| TC-B2-ADM-06f | **API, then database: the recipient is purged.** *Database:* run the shared-data query. As A6, `DELETE /api/users/me` with the password. *Database:* run the user-table query for A6's ID; purge A6 as in ADM-06e; run the user-table query and the shared-data query again. As A4, `GET /api/admin/access/users/{A6}/grants` and `GET /api/admin/access/programs`. Call `GET /api/courses/BAA00104`. The bot runs the *Database* steps. | The deletion answers **202**. Before the purge, the user-table query counts 1 row of `global_admin_grants` for A6; after it, A6 has no `users` row and 0 rows in every user table, `global_admin_grants` included. The shared counts are as before: no program, curriculum or course went with the grant ("Neither action deletes programs, curricula or courses", ADR 0011). A6's grants answer **404**. A4 still lists every program, APCS and CNTT-TCTA-KHMT among them, and BAA00104 answers **200** with its 11 memberships. |

Already automated: `curriculum-admin.e2e-spec.ts` covers a's no-grant list ("gives a signed-in user without a grant 403…"), b and the recovery ("refuses an unknown account and one waiting for deletion, then makes the first access manager once", "lets only one of two concurrent bootstraps succeed", "delegates, protects the last active access manager, and recovers when the last one is deleted", through the service), c for a program grant only ("blocks the next write once a grant is revoked"), d for a recipient ("…and exports them to their recipient"), and e and f by deleting the `users` row directly ("keeps a grant when its granter is purged, and deletes it with its recipient's account"). `account.e2e-spec.ts` checks every user table's key for export and purge. The manual run checks them on staging, through the API, the real deletion and the hourly purge.

### TC-B2-ADM-07: CSV bulk import

A synthetic CSV of courses or group links is parsed deterministically and shown as a preview with errors by row number. A file with any bad row saves nothing, a valid file saves in one transaction after confirmation with the same permission checks as manual entry, and importing it again creates no duplicates ([test plan row](test-plan.md#b2-checks)).

- Owner: Thắng
- Depends on: curriculum administration API (part done); CSV import API (on `main` since 25 November 2026: [ADR 0011, CSV import as built](../analysis-and-design/adr/0011-curriculum-administration.md#csv-import-as-built-25-november-2026)); administration screens (not started); reviewed ADR 0011 (#93, open); Triết's rule-interface handoff.

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-ADM-07a | TODO | TODO |

## 7. TC-B2-SHARE-01: Export and sharing

A signed-out reader of a shared plan sees only the allowed read-only data, with rule-engine violations shown in the view and the PDF. Revoked, old, dead and unknown links stay closed, the page is `noindex`, and every new public route joins the allow-list in `src/backend/test/public-routes.e2e-spec.ts` ([test plan row](test-plan.md#b2-checks)).

- Owners: Dũng, Hoà
- Depends on: plan sharing and PDF export. The API is built (#153); the Share panel, the shared page and the PDF are not started.

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

Sources: Vision §6 Performance; test plan §5, [Coverage and speed](test-plan.md#coverage-and-speed) and [Performance procedure](test-plan.md#performance-procedure); UC-05. The setup follows [B1's PERF-01](test-cases-b1.md#4-tc-b1-perf-01-dashboard-and-audit-load-time).

- Owners: Thắng, Hoà, Triết
- Depends on: planner drag-and-drop and live validation (in progress). The steps below are written against `main` on 24 November 2026, where an edit saves the board (`PUT /api/plans/{id}/placements`) and then checks it (`GET /api/plans/{id}/issues`), with no debounce. Before the run, Hoà confirms that the stop condition below still holds once live validation lands (open items below).

**What is timed.** One edit: a keyboard move of one tile to another term row (UC-05 A1: Space lifts the focused tile, the arrows pick a row, Enter drops). Before each Space, focus `[data-test="tile-<code>"]`: Undo does not put the focus back, and a blur cancels a lift. After the arrows, wait until the target row has lost the class `checking`, so the lift's drop preview (`POST /api/plans/{id}/issues/drops`) has answered, before Enter: Enter only aborts that request in the browser, and the server could still be computing it during the timed save. The clock starts at the Enter `keydown`, which a capture listener on `window` stamps with `performance.now()`. It stops at the first animation frame where all of these hold: the moved tile is in its target row (`[data-test="term-<year>-<number>"]` holds `[data-test="tile-<code>"]`); `[data-test="issues-panel"]` has `aria-busy="false"`; `[data-test="issue-counts"]` has no `stale` class, so the report on screen is the one for the board on screen; and the edit's expected result (table below) is drawn. The script reads the drawn issues themselves, not a flag the app sets. A keyboard move is used instead of a mouse drag because its start is one exact event, and a scripted drag's own motion would be timed with it.

**Fixture.** Account Q, onboarded to APCS 2024, with no transcript. Q has one plan, made with `POST /api/plans` with `"name": "PERF-01"`, `"programCode": "APCS"`, `"cohortYear": 2024` and the `terms` of [`evidence/b2/perf-01-plan.json`](evidence/b2/perf-01-plan.json), SHA-256 `312ef179af67d9fdabf6bf75c14683496405a29e6913a27e3d2adda5b64fd28b`. That board is B1's [completion fixture](../../src/backend/test/fixtures/apcs-2024-completion.json) as a plan: its 45 courses moved two years later (2026-1 to 2029-2, 11 terms, 10 to 20 credits each), with CS468 replaced by CS469 (in 2029-1) and CS470 (in 2029-2), so the one recorded APCS prerequisite can be broken. 46 placements. On the board as saved, the engine reports no violation and no flag, 46 `offering_terms_not_recorded` unknowns, and graduation `done`.

**The four edits** (test plan, performance procedure step 3). Each was checked against the rule engine with the seeded APCS 2024 curriculum on 24 November 2026 (`POST /api/plans/{id}/issues` with the edited board). Triết confirms them; nobody works them out again.

| Edit | Move | Keys after Space | Expected result drawn |
| --- | --- | --- | --- |
| V, valid placement | MTH346, 2028-1 → 2028-2 (18 → 14 and 10 → 14 credits) | ArrowDown ×1 | No `[data-test="issue-violation"]` and no `[data-test="issue-flag"]`; the same counts as the board as saved. |
| P, prerequisite violation | CS470, 2029-2 → 2028-3, before CS469 | ArrowUp ×2 | One `issue-violation`, `prerequisite_not_met` for CS470 in 2028-3; `tile-CS470` holds `tile-issue-violation`. |
| O, offering-term violation | CS420, 2028-1 → 2028-3 | ArrowDown ×2 | One `issue-violation`, `not_offered` for CS420 in 2028-3; `tile-CS420` holds `tile-issue-violation`. Needs CS420's offering terms set to `[1, 2]` first (PERF-01f). |
| C, credit-cap violation | CS163, 2026-2 → 2026-1 (20 → 24 credits, above APCS's 22) | ArrowUp ×1 | One `issue-flag`, `load_above_maximum` for 2026-1; `term-2026-1` holds `row-issue-flag`. The engine reports a cap breach as a flag, not a violation: it cites the petition route and never blocks (ADR 0012). |

Until the issue cards carry the issue code (open items below), the script finds P's and O's issue by the card's `issue-text`, which names the course. C's text names no term ("24 credits, above the maximum of 22. A petition can allow it."), and the term chip beside it has no `data-test`, so C is found by exactly one `[data-test="issue-flag"]` card and `row-issue-flag` inside `term-2026-1`. `tile-issue-*` and `row-issue-flag` are in the DOM but visually hidden (`sr-only`); the script reads the DOM, not the screen.

**Between runs.** Each run starts from the board as saved (performance procedure step 3). After each timed edit, press Ctrl+Z, and wait for the undo's report to be fresh with the saved board's counts before the next run. Undo is not timed. Before each series and after the last, `GET /api/plans/{id}` as Q must return the fixture's terms, and in each the `kind` and `courseCode` of its placements, in order (the answer also gives each placement `requirementGroupId` and `credits`, which the fixture does not have); if it does not, stop and reload them with `PUT /api/plans/{id}/placements`.

**Rate limit.** A run sends about five requests (the edit's save and check, the undo's save and check, and the lift's drop preview). The server allows 120 a minute from one address (ADR 0002), so pace the script at one run every 4 seconds or slower. A run that meets a 429 is void. On the save, the planner waits (2 s, 5 s, then 10 s) and sends again; on the check, it does not send again and shows `[data-test="issues-failed"]`, so the stop condition never holds. So a run is also void if it shows `issues-failed`, or if the stop condition does not hold within 20 s (longer than the save's three waits). For a void run, stop the series, record it, fix the pacing and rerun the series from its warm-ups, as the ADM run did.

**Network profile and running.** The same as [B1's PERF-01](test-cases-b1.md#4-tc-b1-perf-01-dashboard-and-audit-load-time): 10 Mbps down, 2 Mbps up, 50 ms round trip, no packet loss, through `Network.emulateNetworkConditions`, with no CPU throttling, and provisional until the team agrees the profile. A Playwright script in Chrome, headed and in the foreground, saved with its raw output in `docs/test/evidence/b2/`. Q is the only active user, and nothing else runs on the server. For each series, record every duration, then the median, p95 and maximum; warm-ups are recorded and not counted. For diagnosis only, save the server time of the edit's `PUT` and `GET` from Resource Timing (`responseStart - requestStart`), so Hoà and Triết can find a slow part.

| ID | Steps | Expected |
| --- | --- | --- |
| TC-B2-PERF-01a | **Fixture.** Hash the committed board: `git show <commit>:docs/test/evidence/b2/perf-01-plan.json \| sha256sum` (not the checked-out file, which a Windows `core.autocrlf` checkout changes). Sign in as Q, call `GET /api/users/me/transcript`, `GET /api/plans/{id}` and `GET /api/programs/APCS/curricula/2024`. Without the network profile, open the plan in the planner, and make each of V, P and C once by hand, pressing Ctrl+Z after each. | The checksum matches; the transcript has no row; the plan has the fixture's 46 placements; CS420 reads `"offeringTerms": null` (an earlier ADM run may have left it set: if so, run ADM-02c's clean-up first). The board as saved shows no violation or flag. Each edit draws its expected result, and Ctrl+Z brings back the saved board's counts. If a result is wrong, stop: that is a wrong validation result, not a slow one. File it against TC-B2-PLAN-01. |
| TC-B2-PERF-01b | **Profile.** Turn the profile on. Request `/api/health` 10 times, then the largest JavaScript file of the build, and note the times in **Network**. | As B1's PERF-01b: every health request takes at least 50 ms, and the file takes about its size divided by 1.25 MB/s. Record the settings and the Chrome version. |
| TC-B2-PERF-01c | **V.** In one browser context, with the plan open: 5 warm-up runs, then 30 measured runs of V. | All 30 runs under 300 ms, each with V's expected result. |
| TC-B2-PERF-01d | **P.** The same, with P. | All 30 runs under 300 ms, each with P's expected result. |
| TC-B2-PERF-01e | **C.** The same, with C. | All 30 runs under 300 ms, each with C's expected result. |
| TC-B2-PERF-01f | **O.** `{APCS}` and `{APCS24}` are in [ADM-02's values table](#tc-b2-adm-02-program-and-access-boundaries). *Setup:* as A1, `PUT /api/admin/programs/{APCS}/cohorts/{APCS24}/courses/CS420/offering-terms` with `{ "terms": [1, 2] }` (ADM-02's W), then reload the planner as Q. Run 5 warm-ups and 30 measured runs of O. *Clean-up:* as A1, ADM-02c's clean-up, and check that CS420 reads `"offeringTerms": null` in `GET /api/programs/APCS/curricula/2024`. Do not run it while an ADM case runs: ADM-02 and ADM-06 expect CS420's offering terms to be `null`. | After the setup, the board as saved shows 45 unknowns, not 46 (CS420's offering terms are now recorded) and still no violation. All 30 runs under 300 ms, each with O's expected result. The clean-up answers **200** with `"terms": null`. |

A run of 300 ms or more fails its case, whatever the average, and it stays in the report even if a rerun passes (performance procedure, step 4). The same cases run again in B3 with the same fixture.

**Open items before the run.**

1. *Hoà:* when live validation lands, confirm that the stop condition still marks "the current validation result rendered". If the browser draws a result before the server's report (ADR 0015's drag preview), decide with Triết which one the 300 ms covers. The test plan's row says the result the student sees for the edit, including debounce, network, API and rendering.
2. *Hoà:* give each issue card its code, for example `data-code="prerequisite_not_met"`, so that the script does not match message text.
3. *Triết:* confirm the four expected results above.

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
