# 09-fe-kernel report

Commits:
b6b7d29 refactor(frontend): warm the route chunks in the test helper, not in router.ts
8fafbd8 test(frontend): give the ModalDialog browser spec the store the dialog now reads
82ca62d refactor(frontend): give ModalDialog its own default busy text
2b3d76a refactor(frontend): split the admin grants store out of admin/store.ts
7f2026d refactor(frontend): list account-scoped browser keys in one kernel file

A. src/frontend/src/account-storage.ts owns ACCOUNT_STORAGE_KEYS (oc-last-plan, oc-plan-locks, names unchanged) and forgetAccountStorage(). plans/last-plan.ts and plans/lock.ts read their key from it; forgetLastPlan/forgetLocks removed (no other caller). auth/store.ts imports nothing from plans/. auth/store.spec.ts now reads localStorage by those keys (same sign-out and 401 assertions). New account-storage.spec.ts. layers.mjs: kernel entry added, exception list now empty. architecture.md notes the file.
B. admin/access.ts (grants store) and admin/grants.ts (grant types, PERMISSION_KINDS, fetchOwnGrants). admin/api.ts imports and re-exports them so existing importers and api.spec keep working. admin/store.ts keeps only useProgramPicker. Shell, App.vue and admin screens import access.ts; store.spec.ts renamed to access.spec.ts (it only tested the grants store). Entry chunk: 78576 -> 74790 bytes (gzip 29318 -> 28176). class-model.md and UC-11 doc lines updated.
C. ModalDialog reads SHELL_MESSAGES.working itself; busyText stays an override. busy now has default undefined so a dialog that never passes busy (MobileBars sheet) still renders no status line, as before. 12 dialogs dropped the prop and import. New ModalDialog.spec.ts. ModalDialog.browser.spec.ts mounts with Pinia now (setup only, no assertion change).
D. warm-up moved to testing/routes.ts (warmRoutes, warms all routes), called in testing/signed-in.ts setup(). No spec needed an extra call. Unit suite x3 and browser suite x3 all passed (plus verify run).

Left out: none. Warming only the matched route was not tried; warm-all is stable.
Look twice: ModalDialog withDefaults busy: undefined (boolean casting off); admin/api.ts re-export block; MobileBars still renders ModalDialog without busy.
Verify: COUNTS unit-be=- unit-fe=1252 e2e=- browser=68 (baseline 1132 1246 364 68); RESULT: ALL PASS


## Review round

Blocking finding (grant move half done): correct, fixed in 8107b92 and a follow-up commit. Importers (AccessAdmin.vue, errors.ts, messages.ts, sections.ts, testing/fixtures.ts, api.spec.ts and the five admin specs) now import from ./grants.js. The re-export line is gone from admin/api.ts; its import moved to the top block and keeps only GlobalPermission, PermissionKind and UserGrants. The stray blank line is removed. fetchOwnGrants is out of the admin/ api column in class-model.md; UC-11 sequence doc now lists grants.ts. The "calls every function this module exports" spec now reads the exports of grants.ts too, so its assertion is kept (unit-fe 1252, was 1251).

Non-blocking: only the UC-11 doc line was taken. The warmRoutes timing point was left: the reviewer could not show a regression (base also timed out under load) and a beforeAll would touch many specs.

Verify: RESULT: ALL PASS (typecheck lint unit-fe build browser contract); COUNTS unit-fe=1252 browser=68.
