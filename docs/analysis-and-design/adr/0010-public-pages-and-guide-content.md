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

## Consequences

- After this ADR, five kinds of route are public besides the API docs pages: health, sign-up, sign-in, reading guides and reading a shared plan. Anyone can open them, but nobody can change anything without signing in. The one exception is sign-up and sign-in themselves, which must stay open or nobody can get in. Every other route stays default-deny, and a new public route needs a change to this ADR.
- `src/backend/test/public-routes.e2e-spec.ts` takes the OpenAPI document of the whole app, calls every route without a token and expects 401, except for the routes on its allowed list. It also fails:
  - if a listed route is missing or answers 401;
  - if the list holds a write other than sign-up and sign-in;
  - if the document lacks `GET /api/users/me`, so the 401 check cannot pass by checking nothing;
  - if Express serves a route the document lacks, such as one hidden with `@ApiExcludeEndpoint`.

  It runs in CI on every pull request. A new public route fails it until it is added to the list, where reviewers see it. Today the list holds health, sign-up and sign-in; the guides and shared-plan pull requests add their routes.
- The API docs pages are public too: `/api/docs` with its assets, `/api/docs-json` and `/api/docs-yaml`. `SwaggerModule.setup` serves them outside any controller, so they are not in the document, and the test skips them by path. They only describe the API.
- Public routes use the global rate limit (120 requests a minute per address). Behind the staging host's proxy, all visitors share one address until `trust proxy` is set (ADR 0002, Deferred). That fix now protects public pages as well as sign-in.
- Hoà's `plans` module exports one read-only method for the `sharing` module. F9 needs it before Sprint 4 (B2).
- Regulation documents for the advisor chat (UC-08) use the same approach, also decided by Lâm on 30 October: files in the `advisor` module, typed by hand and reviewed in pull requests. They are not public pages.
