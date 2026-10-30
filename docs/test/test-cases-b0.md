# B0 test cases

- Owner: Dũng
- Build: B0, 1 November 2026
- Version: 0.1, 30 October 2026
- Parent checks: [Elaboration test plan §5, B0 checks](elaboration-test-plan.md#b0-checks). Each case below has its parent's ID plus a letter, such as `TC-B0-AUTH-01a`.

Each case lists what to click or type and the result to expect. This file is not a test report: no case here has been run yet.

## 1. Before you start

**Where to test.** For B0, on your own machine: no staging server is chosen yet (issue #24), and `deploy.yml` only builds the files. How cases that cannot run count toward B0 is set in [test plan §7](elaboration-test-plan.md#7-when-a-build-is-ready). Set up the app like this:

```bash
npm install
cp .env.example .env
npm run db:up
npm run build -w src/backend && npm run db:migrate -w src/backend
npm run dev:backend        # API on http://localhost:3000/api
npm run dev:frontend       # app on http://localhost:5173
```

**The API docs page.** Cases marked **API** are run from the Swagger page at `<API address>/api/docs` and need no screen:
1. Open a route, press **Try it out**, fill in the body and press **Execute**. The status code and body appear under **Responses**.
2. To call a route that needs a signed-in user, copy the `token` from a sign-in or sign-up response. Press **Authorize** at the top, paste the token alone (without the word "Bearer"), press **Authorize**, then **Close**.
3. To call as nobody, press **Authorize**, then **Logout**.

**Screens.** Cases marked **Screen** need the sign-up and sign-in screens of issue #13, which are not merged on 30 October. If #13 is not merged by 1 November, mark these cases **not run, feature not merged**; [test plan §7](elaboration-test-plan.md#7-when-a-build-is-ready) says how they count. The labels follow UC-01 (**Sign up**, **Sign in**, **Sign out**) and are updated when the screens land.

**Test data.** Use made-up accounts only:
- emails at `example.com`, such as `b0-01@example.com`, never a real or school address;
- password `correct horse battery`;
- display name `Test Student`.

**Rate limit.** Sign-up and sign-in each accept 10 requests a minute from one address. Wait a minute between batches of cases, or the next case fails with 429 for the wrong reason.

**Recording results.** For every case, record: case ID, result (**passed**, **failed**, **blocked** or **not run**), build tag and commit, browser and version, and screen width for screen cases. Give the reason with **blocked** and **not run**, such as **blocked: no server yet** or **not run, feature not merged**. A blocked or skipped case never counts as passed (test plan §6).

## 2. TC-B0-AUTH-01: Sign-up and sign-in

Run as **API** now; as **Screen** too once #13 is merged. The expected status code is for the API; on the screen, expect the message described.

| ID | Do this | Expect |
| --- | --- | --- |
| AUTH-01a | Sign up with a new email `b0-01@example.com`, the test password and name, consent ticked (`acceptedTerms: true`). | **201.** Account created and signed in. The body has a `token`, `expiresAt` about 7 days from now, the `user` with email and display name, and `accountRestored: false`. No `passwordHash` anywhere. |
| AUTH-01b | Sign up with ` B0-02@Example.COM ` (capitals, spaces around). Then sign in with `b0-02@example.com`. | **201**, the stored email is `b0-02@example.com`. The sign-in succeeds (**200**). |
| AUTH-01c | Sign up with a new email and consent not ticked (`acceptedTerms: false`). | **400**, "acceptedTerms must be true". No account: signing in with that email gives **401**. |
| AUTH-01d | Sign up with a 9-character password `abcdefghi`. | **400**, the password is too short. No account. |
| AUTH-01e | Sign up with exactly 10 characters `abcdefghij`. | **201.** |
| AUTH-01f | Sign up with a 129-character password, then with exactly 128 characters (new email each). | 129: **400**. 128: **201**. |
| AUTH-01g | Sign up with display name empty, then only spaces. | **400** both times. No account. |
| AUTH-01h | Sign up with a 101-character display name, then exactly 100 characters (new email each). | 101: **400**. 100: **201**. |
| AUTH-01i | Sign up with email `not-an-email`. | **400**, the email is invalid. |
| AUTH-01j | Sign up again with `B0-01@example.com` (from AUTH-01a, in capitals). | **409**, "An account with this email already exists". On the screen: says the email is registered and offers **Sign in**. No second account. |
| AUTH-01k | Sign in with `b0-01@example.com` and the test password. | **200**, a new `token`, `accountRestored: false`. |
| AUTH-01l | Sign in with `B0-01@EXAMPLE.COM` and the test password. | **200.** Email case does not matter. |
| AUTH-01m | Sign in with `b0-01@example.com` and a wrong password. | **401**, "Invalid email or password". |
| AUTH-01n | Sign in with `nobody-b0@example.com`, which was never registered. | **401** with exactly the same message and body as AUTH-01m, so it does not reveal that the email is unknown. |
| AUTH-01o | Wait a minute. Send 11 sign-ins within one minute (a wrong password is fine). Wait a minute and sign in correctly. | Requests 1–10: **401**. Request 11: **429**, too many requests. After the minute: **200**. |
| AUTH-01p | Wait a minute. Send 11 sign-ups within one minute (new emails). | Requests 1–10 answered normally. Request 11: **429**. |

Already automated: `auth.e2e-spec.ts` covers a, c, d, j, k and m; `auth.service.spec.ts` covers n (same error and timing). Manual runs still check them on each build, and the automated tests do not cover the screen.

## 3. TC-B0-SESS-01: Sessions

All **API**. Needs two accounts: S1 is `b0-01@example.com` from AUTH-01a, S2 is a new account `b0-04@example.com`.

| ID | Do this | Expect |
| --- | --- | --- |
| SESS-01a | Without Authorize, call `GET /api/users/me`. | **401.** |
| SESS-01b | Authorize with `not-a-real-token`, call `GET /api/users/me`. | **401.** |
| SESS-01c | Sign in as S1 (token T1). Authorize with T1, call `GET /api/users/me`. | **200** with S1's email and display name. No `passwordHash`. |
| SESS-01d | Sign in as S1 again (token T2). Authorize with T2, call `GET /api/auth/sessions`. | **200**, a list with T1's and T2's sessions (plus any earlier S1 sign-ins). Exactly one has `current: true`, T2's. Each has a browser description and an expiry. |
| SESS-01e | Authorize with T1, call `POST /api/auth/refresh` (token T1b). Then call `GET /api/users/me` with T1, then with T1b. | Refresh: **200**, `expiresAt` about 7 days from now. With T1: **401**, it stopped working at once. With T1b: **200**. The session list keeps the same session `id` for it. |
| SESS-01f | With T1b, call `DELETE /api/auth/sessions/{id}` with T2's session id from SESS-01d. Then call `GET /api/users/me` with T2. | Delete: **204**. T2: **401**. T2's session is gone from the list. |
| SESS-01g | Sign in as S2 (token T3) and read S2's own session id from `GET /api/auth/sessions`. Authorize with T1b and delete that id. Then call `GET /api/users/me` with T3. | Delete: **404** "Session not found", the same answer as for an id that does not exist. T3: still **200**. |
| SESS-01h | Repeat the delete of SESS-01f. | **404**, the session is already revoked. |
| SESS-01i | Call `DELETE /api/auth/sessions/abc`. | **400**, the id is not a UUID. |
| SESS-01j | With T1b, call `POST /api/auth/sign-out`. Then call `GET /api/users/me` with T1b, then with T3. | Sign-out: **204**. T1b: **401**. T3 (S2): still **200**. |
| SESS-01k | Without Authorize, call `GET /api/health`. | **200.** Health is the one route that needs no sign-in besides sign-up and sign-in. |
| SESS-01l | An expired token. | **Not run by hand**: sessions last 7 days. Covered by `auth.service.spec.ts` ("returns null for an expired session"). Check instead that every `expiresAt` in SESS-01c to e is about 7 days ahead; a time near "now" means `SESSION_TTL_DAYS` is blank or wrong (issue #37). |

Already automated: `auth.e2e-spec.ts` covers a, c, e, f and j; `auth.service.spec.ts` covers g.

## 4. TC-B0-UI-01: Screens

All **Screen**, through the real API. If #13 is not merged by 1 November: **not run, feature not merged** ([test plan §7](elaboration-test-plan.md#7-when-a-build-is-ready)). Use Chrome and record its version. Open DevTools with F12 where a case says so.

| ID | Do this | Expect |
| --- | --- | --- |
| UI-01a | In a new private window, open the app's address, then type the address of any page other than sign-in or sign-up. | Both show the sign-in screen. No signed-in content appears, even briefly. |
| UI-01b | Press **Sign up**, fill in a new email, the test password and name, tick consent, press **Sign up**. | Signed in. The app shows the signed-in page with "Test Student". |
| UI-01c | On **Sign up**, press the button with every field empty. Then type a 9-character password. | Each required field says, in words, what is wrong, next to the field. The password field says it needs at least 10 characters. Nothing is created. |
| UI-01d | Fill in everything correctly but leave consent unticked, and submit. | A message at the consent box says it is required. No account is created. |
| UI-01e | Sign up with an email that is already registered. | A message says the email is already registered, with a way to go to **Sign in**. |
| UI-01f | On **Sign in**, enter a registered email and a wrong password. | "Invalid email or password" (or its Vietnamese text), shown in words, not only by a red colour. The form stays usable. |
| UI-01g | Press **Sign in** with a wrong password 11 times within a minute. | The 11th attempt says to wait and try again, not "Invalid email or password". |
| UI-01h | Signed in, open DevTools **Network**, and reload the page. | Still signed in. The network list shows one `POST /api/auth/refresh` answered **200**. |
| UI-01i | Signed in, open DevTools **Application**: **Local Storage** and **Session Storage** for the app's address. | Local Storage holds no token. Session Storage holds it (ADR 0002, #13). |
| UI-01j | Signed in, copy this tab's token from **Session Storage**. On the API docs page, authorize with it and call `POST /api/auth/sign-out`. Reload the tab. | The tab lands on the sign-in screen, with no error loop and no blank page. |
| UI-01k | Sign in again and copy the new token from **Session Storage**. Press **Sign out**, then the browser's **Back** button. Look at **Session Storage**. Then call `GET /api/users/me` on the API docs page with the copied token. | Sign-in screen. **Back** shows no signed-in content. Session Storage holds no token. The copied token gives **401**. |
| UI-01l | Signed in, close the tab. Open a new tab and type the app's address. | Sign-in screen: a closed tab does not stay signed in. |
| UI-01m | Without the mouse, sign up: Tab through every field, tick consent with Space, submit with Enter. Then sign in the same way. | Every control can be reached in a sensible order, the focused control is always visibly marked, and both forms work by keyboard alone. |
| UI-01n | Switch the language to English, then to Vietnamese, on both forms. Trigger one error each time. | Every label, button and error message changes language. No text stays in the other language. |
| UI-01o | In DevTools, turn on the device toolbar and set the width to 360, 768, 1280 and 1920 px. Look at both forms. | No sideways scrolling. Every field and button is visible and can be used. |
| UI-01p | Stop the backend. Press **Sign in** with correct details. | A message says the server cannot be reached. It does not say "Invalid email or password". |
| UI-01q | Run `npm run test:browser` on the B0 commit. | The real-API sign-in journey (Thắng, after #13) passes. Record the frontend and backend commits. |

## 5. TC-B0-DB-01: Database and API

| ID | Do this | Expect |
| --- | --- | --- |
| DB-01a | Locally, with an empty test database: `npm run build`, then `npm run db:migrate -w src/backend`. Run the migrate command a second time. | Both runs finish without an error. The second applies nothing new. |
| DB-01b | Open `<API>/api/health` in the browser. | `{"status":"ok","database":"up","postgresVersion":"18.6"}`. The version starts with 18. |
| DB-01c | Stop the database container (`podman stop` or `docker stop`) and open `/api/health` again. Then open the app's home page. Start the database again and wait a minute. | With the database stopped: still **200**, with `"status":"degraded"`, `"database":"down"` and `"postgresVersion":null`, and the home page says "API degraded · database down". After the restart: `"status":"ok"` again without restarting the API. |
| DB-01d | Open `<API>/api/docs`. Then open `<API>/api/docs-json`. | The docs page lists the `health`, `auth` and `users` groups and has an **Authorize** button. The JSON starts with `"openapi": "3.2.0"`. |
| DB-01e | Without Authorize, call every route on the docs page except health, sign-up and sign-in. | Each answers **401**. No route is open by accident (ADR 0002, default deny). |
| DB-01f | Curriculum constraints from PR #23: a duplicate cohort, a course code that breaks `^[A-Z0-9]{2,20}$`, and two requirement groups with the same name in one curriculum. | Each is refused by the database. The detailed steps are written when #23 lands. If #23 is not merged by 1 November: **not run, feature not merged** ([test plan §7](elaboration-test-plan.md#7-when-a-build-is-ready)). |

Already automated: `app.e2e-spec.ts` covers b and the OpenAPI version in d; `auth.e2e-spec.ts` covers `GET /api/users/me` in e.

## 6. TC-B0-DEP-01: Deployed build

No staging server exists yet: no host is chosen (issue #24), and `deploy.yml` only builds the files. For B0, run DEP-01c and DEP-01d on your own machine, and mark the others **blocked: no server yet** ([test plan §7](elaboration-test-plan.md#7-when-a-build-is-ready)). All six run on staging once it exists.

| ID | Do this | Expect | For B0 |
| --- | --- | --- | --- |
| DEP-01a | Open the staging site's address. | The address starts with `https://`. The home page shows "API ok · database up (PostgreSQL 18.x)". | Blocked: no server yet |
| DEP-01b | Open the staging `<API>/api/health`. | `"status":"ok"`, `"database":"up"`. | Blocked: no server yet |
| DEP-01c | With DevTools **Console** open, load the site and sign in. | No CORS errors and no other red errors. | Run locally |
| DEP-01d | Run AUTH-01a and AUTH-01k, and UI-01b once #13 is merged, with a new `example.com` email. | Sign-up and sign-in work end to end. | Run locally |
| DEP-01e | Tester X runs AUTH-01o on staging. Within the same minute, tester Y, on another network, signs in. | Y is signed in. If Y gets **429**, the rate limit counts the host's proxy instead of each person (ADR 0002, "trust proxy"): file a defect. | Blocked: no server yet |
| DEP-01f | On GitHub, open **Tags** and note the commit of `B0`. Open **Actions → Deploy** and note the commit of the run that created the tag. Note the commit this report tested. | All three commits are the same. | Blocked: no server yet |

## 7. Not in B0

These are not B0 acceptance cases and are left out on purpose: Google sign-in (deferred after B0, UC-01 A4), email verification, onboarding, account export and deletion (B1, `TC-B1-USER-01`), transcript import, and the AI gateway (B1, `TC-B1-AI-01`).
