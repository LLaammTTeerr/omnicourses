# Review round 1: 12-routes-and-effects (cvb/12-routes-and-effects, c05b603..0ea81cb)

Verdict: changes requested (two moved tests lost assertions; everything else holds).

## Blocking

1. src/frontend/src/notifications/unread-polling.spec.ts:62-69 ("reads the count once when the student signs in and is sent on to the page they asked for").
   Before, the case in App.spec.ts filled the real sign-in form (#sign-in-email, #sign-in-password, submit) and let SignInView redirect to ?redirect=/guides, then asserted the path is /guides and exactly one unread read.
   Now it calls useAuth().signIn() and router.push('/guides') by hand. So `expect(router.currentRoute.value.path).toBe('/guides')` is true by construction, and the read count no longer covers the real sign-in navigation. A mutation that slips through: SignInView (or afterSignIn) navigating twice, e.g. through an intermediate page or replace then push. That would give two reads, and the moved test stays green.
   Fix: let Host render `h(RouterView)` (from vue-router) so that SignInView mounts at /sign-in?redirect=/guides. Then drive the form exactly as before (setValue on #sign-in-email and #sign-in-password, trigger submit, flushPromises), and keep both assertions.

2. src/frontend/src/admin/access-session.spec.ts:38-52 ("asks for the grants again on the next page when the first request failed, so the entry appears without a reload").
   Before, it asserted the rendered sidebar: `[data-test="nav-admin"]` absent, then present with href '/admin'. Now it asserts `access.any` false, then true. The test's title promises "the entry appears", which nothing in this case checks any more. The brief requires the same assertions.
   Fix: render AppSidebar in Host next to the composable (or mount Host with AppSidebar as a child), and keep the two original DOM assertions. You may keep the access.any checks too. Or leave this one case in App.spec.ts.

## Non-blocking

- access-session.spec.ts:10 redeclares `const MAX_FAILED_LOADS = 3`, a copy of the private constant in admin/access.ts. Export it from access.ts and import it, so the two cannot drift. (Before, the literal 3 was used, so this changes no behaviour.)
- docs/analysis-and-design/class-model.md:1425 (notifications row) and the admin row still list only useUnread / useAdminAccess. Add useUnreadPolling and useGrantsFollowSession. ADR 0018:66 says "App.vue refreshes unread-count". That is still true (App.vue calls the composable), and the ADR is a historical record, so leave it.
- The new specs mount a Host instead of App. No test checks that App.vue calls the two composables. Only indirect coverage remains: App.spec's grant-holder sidebar test and its badge tests would fail if either call were dropped. That is enough; noted for the record.

## What I checked

- Route proof, rebuilt myself (a vitest spec in a git-archive copy of each tree in the scratchpad, not in the repo). It serialises path, name, meta, props, redirect and children in order, keys sorted. Component is serialised in two ways: (a) lazy or eager, (b) the .vue file name the lazy import loads. Base and HEAD are byte-identical in both runs (4802 bytes, 24 lazy components).
- Behaviour, line by line: every route record moved verbatim (APP renamed to APP_PAGE with the same value). The admin children come from ADMIN_SECTIONS with the same order, paths, names and components. MenuEntry and the RouteMeta augmentation are identical in route-meta.ts. useGrantsFollowSession has the same two watchers (user id with immediate; fullPath with signedIn && retryable). useUnreadPolling has the same fullPath watcher with immediate, the same setInterval(UNREAD_POLL_MS) that skips hidden tabs, and clearInterval on unmount. App.vue calls them in the same order as before.
- Contract: no change to src/backend, openapi.json, migrations or package-lock.json. No new dependency.
- Tests: App.spec.ts went from 17 to 12 it( blocks. 5 moved: 3 to admin/access-session.spec.ts (retry on next page, no grants signed out, stop after three failures #160) and 2 to notifications/unread-polling.spec.ts (poll per page and per minute, read once on sign-in). The failure cap, signed-out and polling cases keep every assertion; signed-out gained one. Findings 1 and 2 are the two that lost assertions. Full frontend suite: 89 files, 1317 tests pass. Targeted (App, admin, notifications, shell): 462 pass.
- D: nav.spec.ts pins route order, sections and icons, but not the label wording. So App.spec.ts and MobileBars.spec.ts rightly keep their literal labels.
- typecheck (vue-tsc) exit 0. `npm run lint` passes. route-meta.ts was added to frontendKernel.
- Import graph (depgraph, base against HEAD): no new folder dependency, the same single folder cycle as at base, no file cycles. The router.ts -> shell/nav.ts type import is gone.
- Completeness: nothing imports MenuEntry from shell/nav.js any more. No App.vue polling or grant watchers remain. Docs: architecture.md updated.
- Rules: no comments added. Every commit is signed G with a Conventional subject. Exactly one new changeset (empty). No off-limits file touched. audit/routes.ts is new, as allowed.

## Against the implementer's report (read after the findings above)
The report names both changed assertions (findings 1 and 2) and argues the sidebar is still covered elsewhere. The brief asks moved cases to keep their assertions, and both fixes are small. So both stay blocking. The report's other omissions (D left unchanged, labels kept as literals, dashboard and audit exported separately) are justified.
