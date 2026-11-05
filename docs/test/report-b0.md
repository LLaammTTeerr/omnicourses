# B0 test report

- Owner: Dũng
- Build: B0 is commit `20a0e60` (`20a0e602768b01fb205d381934021c1d89aab1dd`), the last commit on `main` on 1 November 2026 (21:12, UTC+7). Lâm confirmed it as B0 on 5 November 2026. Lâm pushes a signed tag on it with `git tag -s B0 20a0e60 -m "B0"`; on 5 November the tag is not pushed yet. The tag does not go through `deploy.yml`: that workflow tags the commit its branch is on now, and it deploys nothing yet (the deploy step is still a TODO; its last run was 24 October).
- Cases: [B0 test cases](test-cases-b0.md) v0.1, 30 October 2026. Parent checks: [test plan §5, B0 checks](test-plan.md#b0-checks).
- Run: 5 November 2026, 14:10–14:35 (UTC+7), on the tester's own machine. There is no staging server. The times in the evidence files are UTC (07:10–07:35), because the script logs with `toISOString`.
- Decision: Lâm accepted this run as B0 evidence on 5 November 2026, recorded as in §2 and §3.

## 1. Summary

| Result | Cases |
| --- | --- |
| Passed | 32: AUTH-01a–p, SESS-01a–k, DB-01a–e |
| Failed | 0 |
| Blocked | 6: DEP-01a–f, **blocked: no server yet** |
| Not run | 19: UI-01a–q and DB-01f, **not run: feature not merged**; SESS-01l, not run by hand by design |
| **Total** | **57** |

Every case that could run on this commit passed. The blocked and not-run cases are the B0 exceptions in [test plan §7](test-plan.md#7-when-a-build-is-ready). They do not count as passed and carry to B1 (§5). The run found one documentation defect outside the cases, filed as #51 (§6). Thắng checks this report against the acceptance criteria.

By parent check. A parent passes only when all its required detailed outcomes pass ([test plan §5](test-plan.md#5-required-checks)), and the totals above count only the detailed cases.

| Parent check | Result | Why |
| --- | --- | --- |
| TC-B0-AUTH-01 | API part passed; screen part not run | AUTH-01a–p passed through the API. The screen run needs #13 and carries to B1 with UI-01. |
| TC-B0-SESS-01 | all run cases passed | SESS-01a–k passed. SESS-01l is not run by hand by design; `auth.service.spec.ts` covers the expired token and passed in CI. |
| TC-B0-UI-01 | not run: feature not merged | #13 is not in the build. |
| TC-B0-DB-01 | not passed yet | DB-01a–e passed, but DB-01f is not run: feature not merged (#23). |
| TC-B0-DEP-01 | blocked: no server yet | No staging server. |

## 2. Environment and how it was run

| Item | Used |
| --- | --- |
| Machine | Windows 10 Enterprise (10.0.19045), local only |
| Runtime | Node 22.22.1, npm 11.21.1 (the pinned versions) |
| Database | PostgreSQL 18.6, installed directly from the official Windows binaries (EDB 18.6-1), not in Docker. The same version as `compose.yaml`, in a new empty cluster on `localhost:5432` with user and database `omnicourse`. |
| Backend | The B0 build, `node dist/main.js` in `src/backend`, on `http://localhost:3000/api`. `.env` copied from `.env.example` (`SESSION_TTL_DAYS=7`). |
| Frontend | `npm run dev:frontend`, Vite on `http://localhost:5173` |
| Browser | Google Chrome 144.0.7559.110, headless through Playwright 1.64.1, for the pages in DB-01c and DB-01d |
| Test data | Made-up `example.com` accounts only: `b0-01` to `b0-12`, `b0-04` (S2) and `b0-p01` to `b0-p11`, all with the test password and display name `Test Student` |

Four things differ from [test cases §1](test-cases-b0.md#1-before-you-start):

- **PostgreSQL ran directly, not in Docker.** Docker Desktop cannot start on this machine: WSL 2 needs virtualization, which is turned off. The server version is the same. In DB-01c, `pg_ctl stop` and `pg_ctl start` take the place of `docker stop` and `docker start`.
- **Dependencies came from `npm ci`, not `npm install`.** `npm ci` installs exactly what `package-lock.json` at `20a0e60` lists.
- **The API ran as `node dist/main.js`, not `npm run dev:backend`.** It is the build of the same commit, without the watch-mode dev server.
- **A script sent the API requests instead of the Swagger page.** [`b0-cases.mjs`](evidence/b0/b0-cases.mjs) sends the routes, bodies and tokens of AUTH-01, SESS-01 and DB-01b, d and e in the order the cases give, with Node's `fetch` and the user agent `B0 manual run (Node 22 fetch)`. Where a case says "no account", it also counts the matching rows in `users` with `psql`. It waits out the rate limit between batches, as §1 says, so no case gets a 429 it did not ask for. Its output is [`run-output.txt`](evidence/b0/run-output.txt).

The commands that produced the results and the evidence, in order, in Git Bash on Windows. The outputs were saved as `.log` files, then renamed to `.txt` because `.gitignore` excludes `*.log`.

```bash
# Pinned runtime, put first on PATH. Node 22.22.1: node-v22.22.1-win-x64.zip from
# nodejs.org, its SHA-256 checked against SHASUMS256.txt. Then npm 11.21.1:
npm i -g npm@11.21.1 --prefix <npm directory>

# Empty PostgreSQL 18.6 cluster, from the EDB 18.6-1 Windows binaries
initdb -D data -U omnicourse --pwfile=pwfile -A scram-sha-256 -E UTF8 --locale=C
pg_ctl -D data -l server.log -o "-p 5432" -w start
createdb -h localhost -U omnicourse omnicourse
psql -h localhost -U omnicourse -d omnicourse -tAc "show server_version" \
  -c "select count(*) from pg_tables where schemaname='public'"      # 18.6, then 0

# The B0 commit
git worktree add --detach b0 20a0e60     # then, inside b0:
npm ci
cp .env.example .env
npm run typecheck                        # exit 0
npm test                                 # exit 1: the backend suite did not start (ERR_SWC_NATIVE_CACHE, §3);
                                         #         the frontend's 2 tests passed
npm run build                            # exit 0

# DB-01a: migrate twice, keeping the last two lines and the exit code of each run
{ echo "--- run 1"; npm run db:migrate -w src/backend 2>&1 | tail -2; echo "exit ${PIPESTATUS[0]}"
  echo "--- run 2"; npm run db:migrate -w src/backend 2>&1 | tail -2; echo "exit ${PIPESTATUS[0]}"
} | tee db-01a.log

# The API and the home page, left running
(cd src/backend && node dist/main.js > api.log 2>&1)
npm run dev:frontend

# AUTH-01, SESS-01, DB-01b, d and e. PGPASSWORD is the local default from .env.example.
PSQL=<path to psql.exe> PGPASSWORD=omnicourse PGPORT=5432 node b0-cases.mjs results.json > run.log 2>&1

# DB-01c, part 1: the API's process id, then stop the database and check health and the home page
{ echo "API pid before: $(netstat -ano | grep ':3000 .*LISTEN' | awk '{print $NF}' | head -1)"
  pg_ctl -D data -m fast stop < /dev/null > /dev/null 2>&1
  pg_isready -h localhost -p 5432
  echo "health (db stopped): $(curl -s -w ' HTTP %{http_code}' http://localhost:3000/api/health)"
  node home-status.mjs <playwright-core directory> home-db-down.png 2>&1 | tail -1
} | tee db-01c.log

# DB-01c, part 2: start the database, check health every 5 s for 90 s, then the process id again
{ pg_ctl -D data -l server.log -o "-p 5432" -w start < /dev/null > pgstart.log 2>&1
  pg_isready -h localhost -p 5432
  t0=$(date +%s)
  for i in $(seq 1 18); do echo "+$(( $(date +%s) - t0 ))s $(curl -s http://localhost:3000/api/health)"; sleep 5; done
  echo "API pid after: $(netstat -ano | grep ':3000 .*LISTEN' | awk '{print $NF}' | head -1)"
} | tee -a db-01c.log

# DB-01d: the rendered Swagger page. It prints one line to the terminal.
node docs-page.mjs <playwright-core directory> docs-page.png 2>&1 | tail -2
```

Raw evidence, in [`evidence/b0/`](evidence/b0/):

| File | What it holds |
| --- | --- |
| [`b0-cases.mjs`](evidence/b0/b0-cases.mjs), [`run-output.txt`](evidence/b0/run-output.txt) | The script for AUTH-01, SESS-01 and DB-01b, d and e, and its output: each check with its actual value. Tokens are not logged. The run used the script as in commit `baa4e30`. After review, the committed version differs only in comments, SESS-01l's label and the SUMMARY line; every check is the same. |
| [`db-01a-output.txt`](evidence/b0/db-01a-output.txt) | Both migration runs: the last two lines and the exit code of each |
| [`db-01c-output.txt`](evidence/b0/db-01c-output.txt) | The API's process id, `pg_isready`, health and the home page with the database stopped, then `pg_isready`, health every 5 s and the process id after the restart |
| [`home-status.mjs`](evidence/b0/home-status.mjs), [`home-db-down.png`](evidence/b0/home-db-down.png) | The home-page check in headless Chrome, and its screenshot with the database stopped |
| [`docs-page.mjs`](evidence/b0/docs-page.mjs), [`docs-page-output.txt`](evidence/b0/docs-page-output.txt), [`docs-page.png`](evidence/b0/docs-page.png) | The Swagger-page check in headless Chrome, its output and its screenshot. The script printed its one line to the terminal, and that line was copied into `docs-page-output.txt` after the run; the screenshot is the record the script saved. |

## 3. Automated checks on `20a0e60`

[CI run 41315047148](https://github.com/LLaammTTeerr/omnicourses/actions/runs/41315047148) ran on `20a0e60` (push to `main`, 1 November 2026) and is green. It counts as this commit's automated results.

| CI job | What it ran | Result |
| --- | --- | --- |
| `backend` | typecheck, unit tests with coverage, build, e2e on PostgreSQL 18.6, OpenAPI export | passed |
| `frontend` | typecheck, unit tests, browser smoke tests, build | passed |
| `signed-commits` | every commit signed | passed |
| `changeset` | a changeset is present | passed |

On this machine, `npm run typecheck` and `npm run build` passed, and in `npm test` the frontend's 2 unit tests passed. `npm test` still exited 1, because the backend Vitest suite did not start here: `@swc/core` refuses to load its native binding (`ERR_SWC_NATIVE_CACHE`) because the user-profile folders give write rights to other accounts. The cause is the machine, not B0, and the project's main working copy fails the same way. The CI run covers those suites.

## 4. Results

### TC-B0-AUTH-01: Sign-up and sign-in (API)

| ID | Result | What happened |
| --- | --- | --- |
| AUTH-01a | passed | 201. Body has `token`, `expiresAt` 2026-11-12T07:25:22Z (7 days), `user` with email `b0-01@example.com` and name `Test Student`, `accountRestored: false`. Keys: `token, expiresAt, user, accountRestored`; user keys: `id, email, displayName, emailVerifiedAt, createdAt`. No password field. |
| AUTH-01b | passed | 201, stored email `b0-02@example.com`. Sign-in with the lowercase email: 200. |
| AUTH-01c | passed | 400 "acceptedTerms must be true". Sign-in: 401. No row in `users`. |
| AUTH-01d | passed | 400 "password must be longer than or equal to 10 characters". No row in `users`. |
| AUTH-01e | passed | 201 with `abcdefghij`. |
| AUTH-01f | passed | 129 characters: 400 "password must be shorter than or equal to 128 characters", no row. 128 characters: 201. |
| AUTH-01g | passed | Empty name and spaces-only name: 400 "displayName should not be empty" both times. No rows. |
| AUTH-01h | passed | 101 characters: 400 "displayName must be shorter than or equal to 100 characters". 100 characters: 201. |
| AUTH-01i | passed | 400 "email must be an email". |
| AUTH-01j | passed | 409 "An account with this email already exists". Still exactly one row for `b0-01@example.com`. |
| AUTH-01k | passed | 200, a token different from AUTH-01a's, `accountRestored: false`. |
| AUTH-01l | passed | 200 with `B0-01@EXAMPLE.COM`. |
| AUTH-01m | passed | 401 "Invalid email or password". |
| AUTH-01n | passed | 401, body identical to AUTH-01m: `{"message":"Invalid email or password","error":"Unauthorized","statusCode":401}`. |
| AUTH-01o | passed | After a minute's wait: requests 1–10 got 401, request 11 got 429. After another minute, the correct sign-in: 200. |
| AUTH-01p | passed | After a minute's wait: requests 1–10 got 201, request 11 got 429. |

### TC-B0-SESS-01: Sessions (API)

S1 is `b0-01@example.com`, S2 is `b0-04@example.com`.

| ID | Result | What happened |
| --- | --- | --- |
| SESS-01a | passed | `GET /api/users/me` with no token: 401. |
| SESS-01b | passed | With `not-a-real-token`: 401. |
| SESS-01c | passed | 200 with S1's email and display name. Keys: `id, email, displayName, emailVerifiedAt, createdAt`. No password field. |
| SESS-01d | passed | 200, 6 sessions (S1's sign-ups and sign-ins so far), with T1's and T2's among them. Exactly one has `current: true`, T2's. Each has a user agent and an expiry. |
| SESS-01e | passed | Refresh: 200, `expiresAt` 2026-11-12T07:30:39Z. T1 then got 401; T1b got 200. The current session id was unchanged. |
| SESS-01f | passed | Delete T2's session: 204. T2 then got 401. T2's session was gone from the list (5 left). |
| SESS-01g | passed | Delete S2's session with T1b: 404 "Session not found". A random UUID got the identical body. T3 still got 200. |
| SESS-01h | passed | Repeating SESS-01f's delete: 404 "Session not found". |
| SESS-01i | passed | `DELETE /api/auth/sessions/abc`: 400 "Validation failed (uuid is expected)". |
| SESS-01j | passed | Sign-out: 204. T1b then got 401; T3 (S2) still got 200. |
| SESS-01k | passed | `GET /api/health` with no token: 200. |
| SESS-01l | not run | Not run by hand, by design. The check in its place passed: every `expiresAt` in SESS-01c to e was 7 days ahead (2026-11-12T07:30:39Z), so `SESSION_TTL_DAYS` is read correctly. The expired-token case is covered by `auth.service.spec.ts`, which passed in CI. The SUMMARY line of `run-output.txt` says `SESS-01l:passed`; that is only the expiry check in its place, not a run of SESS-01l. |

### TC-B0-DB-01: Database and API

| ID | Result | What happened |
| --- | --- | --- |
| DB-01a | passed | Empty database (no tables in `public`). `npm run build`, then `npm run db:migrate -w src/backend`: "Applied: CreateUsersAndSessions1761696000000, CreateAiUsage1792800000000, AddUsersDeletionRequestedAt1792886400000, CreateTranscriptRows1793159431000", exit 0. Second run: "Database is up to date.", exit 0. |
| DB-01b | passed | `{"status":"ok","database":"up","postgresVersion":"18.6"}`. |
| DB-01c | passed | With the database stopped, `/api/health` answered 200 `{"status":"degraded","database":"down","postgresVersion":null}`, and the home page showed "API degraded · database down" ([screenshot](evidence/b0/home-db-down.png)). After `pg_ctl start`, health was `ok` at once and stayed `ok` for 90 seconds. The API was not restarted: the process id was the same before and after. |
| DB-01d | passed | The script fetched `/api/docs` (200, HTML) and `/api/docs-json`, which starts with `{"openapi":"3.2.0"` and lists the groups `health`, `auth` and `users` and a bearer scheme. That proves the JSON loads, not the page. The page itself was checked in headless Chrome with `docs-page.mjs`: it printed `Authorize buttons: 1 \| groups: health, users, auth` ([output](evidence/b0/docs-page-output.txt), [screenshot](evidence/b0/docs-page.png)). |
| DB-01e | passed | All 9 other routes in the OpenAPI document answered 401 without a token: `GET` and `DELETE /api/users/me`, `POST /api/auth/refresh`, `POST /api/auth/sign-out`, `GET /api/auth/sessions`, `DELETE /api/auth/sessions/{id}`, `GET /api/users/me/export`, `GET` and `PUT /api/users/me/transcript`. |
| DB-01f | not run | **Not run: feature not merged.** The curriculum schema (#23) merged on 3 November as `900b1b8`, after `20a0e60`, so the cohort and course/group constraints are not in B0. |

### TC-B0-UI-01: Screens

UI-01a to UI-01q: **not run: feature not merged.** The sign-up and sign-in screens (#13) are not in `20a0e60`: #13 was not merged by 1 November and is still open on 5 November. The B0 frontend has only the home page.

### TC-B0-DEP-01: Deployed build

DEP-01a to DEP-01f: **blocked: no server yet**, under the B0 exceptions in [test plan §7](test-plan.md#7-when-a-build-is-ready). No staging host was chosen by B0 (#24), and `deploy.yml` only builds the files. DEP-01f's check that the tagged, deployed and tested commits are the same does not apply to B0: nothing is deployed, and Lâm tags the tested commit by hand. DEP-01c and DEP-01d were not tried locally.

## 5. Cases carried to B1

| Cases | Result | Reason | Owner | Next action |
| --- | --- | --- | --- | --- |
| UI-01a–p | not run: feature not merged | #13 is not in `20a0e60` and still open on 5 November | Hoà (screens), Dũng (run) | Run when #13 merges. Update the labels and make UI-01i's token storage exact. |
| UI-01q | not run: feature not merged | The real-API browser sign-in journey needs #13 | Thắng | Write the journey after #13 and run it on the B1 commit. |
| DB-01f | not run: feature not merged | #23 merged after B0, as `900b1b8` | Triết (schema), Dũng (steps) | Write the detailed steps now that #23 is merged, and run them on the B1 commit. |
| DEP-01a–f | blocked: no server yet | No staging server; `deploy.yml` only builds the files | Lâm (server), Dũng (run) | Staging will be up by 12 November (Lâm, 5 November). Run all six on it for B1, where DEP-01f compares the B1 tag, the deploy run and the tested commit. |
| SESS-01l | not run (by design) | Sessions last 7 days | Dũng | None. The check in its place runs on each build. |

## 6. Defects

No case failed. The run found one defect outside the cases:

- [#51](https://github.com/LLaammTTeerr/omnicourses/issues/51), `needs-triage`, low priority in my view: the OpenAPI document declares the bearer scheme with `"bearerFormat": "JWT"`, but the tokens are opaque random tokens (ADR 0002). `src/backend/src/bootstrap.ts:25` calls `.addBearerAuth()` with no options, and `@nestjs/swagger` fills in `JWT` by default. Nothing breaks. The issue gives the one-line fix and the test to add.
