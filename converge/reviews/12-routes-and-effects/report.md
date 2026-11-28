# Batch 12: routes and effects

## Commits
- c9200a7 refactor(frontend): each feature owns its route records. New route-meta.ts (kernel: MenuEntry, RouteMeta augmentation, APP_PAGE constant); routes.ts in views, auth, onboarding, audit, calendar, notifications, transcript, explorer, plans, guides, sharing, privacy, account, admin; admin children built from ADMIN_SECTIONS (path + load added); router.ts keeps guards, chunk reload and one ordered list; nav.ts imports MenuEntry from route-meta.ts; architecture.md lines updated.
- 48ddf94 refactor(frontend): useGrantsFollowSession (admin/access.ts) and useUnreadPolling (notifications/store.ts), one line each in App.vue; moved specs admin/access-session.spec.ts and notifications/unread-polling.spec.ts.
- 0ea81cb empty changeset.

## Proof (A)
Serialised routes (sorted keys, array order kept, component = lazy flag) plus router.getRoutes() flat list, before and after: proof-before.json and proof-after.json in this folder are byte-identical (cmp). Not committed.

## App.spec.ts it( count
Before 17, after 12 (App.spec) + 5 moved (3 admin in admin/access-session.spec.ts, 2 polling in notifications/unread-polling.spec.ts) = 17.
Moved: "asks for the grants again on the next page...", "asks for no grants while nobody is signed in", "stops asking for the grants ... three failures (#160)", "reads the count again on each page and every minute...", "reads the count once when the student signs in...".
Changes in moved assertions: the sidebar is not in a minimal host, so the "entry appears" check asserts useAdminAccess().any instead of the nav-admin link (sidebar rendering stays covered by App.spec "lists Administration ..."); sign-in case calls auth.signIn then router.push instead of typing in the form. MAX_FAILED_LOADS-named constant used for 3. Badge cases (2) stay in App.spec: they test the sidebar rendering.

## Left out
- D: nav.spec.ts pins routes, sections and icons but not the labels, so App.spec.ts and MobileBars.spec.ts are unchanged.
- Menu labels stay literals (owner decision).
- No admin "every router child is in ADMIN_SECTIONS" assertion: true by construction now.
- dashboard and audit are both in audit/ but not adjacent in menu order, so audit/routes.ts exports dashboardRoutes and auditRoutes, spread at the two places.

## E: layers.mjs
Only added 'route-meta.ts' to frontendKernel. Without it lint reports 8 frontend-feature-edges "feature -> (root)" errors for the routes.ts files.

## Look twice
- Admin spec hosts use setup() from testing/signed-in.ts (also fires warmRoutes).
- sections.ts load type: () => Promise<RouteComponent | { default: RouteComponent }>.
- ADR 0018 line 66 still says App.vue refreshes the count; still true (App.vue calls the composable), left.

## Verify tail
PASS lint, typecheck-be/fe, unit-fe, build, contract, browser
COUNTS unit-be=- unit-fe=1317 e2e=- browser=68 (baseline 3c4da22: 1132 1246 364 68)
RESULT: ALL PASS


## Review round

Both blocking findings were right and are fixed in one commit.
- unread-polling.spec.ts: Host renders RouterView, so SignInView mounts at /sign-in?redirect=/guides. The case fills #sign-in-email and #sign-in-password, submits the form and keeps both original assertions (path /guides, exactly one unread read).
- access-session.spec.ts: Host renders AppSidebar next to useGrantsFollowSession(). The retry case asserts [data-test="nav-admin"] absent, then present with href /admin, as before.
- Non-blocking taken: MAX_FAILED_LOADS was already exported from admin/access.ts, so the spec imports it. class-model.md rows list useUnreadPolling and useGrantsFollowSession.
- Not taken: a direct test that App.vue calls the two composables (reviewer agreed it is covered by App.spec).

Verify: COUNTS unit-be=- unit-fe=1317 e2e=- browser=68
RESULT: ALL PASS (typecheck lint unit-fe build browser contract)
