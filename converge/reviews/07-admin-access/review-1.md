# Review round 1: 07-admin-access (cvb/07-admin-access, 0a76adac..fb32b46)

Verdict: approve. No blocking findings.

## What I checked
1. Behaviour, line by line:
   - admin-write.service.ts: only the AdminErrors decorator and PermissionRequiredDto left it; they are byte-identical in admin-access/admin-error-responses.ts (same enum, descriptions, notFound switch). lockAdminWrite, assertMay, run, runForRecipient, runLocked, read: unchanged (same SQL, advisory locks, ROW_LOCK.noKeyUpdate, REPEATABLE READ + READ ONLY, error codes and text).
   - grants.ts: Need, grantsOf, missingPermission unchanged; userGrants moved verbatim to curriculum-admin/user-grants.ts (same two queries, COLLATE "C" order, mapping). grants.ts no longer imports a DTO.
   - admin-grant.entities.ts, admin-write.service.spec.ts, grants.spec.ts: pure renames (100% similarity).
   - DI: AdminAccessModule registers ProgramAdminGrant and GlobalAdminGrant and provides/exports AdminWriteService (its only dependency is DataSource). CurriculumAdminModule and AcademicCalendarModule import it; CurriculumAdminModule exported only AdminWriteService before, so academic-calendar loses nothing.
   - Migrations: built dist MIGRATIONS order printed and compared: identical to the base array order (timestamp order).
   - app.module: imports go from [TypeORM, Throttler, Clock, ...features] to [Throttler, TypeORM, Clock, ...features]; no ordering dependency between Throttler and TypeORM. openapi-document: same list via platformImports.
2. Contract: openapi.json, migration files and package-lock.json untouched (only migrations/index.ts changed). Drift test openapi-document.spec.ts passes (including the reversed-order case). Routes, DTO names, Swagger schema name PermissionRequiredDto unchanged.
3. Tests: 5 test files changed, all either 100% renames or a single import-path line; no it/expect lost. Full backend unit suite: 78 files, 1159 tests pass. Lint (exit 0), backend typecheck, backend build pass. E2E not run: no DATABASE_URL / database container on this machine.
4. Completeness: no reference left to curriculum-admin/admin-write.service, curriculum-admin/grants, curriculum-admin/admin-grant.entities in src, test, scripts, deploy, .github, docs/analysis-and-design, AGENTS.md, README.md (ADR 0011 is off limits and has no such path; no other ADR names them). No re-export files at old paths.
5. Structure: depgraph on the head: admin-access depends on common, curriculum, users; used by root, academic-calendar, curriculum-admin. academic-calendar no longer depends on curriculum-admin. Only folder cycle is auth<->users (pre-existing). layers.mjs adds exactly the new edges and drops academic-calendar -> curriculum-admin. account -> curriculum-admin did not exist at base (survey was stale), so nothing to remove.
6. Repo rules: both commits signed (G), Conventional subjects; one new .changeset file (empty, fine for internal refactor); no comments, .js suffixes, no new dependency.
7. Scope: off-limits csv-import.service.ts has two import-path lines changed (AdminWriteService and Need), both forced by the move; nothing else in off-limits files.

## Blocking
None.

## Non-blocking
- src/backend/src/database/migrations/index.ts: the sort by timestamp is new logic. It is only caught indirectly (CreateSignInAttempts adjacency test fails if the sort is dropped, since namespace exports come in alphabetical order); TypeORM also sorts by timestamp itself. An explicit spec "MIGRATIONS is in ascending timestamp order" would state it directly.
- src/backend/src/database/migrations/index.ts: TIMESTAMP_LENGTH and slice(-13) duplicate the /(\d{13})$/ regex in index.spec.ts; a name with no trailing timestamp gives NaN and an unstable sort (the spec's first test catches such a name, so low risk).
- src/backend/src/features.ts:40: platformImports lives in features.ts (now feature list + platform wiring) and takes a features parameter used only by buildOpenApiDocument's order test. Acceptable; the survey suggested placing it next to app.module.
- curriculum-admin files: new ../admin-access/ imports sit among ./ imports instead of with the other ../ imports (cosmetic; lint does not enforce order).
- The two-line change in csv-import.service.ts must be listed for PR #166's owner.
