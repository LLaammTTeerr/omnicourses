# B1 test cases

- Owner: Dũng
- Build: B1, 15 November 2026. Acceptance run 13–15 November ([test plan §8](test-plan.md#8-schedule-and-remaining-work)).
- Version: 0.2, 9 November 2026. Due 12 November.
- Parent checks: test plan §5, rows `TC-B1-USER-01`, `TC-B1-GUIDE-01`, `TC-B1-ACAD-01`, `TC-B1-ACAD-02`, `TC-B1-PLAN-01`, `TC-B1-DATA-01` and `TC-B1-AI-01` of [B1 checks](test-plan.md#b1-checks), and `TC-B1-COV-01`, `TC-B1-PERF-01` and `TC-B1-A11Y-01` of [Coverage and speed](test-plan.md#coverage-and-speed). Each case below has its parent's ID plus a letter, such as `TC-B1-USER-01a`. The tables shorten it to `USER-01a`.

Each case lists what to do and the result to expect. This file is not a test report: no case here has been run yet.

**Other B1 checks.** §7 writes out the cases for the other six B1 parents. `DATA-01` and `AI-01` are written from the code and tests on `main`. `ACAD-01`, `ACAD-02` and `COV-01` follow the rule engine of #72 and its ADR 0013, and `PLAN-01` the plans API of #71; Hoà, its owner, confirms PLAN-01's expected results before the run. Where a case needs data nobody has entered yet, it is blocked on an item of §6; the cases do not invent rule-engine outcomes. The B0 cases carried to B1 (UI-01a–q, DB-01f, DEP-01a–f and SESS-01l, [B0 report §5](report-b0.md#5-cases-carried-to-b1)) are in §8, with DB-01f written out.

**What exists on 9 November.** Merged on `main`: account export and deletion (#14, [ADR 0004](../analysis-and-design/adr/0004-account-export-and-deletion.md)), the transcript API (#29), the APCS and CLC curriculum seed (#36), the guides with their screens (#54), the curriculum read API (#65) and the onboarding API (#66, `GET` and `PUT /api/users/me/onboarding`). Open with CI green: the plans API (#71), the rule engine and degree audit (#72, `GET /api/users/me/audit`) and curriculum administration with prerequisites and offering terms (#74). No screen is merged except the home page and the guides: not onboarding, the dashboard, the grades page, the explorer, the planner or **Settings**. Steps that name a route use the merged code or the open PR they cite. Steps that name a screen label follow UC-01, UC-10, UC-14 and the [UI prototypes](../analysis-and-design/ui-prototypes/README.md). Dũng updates them when the code lands, by 12 November. A case whose feature is not in the B1 candidate is **not run: feature not merged** ([test plan §7](test-plan.md#7-when-a-build-is-ready)).

## 1. Before you start

**Where to test.** On staging, which Lâm sets up by 12 November ([B0 report §5](report-b0.md#5-cases-carried-to-b1)). If there is no staging server by then, run B1 locally against the real UI, API and database, and label every result **provisional** ([test plan §4](test-plan.md#4-test-environments-and-data)). The whole local run uses the network profile of §4 (10 Mbps down, 2 Mbps up, 50 ms round trip), not only PERF-01. DEP-01a–f then stay **blocked: no server yet**: a local run never passes them. PERF-01 never counts a localhost run without the network profile.

Local setup:

```bash
npm install
cp .env.example .env
npm run db:up
npm run build -w src/backend && npm run db:migrate -w src/backend
npm run db:seed            # APCS 2024 and 2025, CLC 2025 (#36), and the published guides
npm run dev:backend        # API on http://localhost:3000/api
npm run dev:frontend       # app on http://localhost:5173
```

**API and Screen.** Cases marked **API** use the Swagger page at `<API address>/api/docs`, as in [B0 cases §1](test-cases-b0.md#1-before-you-start). Cases marked **Screen** use the app in Chrome.

**Where the database cases run.** USER-01n, q, r, y and z use `psql`, and USER-01y and z change data: y sets `purge_after`, and z needs the backend restarted so the purge runs. DATA-01b and the manual run of DATA-01c edit the seeded curriculum and restore it, so they run on a local disposable database only, never on staging. Never run any of them on a database that holds real students (test plan §4).

- **On a local disposable database:** nobody's OK is needed.
- **On staging:** they need Lâm's OK and database access before they run (test plan §4). Lâm restarts the backend for USER-01z, or you wait up to an hour for the hourly purge.
- **DB-01f (§8):** runs on a local disposable database only.

**Test accounts.** Made-up `example.com` accounts only, all with password `correct horse battery` and display name `Test Student`:

| Name | Email | Used for |
| --- | --- | --- |
| S1 | `b1-s1@example.com` | Export, deletion and restoration |
| S2 | `b1-s2@example.com` | The other student, whose data must stay apart from S1's |
| S3 | `b1-s3@example.com` | Deletion after the deadline, and the purge |
| P | `b1-perf@example.com` | PERF-01 only |
| new | `b1-01@example.com` to `b1-09@example.com` | Cases that need a fresh account, each named in its case. `b1-06` holds the audit cases of §7, `b1-07` and `b1-08` ACAD-02d and e, and `b1-09` PLAN-01f. |

**Synthetic transcripts.** USER-01 saves these with `PUT /api/users/me/transcript`. Codes starting with `ZZ` are in no curriculum, so nobody mistakes them for real records. The audit should list them as not counted; USER-01 does not check that.

S1 (and S3):

```json
{ "rows": [
  { "courseCode": "ZZ101", "courseName": "Synthetic Course One", "credits": 4, "result": "graded", "grade": 8.5, "term": { "year": 2024, "number": 1 } },
  { "courseCode": "ZZ102", "courseName": "Synthetic Course Two", "credits": 2, "result": "pass", "grade": null, "term": { "year": 2024, "number": 3 } },
  { "courseCode": "ZZ103", "courseName": "Synthetic Course Three", "credits": 3, "result": "in_progress", "grade": null, "term": { "year": 2025, "number": 1 } }
] }
```

S2:

```json
{ "rows": [
  { "courseCode": "ZZ201", "courseName": "Synthetic Course Other", "credits": 4, "result": "graded", "grade": 7.0, "term": { "year": 2025, "number": 1 } }
] }
```

**Database queries.** Replace `<id>` with the account's `id`.

The user tables, and the rows one account owns in each (the same tables the export reads, ADR 0004). In `psql`, `\gexec` runs each generated query:

```sql
SELECT format('SELECT %L AS "table", count(*) FROM %I WHERE user_id = %L', cl.relname, cl.relname, '<id>')
FROM pg_constraint c
JOIN pg_class cl ON cl.oid = c.conrelid
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
WHERE c.contype = 'f' AND c.confrelid = 'users'::regclass AND c.conrelid <> 'users'::regclass
  AND c.conparentid = 0 AND cardinality(c.conkey) = 1 AND a.attname = 'user_id'
ORDER BY cl.relname \gexec
```

The shared curriculum data, which no account owns:

```sql
SELECT (SELECT count(*) FROM programs) AS programs, (SELECT count(*) FROM curriculums) AS curriculums,
       (SELECT count(*) FROM requirement_groups) AS groups, (SELECT count(*) FROM courses) AS courses,
       (SELECT count(*) FROM requirement_group_courses) AS links;
```

**Rate limits.** Sign-up, sign-in and account deletion each accept 10 requests a minute from one address (`PASSWORD_LIMIT` in `auth/rate-limits.ts`; ADRs 0002 and 0004). Every other route accepts 120 (`THROTTLERS`, same file; ADR 0010). Each limit counts per route: sign-up and sign-in each get their own 10. Wait a minute between batches, or a case fails with 429 for the wrong reason.

**Recording results.** As in [B0 cases §1](test-cases-b0.md#1-before-you-start): case ID, result (**passed**, **failed**, **blocked** or **not run**, with the reason for the last two), build tag and commit, browser and version, and the screen width for screen cases. A11Y-01 also records the language and theme; PERF-01 records every timing. Evidence goes in `docs/test/evidence/b1/`. Never record a token, a password or a password hash.

## 2. TC-B1-USER-01: Onboarding and account privacy

Sources: [UC-01][uc01] steps 2 and 5–9, A5–A9 and §7; UC-14 A2, A4 and A5 (PA2 use-case specification); ADRs 0002 and 0004; Vision §6 Security, Privacy and Recovery.

### Onboarding

Run as **Screen**. After each case, read what was stored through the onboarding API as well.

| ID | Do this | Expect |
| --- | --- | --- |
| USER-01a | Sign up with a new account `b1-01@example.com`. | Onboarding starts at once with the program question (UC-01 step 6), not the dashboard. It never asks for a school-portal password, a student ID or a real name. |
| USER-01b | Open the faculty, program and cohort lists. | They offer exactly the B1 list (§6, item 1) and nothing else. There is no free-text entry, and no cohort the curriculum data lacks, such as APCS 2023. |
| USER-01c | Choose APCS, cohort 2024. Leave the target graduation term, credits per term and internship term empty, and press **Finish**. Reload. Then sign in as the same account in a second browser. | The dashboard opens (UC-01 step 10). In the second browser, signing in opens the dashboard, not onboarding (UC-01 A5 step 3). Both browsers show APCS 2024. The three goal fields are unset: the API returns `null` for each and the screen says they are not set. None is filled with a default, such as 18 credits or a guessed term. |
| USER-01d | In **Settings**, set the target graduation term to 2027–2028 term 2, credits per term to 18 and the internship term to 2027–2028 term 1. Save and reload. | All three come back unchanged. The terms are stored as `{ "year": 2027, "number": 2 }` and `{ "year": 2027, "number": 1 }` ([ADR 0009](../analysis-and-design/adr/0009-term-encoding.md)). |
| USER-01e | Set credits per term to 23, save and reload. Then set it to 9, save and reload. | 23 is saved and comes back as 23, then 9 as 9. No message about the credit cap and no silent change to 22 or 10, APCS's caps (§6 item 2): the rule engine applies the cap when a plan is built, not onboarding (UC-01 §7). |
| USER-01f | Set credits per term to `-1`, then `2.5`, then `abc`, saving each time. Then clear the field and save. | Each of the three is refused with a message at the field that says what a valid value is, without citing the credit cap, and the earlier value stays. Once cleared, the field is unset (`null`). |
| USER-01g | Set credits per term to `0` and save. Then set it to `40` and save. | `0` is refused as in USER-01f, with no message about the credit cap, and the earlier value stays (§6 item 2). `40` is saved and comes back as 40: onboarding has no upper limit. |
| USER-01h | Set the internship term to **None planned**. Save and reload. Then clear it and save. | After reload it shows **None planned**, and the API keeps it apart from unset. After clearing it is unset (`null`). |
| USER-01i | Change the program and cohort from APCS 2024 to APCS 2025 in **Settings**. Reload and open the dashboard. | Saved. The dashboard and the explorer use the 2025 curriculum (`APCS2025`), and `GET /api/users/me/audit` (#72) returns `curriculumCode` `APCS2025`. The goal fields are unchanged. This case also counts for TC-B1-ACAD-01's cohort selection. |
| USER-01j | Needs basic plans (TC-B1-PLAN-01). With a new account `b1-02@example.com` onboarded to APCS 2024, save a plan. Change the cohort to 2025, then open the plan. | The plan still uses the 2024 curriculum it was made with (UC-14 A2, Vision §6 Data). If plans are not in the candidate: **not run: feature not merged**. |
| USER-01k | With a new account `b1-03@example.com`, choose **My program isn't listed** at the program question (UC-01 A7). Open **Guides**, then the dashboard. Sign out and sign in again. | The screen says only the listed programs are supported in this release. No program is saved. Guides open normally. The dashboard asks the student to finish onboarding, with a link to it: no error, and no audit worked out without a program. After signing in again, onboarding opens. |
| USER-01l | With a new account `b1-04@example.com`, choose a program and cohort, then close the tab before the planning-goal question. Sign in again. | Onboarding resumes at the planning-goal question, with the program and cohort kept (UC-01 A8). |
| USER-01m | **API.** Call each onboarding route without a token, then with S2's token. If a route takes a user id in its path or body, send S1's id with S2's token. | Without a token: **401**. With S2's token: only S2's own answers. With S1's id: refused like an unknown id, and S1's answers are unchanged when read with S1's token. |

### Password storage, privacy notice and consent

These rerun TC-B0-AUTH-01's storage and consent checks on the B1 candidate. AUTH-01c (no account without consent) runs again as part of the B0 regression and is not repeated here.

| ID | Do this | Expect |
| --- | --- | --- |
| USER-01n | Sign up as S1. In `psql`: `SELECT password_hash FROM users WHERE email = 'b1-s1@example.com';`. Then search a data dump and the backend log for the password: `pg_dump --data-only <database> \| grep -c "correct horse battery"`, and the same `grep` on the log. | The hash starts with `$argon2id$`. Neither the dump nor the log contains the password. |
| USER-01o | Look at the response bodies of sign-up, sign-in, refresh, `GET /api/users/me`, `GET /api/auth/sessions`, every onboarding route and `GET /api/users/me/export`. | None has a key named `password`, `passwordHash` or `password_hash`, and none contains the hash from USER-01n. |
| USER-01p | **Screen.** On **Sign up**, open the privacy-notice link beside the consent box. Read it in Vietnamese and in English. | It opens without signing in. It states: what is stored (account, onboarding answers, transcript, plans, sessions, AI usage counts, consent time); that the data is kept until the student deletes the account; that a deletion takes effect after 30 days, and signing in before then cancels it (ADR 0004); how long backups keep data after a purge (Vision §6 Recovery says 7 days; item 9 of §6 below); and how to export or delete the account. The 30 days match `ACCOUNT_DELETION_GRACE_DAYS` on the server under test. |
| USER-01q | Note the time. Sign up as a new account `b1-05@example.com`. In `psql`: `SELECT consent_at FROM users WHERE email = 'b1-05@example.com';`. | `consent_at` is within a minute of the sign-up. |

### Export

Prepare: S1 has finished onboarding with all three goal fields set, has saved the S1 transcript of §1, and is signed in on two browsers, so it has at least two sessions. If plans are in the candidate, S1 also has one plan. S2 has finished onboarding and saved the S2 transcript.

| ID | Do this | Expect |
| --- | --- | --- |
| USER-01r | **API.** As S1, call `GET /api/users/me/export`. Then run the user-table query of §1 for S1's id. | **200**, sent as a download named `omnicourse-account.json`. `user` holds S1's id, email, display name and `consent_at`. `tables` has a key for each table the query lists, each with as many rows as the query counts. The onboarding answers appear with the values from Prepare, in `user` or `tables` depending on where onboarding stores them. `tables` also holds the 3 transcript rows and at least 2 sessions. |
| USER-01s | Search the S1 file for credentials. | No key, at any depth, ends in `_hash`, `_token`, `_secret`, `_key`, `_password` or `_sub`, or their camelCase forms (`passwordHash`, `tokenHash`, …). The file does not contain S1's `password_hash`, any `token_hash` from `sessions`, or the bearer token used for the request. |
| USER-01t | Search the S1 file for S2. | S2's id, email and `ZZ201` appear nowhere. |
| USER-01u | **Screen.** As S1, open **Settings** and press **Export my data**. | The browser saves a JSON file with the same tables and row counts as USER-01r. |

### Deletion, restoration and purge

| ID | Do this | Expect |
| --- | --- | --- |
| USER-01v | **API.** As S1, call `DELETE /api/users/me` with `{"password": "not the password"}`. Then `GET /api/users/me`. | **403** "Wrong password". S1 is still signed in (**200**), and `deletion_requested_at` is still null. |
| USER-01w | Export S1 and keep the file as E1. With S1 signed in on browsers A and B, in A open **Settings**, press **Delete account** and confirm with the password. Then use B. Then sign up again with `b1-s1@example.com`. Then call `GET /api/users/me` with S2's token. | The dialog explains the 30-day grace period before asking for the password. The API answers **202** with `purgeAfter` 30 days after the request, to the minute, and `purge_after` in the database is the same time. A shows the sign-in screen; B's next request gets **401** and B shows the sign-in screen too. Sign-up: **409**. S2: still **200**. |
| USER-01x | Before the deadline, sign in as S1. Export again and keep the file as E2. | **200** with `accountRestored: true`, and the screen says the account was restored. `deletion_requested_at` and `purge_after` are null. E2 matches E1 except `exportedAt`, `user.updated_at` and the `sessions` rows: the onboarding answers, transcript rows and plans are unchanged. |
| USER-01y | Sign up as S3, finish onboarding and save the S1 transcript of §1. Delete the account with the password. In `psql`: `UPDATE users SET purge_after = now() - interval '1 minute' WHERE email = 'b1-s3@example.com';`. Sign in as S3, then as `nobody-b1@example.com`, which was never registered. | Both sign-ins answer **401** with identical bodies: "Invalid email or password". S3's `users` row still exists: the purge has not run yet. The hourly purge can run between the `UPDATE` and this check. If S3's row is already gone, record that and run USER-01y again with S3 signed up afresh: that is not a failure. |
| USER-01z | Note S3's id, and run the shared-data query and the user-table query for S2. Restart the backend: the purge runs at start-up. Run the user-table query for S3 and for S2, and the shared-data query again. Then sign up as `b1-s3@example.com` and export. | The backend log says "Purged 1 account(s) after the deletion grace period". S3 has no `users` row and 0 rows in every user table. S2's counts and the shared counts are as before. The new sign-up answers **201**, and its export holds nothing from the old account. |

Already automated: `auth.service.spec.ts` covers n (argon2id) and q (consent time). `account.e2e-spec.ts` covers r and s (every user table, no secret column), t (only owned rows), v (403 keeps the session), w and x (deletion signs out everywhere; signing in restores), y (refused after the deadline) and z (only due accounts are purged, with their rows). `account.service.spec.ts` checks that a later change of the grace setting does not move a stored deadline. Manual runs still run these on the candidate, with the screens and with real onboarding and transcript rows.

The test plan's USER-01 also carries the guide search and browse outcomes. They are tested and counted once, as GUIDE-01b–d below.

## 3. TC-B1-GUIDE-01: Public guides

Sources: [UC-10](../requirements/use-cases/UC-10-follow-a-school-task-guide.md) steps 1–7, A1, A2 (task groups only), A5 (the 6-month rule only) and A8; [guides plan](../requirements/guides-plan.md) §2–§6; [ADR 0010](../analysis-and-design/adr/0010-public-pages-and-guide-content.md); AGENTS.md hard rules 1–3. The B1 guides are G01, G02, G06 and G07. Program values (A3), a plan's courses (A4), **Report a problem** (A6) and **Suggest a guide** are B3 (TC-B3-GUIDE-01), and B1 must not show them half built.

Run GUIDE-01a–h on a database seeded with the published guides only. Then load the test-only guides below and run GUIDE-01i–o.

**Test-only guides.** Synthetic guides for cases the real batch cannot reach. They are loaded into the test database only, with `npm run db:seed -w src/backend -- --guide-fixtures` (`src/backend/src/guides/testing/guide-fixtures.ts`); seeding again without the flag withdraws them. They never go into the published content folder. Each title contains its ID, so a search finds it. D is the test day in Vietnam time (UTC+7).

| Test guide | Languages | Status | Last checked |
| --- | --- | --- | --- |
| `zz-fresh` | VI, EN | published | D |
| `zz-six-months` | VI, EN | published | D minus 6 calendar months: 13 May 2026 for a run on 13 November 2026 |
| `zz-six-months-and-a-day` | VI, EN | published | One day before that: 12 May 2026 |
| `zz-vi-only` | VI | published | D |
| `zz-en-only` | EN | published | D |
| `zz-draft` | VI, EN | draft | D |
| `zz-withdrawn` | VI, EN | withdrawn | D |

### Content, browsing and search

| ID | Do this | Expect |
| --- | --- | --- |
| GUIDE-01a | Open the content files of G01, G02, G06 and G07 in both languages, and the pull request that published each. | Every required field of guides plan §2 is filled in. Status is published, with a version and a change note. **Last checked** gives a date and the name of the team member who followed the guide on the real portal (guides plan §6 step 2). The PR is approved by someone other than its author. The text states no academic rule value: no credit numbers and no pass marks; G02 says the credit cap depends on the program and cites the clause. It gives no date that changes every term, and quotes the portal's labels. Screenshots show no real name, student ID or grade. No step sends a portal password anywhere but the portal, and no step uses a script, bookmarklet or browser extension. |
| GUIDE-01b | **Screen.** In a private window, signed out, open **Guides**. | The four guides, under their groups: Accounts and portals (G01), Registration (G02), Tuition and fees (G06), Records and certificates (G07). Each entry shows the task, the portal, the account it needs and the direct link. |
| GUIDE-01c | Type each query of the table below into the search box: first with the screen in Vietnamese, then in English. | Each lists exactly the expected guides, and the list narrows as you type. No error. |
| GUIDE-01d | Search for `xyzzy`. Then clear the box. | The page says no guide covers it yet and shows the task groups to browse (A2). There is no **Suggest a guide** and no advisor link (B3). Once cleared, all four guides are back. |

Search queries for GUIDE-01c. The expected guides follow the keywords in the content files: a pull request that changes a guide's keywords updates this table too.

| Query | Expected guides |
| --- | --- |
| `học phí` | G06 |
| `hoc phi` | G06 |
| `HỌC PHÍ` | G06 |
| `  hoc   phi  ` (spaces around and between) | G06 |
| `học phí` as decomposed Unicode: run `copy('học phí'.normalize('NFD'))` in the DevTools console, then paste | G06 |
| `hoc ph` (not finished) | G02 and G06: "học phần" starts the same way |
| `tuition` | G06 |
| `đăng ký học phần` | G02 |
| `dang ky hoc phan` | G02. `đ` must match `d`: removing accents alone leaves `đ`, so this catches a common bug. |
| `ĐĂNG KÝ` | G02 |
| `dkhp` | G02 |
| `register` | G02 |
| `bảng điểm`, `bang diem`, `transcript` | G07 |
| `tài khoản`, `tai khoan` | G01 |
| `%`, `_`, `'`, `\` (one at a time) | None, with the A2 message. Not every guide, and no error. |
| 500 letters `a` | None, with the A2 message. No error. |
| Empty | All four |

### Reading a guide

| ID | Do this | Expect |
| --- | --- | --- |
| GUIDE-01e | Open G02 signed out. Then sign in as S1, whose onboarding is finished, and open it again. | The guide shows everything in UC-10 step 5: what the task is for and who needs it; when to do it, with a link to the school's announcement; what to prepare; the portal and the account; numbered steps; notes with their source; the version; and the last-checked date. The credit-cap note says the value depends on the program and cites the clause, with no number (A3 is B3). Signed in, the guide is the same: no program value, no plan courses, no **Report a problem**. |
| GUIDE-01f | In each B1 guide, inspect **Open** *portal name* and the direct link in the list (A1), then press each. | Each is an ordinary link (`<a href>`) whose address is exactly the one in the content file, with no query parameter added by OmniCourse. It opens in a new tab, and its `rel` includes `noopener`. The page that opens is the portal page the guide names; record who checked and when. The OmniCourse tab stays where it was. |
| GUIDE-01g | Copy a guide's address, such as `/guides/register-courses`. Open it in a new private window, then reload. Then open `/guides/no-such-guide`. | The guide opens directly, signed out, and again after the reload. The unknown address shows a "guide not found" page with a link to **Guides**, and its API request answers **404**. |
| GUIDE-01h | On the list and on a guide, switch the language between Vietnamese and English. | Titles, group names and the guide text change language. The version and date stay the same, written in the format of the chosen language. The address does not change. |
| GUIDE-01i | Load the test-only guides. Open `zz-vi-only` with the screen in English, and `zz-en-only` with it in Vietnamese. Search for each by its ID in both languages. | Each shows the language it has, with a note that it exists only in that language (A8): not a blank page and not "not found". Search finds each in both languages. |
| GUIDE-01j | Open `zz-fresh`, `zz-six-months` and `zz-six-months-and-a-day`. | Each shows the version and last-checked date of its file. Only `zz-six-months-and-a-day` warns that the portal may have changed, giving the date, and it stays fully readable (A5). The boundary is §6 item 8. |
| GUIDE-01k | Search for `zz-draft` and `zz-withdrawn`. Open `/guides/zz-draft` and `/guides/zz-withdrawn`. | Neither is listed or found. Both show the same page and API answer as the unknown guide of GUIDE-01g. |

### Privacy and public routes

| ID | Do this | Expect |
| --- | --- | --- |
| GUIDE-01l | Signed out, with DevTools **Network** open, browse, search and open each B1 guide. Look at every request to the guide API. Sign in as S1 and repeat; compare the response bodies. | Signed out, no request carries an `Authorization` header, and the responses hold only guide content: no email, display name, program, cohort, transcript or plan. Signed in, the guide responses are identical to the signed-out ones, since B1 guides have no personal parts. No guide page shows the student's name. |
| GUIDE-01m | On each guide page, run `document.querySelectorAll('input[type=password]').length` and `document.querySelectorAll('form').length` in the console. Watch **Network** while reading the guide and pressing its links. | No password field, and no form that sends anything to a portal. OmniCourse itself sends no request to a portal address: the only portal traffic is the new tab the student opened. G01 tells the student never to give their portal password to anyone, OmniCourse included. |
| GUIDE-01n | **API.** Without a token, call every guide route in the OpenAPI document. Rerun DB-01e of B0 on the B1 candidate. Read `PUBLIC_ROUTES` in `src/backend/test/public-routes.e2e-spec.ts`, and the PR that added the guide routes. | Each guide route answers **200** (**404** for an unknown guide). All of them are `GET`: the document has no write route for guides. Every other route answers **401** except health, sign-up and sign-in. `PUBLIC_ROUTES` adds exactly the guide routes to those three, in the same PR as the routes, and the test passes in CI on the candidate. |
| GUIDE-01o | Without a token, send 121 requests to the guide list within one minute. Wait a minute and send one more. On staging, while tester X's requests are being refused, tester Y on another network opens **Guides**. | Requests 1–120: **200**. Request 121: **429**. After the minute: **200**. Y sees the guides. If Y gets **429**, the limit counts staging's proxy instead of each reader ("trust proxy", ADR 0002 and ADR 0010): file a defect. |

Already automated: `src/frontend/src/guides/search.spec.ts` runs every query of GUIDE-01c's table against synthetic guides (`đ` and `d`, decomposed Unicode, letter case, spaces, and `%`, `_`, `'` and `\` as plain text). `src/backend/src/guides/out-of-date.spec.ts` checks the out-of-date rule with fixed dates, including a time between 00:00 and 07:00 in Vietnam, when the UTC date is still the day before. `src/backend/test/guides.e2e-spec.ts` covers k (draft, withdrawn and unknown guides get the same 404) and l (the signed-in answer equals the signed-out one). `public-routes.e2e-spec.ts` covers GUIDE-01n's 401 and allow-list checks.

## 4. TC-B1-PERF-01: Dashboard and grades load time

Sources: Vision §6 Performance; test plan §5, [Coverage and speed](test-plan.md#coverage-and-speed) and [Performance procedure](test-plan.md#performance-procedure); UC-03 and UC-15 special requirements.

**Which pages.** The dashboard is UC-03 (`dashboard.html` in the prototypes). The audit is UC-15, the grades page (`audit.html` in the prototypes). Each is timed and reported on its own. Triết confirms this reading (§6 item 6).

**Fixture.** Thắng supplies a versioned synthetic transcript of 40 courses for one APCS cohort, and Triết reviews the dashboard and grades values it should produce (§6 item 5). Record its commit, SHA-256 checksum, row count, number of terms and the expected values. Account P is onboarded to the fixture's cohort and has the fixture saved with `PUT /api/users/me/transcript`. During timing, P is the only active user and nothing else runs on the server.

**Network profile.** Proposed in the [performance procedure](test-plan.md#performance-procedure): 10 Mbps down, 2 Mbps up, 50 ms round trip, no packet loss. Apply it in Chrome through the DevTools Protocol, with `Network.emulateNetworkConditions` and `{ "offline": false, "latency": 50, "downloadThroughput": 1250000, "uploadThroughput": 250000 }` (bytes per second). No CPU throttling. If the team has not agreed the profile by the run (§6 item 7), label the results provisional.

**When a page counts as loaded.** For a page load, the clock starts at navigation start (`performance.timeOrigin`). For an in-app open, it starts at the click. It stops at the first frame where every expected fixture value is on screen and no loading indicator is left (`aria-busy="true"` or a spinner). The script reads the values themselves, not a flag the app sets. Hoà gives each expected figure a stable selector (§6 item 6).

**Running.** A Playwright script in Chrome, headed and in the foreground, saved with its raw output in `docs/test/evidence/b1/`. For every series, record each duration, then the median, p95 and maximum. Warm-ups are recorded but not counted. For every timed run, also save the server time of each API request (DevTools **Timing**, "Waiting for server response") so Triết and Hoà can find a slow part. These diagnostic times never pass or fail a run. The pages only read, so the fixture stays as loaded; check its checksum again after the last series.

| ID | Do this | Expect |
| --- | --- | --- |
| PERF-01a | Check the fixture: its checksum, and `GET /api/users/me/transcript` as P. Without the network profile, open the dashboard and the grades page. | The checksum matches, the API returns 40 rows, and both pages show every expected value. If a value is wrong, stop: that is a wrong academic result, not a slow one. File it against TC-B1-ACAD-01. |
| PERF-01b | Turn the profile on. Request `/api/health` 10 times, then the largest JavaScript file of the build, and note the times in **Network**. | Every health request takes at least 50 ms. The file takes about its size divided by 1.25 MB/s. The profile reaches the app's traffic. Record the settings and the Chrome version. |
| PERF-01c | Dashboard, cold cache, 5 runs. For each run, open a new browser context, sign in as P (not timed), clear the cache with `Network.clearBrowserCache`, then load the dashboard's address. | All 5 runs under 2 seconds, with every expected value. |
| PERF-01d | Dashboard, warm cache. In one context, 5 warm-up reloads, then 30 measured reloads. | All 30 runs under 2 seconds, with every expected value. |
| PERF-01e | Dashboard, in-app. From **Guides**, press **Dashboard** in the sidebar, then go back to **Guides**. 5 warm-ups, then 30 measured runs. | All 30 runs under 2 seconds, with every expected value. |
| PERF-01f | The grades page, as PERF-01c. | All 5 under 2 seconds, with every expected value. |
| PERF-01g | The grades page, as PERF-01d. | All 30 under 2 seconds, with every expected value. |
| PERF-01h | The grades page, as PERF-01e. | All 30 under 2 seconds, with every expected value. |

A run of 2 seconds or more fails its case, whatever the average, and it stays in the report even if a rerun passes (performance procedure, step 4). The same cases run again in B2 and B3 with the same fixture.

## 5. TC-B1-A11Y-01: Keyboard, languages, widths and contrast

Sources: Vision §6 Usability; test plan §5, [Coverage and speed](test-plan.md#coverage-and-speed); usability notes in UC-01 §7, UC-03 and UC-10 §7; WCAG 2.1 success criteria 1.4.3 (text contrast) and 1.4.11 (non-text contrast), both level AA.

**Screens and states.** Test every screen of the B1 candidate in each state below, in every theme it has. A screen whose feature is not in the candidate is **not run: feature not merged**.

| Screen | States |
| --- | --- |
| Home, signed out | API ok; API degraded |
| Sign up | Empty; each field error; consent missing; email taken; too many attempts; server unreachable |
| Sign in | Wrong password; too many attempts; account restored |
| Privacy notice | |
| Onboarding | Program and cohort; program not listed; planning goal |
| Dashboard (UC-03) | No transcript; the PERF-01 fixture; a group opened; needs-attention items; a course not counted |
| Grades (UC-15) | The PERF-01 fixture; a filter with no results |
| Explorer (UC-04) | Groups; search with no results; course drawer; prerequisite graph |
| Plans (PLAN-01) | No plans; several plans; course added to and removed from a term; save failed |
| Guides | List; search results; no results; a guide; out-of-date warning; one-language note; not found |
| Settings (UC-14) | Profile and goal; a field error; sessions; export; delete dialog; wrong password |
| Session expired | Back on sign-in |

| ID | Do this | Expect |
| --- | --- | --- |
| A11Y-01a | List the routes in `src/frontend/src/router.ts` on the candidate and compare them with the table above. | Every route is in the table; add any missing one before the run. Record which screens the candidate has. |
| A11Y-01b | At 1280 px, without the mouse, do these journeys: (1) sign up, onboard, reach the dashboard; (2) open a group on the dashboard, go to the grades page, filter it; (3) in the explorer, search for a course, open its drawer, close it, and find its prerequisites in the graph or its keyboard alternative; (4) create a plan, add a course to a term, remove it; (5) in **Guides**, search, open a guide and open its portal link; (6) in **Settings**, change credits per term, revoke a session, export, then open the delete dialog and cancel it; (7) sign out. | Every journey can be finished by keyboard alone. Tab order follows the visual order, focus is always visible, and focus never gets stuck. A skip link jumps to the main content. Dialogs and drawers take focus when they open, keep it inside, close with Esc and give it back to the control that opened them. Option cards and switches work with Space and Enter. Nothing needs hover or dragging. |
| A11Y-01c | In DevTools, turn on the device toolbar with a height of 800 px. For every screen and state, set the width to 360, 768, 1280 and 1920 px, and to each breakpoint of the built CSS (`grep -oh "@media[^{]*" src/frontend/dist/assets/*.css \| sort -u`), both at its value and 1 px on the other side. At each width, run `document.documentElement.scrollWidth <= innerWidth` in the console. | `true` every time: the page never scrolls sideways. Nothing overlaps or is cut off, and every control can be seen and used. Wide content, such as the graph, scrolls inside its own box, not the page. Record the widths tested. |
| A11Y-01d | On every screen and state, switch the language from Vietnamese to English and back. Reload. | Every label, button, placeholder, error (including errors the API returns), empty state, message, page title and `aria-label` changes language, and `<html lang>` becomes `en` or `vi`. Nothing stays in the other language except course codes and data that exists in one language only (a guide's A8 note, and program names with no English name, §6 item 11). Dates and numbers follow the chosen language. After the reload the language is remembered (UC-14 A6). |
| A11Y-01e | Run axe-core, its version recorded, with tags `wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa` on every screen and state, at 360 and 1280 px, in each theme. Save its JSON output. | No `color-contrast` violation. File any other violation as a defect; only contrast decides this case. |
| A11Y-01f | Measure by hand what axe-core cannot, with the DevTools colour picker or a contrast checker, in each theme: text over images or gradients; placeholder text; the group colours and glyphs; chart segments; status labels; the out-of-date warning; hover and selected states; focus indicators; field borders, checkboxes and switches. | Text is at least 4.5:1 against its background, or 3:1 for large text (24 px, or 18.66 px bold). Focus indicators, control borders, chart segments and glyphs that carry meaning are at least 3:1 against what they sit on (1.4.11). Disabled controls are exempt. Record each pair: colours, measured ratio and required ratio. |
| A11Y-01g | On sign-up, onboarding, the dashboard, the grades page, the explorer and **Settings**, look for meaning shown by colour alone. | Every status and error is also given in words or a glyph: each requirement group has its glyph, a course says passed, in progress or planned in words, and field errors are written out (UC-03 special requirements). |

B0's UI-01m–o check the keyboard, language and widths of sign-up and sign-in. If they run on the same B1 candidate, their evidence covers those two screens here too, recorded under both IDs and not counted twice for a parent.

## 6. Inputs still needed

Until an item is answered, the cases it affects stay **blocked** with the item as the reason.

| # | Needed | From | Cases |
| --- | --- | --- | --- |
| 1 | The faculty, program and cohort lists onboarding offers in B1. The seed has APCS 2024 and 2025 and nine CLC 2025 programs, all with `faculty` null, so a faculty question has nothing to list. B1's scope is the verified APCS curriculum: are the CLC rows offered? **Decided (Lâm, 9 November 2026):** B1 onboarding offers only APCS, cohorts 2024 and 2025. The CLC rows stay in the database but are not offered until their curricula are verified. While no program has a faculty, onboarding skips the faculty question and lists the programs directly. | Triết (data), Lâm (scope) | USER-01b |
| 2 | **Decided (9 November 2026, [ADR 0012](../analysis-and-design/adr/0012-credit-caps-by-training-type.md)):** the credit caps depend on the program's training type (QĐ 1175/QĐ-KHTN Điều 7.2). APCS is a Tiên tiến program: 10–22 credits in every one of its three main terms a year, so its term number 3 is a main term, not a summer term (ADR 0009 as amended). Đại trà programs have 14–25 in a main term and at most 12 in a summer term. This replaces the earlier 14–25 and 12 for every program (Vision §4): the prototypes' 10–22 (`ui-prototypes/assets/data.js:152`), which their onboarding and settings slider also use, is right for APCS and is not a bug. Onboarding stores the requested credits without applying any cap (test plan TC-B1-USER-01, UC-01 §7). **Decided (Lâm, 9 November 2026):** credits per term is a whole number of 1 or more. 0 is refused like the values in USER-01f, and there is no upper limit: the rule engine applies the caps when a plan is built. | Lâm (UC-01), Hoà (screens) | USER-01e, USER-01f, USER-01g |
| 3 | **Decided (Lâm, 9 November 2026):** `GET /api/users/me/onboarding` reads the student's answers and `PUT /api/users/me/onboarding` saves them. A goal left empty is stored as `null` (not set). An internship term of "none planned" is stored as `'none'`, never `null`, so it stays distinct from not set. | Lâm | USER-01c–h, USER-01m |
| 4 | **Decided (Lâm, 9 November 2026):** from the current term (by the Vietnam date, terms as in ADR 0009) up to 8 academic years ahead. Past terms are refused. | Lâm | USER-01d |
| 5 | The 40-course fixture with its checksum and cohort, and the reviewed dashboard and grades values it should show | Thắng (fixture), Triết (values) | PERF-01, A11Y-01 dashboard states |
| 6 | Confirm the pages PERF-01 times as audit and dashboard, and a stable selector for each expected figure | Triết (UC-03, UC-15), Hoà (screens) | PERF-01 |
| 7 | **Decided (Lâm, 9 November 2026):** the test plan §5 profile for every build: 10 Mbps download, 2 Mbps upload, 50 ms round trip, no packet loss. | Lâm, Triết, Hoà | PERF-01 |
| 8 | **Decided (Lâm, 9 November 2026):** the rule UC-10 A5 states and `guides/out-of-date.ts` implements. Count calendar months on the Vietnam date. A guide checked exactly 6 months ago is still fresh; one day more and it is out of date. A day the target month lacks becomes its last day (31 August + 6 months = end of February). | Lâm (Dũng asks) | GUIDE-01j |
| 9 | **Decided (Lâm, 9 November 2026):** a public `/privacy` page in Vietnamese and English, linked beside the consent box on **Sign up**. It states that backups start in B2 and are kept 7 days (Vision §6), so B1 promises no backup it does not have yet. | Lâm | USER-01p |
| 10 | Each B1 guide followed on the real portal by a team member, with the date | Dũng, plus a second team member | GUIDE-01a, GUIDE-01f |
| 11 | What English mode shows for a program with no English name. Every seeded program has `name_en` null. **Decided (Lâm, 9 November 2026):** the Vietnamese name, the same fallback the guides use for a missing translation. | Triết | USER-01b, A11Y-01d |
| 12 | The staging address, the deployed commit and the B1 tag. **Decided (Lâm, 9 November 2026):** staging runs with `NODE_ENV=production`, like production. So the synthetic `zz-*` guides (`--guide-fixtures`) are refused there and their cases run on a local test database. | Lâm | All |
| 13 | The academic rules behind ACAD-01 and ACAD-02: the pass mark, how `pass`, `fail` and `exempt` count, retakes, allocation between groups, and the output of a cap violation. **Decided (ADR 0013 in #72, accepted on 9 November 2026 with Lâm as decider; Triết reviews it there):** 5.0 passes (Điều 11.4); `pass`, `fail` and `exempt` enter no average, and `exempt` and `pass` count their credits (Điều 13.3); the last completed attempt is official (Điều 14); surplus (A) tự chọn credits count for (C), and a course counts in one group only; a violation is a rule code with its citation and petition note, not fixed wording. If #72 changes one before it merges, Dũng updates §7. **Completion fixture: built, awaiting Triết's review.** [`src/backend/test/fixtures/apcs-2024-completion.json`](../../src/backend/test/fixtures/apcs-2024-completion.json), SHA-256 `d0a0493f2fe62da8b070d853392100a9f47babac789f2c099ed69ccfdf3facde`. It is the exact `PUT /api/users/me/transcript` body: 45 synthetic rows over 12 terms, 2024-1 to 2027-3, laid out by `apcs-2024.teaching-plan.ts`. Names and credits are the catalog's. Terms from 2026-3 on are in the future; the audit does not read the date. The rows: all ten (A) bắt buộc courses; CS251, CS252, CS311 and CS420 for (A) tự chọn (16, no overflow); the nine Non Computer Science courses (26); BAA00021, BAA00022 and BAA00030 as `pass`; Math (16) and Physics (12); MTH253 and MTH346 for (B) (8); nine (C) courses (36); and CS468 (10). Every other row is `graded` and passed. 164, not 163, is the least the electives reach: they are 4 credits each, so (B) + (C) ≥ 43 takes 44. Expected, worked out by hand: every group and **Kiến thức tự chọn** `met` (44 of 43); `credits` `{ accumulated: 172, towardTotal: 164, inProgressTowardTotal: 0, totalRequired: 163, remaining: 0, yearLevel: 4 }`; `gpa` `{ average: 7.77, accumulatedAverage: 7.77, accumulatedAverageFourPoint: 3.3, classification: "good", gradedCredits: 164 }` (1274 / 164; 540.5 / 164); 10 to 20 credits a term, so no cap violation; no warning or unmatched course; `graduation.status` `done`. `audit.e2e-spec.ts` ("the APCS 2024 completion fixture") checks the checksum and these values, term by term. A change to the file fails that test until this item is updated. | Triết (rules), Thắng (fixture) | ACAD-01c |
| 14 | APCS 2024 prerequisites and offering terms, entered through F12's admin routes (#74, steps in its PR body), and the rule engine reading them (ADR 0013 lists this as an open data gap). No date yet: if it is not done by 12 November, ACAD-01h stays blocked in B1. | Thắng (data), Triết (engine) | ACAD-01h |

## 7. Other B1 checks

The cases for the remaining B1 parents (test plan §5). The academic expected results follow ADR 0013, the rule engine's ADR in #72 (accepted on 9 November with Lâm as decider; Triết reviews it there), and each cites the clause of QĐ 1175/QĐ-KHTN it rests on. If #72 changes a rule before it merges, Dũng updates the values here. The plan cases follow #71; Hoà confirms them before the run.

| Parent | Area | Owner | Cases | Code under test |
| --- | --- | --- | --- | --- |
| TC-B1-ACAD-01 | Rules, audit and explorer | Triết | ACAD-01a–h | #72 (audit), #65 and #74 (explorer) |
| TC-B1-ACAD-02 | Audit counting and freshness | Triết, Lâm | ACAD-02a–f | #72 |
| TC-B1-PLAN-01 | Basic plans | Hoà | PLAN-01a–f | #71 |
| TC-B1-DATA-01 | APCS integration | Thắng, Triết | DATA-01a–e | `main` (#36) |
| TC-B1-AI-01 | Gateway regression | Lâm | AI-01a–g | `main` |
| TC-B1-COV-01 | Rule-engine coverage | Thắng, Triết | COV-01a–c | #72 (`src/rules/`) |

**Audit cases (ACAD-01a–f, ACAD-02a–f).** Until #72 merges they are **not run: feature not merged**. Run them as **API**: save the rows with `PUT /api/users/me/transcript`, then call `GET /api/users/me/audit` (#72). A student who has not finished onboarding gets **409** `onboarding_required` instead (USER-01k). The **Screen** parts wait for the dashboard and grades screens: until they merge, **not run: feature not merged**.

- **Account.** A new account `b1-06@example.com`, onboarded to APCS 2024: through the screens, or with `PUT /api/users/me/onboarding` and `{ "program": "APCS", "cohort": 2024, "targetGraduationTerm": null, "creditsPerTerm": null, "internshipTerm": null, "finished": true }`. ACAD-02d and ACAD-02e use their own accounts. S1's and S2's transcripts of §1 are never touched.
- **Every save replaces the whole transcript.** So each case saves all of its rows, and the cases can run in any order. Run ACAD-01a first, before `b1-06` saves anything.
- **Rows.** `CS160 4 graded 8.0 2024-1` stands for `{ "courseCode": "CS160", "courseName": "Nhập môn Tin học", "credits": 4, "result": "graded", "grade": 8.0, "term": { "year": 2024, "number": 1 } }`. For any result other than `graded`, `grade` is `null`. The course names and credits are the catalog's (`apcs-2024.ts`, with CM102's name from `apcs-catalog-decisions.ts`), so no `credits_differ` warning appears:

| Group of APCS 2024 | Codes used here, with their names |
| --- | --- |
| Kiến thức Computer Science (A): bắt buộc (40 credits, 4 each) | CS160 Nhập môn Tin học, CS163 Cấu trúc dữ liệu, CS201 Lập trình hệ thống, CS202 Các hệ thống lập trình, CS250 Cấu trúc rời rạc I, CS300 Nhập môn Công nghệ phần mềm, CS323 Đạo đức khoa học, CS333 Nhập môn Hệ điều hành, CS486 Nhập môn các hệ cơ sở dữ liệu, ECE341 Phần cứng máy tính |
| Kiến thức Computer Science (A): tự chọn (at least 16, 4 each) | CS251 Cấu trúc logic, CS252 Tư duy tính toán, CS311 Cấu trúc tính toán, CS320 Nguyên lý các ngôn ngữ lập trình, CS350 Thuật toán và độ phức tạp |
| Kiến thức Non Computer Science (26) | CM102 Tư duy phản biện (4), BAA00101 Triết học Mác - Lênin (3), BAA00102 Kinh tế chính trị Mác - Lênin (2), BAA00103 Chủ nghĩa xã hội khoa học (2) |
| None | ZZ999 Unknown Synthetic Course (4), ACAD-02f only |

Any term below 10 credits in these rows also reports a `below_minimum` cap violation. That is expected (ACAD-01e) and not a defect; a case names a violation only when it tests one. The expected values were worked out by hand from ADR 0013. `audit.e2e-spec.ts` and `src/rules/*.spec.ts` in #72 check the same rules on other transcripts.

### TC-B1-ACAD-01: Rules, audit and explorer

Sources: [UC-03][uc03] steps 1–9, A1–A4; [UC-04][uc04] steps 1–7; [UC-19][uc19] steps 1–7; Vision §5; ADR 0013 (#72); [ADR 0012](../analysis-and-design/adr/0012-credit-caps-by-training-type.md) for the credit caps, which replaces Vision §4's; test plan §5 row `TC-B1-ACAD-01`.

| ID | Do this | Expect |
| --- | --- | --- |
| ACAD-01a | **API, then Screen.** As `b1-06`, before any transcript is saved, call the audit. Then open the dashboard. | **200**. `credits` is `{ "accumulated": 0, "towardTotal": 0, "inProgressTowardTotal": 0, "totalRequired": 163, "remaining": 163, "yearLevel": 1 }`. `gpa.average` and `gpa.accumulatedAverage` are `null`; `terms` and `unmatchedCourses` are empty. Each group with a minimum has `passedCredits` 0 and `remainingCredits` equal to its `requiredCredits`: (A) bắt buộc 40, (A) tự chọn 16, Kiến thức Math 16, Non Computer Science 26, Physics 12, Kiến thức tốt nghiệp 10, Tự chọn Math (B) 8. **Tự chọn Computer Science (C)** has no minimum of its own: `requiredCredits` and `remainingCredits` are `null`, and `met` is true. Its rule is the combined minimum **Kiến thức tự chọn**, at 0 of 43 in `combinedMinimums`. `graduation.status` is `not_yet`. The dashboard shows the same figures. It shows (C) without a minimum, never as "0 / 0", and says the audit assumes no course is passed, with a link to enter a transcript (UC-03 A1). There is no estimated graduation term: it comes from the planner, not the audit (ADR 0013). |
| ACAD-01b | Save `CS160 4 graded 8.0 2024-1` and `CM102 4 graded 7.0 2024-1`. Call the audit. | `credits.accumulated` 8, `towardTotal` 8, `remaining` 155. `gpa.average` and `gpa.accumulatedAverage` 7.5, from (8.0 × 4 + 7.0 × 4) / 8, and `classification` `good`. **Kiến thức Computer Science (A): bắt buộc** has `passedCredits` 4 of 40, with CS160 `passed`. **Kiến thức Non Computer Science** has 4 of 26, with CM102 `passed`. Term 2024-1 has 8 credits and one cap violation, `below_minimum` with `credits` 8 and `limit` 10. It is reported, not refused (ACAD-01e). |
| ACAD-01c | Save the APCS 2024 completion fixture of §6 item 13 as it is: `PUT /api/users/me/transcript` with the file as the body, after checking its SHA-256. It includes BAA00021, BAA00022 and BAA00030 as passed. Call the audit, then open the dashboard. | `graduation.status` is `done` and `graduation.unmet` is empty. `credits.towardTotal` is 164 (at least 163) and `remaining` is 0, with the credits and averages of §6 item 13. Every group and the combined minimum are `met`. `graduation.notChecked` still lists the five conditions of ACAD-01d, and the dashboard shows them as not checked, never as met. B1 shows **no graduation-guide link**: the graduation guide is not a B1 guide (§3). |
| ACAD-01d | With ACAD-01b's rows saved, read the group **Kiến thức Computer Science (A): tự chọn** and `graduation`. | The empty elective group has `passedCredits` 0 of 16 and `met` false. `graduation.unmet` has an entry whose `description` is `Requirement group "Kiến thức Computer Science (A): tự chọn"`, with an `id` of the form `group:<uuid>` and the `citation` `QĐ 1175/QĐ-KHTN Điều 17.3.b`. `graduation.notChecked` lists exactly these ids: `no_prosecution_or_suspension`, `defence_education_certificate`, `foreign_language_standard`, `it_standard` and `study_time_limit`. They cite Điều 17.3.a, 17.3.c, 17.3.d, 17.3.e and 2.7. The transcript has no certificate field (ADR 0007), so the language certificate is never assumed met. B1 shows **no certificate link**. The prerequisite-not-taken warning is ACAD-01h. |
| ACAD-01e | Main-term caps. Save each of these four transcripts in turn, and call the audit after each. Every row is `graded` 7.0 in 2024-1. (1) 9 credits: CS160, BAA00101, BAA00102. (2) 10: CS160, CS163, BAA00102. (3) 22: CS160, CS163, CS201, CS202, CS250, BAA00102. (4) 23: CS160, CS163, CS201, CS202, BAA00101, BAA00102, BAA00103. | Every save answers **200**. `trainingType` is `advanced`. Each time, term 2024-1 has `kind` `main` and `caps` `{ "min": 10, "max": 22 }` (ADR 0012). Its `capViolations`: (1) one `below_minimum`, `credits` 9, `limit` 10; (2) and (3) none; (4) one `above_maximum`, `credits` 23, `limit` 22. Each violation has `citation` `QĐ 1175/QĐ-KHTN Điều 7.2` and a `petition` note. A load outside the caps is reported, never refused (ADR 0012). The audit gives rule codes, not fixed wording. **Plans:** #71 saves a plan without checking caps. The planner's cap check comes with the rule engine's plan hook (`PlanIssuesProvider`), so that part is **not run: feature not merged**. |
| ACAD-01f | Term 3. As ACAD-01e, with every row in 2024-3: (1) 12 credits: CS160, CS163, CS201. (2) 13: CS160, CS163, BAA00101, BAA00102. (3) 22: the rows of ACAD-01e (3). | Each time, term 2024-3 has `kind` `main`, not `summer`, and `caps` `{ "min": 10, "max": 22 }`: term 3 is a main term for APCS (ADR 0012, ADR 0009 as amended). None of the three has a cap violation, and nothing cites a 12-credit summer cap. B1 offers no đại trà program (§6 item 1), so the đại trà caps (14–25, and 12 in summer) are not run here; `credit-caps.spec.ts` and `audit.spec.ts` in #72 cover them. |
| ACAD-01g | Explorer. **API:** `GET /api/programs/APCS/curricula/2024` (#65). **Screen**, once the explorer merges: open **Curriculum** for APCS 2024. Search for `cau truc du lieu`, then `cấu trúc dữ liệu`, then clear the box. Open the drawer of `CS163`. | API: **200**, with the eight groups of ACAD-01a and their courses. `CS163` is in **Kiến thức Computer Science (A): bắt buộc**, named "Cấu trúc dữ liệu", with 4 credits. Once #74 merges, every course has `prerequisites` and `offeringTerms` `null`: not recorded, since no prerequisite data is loaded. Screen: courses are listed by group. Both searches find CS163, and clearing the box brings the full list back. The drawer shows the code, name, credits and group. Where the explorer shows prerequisites or offering terms, it says they are not recorded, never "none". The locked and available states, the padlock, missing and unlocked prerequisites, and the graph are ACAD-01h. |
| ACAD-01h | **Blocked: §6 item 14, prerequisite and offering-term data.** Once APCS 2024 prerequisites and offering terms are entered through F12 (#74) and the rule engine reads them: in the explorer, open a course whose prerequisite is not passed, then its prerequisite. In the audit, save a transcript with that course but not its prerequisite, and one with a course outside its offering terms. | Written from the entered data when the item clears. The course shows a padlock, is locked and lists the missing prerequisite. Passing the prerequisite unlocks it. The drawer lists the courses it unlocks. The prerequisite graph shows the edge and scrolls inside its own box. The audit warns about the prerequisite not taken and the course outside its offering terms. Neither warning blocks anything. |

Cohort selection is USER-01i: it counts for ACAD-01 too and is not repeated here.

### TC-B1-ACAD-02: Audit counting and freshness

Sources: [ADR 0007](../analysis-and-design/adr/0007-transcript.md); ADR 0013 (#72); [UC-03][uc03]; [UC-15][uc15]; [UC-19][uc19]; test plan §5 row `TC-B1-ACAD-02`.

| ID | Do this | Expect |
| --- | --- | --- |
| ACAD-02a | Results and the pass mark. Save `CS160 4 graded 5.0 2024-1`, `CS163 4 graded 4.9 2024-1`, `CS201 4 pass 2024-1`, `CS202 4 fail 2024-1`, `CS250 4 exempt 2024-1` and `CS300 4 in_progress 2024-2`. Call the audit. | In **Kiến thức Computer Science (A): bắt buộc**: CS160 is `passed` (5.0 passes, Điều 11.4) and CS163 is `failed` (4.9 does not). CS201 is `passed`, CS202 `failed`, CS250 `passed` (exempt, Điều 13.3) and CS300 `in_progress`. The group has `passedCredits` 12, `inProgressCredits` 4 and `remainingCredits` 24. `credits.accumulated` is 12 and `inProgressTowardTotal` 4. `gpa.average` is 4.95, from CS160 and CS163 only: (5.0 × 4 + 4.9 × 4) / 8. `gpa.accumulatedAverage` is 5.0, with `gradedCredits` 4 (CS160 only). `pass`, `fail` and `exempt` have no grade, so they enter no average (Điều 13.3, ADR 0013). Term 2024-1 has `failedCourseCodes` CS163 and CS202. |
| ACAD-02b | Retakes. Save `CS160 4 graded 3.0 2024-1` and `CS160 4 graded 8.0 2024-2`, then call the audit. Then save those two rows and `CS160 4 graded 6.0 2024-3`, and call it again. | First save: CS160 counts once, as `passed` with grade 8.0. `credits.accumulated` is 4, and `gpa.average` and `accumulatedAverage` are 8.0. Term 2024-1 keeps its own sitting: `average` 3.0 and `failedCourseCodes` CS160. Second save: the last completed attempt is official even when it is lower (Điều 14.1.a, 14.2.a). CS160 has grade 6.0, `credits.accumulated` is still 4, and `gpa.accumulatedAverage` is 6.0. |
| ACAD-02c | Credits counted once, and group (C). Save 15 rows, each 4 credits and `graded` 7.0. 2024-1: CS160, CS163, CS201, CS202. 2024-2: CS250, CS300, CS323, CS333. 2024-3: CS486, ECE341, CS251, CS252. 2025-1: CS311, CS320, CS350. That is all ten (A) bắt buộc courses (40 credits) and five (A) tự chọn courses (20). | (A) bắt buộc: 40 of 40, `met`. (A) tự chọn: `passedCredits` 20 of 16, `met`, and `overflowOutCredits` 4 toward (C) (APCS 2024 p.5–6: surplus (A) credits count for (C)). (C): `requiredCredits` `null`, `overflowInCredits` 4, `met` true. **Kiến thức tự chọn** ((B) + (C) ≥ 43): `credits` 4, `remainingCredits` 39. `credits.towardTotal` is 60, not 64: the 4 overflow credits count once, and `remaining` is 103. No term has a cap violation (16, 16, 16 and 12 credits). No seeded curriculum links one course to two groups, so a course shared by two groups is checked only in `audit.spec.ts` (#72), "counts it once: in a compulsory group first, then by group name". |
| ACAD-02d | Recompute. As a new account `b1-07@example.com`, onboarded to APCS 2024, save `CS160 4 graded 8.0 2024-1` and call the audit. Then save `CS160 4 graded 8.0 2024-1` and `CS163 4 graded 6.0 2024-1`, and call it again. **Screen:** with the dashboard open, make the second save in another tab, then reload the dashboard. | First: `credits.accumulated` 4 and `gpa.average` 8.0. Second: `credits.accumulated` 8, `gpa.average` 7.0, and (A) bắt buộc `passedCredits` 8. The audit is worked out from the saved rows on every request, with nothing stale. After the reload, the dashboard shows 8 credits and 7.0. Automated in #72: `audit.e2e-spec.ts`, "recomputes after a new transcript is saved, for that student only". |
| ACAD-02e | Isolation. Make a new account `b1-08@example.com`, onboarded to APCS 2024, and save `CM102 4 graded 7.0 2024-1`. Read `b1-08`'s transcript and audit. As `b1-07` (ACAD-02d), save `CS201 4 graded 9.0 2024-1`. Read `b1-08`'s transcript and audit again. | Both times, `b1-08`'s transcript holds only CM102, and its audit has `credits.accumulated` 4 and `gpa.average` 7.0. No course of `b1-07`'s (CS160, CS163, CS201) appears in either response, and nor do its credits or GPA. |
| ACAD-02f | Unknown course. Save `CS160 4 graded 8.0 2024-1` and `ZZ999 4 graded 9.0 2025-1`. Call the audit. | `unmatchedCourses` is exactly ZZ999, with `passed` true. `warnings` has `not_in_curriculum` for ZZ999 (UC-03 A3: no group lists it and no equivalence is recorded). It counts toward nothing: `credits.accumulated` is 4 and `gpa.average` 8.0, from CS160 alone. Term 2025-1 still shows its 4 credits as load, since the load counts every course taken (Điều 7.1.b). |

### TC-B1-PLAN-01: Basic plans

Sources: [UC-05][uc05] steps 1–7; [ADR 0004](../analysis-and-design/adr/0004-account-export-and-deletion.md); [ADR 0009](../analysis-and-design/adr/0009-term-encoding.md); ADR 0014 (#71); Vision §5 F5; test plan §5 row `TC-B1-PLAN-01`.

The routes are #71's: `GET` and `POST /api/plans`; `GET`, `PATCH` and `DELETE /api/plans/{id}`; `PUT /api/plans/{id}/placements`; and `POST /api/plans/{id}/duplicate`. #71 and the planner screen (#78, #80) are merged. Live validation and drag-and-drop are B2 (test plan §5).

**Confirmed (Hoà, 11 November 2026):** the expected results below match the plans API (#71: `plans.controller.ts`, `plans.dto.ts`, `plans.e2e-spec.ts`) and the planner screen (#80: `PlanEditorView.vue`). The planner has no Save button: it saves each change as it is made.

| ID | Do this | Expect |
| --- | --- | --- |
| PLAN-01a | **API.** As S1, call `POST /api/plans` with `{ "name": "Standard 4-Year", "programCode": "APCS", "cohortYear": 2024 }`, then with `"name": "Fast Track"`. Call `GET /api/plans`. | Each `POST` answers **201** with the plan's `id`. The list holds both plans, each with its `id`, its `name` and `curriculum.code` `APCS2024`, and nothing of S2's. |
| PLAN-01b | In "Standard 4-Year", call `PUT /api/plans/<id>/placements` with `{ "terms": [ { "term": { "year": 2024, "number": 1 }, "placements": [ { "kind": "course", "courseCode": "CS160" } ] }, { "term": { "year": 2024, "number": 2 }, "placements": [ { "kind": "course", "courseCode": "CS163" } ] } ] }`. Read it with `GET /api/plans/<id>`. Then `PUT` only the 2024-2 term, and read it again. Then `PUT` `{ "terms": [ { "term": { "year": 2024, "number": 1 }, "placements": [] } ] }` and read it once more. **Screen:** in the planner, place CS160 in 2024-1 and CS163 in 2024-2, wait for **Đã lưu** (Saved) and reload. Then remove CS160 and reload again. The empty-term `PUT` is API only: the screen never sends a term with nothing placed. | The first read has CS160 in 2024-1 and CS163 in 2024-2, with terms as `{ year, number }` (ADR 0009). After the second `PUT`, `terms` holds only 2024-2 with CS163. 2024-1 is left out: a term with nothing placed is never stored. The `PUT` with an empty 2024-1 term is refused with **400** (`@ArrayMinSize(1)` on `placements`), and the last read still shows only CS163 in 2024-2. "Fast Track" still has no placements. |
| PLAN-01c | **Screen.** With S1 signed in on browsers A and B, edit and save the plan in A. Reload B and open the plan. | B shows exactly the placements saved in A. |
| PLAN-01d | **API.** As S2, with the id of S1's "Standard 4-Year", call `GET /api/plans/<id>`, `PATCH /api/plans/<id>` with `{ "name": "x" }`, `PUT /api/plans/<id>/placements` with `{ "terms": [] }`, `POST /api/plans/<id>/duplicate` and `DELETE /api/plans/<id>`. Then read the plan as S1. | Each of S2's calls answers **404**, the same as for an id that does not exist, so S2 cannot tell that the plan exists. Read as S1, the plan is unchanged. Automated in #71: `plans.e2e-spec.ts`, "answers 404 for another student's plan, as for one that does not exist, and changes nothing". |
| PLAN-01e | **Screen.** Stop the backend, or block `/api/plans` in DevTools, while saving a plan edit. Then restore it and reload. | The screen shows "Chưa lưu được thay đổi. Kế hoạch đã trở về lần lưu gần nhất." (English: "The change could not be saved. The plan is back to its last saved state."), never **Đã lưu**, and the board returns to the last saved state at once. After the reload, the editor shows that same state. |
| PLAN-01f | **API.** As a new account `b1-09@example.com`, onboarded to APCS 2024, create a plan and place CS160 in 2024-1, as in PLAN-01a and b. Call `GET /api/users/me/export`. | `tables.plans` holds the plan and `tables.plan_placements` its placement, both with `b1-09`'s `user_id`. The purge is not repeated here. USER-01z checks that it empties every user table, `plans` and `plan_placements` included once #71 merges. `plans.e2e-spec.ts` (#71) also checks it: "exports the plans with the account and purges them with it (ADR 0004)". |

### TC-B1-DATA-01: APCS integration

Sources: [ADR 0005](../analysis-and-design/adr/0005-curriculum-cohort-and-course-catalog.md); [`curriculum-seed.e2e-spec.ts`](../../src/backend/test/curriculum-seed.e2e-spec.ts); PR #23 and PR #36; test plan §5 row `TC-B1-DATA-01`.

| ID | Do this | Expect |
| --- | --- | --- |
| DATA-01a | **CLI.** Run `npm run db:seed -w src/backend` and note the shared-data counts of §1. Run the seed a second time, and the counts again. | The second run prints `Inserted:` with 0 for every table it lists, and the counts match the first run. Once #72 merges, the list also has `combined_minimums` and `overflows`. |
| DATA-01b | **Database, disposable database only (§1).** Run `UPDATE requirement_groups SET official_notes = 'admin note' WHERE name = 'Kiến thức Math' AND curriculum_id = (SELECT id FROM curriculums WHERE code = 'APCS2024');`. Run `npm run db:seed -w src/backend`, then read the row. Restore it with the same `UPDATE`, setting `official_notes = '4 học phần'`. | The `UPDATE` changes 1 row. The seed completes without error and keeps the edit: `official_notes` is still `admin note`. APCS 2025's Math group is unchanged. After the restore the row reads `4 học phần`, the value in `apcs-2024.ts`. Automated: `curriculum-seed.e2e-spec.ts`, "keeps an admin edit to a group, and aborts on a catalog course edited to a new name". |
| DATA-01c | **Automated: the same test (read the CI result).** By hand, on a disposable database only (§1): run `UPDATE courses SET name_vi = 'Renamed' WHERE code = 'CS160';`, then `npm run db:seed -w src/backend`. Restore with `UPDATE courses SET name_vi = 'Nhập môn Tin học' WHERE code = 'CS160';` and run the seed again. | Automated: the seed rejects with [`CatalogConflictError`](../../src/backend/src/database/seeds/catalog.ts), naming `CS160.name_vi`. By hand: `seed.ts` prints only the error's message and exits with code 1. The message begins `Course catalog conflict: 1 value(s) differ for the same course code.` and has the line `CS160.name_vi: "Renamed" (database) vs "Nhập môn Tin học" (seed)`. The curriculum step writes nothing, and CS160 keeps `Renamed` until the restore. After the restore, the seed runs without error. Restore the exact name: any other value makes every later seed abort. |
| DATA-01d | **Automated: `curriculum-seed.e2e-spec.ts`, "rolls back everything when one insert fails" (read the CI result).** | An invalid group kind is rejected with `/ck_requirement_groups_kind/`. The transaction rolls back and the table counts stay the same. |
| DATA-01e | **Database.** Query the seeded APCS curricula in PostgreSQL. | APCS 2024 has `total_credits_min = 163`. Course codes match `^[A-Z0-9]{2,20}$`. `Kiến thức Computer Science (A)` is seeded as two groups: **(A): bắt buộc** (kind `compulsory`, 40 credits, 10 courses) and **(A): tự chọn** (kind `elective`, at least 16 credits, 6 courses). Prerequisites and offering terms missing from the official PDFs are recorded as unresolved in the test report, never made up. |

### TC-B1-AI-01: Gateway regression

Sources: [ADR 0003](../analysis-and-design/adr/0003-language-model-scope.md); [`sse.ts`](../../src/backend/src/ai/sse.ts); [`ai.e2e-spec.ts`](../../src/backend/test/ai.e2e-spec.ts); test plan §5 row `TC-B1-AI-01`.

No B1 route calls a model, so every AI-01 case reads the CI result of a test, except the column check of AI-01f.

| ID | Do this | Expect |
| --- | --- | --- |
| AI-01a | **Automated: `ai.e2e-spec.ts`, "boots without a key and answers ai_unavailable before reserving, so the attempt does not count" (read the CI result).** | The call rejects with [`AiUnavailableError`](../../src/backend/src/ai/ai-unavailable.error.ts), and no `ai_usage` row is kept. |
| AI-01b | **Automated: `ai.e2e-spec.ts`, "counts a call the student stopped, and refuses once the daily cap is reached" (read the CI result).** | With a daily limit of 2, one finished call and one stopped call both count, and the third call is refused with `ai_unavailable`. |
| AI-01c | **Automated: `ai.e2e-spec.ts`, "lets exactly the cap through when calls arrive in parallel" (read the CI result).** | Of 5 parallel calls with a limit of 2, exactly 2 succeed and 2 usage rows remain. The other 3 are refused. |
| AI-01d | **Automated: `sse.spec.ts` (read the CI result).** | "throws a failure before the first event, so Nest can still answer 503": before the first event, `streamChat` rethrows the `AiUnavailableError` and never calls `res.status`, so Nest's error handling still answers. "turns a failure after the first event into an error event": after the first event, the last write is `event: error` with `{"code":"ai_unavailable",…}`, and `res.end()` is called. No test sees the HTTP status itself. The 503 comes from `AiUnavailableError`, a `ServiceUnavailableException` (`ai-unavailable.error.ts`). |
| AI-01e | **Automated: `gateway-llm.service.spec.ts`, "passes only user and assistant messages from the client to the model" (read the CI result).** | The gateway drops a message with `role: 'system'`, or any role other than `user` and `assistant`, before it reaches the model (`gateway-llm.service.ts`). B1 has no F8 chat route or `@IsIn` DTO to test (§9). |
| AI-01f | **Automated: `account.e2e-spec.ts`, "every user_id key to users cascades, and every other key cascades or sets null (AGENTS.md rule)" and "purges only the accounts whose deadline has passed, with their rows" (read the CI result).** By hand, on any database: `\d ai_usage` in `psql`. | The first test checks that every `user_id` key to `users`, `ai_usage`'s included, is `ON DELETE CASCADE`, so the rows go with the user. The second checks that the purge removes due accounts (`users`, `sessions`) and keeps the others. The table's columns are `id`, `user_id`, `feature`, `model`, `input_tokens`, `output_tokens`, `latency_ms`, `succeeded` and `created_at` (migration `1792800000000-create-ai-usage`). None holds a prompt, a reply or tool arguments. |
| AI-01g | **Automated: `gateway-llm.service.spec.ts` (read the CI result).** Structured: "returns the parsed reply and sends a strict schema without $schema", "retries once when the reply misses the schema, and meters both attempts as one call", "gives up after two unusable replies with ai_unavailable" and "keeps the reserved call when the provider may have billed it (a timeout)". Streaming: "streams text and ends with done" and "throws ai_unavailable mid-stream after the text already sent". | Each passes, with a scripted model client and no provider call (ADR 0003). |

Already automated: `src/backend/test/ai.e2e-spec.ts`, `src/backend/src/ai/sse.spec.ts`, `src/backend/src/ai/gateway-llm.service.spec.ts` and `src/backend/test/account.e2e-spec.ts`.

### TC-B1-COV-01: Rule-engine coverage

Sources: [Test plan §5](test-plan.md#coverage-and-speed); [`vitest.config.mts`](../../src/backend/vitest.config.mts); Vision §6 Testability and Maintainability.

| ID | Do this | Expect |
| --- | --- | --- |
| COV-01a | Check that `src/backend/src/rules/` exists on the tested candidate commit and inspect production rule files. | The directory exists and contains production rule files; Vitest's statement denominator is non-empty (> 0 statements). An absent directory or empty denominator fails acceptance. |
| COV-01b | Run `npm test -w src/backend` (which executes tests with coverage). Read the report for `src/rules/**`. | Statement coverage for `src/rules/**` is **≥ 80.0%**. Test files, testing helpers (`**/testing/**`), migrations, and non-rule source files are excluded from this threshold. |
| COV-01c | On a disposable branch or throwaway worktree, introduce an uncovered branch in `src/backend/src/rules/` that drops statement coverage below 80%. Run `npm test -w src/backend`; discard the branch/worktree without changing the B1 candidate. | Vitest fails with exit code 1 due to the coverage threshold breach, demonstrating CI gate enforcement. |

## 8. B0 cases run on B1

These B0 cases carry to B1 ([B0 report §5](report-b0.md#5-cases-carried-to-b1)). Run them from [B0 test cases](test-cases-b0.md) on the B1 candidate, with the changes below. The B0 cases that passed (AUTH-01a–p, SESS-01a–k, DB-01a–e) rerun unchanged as regression (test plan §2).

| Cases | On B1 |
| --- | --- |
| UI-01a–p | Run as written once the sign-in and sign-up screens (#13) merge. While #13 is open, as it is on 5 November, they stay **not run: feature not merged**. When #13 lands, update the labels and make UI-01i exact: it names where the token is kept, in memory or Session Storage, as #13 decides. |
| UI-01q | "On the B0 commit" becomes **on the B1 commit**: run `npm run test:browser` on the B1 candidate, and it passes, `src/auth/SignIn.browser.spec.ts` included: a valid sign-in, a wrong password with its 401 message, and the 401 of an ended session. Record the frontend commit. The browser suite starts no backend, so it mocks the API ([browser-tests.md](browser-tests.md)); the sign-in screen against the real auth API is UI-01a–p, run on the server. |
| DB-01f | Written out below. |
| DEP-01a–f | Run on staging. DEP-01f checks the **`B1`** tag instead of `B0`: the commit of the `B1` tag, the commit of the deploy run and the commit this report tests are the same. Without staging they stay **blocked: no server yet** (§1). |
| SESS-01l | Nothing to change: still not run by hand, by design (sessions last 7 days). The check in its place, every `expiresAt` in SESS-01c–e about 7 days ahead, runs with them. |
| DB-01b, DB-01c, DEP-01a | The public health route no longer reports the PostgreSQL version (issue #28). DB-01b expects `{"status":"ok","database":"up"}`; DB-01c expects `"status":"degraded"` and `"database":"down"` with no version field; DEP-01a's home page shows "API ok · database up" with no version. Check the version on the server instead (`docker exec omnicourse-db postgres --version`), recorded by Lâm or Thắng. |

### DB-01f: Curriculum constraints

Sources: [ADR 0005](../analysis-and-design/adr/0005-curriculum-cohort-and-course-catalog.md); migration `src/backend/src/database/migrations/1792912952302-create-curriculum-course-schema.ts` (#23, `900b1b8`).

Run it on a local disposable database, migrated to the B1 candidate (§1). The script works in one transaction and ends with `ROLLBACK`, so the seed stays as it is. Its program, `ZZTEST`, is synthetic. `ON_ERROR_ROLLBACK` makes `psql` undo only the statement that failed. Without it, the first error aborts the transaction, and every later insert fails for the wrong reason.

1. Run the shared-data query of §1 and note the counts.
2. Save the script below as `db-01f.sql`. Run `psql <database> -f db-01f.sql` and keep its output as evidence.
3. Run the shared-data query again.

```sql
\set ON_ERROR_ROLLBACK on
BEGIN;
-- Valid rows: each must succeed, so the refusals below are not the schema refusing everything.
INSERT INTO programs (code, name_vi) VALUES ('ZZTEST', 'ZZ test program') RETURNING id \gset prog_
INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES (:'prog_id', 2024, 'ZZTEST2024', 'ZZ test 2024') RETURNING id \gset cur_
INSERT INTO requirement_groups (curriculum_id, name, kind) VALUES (:'cur_id', 'ZZ group', 'compulsory') RETURNING id \gset grp_
INSERT INTO courses (code, name_vi, credits) VALUES ('ZZ001', 'ZZ test course', 3);
INSERT INTO requirement_group_courses (requirement_group_id, course_code) VALUES (:'grp_id', 'ZZ001');
-- 1. The same program and cohort twice
INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES (:'prog_id', 2024, 'ZZTEST2024B', 'ZZ test 2024 again');
-- 2. A course code that breaks ^[A-Z0-9]{2,20}$
INSERT INTO courses (code, name_vi, credits) VALUES ('zz-1', 'ZZ bad code', 3);
-- 3. A group link with that code
INSERT INTO requirement_group_courses (requirement_group_id, course_code) VALUES (:'grp_id', 'zz-1');
-- 4. Two groups with the same name in one curriculum
INSERT INTO requirement_groups (curriculum_id, name, kind) VALUES (:'cur_id', 'ZZ group', 'elective');
-- 5. A kind other than compulsory or elective
INSERT INTO requirement_groups (curriculum_id, name, kind) VALUES (:'cur_id', 'ZZ other group', 'optional');
-- 6. A cohort year outside 2000-2100
INSERT INTO curriculums (program_id, cohort_year, code, name_vi) VALUES (:'prog_id', 1999, 'ZZTEST1999', 'ZZ test 1999');
-- 7. A course with 0 credits
INSERT INTO courses (code, name_vi, credits) VALUES ('ZZ002', 'ZZ no credits', 0);
ROLLBACK;
SELECT count(*) AS zztest_programs_left FROM programs WHERE code = 'ZZTEST';
```

| Statement | Expect |
| --- | --- |
| The valid rows: program `ZZTEST`, its 2024 cohort, group `ZZ group`, course `ZZ001` and its link | Each succeeds (`INSERT 0 1`) |
| 1. The same program and cohort twice | Fails on `uq_curriculums_program_cohort` |
| 2. Course code `zz-1` | Fails on `ck_courses_code_format` (`^[A-Z0-9]{2,20}$`) |
| 3. A group link with code `zz-1` | Fails on `ck_requirement_group_courses_code_format` |
| 4. Two groups named `ZZ group` in one curriculum | Fails on `uq_requirement_groups_curriculum_name` |
| 5. `kind = 'optional'` | Fails on `ck_requirement_groups_kind`: only `compulsory` and `elective` are allowed, and there is no `compulsory` column |
| 6. `cohort_year = 1999` | Fails on `ck_curriculums_cohort_year_range` |
| 7. `credits = 0` | Fails on `ck_courses_credits_positive` |
| After `ROLLBACK` | `zztest_programs_left` is 0, and the shared-data counts match step 1 |

DB-01f passes when every valid row goes in, each of the seven inserts fails on its named constraint and on nothing else, and nothing is left after the rollback.

Already automated: `curriculum-schema-migration.e2e-spec.ts`.

## 9. Not in B1

Left out of these cases on purpose:

- **Guides, B3:** program values from the rule engine (UC-10 A3), the courses of a plan (A4), **Report a problem** (A6), **Suggest a guide** and the advisor link in A2, the reported-link trigger of A5, and the remaining guides (TC-B3-GUIDE-01).
- **Account, B2 or later:** stopping shared links on deletion (UC-14 A5, with F9 in TC-B2-SHARE-01), AI consent withdrawal (UC-14 A3, with the advisor in TC-B3-ADV-01), transcript import during onboarding (UC-01 A5 in PA2 numbering, F2 in B2), and nightly backups (TC-B2-OPS-01).
- **Academic, later:** a warning for a missing language certificate, since the transcript has no certificate field (ADR 0007) and the audit lists the foreign-language standard as not checked (ACAD-01d); the đại trà caps, since B1 offers no đại trà program (ACAD-01f); and the planner's live checks of caps, prerequisites and offering terms (TC-B1-PLAN-01: live validation is B2). Offering terms and prerequisites in the explorer and the audit wait on data (ACAD-01h, §6 item 14).
- **AI, B3:** the advisor's chat route and its `@IsIn(['user', 'assistant'])` DTO (F8). B1 checks only the gateway's role filter (AI-01e).
- **Not decided:** Google sign-in, verified-student-email sign-up and two-factor authentication ([test plan §8](test-plan.md#8-schedule-and-remaining-work)).

[uc01]: https://github.com/LLaammTTeerr/omnicourses/blob/9d1f13bcb3be62cede0629799cf484d7ed321406/docs/requirements/use-cases/UC-01-sign-up-and-onboard.md
[uc03]: ../../report/assignments/PA2/uc-specs.tex
[uc04]: ../../report/assignments/PA2/uc-specs.tex
[uc05]: ../../report/assignments/PA2/uc-specs.tex
[uc15]: ../../report/assignments/PA2/uc-specs.tex
[uc19]: ../../report/assignments/PA2/uc-specs.tex
