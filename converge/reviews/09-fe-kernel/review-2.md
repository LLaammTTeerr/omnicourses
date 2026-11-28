# Review round 2: 09-fe-kernel (cvb/09-fe-kernel, 9eef108..12e2469)

Verdict: approve. The round-1 blocking finding is fixed, and the two new commits are clean.

## Round-1 fix, checked item by item
- The re-export line `export { ... } from './grants.js'` is gone from admin/api.ts.
- api.ts now imports only `type { GlobalPermission, PermissionKind, UserGrants }` from ./grants.js (line 5), inside the top import block. Each one is used: PermissionKind at line 244, UserGrants at 341-349, GlobalPermission at 346-348. PERMISSION_KINDS, GlobalGrant and ProgramGrant are no longer imported.
- The extra blank line near the old line 305 is gone.
- These files now import from ./grants.js: AccessAdmin.vue, errors.ts, messages.ts, sections.ts, testing/fixtures.ts, api.spec.ts, and the AccessAdmin, CalendarAdmin, CatalogAdmin, CurriculumAdmin and ImportAdmin specs. A grep of src/frontend finds no grant name imported from ./api.js or ../api.js, and no `api.fetchOwnGrants`.
- api.spec.ts keeps every assertion: the DTO shape checks for UserGrants, ProgramGrant and GlobalGrant; the GLOBAL_PERMISSIONS and PERMISSION_KINDS contract-enum checks; and the fetchOwnGrants row in CALLS (now calls the grants.ts export). Commit 12e2469 widens the "calls every function" check to the exports of api and grants together. That keeps fetchOwnGrants covered, and it would also catch a new function added to grants.ts without a CALLS row. Nothing is weakened.
- class-model.md: fetchOwnGrants is gone from the admin/ api column and stays in the state column under grants.ts. The UC-11 sequence doc now lists grants.ts too, which also covers a round-1 non-blocking note.

## New commits (8107b92, 12e2469)
- Only import lines and docs changed. There is no change to behaviour or to rendered output.
- Both commits are signed (G) and have Conventional subjects. No comments added. No dependency or lockfile change. Still exactly one .changeset file. Nothing off-limits is touched. openapi.json, migrations and package-lock.json are unchanged.

## Runs
- npm run typecheck -w src/frontend (vue-tsc): clean.
- npm run lint: 33/33, with the layers check passing.
- cd src/frontend && npx vitest run, run twice one after the other: 1252/1252 both times (21.9 s, 21.6 s). Same test count as round 1.

## Non-blocking
- api.spec.ts:59-60 imports ./grants.js twice: once as `* as grants` and once with named imports. One import would do: use `grants.fetchOwnGrants` etc., or keep the named imports and build the export list from the namespace only.
- api.spec.ts:319: the test is still titled "calls every function this module exports", but it now covers two modules. Suggested title: "calls every function the admin api and grants modules export".
- The round-1 step-D timing note still applies: the route warm-up runs inside the first test's 5 s timeout. That only shows up when the machine is loaded.

## Implementer report
I read the report after writing the above. Nothing in it changes this review.
