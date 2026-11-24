# ADR 0010: Public pages and guide content

- Status: accepted
- Amends: [ADR 0002](0002-authentication-and-sessions.md)
- Date: 2026-10-30
- Owner: Dũng (F9 sharing, F11 guides)
- Deciders: Lâm (Project Lead), accepted 30 Oct 2026
- Reviewers: Hoà (`plans` API), Triết (Backend Lead)

## Context

[ADR 0002](0002-authentication-and-sessions.md) makes every route require a signed-in user unless it is marked `@Public()`. Today only three routes are public: health, sign-up and sign-in. Two features need pages that anyone can open:

- F9: a lecturer or academic advisor opens a student's shared plan from a link (UC-09). Most will not have an OmniCourse account.
- F11: guides hold only what the school publishes, so a student can read them before signing up (UC-10).

F11 also needs a place to keep guides that records every version (Vision F11: "Every guide is versioned").

The shared-plan route also crosses a module boundary: F9 is Dũng's, but plans belong to Hoà's `plans` module.

Lâm decided these points on 30 October 2026, in answer to Dũng's questions on UC-08 to UC-10. The same day Lâm confirmed two details: public pages only read, and a test catches any route made public by mistake.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **Guides can be read without signing in.** The routes that list, search and return a guide are `@Public()` and only read. The parts of a guide that use the student's data (the program's values from the rule engine, the courses of a plan) and **Report a problem** stay behind sign-in. | Keep sign-in for guides (ADR 0002 default). Make problem reports public too. | A guide holds no personal data, only what the school publishes. A public write would invite spam, with no user to rate-limit or trace. UC-10 A3, A4, A6. |
| **A shared plan opens without signing in.** One `@Public()` read route takes the link's token and returns only the content listed in UC-09 step 2. The token is 32 random bytes, like a session token. A stopped, deleted or unknown link gets the same "not shared" answer. The page tells search engines not to index it. | The reader must sign in. The student invites the reader by email. | Vision F9 shares the plan "with an academic advisor", who should not need an account. A 32-byte token cannot be guessed (ADR 0002). One answer for every dead link means the page does not reveal whether a plan exists. |
| **The shared-plan route lives in Dũng's own `sharing` module.** It reads plans only through a read-only method that Hoà's `PlansService` exports. | A route inside Hoà's plans controller. | One folder, one owner (Work Breakdown rule 2, as in ADR 0003). The public route can reach no write in the `plans` module. |
| **Guides are content files in the repository, loaded into the database by a seed.** One file per guide and language. There is no admin screen. A guide removed from the files is withdrawn, not deleted, so problem reports about it stay valid. | An admin screen like curriculum administration (UC-11). Editing guides straight in the database. | Git records every version and who changed it. Each change gets a second person's review in a pull request (guides plan §6). An admin screen would need its own permissions, which F11 has no time for: the whole feature is estimated at 10 hours (SDP v2 draft, PR #20). |

### Shared plans as built (amended 25 November 2026)

The API of F9 was built on 25 November 2026 (`src/backend/src/sharing/`). The points below are what the first table left to the implementation. They were chosen in the implementation pull request, each with the most private reading where UC-09 did not decide. The Project Lead accepts or changes them in the review of that pull request; the open ones are listed after the table.

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **Routes.** The owner: `GET`, `PUT` and `DELETE /api/plans/{id}/share`, behind sign-in, for their own plans only. `PUT` shares the plan: a plan not shared gets a new link, a plan already shared keeps its link and takes the new `showName`. The reader: `GET /api/shared-plans/{token}`, the one `@Public()` route of the module. | `POST` to create and `PATCH` to change the name choice; the token in a query string | One idempotent request covers "Create link", "the plan is already shared" (UC-09 A4) and "Show my name": two requests at once end with one link. Another student's plan answers 404, as in ADR 0014. |
| **One table, `plan_shares`, with at most one row per plan (`UNIQUE (plan_id)`). Stopping a link deletes its row.** The row has its own `user_id … ON DELETE CASCADE` and the composite key `(plan_id, user_id) → plans (id, user_id) ON DELETE CASCADE`, as `plan_placements` has. | A `revoked_at` column that keeps stopped links; a column on `plans` | With no row, a stopped link, a deleted plan, a deleted account and a link that never existed are the same lookup with the same answer (UC-09 A2, A6, A8). Nothing about old links is kept. Export and purge cover the table with no extra code (ADR 0004). |
| **The token is 32 random bytes in base64url, from `crypto.randomBytes`, and it is stored readable** in `share_token`. | Store only its SHA-256, as for a session token (ADR 0002); encrypt it with a server key | UC-09 A4 shows the live link again later, which a hash cannot do. A server key would be a new secret to deploy and rotate. The name ends in `_token`, so the account export never selects it. **Cost:** someone who reads the database can open every shared plan, though not the grades or the account behind it. |
| **The reader's answer is built field by field** (`sharing/shared-plan.ts`): the plan's name, the curriculum code, cohort and names, the program, the last change, each term with its courses (code, names, credits), slots (group name, credits), load and caps, the issues below, and the owner's display name only when `show_name` is true. It holds no id of the plan, the owner, the curriculum or a requirement group. | Return `PlanDto` and the engine's report as they are | UC-09 step 2 and §7 list what a reader sees. An e2e test compares the full set of keys at every level, so a field added later fails until someone allows it. |
| **The issues come from the rule engine's own report of the plan (`PlanIssuesProvider.issuesFor`), and the answer leaves out every issue code that the engine decides from the owner's transcript**: `prerequisite_not_met`, `already_passed`, `already_in_progress` and `requirement_not_covered`, with the coverage and the graduation status. The ten other codes follow from the plan and its curriculum alone. The answer names the codes left out (`issueCodesNotShown`), so the page can say that these checks are not shown. | Show every issue the owner sees (UC-09 A9 as written); run the engine without the transcript | Each of the four codes, by being there or by being absent, tells a reader which courses the owner has passed, failed or is taking, and UC-09 §7 says the transcript never appears. Running the engine without the transcript would report passed prerequisites as violations: wrong verdicts under the engine's name (AGENTS.md hard rule 1). Two tests save a transcript that changes the owner's own report and check that the reader's answer stays exactly the same. A code the engine gains later stays hidden until a person adds it to the list (`shared-plan.spec.ts`). |
| **No estimated graduation term.** | Work one out in the sharing module | Nothing in `src/` computes one ([design differences](../design-differences.md), UC-03 and UC-05), and a module other than the rule engine must not (hard rule 1). |
| **A deletion request deletes the account's `plan_shares` rows in the same transaction that revokes the sessions.** The public read also refuses an account that is waiting for deletion, and `PUT …/share` locks the account's row, so a share request that crosses a deletion request leaves no link. | Only check `deletion_requested_at` when a link is read | UC-09 A7: the links stop at once and stay stopped when the account is restored. A check at read time alone would bring the links back on restore. |
| **Every answer of the public route, the 404 included, carries `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`.** A token that is not 43 base64url characters is answered without a database query. | A header only on the 200 | UC-09 §7 asks for `noindex`; a cached answer would outlive a stopped link (A2). The page itself must add its own `noindex`: the API's header covers only the API's answer. |
| **No PDF on the server.** | A PDF library in the API | UC-09 leaves "browser or server" open, A1 keeps no file on the server, and the prototype prints the page (`print()`). A server PDF needs a new dependency, which is the Project Lead's decision. |

Open, for the Project Lead:

1. Whether a reader may see the four issue codes left out. Showing them is what UC-09 A9 says ("the same problems as the student"); leaving them out is what UC-09 §7 says ("the transcript never appears"). The prototype `shared.html` also shows the passed courses and the coverage of each requirement group, which come from the transcript too and are not in the answer.
2. Whether the token should be stored as a hash, at the price of showing the link only once (UC-09 A4 would change).
3. Whether the PDF is the browser's print layout or a server file.

## Consequences

- After this ADR, five kinds of route are public besides the API docs pages: health, sign-up, sign-in, reading guides and reading a shared plan. Anyone can open them, but nobody can change anything without signing in. The one exception is sign-up and sign-in themselves, which must stay open or nobody can get in. Every other route stays default-deny, and a new public route needs a change to this ADR.
- `src/backend/test/public-routes.e2e-spec.ts` takes the OpenAPI document of the whole app, calls every route without a token and expects 401, except for the routes on its allowed list. It also fails:
  - if a listed route is missing or answers 401;
  - if the list holds a write other than sign-up and sign-in;
  - if the document lacks `GET /api/users/me`, so the 401 check cannot pass by checking nothing;
  - if Express serves a route the document lacks, such as one hidden with `@ApiExcludeEndpoint`.

  It runs in CI on every pull request. A new public route fails it until it is added to the list, where reviewers see it. Today the list holds health, sign-up and sign-in; the guides and shared-plan pull requests add their routes. *Since 25 November 2026* the list also holds the two guide reads and `GET /api/shared-plans/{token}`.
- The API docs pages are public too: `/api/docs` with its assets, `/api/docs-json` and `/api/docs-yaml`. `SwaggerModule.setup` serves them outside any controller, so they are not in the document, and the test skips them by path. They only describe the API. They are not served when `NODE_ENV=production` unless `API_DOCS=true` (issue #28).
- Public routes use the global rate limit (120 requests a minute per address). Behind the staging host's proxy, all visitors share one address until `trust proxy` is set (ADR 0002, Deferred). That fix now protects public pages as well as sign-in.
- Hoà's `plans` module exports one read-only method for the `sharing` module. F9 needs it before Sprint 4 (B2). *As built:* `PlansService.find(userId, planId)`, which returns the owner's plan or null and writes nothing; the owner routes check ownership with `PlansService.get`.
- The `account` module imports `sharing`, so that a deletion request stops the links (UC-09 A7).
- Regulation documents for the advisor chat (UC-08) use the same approach, also decided by Lâm on 30 October: files in the `advisor` module, typed by hand and reviewed in pull requests. They are not public pages. *Amended 15 November 2026 (Lâm):* typing by hand, with no AI, stays the rule for the regulation files only. An AI tool may draft and translate guide text; portal addresses, labels and steps still come only from the school's pages or the portal, and no personal data goes into the tool (guides plan §6 step 1).
