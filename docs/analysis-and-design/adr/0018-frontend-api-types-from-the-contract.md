# ADR 0018: Frontend API types generated from the OpenAPI contract

- Status: proposed
- Date: 2026-11-13
- Deciders: Lâm (Project Lead)
- Reviewers: Hoà (frontend)

## Context

The API publishes its contract as OpenAPI 3.2.0 ([ADR 0001](0001-technology-stack.md)), committed as `src/backend/openapi.json`; a backend test fails when the committed file differs from what the code generates. Until now the frontend copied every request and response type by hand into each feature's `api.ts` (about 80 types in 9 files), and per-schema "Shape" specs (`testing/contract.ts`) checked the copies against the file. On 9 November `openapi-typescript` was ruled out because it needs TypeScript 5 and the repo pins 6.0.3 ([architecture.md](../architecture.md), "API types").

The copies drifted in ways the checks could not see:

- A Shape spec compares property names and whether each is required. It never compares a property's type: `credits: number | null` copied as `credits: number` passes.
- Types were copied twice (`TERM_KINDS` and `CreditCaps` in both `audit/api.ts` and `plans/api.ts`), and features imported each other's DTOs (`audit/api.ts` → `transcript/api.ts`, `plans/api.ts` → `curriculum/api.ts`).
- On main at 37b8e45, the three `PlanDrop*` types of `POST /plans/{id}/issues/drops` had no check at all.
- Twelve enum arrays (`COURSE_STATUSES`, `PLAN_ISSUE_CODES`, …) existed only to derive a type and feed a spec.

## Decision (proposed)

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **Generate the frontend's DTO types from `src/backend/openapi.json` with `@hey-api/openapi-ts` 0.99.0**, pinned exactly, as a frontend dev dependency only, with the `@hey-api/typescript` plugin alone (types; no client, no SDK, nothing that runs). | `openapi-typescript` 7.13.0; `swagger-typescript-api` 13.13.0; keep the hand-written types | `openapi-typescript`: upstream says it is "in maintenance mode and won't be getting any more updates" (issue #2874, 19 Sep 2026); its peer `typescript ^5.x` makes npm 11 refuse to install it beside TypeScript 6.0.3 (ERESOLVE) unless overridden; OpenAPI 3.2 (#2577) and TypeScript 6 issues are open. `swagger-typescript-api`: drops `null` from all 9 nullable enum fields, for example `OnboardingDto.program` and `TermSummaryDto.kind`. `@hey-api/openapi-ts`: peer `typescript >=5.5.3 \|\| >=6.0.0`, Node `>=22.18` (we run 22.22.1), maintained (MIT), `tsc --strict` passes on its output. Trial: 56 of 62 hand-written types were identical to the generated ones in both directions. |
| **One generated module, committed: `src/frontend/src/api-schema/types.gen.ts`.** `npm run generate:api -w src/frontend` writes it (config: `src/frontend/openapi-ts.config.ts`). The generator owns the folder and empties it on every run. | Generate at build time; generate one file per feature | Committed, a build or a fresh clone needs no generation step and the diff of a contract change shows in review. One file mirrors one contract. |
| **`src/api-schema.spec.ts` regenerates into a temporary folder and fails when the committed module differs.** It runs in the existing frontend unit job, so no CI workflow changes. | A separate CI step; trust contributors to regenerate | Same pattern as the backend's `openapi.json` check: the contract and the client types cannot drift apart unnoticed. Mutation-checked both ways: editing the generated file, and editing a value in the contract, each turn the spec red. |
| **Each feature's `api.ts` keeps its request functions and names the types it uses as aliases** (`export type Plan = PlanDto`), with enum types as indexed types (`PlanIssueDto['kind']`). | Import generated names everywhere | Screens keep their short names; the folder that changes with a contract (`api-schema/`) is separate from the code that calls the API. |
| **Where the client is stricter than the contract for a real reason, it keeps a narrowing alias built from the generated type**, documented beside it and type-tested to stay within the contract (`expectTypeOf<Narrow>().toExtend<Generated>()`, checked by `npm run typecheck`): `SignUpBody.acceptedTerms: true` (consent; the API refuses false), and `GuideNoteSource` as a union (the backend's guide validation requires a regulation's document, clause and url), which `GuideText` and `Guide` inherit. `GuideTexts<T>` stays a generic helper, keyed by the contract's languages (`keyof GuideTextsDto`). | Accept the weaker types; change `openapi.json` | The contract is the source of truth, and the untangle PRs keep `openapi.json` byte-identical. A narrowing that the type test holds within the contract cannot drift outside it. |
| **Values the app needs at run time stay hand-written and are checked against the contract**: `TRANSCRIPT_RESULTS`, `GUIDE_GROUPS`, `GUIDE_LANGS`, `AUDIT_UNAVAILABLE_CODES`, `TERM_NUMBERS`, `ISSUE_KINDS_SHOWN` (each `satisfies` the generated type, and a spec checks it lists every value), and the lengths and bounds already checked by specs. | Generate runtime enum constants | The generator produces none here (every enum is inline), and these arrays carry an order the contract does not (the order a screen lists them in, or strongest first). |

## Consequences

- About 80 hand-copied types are gone, with the two duplicates, the cross-feature DTO imports, the twelve type-only enum arrays and the per-schema Shape specs (each removed spec is listed in the PR that made the change).
- A contract change now shows up as a compile error at every screen that uses the changed field, not only as a failing Shape spec for names.
- `@hey-api/openapi-ts` adds 42 packages to the lockfile, all dev-only (MIT, ISC, BSD-2-Clause), none with an install script. Nothing of it reaches the bundle: the generated module holds types only.
- `@hey-api/openapi-ts` is 0.x: a minor release may change its output. Upgrade it in its own PR, regenerate, and review the diff of `types.gen.ts`.
- **It parses OpenAPI 3.2.0 with its 3.1 parser.** Our contract uses no keyword that exists only in 3.2 today (no `$self`, `itemSchema`, `query`, `querystring` or `additionalOperations`). If a route adopts one, for example `itemSchema` for a server-sent event stream, the generator may produce `unknown` or skip it (upstream #2660, #4332). Check the generated diff when a route uses a 3.2 keyword.
- Two contract defects show up in the generated types and are left to the backend: `AdminErrorDto.message` and `PermissionRequiredDto.message` are typed `object`, because the DTO declares `message: string | string[]` with no `type` in its `@ApiProperty` and Swagger reflects the union as Object (`src/backend/src/curriculum-admin/admin-errors.ts:15-16`). The frontend does not use them yet.
- `OnboardingDto.program` lists the programs this release offers, so the client's answer type follows each release. `curriculum/programs.ts` types `OFFERED_COHORTS` by it, and the onboarding pickers accept only an offered program (`isOffered`).
- Contributors: after `npm run openapi -w src/backend`, run `npm run generate:api -w src/frontend` and commit both files.
