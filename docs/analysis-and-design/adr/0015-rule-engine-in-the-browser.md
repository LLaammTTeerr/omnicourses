# ADR 0015: The rule engine in the browser for the drag preview

- Status: accepted
- Date: 2026-11-12
- Deciders: Lâm (Project Lead), 12 Nov 2026 ([#95](https://github.com/LLaammTTeerr/omnicourses/issues/95#issuecomment-6824731321), with the rate limit of [#96](https://github.com/LLaammTTeerr/omnicourses/issues/96#issuecomment-6824732058))
- Reviewers: Hoà (F5 planner), Triết (rule engine)

## Context

While a student drags or lifts a course in the planner (F5, UC-05), each term row shows what the rule engine would report if the course landed there: a tone (no problem, worth a look, not checked, breaks a rule) and the term's load against its caps. The tone depends on academic rules: prerequisites (including those a move breaks in another term), offering terms, credit caps by term kind and training type ([ADR 0012](0012-credit-caps-by-training-type.md)), placed twice, already passed and in progress. AGENTS.md hard rule 1 leaves these to the deterministic rule engine ([ADR 0013](0013-rule-engine-and-degree-audit.md)); the frontend must not keep its own copy of them.

Today the preview asks the server. PR 90 first sent one request per row (about 14 per drag), which hit the global limit of 120 requests a minute per address ([ADR 0002](0002-authentication-and-sessions.md)), and a 429 left rows without a preview. It now sends one batched request per drag (`POST /api/plans/{id}/issues/drops`). That keeps a single student far from the limit, but every drag still costs a round trip before the rows are coloured, and the requests still count against a limit that students behind one campus address share.

That shared limit is decided separately: the Project Lead accepted [#96](https://github.com/LLaammTTeerr/omnicourses/issues/96) on 12 Nov 2026. After sign-in the limit counts per student (120 a minute, keyed by `user.id`), and only a higher flood ceiling counts per address before sign-in; ADR 0002 changes with that PR. It removes the shared campus budget, not the round trip, so this ADR still stands.

The engine itself is pure: `checkPlan` in `src/backend/src/rules/plan-issues.ts` takes the board, the curriculum rules, the course rules, the transcript and the catalog credits, and returns the report. It imports only types and other pure functions, with no database, Nest or Node dependency.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **Run the same rule engine in the browser for the drag preview.** Move `checkPlan` and the pure modules it imports into a workspace package (for example `src/rules-engine`) that both the backend and the frontend import. The preview colours each row from the engine's report on the board with the drop made, with no request. | A frontend copy of the checks; keep asking the server per drag | Hard rule 1 asks that the deterministic engine decides, and the browser would run that same code, not a second implementation. A copy would drift and break the rule. The server round trip is what makes the preview slow and rate-limited. |
| **A new route gives the engine's inputs for one plan** (curriculum rules, course rules for the codes in reach, the student's own transcript entries, catalog credits), loaded when the editor opens a plan. | Fetch inputs per drag | One load per plan, not per drag. The transcript is the student's own data, already readable by them. |
| **The server stays authoritative.** Every save still runs the engine on the server (`GET /api/plans/{id}/issues`), and the issues panel, the status strip and every stored or shared result show the server's report. The browser engine only colours rows during a drag. | Trust the browser's report everywhere | A browser can be tampered with or hold stale inputs. The preview is advice before a drop; the saved plan's report is the record. |
| **Inputs are reloaded whenever the server's report disagrees with the browser's on the saved board,** and when the transcript or the curriculum version changes. | Never reload during a session | The transcript (F2) and the curriculum (F12) can change while a plan is open; a mismatch shows the browser's inputs are stale. |

## Consequences

- One request less per drag; the rows colour as soon as the drag starts, and drags no longer count against the rate limit.
- A new workspace package and its build: both the backend (NodeNext) and the frontend (Vite) must import it. The engine's ≥ 80 % coverage rule (Vision NFR) moves with it.
- The `POST /api/plans/{id}/issues/drops` route can be removed once the browser engine ships, or kept as a fallback for a browser that cannot load the inputs.
- A new route that returns rule inputs, documented in the OpenAPI contract; its shape becomes part of the engine's interface.
- Open: whether the AI plan generator (F6) or the advisor (F8) should use the same package. Both already call the engine on the server, so nothing changes for them.
