# Review round 1: 09-fe-kernel (cvb/09-fe-kernel, 9eef108..b6b7d29)

Verdict: changes requested (one blocking finding, small).

## Blocking

1. src/frontend/src/admin/api.ts:8-10 - the grant move is half done. admin/api.ts imports the grant names from grants.ts and re-exports all of them (fetchOwnGrants, GLOBAL_PERMISSIONS, PERMISSION_KINDS, GlobalGrant, GlobalPermission, PermissionKind, ProgramGrant, UserGrants). The old import path stays live as an alias, so the names now have two homes. Callers still using the old path: AccessAdmin.vue, errors.ts, messages.ts, sections.ts, testing/fixtures.ts, api.spec.ts (the DTO shape checks, the GLOBAL_PERMISSIONS enum check, the fetchOwnGrants endpoint row), and CatalogAdmin/CalendarAdmin/AccessAdmin/ImportAdmin/CurriculumAdmin specs (UserGrants). The report says this was done on purpose ("so existing importers and api.spec keep working"). The brief's completeness rule says nothing may still point at the retired place.
   Fix: point those importers at ./grants.js (in api.spec.ts, import the grant names from ./grants.js and keep every assertion). Delete the export { ... } from './grants.js' line. Keep only the import api.ts itself needs (PERMISSION_KINDS is not used in api.ts: check, and drop it if unused). Move that import up into the import block at the top. Also delete the leftover double blank line where fetchOwnGrants used to be (around line 305). class-model.md lists fetchOwnGrants in the admin/ api.ts column: once it lives only in grants.ts, take it out of that column.

## Non-blocking

- Step D timing: warmRoutes() now runs inside setup(), so the first test in each file pays for importing every route chunk out of its own 5 s timeout. Before, router.ts did this at module load, outside any test timeout. Solo runs pass. With three vitest processes at once, HEAD failed 4-6 tests per run, always the first heavy test of a file (CurriculumAdmin, ImportAdmin, PlanEditorView, TranscriptView, CalendarAdmin, App.spec, AuditView), all on the 5 s timeout. The base under the same load also failed the CurriculumAdmin first test (only partial runs: the base copy had a cold transform cache). So I cannot call this a regression, but it is worth hardening: call warmRoutes from a beforeAll in a vitest setupFile, or a beforeAll in the helper module, so it runs outside the test timeout. Specs that call createAppRouter directly (router.spec, nav.spec, GuidesView.spec, GuideView.spec, the browser specs) no longer warm anything. They pass today.
- ModalDialog.vue: withDefaults(..., { busy: undefined }) turns off Vue's boolean casting so that "busy not passed" means "no status line". That is right, but it is a subtle three-state prop. A short test exists ('has no status line for a dialog that is never busy'), which covers it.
- admin/access.ts and admin/grants.ts: the UC-11 sequence doc lists access.ts but not grants.ts.
- auth/store.spec.ts now sets and reads localStorage by key instead of going through rememberLastPlan/setLocked/readLastPlan/isLocked. The assertions are equivalent ([null,false] -> [null,null], still for sign-out, the 401 during a call and the 401 at start). The plans modules take their key from ACCOUNT_STORAGE_KEYS, so the link holds. Not weakened.

## What I checked

1. Behaviour.
   - A: account-storage.ts keys are 'oc-last-plan' and 'oc-plan-locks', the same as the old KEY constants in plans/last-plan.ts and plans/lock.ts. forgetAccountStorage keeps the old try/catch per key. auth/store.ts calls it at the same two places (signOut path, 401 in start). No key name changed.
   - B: useAdminAccess in access.ts is identical, line by line, to the old store.ts body (MAX_FAILED_LOADS, watch, load, error log text). The grant types and fetchOwnGrants are byte-identical in grants.ts. store.ts keeps useProgramPicker unchanged.
   - C: all 12 dialogs passed :busy and :busy-text="shell.working". The rendered text is now props.busyText ?? shell.working. Callers without busy (MobileBars sheet, SettingsView revoke, CourseDrawer, PasteTranscriptDialog) still get no status line because busy defaults to undefined. Rendered output unchanged.
   - D: the warm-up function is the same code, moved to testing/routes.ts. The production router.ts no longer has a top-level await.
2. Contract: git diff of openapi.json, migrations, package-lock.json and the package.json files is empty. No backend file changed.
3. Tests: store.spec.ts was renamed to access.spec.ts at 99% similarity (only the import line changed). auth/store.spec keeps all its it/expect calls, now with equivalent assertions. ModalDialog.browser.spec only gained the Pinia plugin. New: account-storage.spec (catches a dropped key or a renamed key) and ModalDialog.spec (default text in vi and en, override, idle, no busy). No test lost.
4. Completeness: no matches anywhere for forgetLastPlan, forgetLocks, forgetAccountData or warmRouteChunks. No useAdminAccess import from admin/store.js. The grant re-export is the one gap (blocking 1).
5. Structure: compared the depgraph output against the base. The auth -> plans edge is gone. There is no new folder edge (components -> shell already existed; ModalDialog -> shell/messages is kernel to kernel). No file cycles in either. Entry chunk: 78539 -> 74844 bytes (gzip 29303 -> 28211), built here into the scratchpad. This matches the report.
6. Repo rules: no comments added. No dependency or lockfile change. All 5 commits are signed (G) and have Conventional subjects. Exactly one new .changeset file (empty, frontmatter only). npm run lint passes (33 tests, layers check with an empty exception list). vue-tsc typecheck is clean.
7. Scope: nothing in the off-limits files (audit/*, shell/icons.ts, testing/fetch.ts, backend). The doc edits (architecture.md, class-model.md, UC-11) are in scope.
8. Step D runs: npx vitest run solo, 4 times: 1252/1252 every time. The first run, made alongside lint and typecheck, had 5 failures (5 s timeouts, see non-blocking). With three runs at once, 4-6 timeouts each. npm run test:browser once: 68/68.

## Implementer report, checked after writing the above
The report states "Left out: none". It flags the api.ts re-export as deliberate, which I treat as blocking 1. Its entry-chunk numbers match mine.
