# Backend platform survey (BAC)

Scope: src/backend/src/{app.module,bootstrap,main,features,openapi*}.ts, common/, config/, database/ (not seed rows), auth/, users/, health/, account/, ai/, backend package/tsconfig/vitest configs. Base: 3c4da22. Read-only survey.

## 1. Model of the area

- **Composition root**: `main.ts` -> `AppModule` (TypeORM root, Throttler, ClockModule, `FEATURE_MODULES`; APP_GUARDs ThrottlerGuard then AuthGuard) -> `configureApp()` (prefix, ValidationPipe, CORS, security headers, `FEATURE_SETUPS`, Swagger). `openapi-document.ts` rebuilds the same import list by hand for the contract.
- **Registries edited by hand**: `features.ts` (15 modules on one line + 1 setup hook), `migrations/index.ts` (import + array entry per migration, completeness guarded by `index.spec.ts`), `database/seed.ts` (2 feature seeds).
- **config/**: `env.ts` typed getters (lint forbids `process.env` elsewhere) plus the AI DI token; `clock.ts` global Clock; `time.ts` day maths.
- **common/**: error helpers (`api-errors.ts`, coded `{statusCode, code, message}`), strict body / UUID pipes, failure logging that never prints messages (`failure-kind.ts`), field validators (and `TermDto`, which imports `terms/`).
- **auth/**: sessions, argon2, global guard + decorators, throttler config, and a DB-backed per-(IP,email) sign-in limiter (#207). Depends on users (service, entity, dto).
- **users/**: the `users` row and a repository facade with methods for each consumer (auth: `findByEmailForAuth`, `findPasswordHash`, `cancelDeletion`; account: `markDeletionRequestedWithin`, `findDueForPurge`, `purgeIfDue`). `users.controller.ts:3` imports `auth.decorators`, which imports User/Session as types only: a folder cycle, not a file cycle (depgraph `fileCycles` lists only curriculum entities).
- **account/**: export by catalog (ADR 0004), deletion request (revokes sessions, stops shares, takes curriculum-admin's lock), hourly purge.
- **ai/**: gateway, cost guard (`ai_usage`), OpenRouter client, SSE. Almost every file is owned by in-flight PR #77.
- **State**: Postgres only. Advisory locks are numbered in three modules; the in-memory throttler is per process.

## 2. Ideal direction

- Each cross-cutting concept has one owner module that exports its rule. Today that fails for "account pending deletion", "advisory lock ids", "API error envelope" and "password-attempt limit".
- Leaf folders (`common`, `config`) import nothing from feature folders. Features import platform code, never the reverse, and a lint rule checks this.
- The composition root is a set of append-only lists, one entry per line, and one function builds the platform imports for both the app and the contract.
- Feature data lives in the feature folder (curriculum seed rows), so `database/` holds only the data source, the migrations and the orchestration.
- Steps are incremental and keep the contract fixed. Error-shape unification is the only piece that needs a product decision.

## 3. Findings

### BAC-1 Give users one owner for "account pending deletion": an exported predicate and row lock, used by every module that now re-reads `deletion_requested_at` in raw SQL
- Problems it solves:
  - Hidden link (copied rule, 9 sites, 5 modules), all verified by `rg -n "deletionRequestedAt|deletion_requested_at" src/backend/src`:
    - `src/backend/src/auth/auth.service.ts:86` and `:111` (entity field)
    - `src/backend/src/sharing/sharing.service.ts:57` (`... AND "deletion_requested_at" IS NULL FOR SHARE`) and `:93` (public read filter)
    - `src/backend/src/notifications/notifications.service.ts:24` (INSERT ... WHERE `u."deletion_requested_at" IS NULL`)
    - `src/backend/src/curriculum-admin/admin-lookups.ts:57-59`
    - `src/backend/src/curriculum-admin/access-admin.service.ts:18` and `:32`
    - `src/backend/src/curriculum-admin/admin-write.service.ts:38` (`FOR NO KEY UPDATE`), `:42` and `:81`
  - Needless link (cross-module reach): four modules query the `users` table directly by column name, while `users/` owns the entity.
  - Hidden link (call order): `src/backend/src/account/account.service.ts:41-44` takes `ACCESS_MANAGER_LOCK` and then calls three `*Within(manager)` methods (users, auth, sharing). The write paths in sharing and curriculum-admin lock the users row (`FOR SHARE`, `FOR NO KEY UPDATE`) to serialise against that request. This protocol is written down only in `account.service.spec.ts:78` and in ADR 0004's 25 Nov amendment.
- Callers and dependents: found with the rg above plus `rg -n "Within\(" src/backend/src`. Affected: auth, sharing, notifications, curriculum-admin, account and users.
- Cost today: changing what "pending" means needs 9 edits in 5 folders, three of them inside SQL strings. Examples: also treat `purge_after <= now` as gone, which ADR 0004 says sign-in already does through `cancelDeletion`. A new feature whose writes must stop for a pending account has to discover the row-lock convention by reading sharing.
- Proposed change:
  1. In `users/`, export `ACTIVE_USER_SQL`, a fragment such as `"deletion_requested_at" IS NULL` with an alias parameter.
  2. Export `isDeletionPending(user)`.
  3. Add `UsersService.lockActive(manager, ids, mode: 'share' | 'no key update')`, returning the active ids in id order.
  4. Replace the 9 sites with these. `lockAdminWrite` keeps its advisory locks and calls `lockActive` for the row step.
  5. Retire the inline SQL. Optionally add a lint rule (BAC-6) that flags the string `deletion_requested_at` outside `users/` and migrations.
- Contract impact: none. The SQL text changes, the semantics do not.
- Write scope: `src/backend/src/users/`, `src/backend/src/sharing/sharing.service.ts`, `src/backend/src/notifications/notifications.service.ts`, `src/backend/src/curriculum-admin/{admin-lookups,access-admin.service,admin-write.service}.ts`, `src/backend/src/auth/auth.service.ts`. This overlaps BAC-2 and BAC-4 on `admin-write.service.ts` and `auth.service.ts`: run them in one batch or in sequence.
- Effort M, risk med (lock modes and row order must stay identical), confidence high.
- Verification: e2e `account`, `plan-sharing`, `notifications`, `curriculum-admin*` (the lock tests in `test/support/locks.ts`); unit `account.service.spec`, `auth.service.spec`. A grep that `deletion_requested_at` appears only in `users/` and migrations.
- Alternatives: (a) a deletion event that each module subscribes to. Rejected: Nest has no event bus here, and the work must share the caller's transaction. (b) Leave it. The rule is stable today, but every new user-facing write copies it.

### BAC-2 Put every advisory-lock key in one registry (`common/advisory-locks.ts`) with a uniqueness spec, so account stops importing curriculum-admin for a number
- Problems it solves:
  - Hidden link (scattered magic numbers):
    - `src/backend/src/curriculum-admin/admin-write.service.ts:25-26` (`ADMIN_WRITE_LOCK = 11_012_001`, `ACCESS_MANAGER_LOCK = 11_012_002`)
    - `src/backend/src/auth/auth.service.ts:28` (`SIGN_IN_ATTEMPT_LOCK_NAMESPACE = 11_012_003`, added by #207, which continued the series by hand)
    - `src/backend/src/ai/ai-cost-guard.service.ts:12` (`AI_QUOTA_LOCK_NAMESPACE = 3003`)
    - Choosing a new key means grepping for every `pg_advisory_xact_lock`.
  - Needless link: `src/backend/src/account/account.service.ts:7` and `src/backend/src/curriculum/seed-curricula.ts` import lock constants from `curriculum-admin/admin-write.service.ts`, a service file. That import is the account -> curriculum-admin edge in the depgraph and part of the curriculum <-> curriculum-admin cycle.
  - Special case: two key styles. Single bigint (`pg_advisory_xact_lock($1)`) is used by admin and account; `(int, hashtext)` by auth and ai. Assumed from PostgreSQL docs, not run here: the two forms are separate key spaces (`pg_locks.objsubid` 1 vs 2), so nothing collides today. That safety is accidental and not visible in the code.
- Callers: `rg -n "advisory" src/backend/src` gives 6 call sites.
- Cost today: a new lock means knowing all four numbers and both styles. A reader of account must open curriculum-admin to learn what `ACCESS_MANAGER_LOCK` guards.
- Proposed change:
  1. Add `common/advisory-locks.ts` exporting `ADVISORY_LOCKS = { adminWrite, accessManager, signInAttempt, aiQuota }` and `lockXact(em, key, sub?)`.
  2. Add a spec that asserts unique values.
  3. Point the 6 sites at it, and re-export from `admin-write.service.ts` only during the switch.
  4. The ai site is deferred (in-flight PR #77 owns `ai-cost-guard.service.ts`). Add its key to the registry now and switch the call after #77 merges.
- Contract impact: none. The numeric values stay, so running servers interoperate during deploy.
- Write scope: new `src/backend/src/common/advisory-locks.ts` (+ spec), `src/backend/src/curriculum-admin/admin-write.service.ts`, `src/backend/src/account/account.service.ts`, `src/backend/src/curriculum/seed-curricula.ts`, `src/backend/src/auth/auth.service.ts`. ai deferred: in-flight PR #77.
- Effort S, risk low, confidence high.
- Verification: `account.service.spec.ts:78` (asserts the lock id), the lock e2e tests, typecheck.
- Alternatives: keep the constants local and only add a spec that greps for duplicate literals. Cheaper, but it keeps the account -> curriculum-admin import.

### BAC-3 Build every coded API error through `common/api-errors.ts`, and enforce it; decide separately whether the uncoded Nest errors get codes
- Problems it solves:
  - Hidden link (copies of the envelope):
    - `src/backend/src/notifications/notifications.service.ts:17` is a byte-for-byte copy of `notFound()` (`common/api-errors.ts:15`).
    - `src/backend/src/audit/audit.controller.ts:30` and `:33-37` hand-build the same object as `conflict()` (`api-errors.ts:19`), same keys in the same order.
    - `src/backend/src/curriculum-admin/admin-write.service.ts:13` and `:16` hand-build 403s, and `curriculum-admin/admin-errors.ts:54-61` builds more. There is no 403 helper.
    - `src/backend/src/ai/sse.ts:47` repeats `'ai_unavailable'` and the `AI_REASONS.unavailable` text (deferred: in-flight PR #77).
  - Special case (two envelopes):
    - Coded `{statusCode, code, message}`: curriculum-admin, academic-calendar, audit, notifications, ai.
    - Nest default `{statusCode, message, error}`, no code: auth (`auth.service.ts:57,84,88,124,154,185`), account (`account.service.ts:37`), plans (`plans.service.ts:18-19,54,119-144`, `plan-id.ts:4`), curriculum (`curriculum.service.ts:54,81`), guides (`guides.service.ts:35`), sharing (`sharing.service.ts:21`, `sharing.controller.ts:12`).
    - The SPA copes with both (`src/frontend/src/api.ts:35-37`, `code` nullable). A module author must pick one with no rule to follow.
  - Surplus/misnaming: the shared envelope DTO is `AdminErrorDto` (`common/api-errors.ts:4`), used by academic-calendar too.
- Callers: found with `rg -n "code: '[a-z_]+'"` and `rg -n "new (NotFound|BadRequest|Conflict|Forbidden|Unauthorized|HttpException)"` over `src/backend/src`.
- Cost today: a new error code means choosing between helper and copy, and checking by eye that key order and status match. The F8 and F6 screens and the admin screens branch on `code`. Other screens can only match message text.
- Proposed change (contract-neutral part):
  1. Add `forbidden(code, message, extra)` and a generic `apiError(status, code, message, extra)` to `common/api-errors.ts`.
  2. Replace the copies in notifications, audit and admin-write/admin-errors with these helpers.
  3. For `permission_required`, the current body key order is `statusCode, code, permission, message`. Keep it by letting the helper take `extra` before `message`, or accept the order change (JSON key order, not in openapi.json).
  4. Add a lint rule in `scripts/lint.mjs` that flags `code: '` inside `new *Exception(` outside `common/api-errors.ts` and `ai/ai-unavailable.error.ts`.
- Needs decision:
  - (a) Give codes to the uncoded errors listed above (`email_taken`, `invalid_credentials`, `session_not_found`, `wrong_password`, `too_many_attempts`, `plan_not_found`, …). This changes response bodies (adds `code`, drops Nest's `error` field) but not the status codes or openapi.json, where most of these are described by text only.
  - (b) Rename `AdminErrorDto` to `ApiErrorDto`. This changes the component name in `openapi.json`.
- Write scope: `src/backend/src/common/api-errors.ts`, `src/backend/src/notifications/notifications.service.ts`, `src/backend/src/audit/audit.controller.ts`, `src/backend/src/curriculum-admin/{admin-write.service,admin-errors}.ts`, `scripts/lint.mjs`. sse.ts deferred: in-flight PR #77.
- Effort S (neutral part) / M (decision a), risk low, confidence high.
- Verification: the existing e2e tests that assert bodies (`audit`, `notifications`, `curriculum-admin*`), the openapi drift test, `npm run lint`.
- Alternatives: a global exception filter that adds codes. Rejected for now: it changes every body at once and hides where codes come from. Or leave it, and the second envelope keeps spreading with each module.

### BAC-4 Give the password-attempt limit one home: extract the DB sign-in limiter from AuthService and derive its numbers from `PASSWORD_LIMIT`
- Problems it solves:
  - Hidden link (copied value): `src/backend/src/auth/auth.service.ts:26-27` (`MAX_FAILED_SIGN_INS = 10`, `FAILED_SIGN_IN_WINDOW_MS = MINUTE_MS`) repeats `src/backend/src/auth/rate-limits.ts:7` (`PASSWORD_LIMIT` 10 per minute). `docs/analysis-and-design/architecture.md:124,272` describes both as one "10 a minute" rule.
  - Needless link (one service, four jobs): `AuthService` (225 lines) holds password hashing, sessions, deletion cancel and, since #207, a 50-line attempt limiter with its own entity, advisory lock and batch purge (`auth.service.ts:28-29,172-203`). `auth.service.spec.ts` grew by 340 lines in #207, mostly for it.
  - Surplus special case (verified): `auth.service.ts:110,122,142` guard `session.createdAt` for null/undefined, but `sessions.created_at` is `NOT NULL DEFAULT now()` (`migrations/1761696000000-create-users-and-sessions.ts:29`) and `@CreateDateColumn`. Added by #207 (git blame).
  - Special case (open question 2): `auth.service.ts:216` `Math.max(MAX_SESSION_LIFETIME_DAYS, sessionTtlDays())` lifts the "hard 30-day cap" when `SESSION_TTL_DAYS > 30`.
- Callers: `rg -n "PASSWORD_LIMIT|THROTTLERS|MAX_FAILED_SIGN_INS|signInAttemptKey"` finds `auth.controller.ts:18`, `account.controller.ts:5`, `app.module.ts:6` and `auth.service.spec.ts:9`.
- Cost today: changing the password-attempt policy means editing two files that do not reference each other. Reading sign-in means reading the limiter's locking.
- Proposed change:
  1. Move `reserveSignInAttempt`, `purgeExpiredSignInAttempts`, `signInAttemptKey` and the constants into `auth/sign-in-limiter.ts`, an `@Injectable` registered in `AuthModule`.
  2. Take its limit and window from one named constant in `rate-limits.ts`, shared with `PASSWORD_LIMIT`.
  3. AuthService calls `limiter.reserve(key, now)` and `limiter.clear(key)`.
  4. Split the limiter cases out of `auth.service.spec.ts` into `sign-in-limiter.spec.ts`, moved verbatim.
  5. Drop the `createdAt` null guards, but only if open question 2's answer and the spec fixtures (`auth.service.spec.ts:97` always sets it) confirm nothing relies on them.
- Contract impact: none. The 429 text and status are unchanged.
- Write scope: `src/backend/src/auth/` only. Doc line updates in `architecture.md` are deferred: in-flight PR #77.
- Effort S-M, risk low, confidence high.
- Verification: `rate-limits.e2e-spec.ts` (11th sign-in refused), `auth.e2e-spec.ts`, the moved unit cases unchanged.
- Alternatives: move `THROTTLERS` to `common/` as well. Low value, because app.module imports auth for AuthGuard anyway. Leave it, and the duplicate "10" can drift.

### BAC-5 Make the composition root append-only and single-sourced: one entry per line in the registries, and one function for the platform imports shared by app and contract
- Problems it solves:
  - Contention: `src/backend/src/features.ts:19` lists all 15 modules on one ~230-character line. Every new feature edits that line, so two parallel feature PRs always conflict textually. features.ts has 13 commits since 1 Nov. Order has been free since #183 (`openapi-document.spec.ts` "does not depend on the order").
  - Contention/surplus: `migrations/index.ts` needs each migration twice (import at :1-16 and array entry at :20-37). The spec already fails on an omission (`index.spec.ts` "lists every migration file"), so this is churn, not an enforcement gap.
  - Hidden link: `src/backend/src/app.module.ts:12-16` and `src/backend/src/openapi-document.ts:13-14` each assemble `[TypeORM root, ClockModule, ...FEATURE_MODULES]` by hand. A new global module such as ClockModule (#188) must be added to both, or the contract build fails at DI.
- Callers: `rg -n "FEATURE_MODULES|ClockModule" src/backend` finds app.module, openapi-document (+spec) and features.
- Cost today: adding a module edits 4 to 5 shared files: features.ts, migrations/index.ts (twice), seed.ts if seeded, the architecture.md table, and openapi.json.
- Proposed change:
  1. features.ts: one module per line, sorted by name.
  2. migrations/index.ts: one line per migration, by `export { X } from './file.js'` in a barrel, plus `MIGRATIONS = Object.values(barrel).sort(byTimestamp)`. Keep the class list per ADR 0002 (no globs).
  3. A `platformImports(typeOrmOptions)` function next to app.module, used by both AppModule and `buildOpenApiDocument`.
- Contract impact: none. openapi.json is sorted, and migration order follows timestamps, which the spec already asserts are unique.
- Write scope: `src/backend/src/app.module.ts` and `src/backend/src/openapi-document.ts` can go now. `features.ts` and `migrations/index.ts` are deferred: in-flight PR #77.
- Effort S, risk low, confidence high.
- Verification: openapi drift test, `migrations/index.spec.ts`, the e2e boot.
- Alternatives:
  - Module self-registration by folder scan. Rejected: ADR 0002 rejected globs between ts and dist, and the explicit list is the discoverability point.
  - Leave it. Conflicts there are easy to resolve, but they are guaranteed.

### BAC-6 Keep platform folders leaves and give them a lint check: move `TermDto` out of `common/`, and teach `scripts/lint.mjs` the import direction
- Problems it solves:
  - Needless link (stable code importing domain code): `src/backend/src/common/field-validators.ts:5` imports `terms/term.js` for `TermDto` (`:98-107`). It is the only edge out of `common/` (depgraph: common dependsOn ["terms"]). common has fan-in from 15 folders, so all of them depend on `terms` through it.
  - Enforcement gap: the layering is protected only by discipline. AGENTS.md says one module per feature folder, and `common`/`config` are meant to be leaves. `scripts/lint.mjs` already walks every backend file (`lintWorkspace`), but it checks only `process.env`, ts-ignore, debugger, Vue rules and CSP.
  - The same rule would back BAC-1 (no `deletion_requested_at` outside users) and BAC-3 (codes only via api-errors).
- Callers: `rg -ln "TermDto\b" src/backend/src` finds 7 users: onboarding.controller, onboarding.dto, plans/plan-issues.dto, plans/plans.dto, sharing.dto, audit.dto and transcript.dto.
- Cost today: a change to `terms/term.ts` touches the dependency closure of every module, and the next shortcut into common goes unnoticed.
- Proposed change:
  1. Move `TermDto` to `src/backend/src/terms/term.dto.ts` and update the 7 imports. The class name stays, so the OpenAPI schema `TermDto` is unchanged.
  2. Add `checkBackendLayers` to lint.mjs: files under `common/` and `config/` may import only `common/`, `config/`, `node:` and packages.
  3. Optionally forbid new folder cycles, with today's two (auth<->users, curriculum<->curriculum-admin<->database) on an allowlist that shrinks.
- Contract impact: none. Confirm byte-identical openapi.json; property order inside TermDto is unchanged.
- Write scope: `src/backend/src/common/field-validators.ts`, new `src/backend/src/terms/term.dto.ts`, the 7 DTO/controller files above, `scripts/lint.mjs`.
- Effort S, risk low, confidence high.
- Verification: openapi drift test, typecheck, `npm run lint`, and lint.mjs's own spec if one exists (assumed, not checked).
- Alternatives: a dependency-cruiser config. Rejected: it is a new dependency, and lint.mjs already exists.

### BAC-7 Move curriculum's seed rows out of `database/seeds/` into `curriculum/seeds/`, so `database/` stops being part of the curriculum cycle
- Problems it solves:
  - Hidden link (one feature split across folders): `src/backend/src/database/seeds/` holds 20 files (256 KB) of APCS/CLC curriculum rows and catalog decisions. Only curriculum code and tests read them (`curriculum/seed-curricula.ts`, `curriculum-admin/program-admin.dto.spec.ts`, and 5 e2e specs, found with `rg -ln "database/seeds/"`).
  - Needless link (cycle): `database/seed.ts` -> `curriculum/seed-curricula.ts` -> `database/seeds/*` forms the depgraph cycle curriculum <-> database. architecture.md §"Features own their seeds" (#58) already states the intended rule.
- Cost today: a curriculum data change touches `database/`, and the database folder shows 4,330 lines that are not platform code.
- Proposed change: `git mv src/backend/src/database/seeds src/backend/src/curriculum/seeds` and update the 7 import paths. `database/seed.ts` stays as the orchestrator.
- Contract impact: none.
- Write scope: `src/backend/src/database/seeds/` -> `src/backend/src/curriculum/seeds/`, `src/backend/src/curriculum/seed-curricula.ts`, `src/backend/src/curriculum-admin/program-admin.dto.spec.ts`, `src/backend/test/{audit,curriculum,curriculum-seed,curriculum-admin}.e2e-spec.ts`. `curriculum-admin-import.e2e-spec.ts` is deferred: in-flight PR #166 (leave a re-export or do it after #166).
- Effort S, risk low, confidence med: the curriculum surveyor may propose a different home. Coordinate.
- Verification: `curriculum-seed.e2e-spec`, typecheck, the depgraph shows no database -> curriculum back-edge except `seed.ts`.
- Alternatives: leave the seeds and accept the cycle.

### BAC-8 (deferred: in-flight PR #77) Let `ai/` own its configuration shape and DI token; keep `config/env.ts` to raw getters
- Problems it solves:
  - Needless link: `src/backend/src/config/env.ts:56-68` defines `aiConfig()`, the `AI_CONFIG` Nest DI symbol and the `AiConfig` type. The leaf config module knows AI's object shape and Nest DI. It is imported by `ai.module.ts:3`, `ai-cost-guard.service.ts:6` and `gateway-llm.service.ts:5`.
  - The other settings are plain getters. Before #187, `ai/ai-config.ts` held this, and #56/#187 folded it into env.ts.
- Cost today: an AI setting change edits config and ai together, and every change to env.ts collides with the AI work in flight.
- Proposed change: env.ts exports plain getters (`openRouterApiKey()`, `aiTimeoutMs()`, …). `ai/ai-config.ts` builds the object and owns `AI_CONFIG`.
- Contract impact: none. Env var names unchanged.
- Write scope: `src/backend/src/config/env.ts`, `env.spec.ts`, `src/backend/src/ai/*`, all owned by PR #77. Do this after #77 merges.
- Effort S, risk low, confidence med: #77 may already reshape it.
- Alternatives: leave it. It is cohesive enough while ai is the only structured setting.

## 4. Looked at and left alone

- **`FEATURE_SETUPS` with one entry** (`installImportBodyLimit`). It looks like an extension point for one caller, but it is needed. The large-body JSON parser must be registered with `app.use` before Nest registers its own body parser in `init()`. Module middleware (`NestModule.configure`) would run after the default 100 kB parser had already refused the body. It keeps bootstrap ignorant of curriculum-admin.
- **auth <-> users folder cycle.** It exists only as `users.controller.ts:3` -> `auth.decorators.ts`, and that file imports `User`/`Session` as types. There is no runtime or file-level cycle. Moving the decorators would edit about 20 importers and AGENTS.md (#77) for no behavioural gain. Allowlist it in BAC-6's cycle check.
- **Catalog-driven account export and purge** (`account-export.ts`, `test/user-table-rules.ts`). This is ADR 0004's deliberate choice over per-module registration, and an e2e test enforces it. It is the model the other global rules should follow.
- **Migrations as an imported class list.** ADR 0002 (globs differ between ts and dist), and `index.spec.ts` already enforces completeness and unique timestamps.
- **UsersService methods that serve one caller each** (`findByEmailForAuth`, `findDueForPurge`, …). users owns the table and `password_hash` is `select: false`, so a facade per consumer keeps credential reads in one file. That is correct.
- **`notifications.service.ts:121` private `logFailure`.** It adds rate-limited read-failure logging that `common/failure-kind.logFailure` lacks. It is not a copy, and it postdates #187.
- **`advisor/` imported by nothing.** It is not dead: the `regulations:extract` package script and PR #77 own it.
- **Error logging.** Every `logger.*` call passes `failureKind()` or fixed text. None prints `error.message` (`rg -n "logger\.(log|warn|error)"`). A lint rule could guard this later, but nothing is broken.
- **Global ThrottlerGuard missing from the OpenAPI build.** It is right: guards do not change the document.

## 5. Open questions for a human

1. BAC-3(a): should every 4xx carry a `code`, so auth, account, plans, curriculum, guides and sharing gain one and lose Nest's `error` field? And may `AdminErrorDto` be renamed to `ApiErrorDto` in openapi.json?
2. `auth.service.ts:216`: if an operator sets `SESSION_TTL_DAYS` above 30, should the hard session cap stay at 30 days (the ADR 0002 text and architecture.md:133 say "hard 30-day max") or follow the TTL as the code does now?
3. BAC-1: should a sign-in after `purge_after` but before the hourly purge also count as "pending" for sharing and notifications reads? Today only auth applies the deadline (through `cancelDeletion`). The other modules check `deletion_requested_at` only, which is equivalent while the row exists.
