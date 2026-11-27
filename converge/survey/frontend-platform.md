# Frontend platform survey (src/frontend root, shell/, components/, auth/, views/, testing/)

Surveyor: frontend-platform. Base: refactor/converge = main at 3c4da22. Read-only.

## 1. Model of the area

- **Kernel (shared leaves, no feature imports):** `api.ts` (fetch wrapper, `HttpError`, `failureKind`, `byField`, `segment`, `codePoints`, plus `Health`/`fetchHealth`), `locale.ts` (Pinia `useLocale`, `useMessages`, date formatters; fan-in 80), `async-load.ts`, `page-title.ts`, `groups.ts`, `terms.ts`, `course-code.ts`, `styles.css` (global design tokens and utility classes), `components/` (ModalDialog, SelectMenu, ExternalLink, ApiStatus).
- **Shell kit (used by features):** `shell/Icon.vue`+`icons.ts` (36 importers outside shell), `toast.ts` (31), `messages.ts` (14), `theme.ts`, `LangButton`, `ThemeButton`, `BrandLink`.
- **Composition (imports features, imported by no feature):** `main.ts`, `app.ts`, `App.vue` (layout pick, session-end toast, admin-grant loading, unread polling), `router.ts` (every route + its `meta.menu`, auth/onboarding guards, stale-chunk reload), shell frame (`AppSidebar`, `MobileBars`, `PublicHeader`, `PublicFooter`, `ToastHost`, `TooltipHost`, `nav.ts`, `sidebar.ts`).
- **auth/** is both a feature (sign-in/up views) and the session kernel: `auth/store.ts` (`useAuth`, `requestAsUser`/`sendAsUser`, `useAccountCache`; fan-in 30) is how every feature calls the API.
- **State:** Pinia stores `auth`, `locale`, `toast`, `theme`, `sidebar` (platform) and `onboarding`, `admin-access`, `notifications-unread` (feature); per-account caches via `useAccountCache` keyed by user id; browser storage keys listed in architecture.md "Browser storage".
- **API types:** hand-written per feature `api.ts`; each feature's `api.spec.ts` checks field presence against `src/backend/openapi.json` through `testing/contract.ts` (openapi-typescript rejected: TS 6, architecture.md "API types").
- **i18n:** one `*_MESSAGES: Record<Lang, XMessages>` per feature `messages.ts`; `messages.spec.ts` checks no message is blank over a hand-kept list.
- **Tests:** `testing/` (`mockApi`, `setup()` that builds the real router, contract helpers), shared hubs `App.spec.ts` (shell + admin link + bell), `Shell.browser.spec.ts` (phone/desktop, dialogs from explorer/settings, sign-in flow), `router.spec.ts`.
- **Verified graph facts:** `fileCycles` is empty; the "every folder in one cycle" is folder-level only, caused by counting the composition files (`router.ts`, `App.vue`, `app.ts`, `main.ts`) as the same "(root)" folder as the kernel leaves. The only production edge from a non-root file into the composition files is `shell/nav.ts:4` -> `router.ts` (searched: `rg "from '\.\./(shell/(nav|sidebar|AppSidebar|...)|router|app|App)"` outside specs and testing/).

## 2. Ideal direction

Three layers, one direction of import: **kernel** (HTTP, session, locale, design system, generic components, term/group vocabulary) <- **features** (one folder each: views, api.ts, messages.ts, store, and its own route records) <- **composition** (main/app/App.vue, router assembly, shell frame). Features never import composition; kernel never imports features. Each feature owns its routes, menu labels, app-wide effects (polling, grant loading) and the tests of those. Composition is a short ordered list of features. Contract checks cover every DTO and fail when a new one lands unchecked. Reach this by **declaring and enforcing the layers over the files where they are**, not by moving the 80-importer files; a later move of the shell kit into a `ui/` folder is optional and should wait for a quiet window.

## 3. Findings

### FRO-1 Enforce the kernel <- features <- composition import rule in scripts/lint.mjs over the files where they are, with no file moves.

- Problems it solves:
  - The folder graph shows every folder in one cycle and shell<->admin, shell<->notifications, shell<->auth, shell<->components as two-way pairs, so the graph cannot tell an engineer what may import what (needless link / enforcement gap). Evidence: depgraph-frontend.json `folderStats` "(root)" dependsOn and usedBy every folder; `fileCycles: []`.
  - `shell/` mixes a kit that features use (`shell/Icon.vue`, `shell/toast.ts`, `shell/messages.ts`, `shell/theme.ts`, `shell/LangButton.vue`, `shell/ThemeButton.vue`, `shell/BrandLink.vue`) with the frame that imports features (`src/frontend/src/shell/AppSidebar.vue:5,9` imports `admin/store`, `notifications/UnreadBadge`; `src/frontend/src/shell/MobileBars.vue:5,10-12`). Nothing stops a feature from importing `AppSidebar` or `nav.ts` and creating a real cycle (enforcement gap).
  - The root folder mixes kernel leaves with composition (`src/frontend/src/router.ts`, `App.vue`, `app.ts`, `main.ts`) (hidden link: the layer of a root file is known only by convention).
  - `components/SelectMenu.vue:3` imports `shell/Icon.vue` (kernel -> shell kit); fine once the kit is classified as kernel.
- Callers affected: none at runtime. Verified today's code has **zero violations** under this classification: (a) no production file outside composition imports `router.ts`/`app.ts`/`App.vue` or a shell frame file except `shell/nav.ts` (itself composition); (b) kernel files import only `vue`, `pinia`, `vue-router`, `locale.ts`, `api.ts`, `async-load.ts` and the shell kit (`rg "^import"` over the kernel list).
- Cost today: an agent cannot tell from the tree whether `page-title.ts` and `router.ts` are the same kind of file; a feature that imports `shell/nav.ts` or `router.ts` passes review and silently ties every feature together (`router.ts` statically references every view).
- Proposed change:
  - Add a `checkFrontendLayers` rule to `scripts/lint.mjs` (no dependency; it already walks frontend files). Three explicit path lists: KERNEL = `api.ts locale.ts async-load.ts page-title.ts groups.ts terms.ts course-code.ts components/** auth/store.ts auth/api.ts auth/redirect.ts shell/{Icon.vue,icons.ts,toast.ts,theme.ts,messages.ts,LangButton.vue,ThemeButton.vue,BrandLink.vue}`; COMPOSITION = `main.ts app.ts App.vue router.ts shell/{AppSidebar,MobileBars,PublicHeader,PublicFooter,ToastHost,TooltipHost}.vue shell/{nav,sidebar}.ts`; everything else under `src/frontend/src/<folder>/` is a feature. Rules: a kernel file imports only kernel; a feature file never imports composition; `testing/**` and `*.spec.ts` are exempt. Error message names the layer table in architecture.md.
  - Note: `auth/store.ts` imports `plans/last-plan.ts` and `plans/lock.ts` (kernel -> feature). Either list those two in an allowlist until FRO-4 lands, or land FRO-4 first.
  - Add a spec for the rule next to the existing lint checks if lint.mjs has a test harness; otherwise prove it by running `npm run lint` on a scratch branch with a planted violation.
  - Document the table in architecture.md "Components of the single-page app": **deferred: in-flight PR #77** (owns architecture.md and AGENTS.md); the lint message can carry the rule meanwhile.
  - Retirement: none needed; nothing moves. A later move of the shell kit into `src/frontend/src/ui/` is optional (touches ~70 importers: Icon 36, toast 31; `shell/icons.ts` is **deferred: in-flight PR #214**). Do not do it in this pass.
- Contract impact: none.
- Write scope: `scripts/lint.mjs` only (other surveyors may also propose lint.mjs rules; batch them in one PR or sequence them).
- Effort S, risk low, confidence high. Verification: `npm run lint` passes on main; a planted `import { routes } from '../router.js'` in a feature fails it; typecheck/tests untouched.
- Alternatives: move the kernel leaves into `src/frontend/src/core/` (true fix of the folder picture, but forces every open branch to rebase ~100 import lines for no behaviour gain); eslint-plugin-boundaries (new dependency, the repo uses its own lint.mjs); leave it (the graph stays unreadable and the rule stays unprotected).

### FRO-2 Move the session-end storage wipe out of auth/store.ts into a kernel account-storage module, so auth no longer imports plans.

- Problems it solves:
  - `src/frontend/src/auth/store.ts:4-5,19-22` imports `forgetLastPlan` and `forgetLocks` from `plans/`: the session kernel (fan-in 30) depends on a volatile feature, giving the auth<->plans folder cycle (needless link).
  - Any feature that adds an account-scoped browser key must know to edit `auth/store.ts` and architecture.md's storage list (hidden link: a list edited by hand whenever something else is added). Evidence: `src/frontend/src/plans/last-plan.ts:11-13`, `src/frontend/src/plans/lock.ts:14-16`; `src/frontend/src/auth/store.spec.ts:6-7` imports plans to test it.
- Callers affected: `auth/store.ts` (clear() and start() 401 path), `plans/last-plan.ts`, `plans/lock.ts`, `auth/store.spec.ts`. Searched `rg "forgetLastPlan|forgetLocks|localStorage|sessionStorage" --glob '!*.spec.ts'`: no other account-scoped key exists today (`oc-planner-rail`, theme, sidebar, lang are per browser).
- Cost today: adding e.g. a "last audit view" key means editing auth, plans-style helper and the doc, and nothing fails if auth is forgotten (the key leaks to the next account on the same browser).
- Proposed change: add `src/frontend/src/account-storage.ts` (kernel) exporting `ACCOUNT_STORAGE_KEYS = { lastPlan: 'oc-last-plan', planLocks: 'oc-plan-locks' } as const` and `forgetAccountStorage()` that removes each (try/catch as today). `plans/last-plan.ts` and `plans/lock.ts` take their key from it and drop their own `forget*` (or keep them as one-liners calling nothing else); `auth/store.ts` calls `forgetAccountStorage()` and drops both plans imports. Move the two tests in `auth/store.spec.ts` that read plans helpers to assert on `localStorage` keys from `ACCOUNT_STORAGE_KEYS`. Key names unchanged, so no saved value is lost.
- Contract impact: none (browser key names unchanged).
- Write scope: new `src/frontend/src/account-storage.ts` (+ spec), `src/frontend/src/auth/store.ts`, `src/frontend/src/auth/store.spec.ts`, `src/frontend/src/plans/last-plan.ts`, `src/frontend/src/plans/lock.ts` (+ their specs if they test forget). Overlaps the planner surveyor's area for the two plans files; coordinate.
- Effort S, risk low, confidence high. Verification: existing `auth/store.spec.ts` sign-out/401 cases still pass unchanged in meaning; `rg "plans/" src/frontend/src/auth` is empty.
- Alternatives: a common prefix `omnicourse.account.*` and wipe-by-prefix (no list at all, but renames two keys, so every student loses last plan and locks once: **needs decision**); a registry each feature registers into at import time (fails when the plans chunk was never loaded in the tab, so rejected); leave it.

### FRO-3 Take the test-only route warm-up out of router.ts and into the test helper.

- Problems it solves:
  - `src/frontend/src/router.ts:142-151`: `if (import.meta.env.MODE === 'test') await Promise.all(warmRouteChunks(routes))`, added by #207 with no doc or comment trail (searched architecture.md, ADR 0008, docs/test/README.md for warm/lazy/chunk: nothing). Production code carries a branch for one environment (special case), and a top-level await in the module every test imports.
  - Because of it, every spec that imports `router.ts` directly or through `testing/signed-in.ts` (50 spec files: `rg -l "testing/signed-in|router.js'" -g '*.spec.ts' | wc -l`) loads every view of every feature. A compile or import-time error in `admin/` fails `auth/` and `onboarding/` tests; per-feature test runs cannot stay local (needless link).
- Callers affected: `testing/signed-in.ts`, specs calling `createAppRouter` directly (`router.spec.ts`, `App.spec.ts`, `Shell.browser.spec.ts`, `router.browser.spec.ts`, feature view specs using `setup()`).
- Cost today: a test author does not know why route views resolve synchronously in tests; removing the block would make some tests flaky with no hint where.
- Proposed change: move `warmRouteChunks` into `src/frontend/src/testing/routes.ts` (or into `testing/signed-in.ts`) as `warmRoutes()`; call it in `setup()` and in the few specs that build the app router themselves. Better still, have `setup()` warm only the matched route's components after `router.push` (`router.currentRoute.value.matched`), keeping other features out of the test. Delete the block from `router.ts`. Keep `router.spec.ts:56` ("loads every feature screen lazily") as is.
- Contract impact: none.
- Write scope: `src/frontend/src/router.ts` (lines 142-151 only), `src/frontend/src/testing/signed-in.ts`, new `src/frontend/src/testing/routes.ts`, plus any spec that then needs one `await warmRoutes()` line. Not `testing/fetch.ts` (**PR #214**).
- Effort S-M, risk med (timing-sensitive tests), confidence med (I could not run the suites; which specs depend on the warm-up is unproven). Verification: `npm test -w src/frontend` and `npm run test:browser` green, run three times; `rg "MODE === 'test'" src/frontend/src` empty.
- Alternatives: leave it but name the reason in architecture.md (deferred: #77 owns the doc); vitest `setupFiles` that warms all routes (keeps the cross-feature coupling, only moves it).

### FRO-4 Let each feature own its route records and app-wide effects, so router.ts, App.vue and App.spec.ts become short ordered lists.

- Problems it solves:
  - Contention: `router.ts` is the 2nd most edited file since 1 Nov (15 commits), `App.spec.ts` 12, `App.vue` 9, `shell/nav.ts` 9; each new screen edits the 30-line route block with layout, auth, onboarding and menu metadata (`src/frontend/src/router.ts:29-138`).
  - Bilingual menu labels live in `router.ts` (`router.ts:38,44,52,63-64,75,81,91,104,117,127`), outside every messages catalogue and outside `messages.spec.ts` (hidden link: the screen's name is split between `router.ts` and the feature's `messages.ts`).
  - `App.vue:44-72` holds admin-grant loading/retry and unread polling (feature lifecycles in the composition root), so admin and notification behaviour is tested in the shared `App.spec.ts` (`App.spec.ts:58-86,169-246`) rather than in `admin/` or `notifications/`; any change to either feature edits the shared hub (contention, needless link).
  - Type cycle: `router.ts:15` imports `MenuEntry` from `shell/nav.ts`, which imports `routes` from `router.ts` (`shell/nav.ts:4`).
- Builds on #201/#203 (menu entries on routes, menu order = route order); keeps that: the order of features in `router.ts` remains the menu order, and `nav.spec.ts` pins it.
- Callers affected: `router.ts`, `shell/nav.ts`, `App.vue`, `App.spec.ts`, `testing/signed-in.ts`; new per-feature files. Searched `rg -l "router.js'"`: production importers are `main.ts`, `app.ts`, `shell/nav.ts`, `testing/signed-in.ts`.
- Cost today: a new screen touches `router.ts` + feature folder (+ `App.vue`/`App.spec.ts` if it has an app-wide effect), and two branches adding screens conflict in the same array.
- Proposed change (two steps, each shippable):
  1. Move `MenuEntry` and the `RouteMeta` augmentation into a kernel `src/frontend/src/route-meta.ts`; `shell/nav.ts` and features import it from there. Each feature gets `<feature>/routes.ts` exporting its `RouteRecordRaw[]` (menu labels can then come from the feature's messages object, e.g. `label: { vi: X_MESSAGES.vi.title, en: X_MESSAGES.en.title }` only where the strings are equal; otherwise keep literal). `router.ts` keeps guards, chunk reload and `routes = [...homeRoutes, ...authRoutes, ...auditRoutes, ...]` in menu order.
  2. Move the two effects into the features as composables: `useGrantsFollowSession()` in `admin/store.ts` and `useUnreadPolling()` in `notifications/store.ts` (same watchers and interval as `App.vue:44-72`), called by one line each in `App.vue`. Move the matching `App.spec.ts` cases to `admin/` and `notifications/` specs, using `setup()` + a minimal host; no assertion changes.
- Contract impact: none (routes, names, paths and meta unchanged; `router.spec.ts` and `nav.spec.ts` prove it).
- Write scope: step 1: `src/frontend/src/router.ts`, `src/frontend/src/shell/nav.ts`, new `src/frontend/src/route-meta.ts`, new `<feature>/routes.ts` in each feature folder (audit/routes.ts is a new file, not in PR #214's list, but #214 rebuilds the dashboard: coordinate). Step 2: `App.vue`, `App.spec.ts`, `admin/store.ts`, `notifications/store.ts` and their specs.
- Effort M, risk low-med, confidence med (value is real, but the remaining edit per new screen is still one line in `router.ts`). Verification: `router.spec.ts`, `nav.spec.ts` (menu order, phone tabs), `App.spec.ts` and the moved cases green; `router.getRoutes()` snapshot identical before/after.
- Alternatives: leave routes central and only do step 2 (removes App.spec contention, cheapest); `import.meta.glob('./*/routes.ts')` auto-discovery (no list at all, but menu order then needs an explicit `order` field: hidden ordering, rejected).

### FRO-5 Make the contract check fail when a DTO has no frontend check, and compare nullability, not only presence.

- Problems it solves:
  - `src/frontend/src/testing/contract.ts:11-16`: `Shape<T>` and `contractShape` compare only whether a key is required or optional. A field that becomes nullable (`type: ["string","null"]`, as `UserDto.studentId` is) or changes type is not caught; the frontend type can say `string` while the API sends `null` (enforcement gap).
  - Nothing fails when a new schema lands in `openapi.json` with no matching `Shape` test; coverage today is by discipline (enforcement gap). A loose scan (every quoted `'XxxDto'` in frontend specs) finds 137 of 138 schemas mentioned; only `NotificationNotFoundDto` is absent. That count proves a mention, not a check.
  - Paths and methods in feature `api.ts` are not checked against `openapi.json` paths except in `admin/api.spec.ts:220,302` (enforcement gap; a renamed route compiles and passes unit tests that use `mockApi` with the same wrong path).
- Callers affected: 13 `api.spec.ts` files use `testing/contract.ts` (`rg -l "testing/contract"`).
- Cost today: architecture.md says "a renamed or missing field fails a test"; true only for fields of schemas someone remembered to check, and never for nullability or paths.
- Proposed change:
  - New `src/frontend/src/contract-coverage.spec.ts`: read every frontend spec as text (`import.meta.glob('./**/*.spec.ts', { query: '?raw', eager: true })`) and assert each `components.schemas` name appears in a `contractShape(`/`contractEnum(`/it.each table, with an explicit `NOT_READ_BY_THE_SCREENS` allowlist (start: `NotificationNotFoundDto`).
  - Add `contractNullable(schema)` (keys whose `type` array contains `"null"`) and a type helper `Nullable<T>`; add one assertion per existing table (`expect(contractNullable(s)).toEqual(nullableKeys)`) rather than changing every `Shape` literal.
  - Path check: a `mockApi` option or a contract helper `contractHasRoute('GET /plans/{id}')`, so a route string used by `api.ts` is verified; or have `testing/fetch.ts` reject unknown routes against `openapi.json` paths: **deferred: in-flight PR #214** (owns `testing/fetch.ts`).
- Contract impact: none (reads `openapi.json`, never writes it).
- Write scope: `src/frontend/src/testing/contract.ts`, new `src/frontend/src/contract-coverage.spec.ts`, the 13 `*/api.spec.ts` for nullability lines (leave `audit/api.spec.ts` until PR #214 merges, since #214 changes `audit/api.ts`).
- Effort S (coverage) + M (nullability), risk low, confidence high. Verification: the new spec passes on main; deleting one `Shape` table row makes it fail; flipping one frontend field to non-null makes the nullability assertion fail.
- Alternatives: generate types with openapi-typescript (rejected in architecture.md: TS 6 pin; revisit when supported); leave it.

### FRO-6 Collect message catalogues by glob in messages.spec.ts instead of a hand-kept list.

- Problems it solves:
  - `src/frontend/src/messages.spec.ts:2-37`: `CATALOGUES` imports and lists 16 catalogues by hand (contention: every feature that adds a catalogue edits this shared spec; hidden link: forget it and blank-message checking silently skips the new file). PR #214 adds `audit/dashboard-messages.ts`, which is not in the list.
  - `views/HomeView.vue:22` defines its messages inline, and route menu labels sit in `router.ts` (see FRO-4), both outside the check.
- Callers affected: only the spec.
- Proposed change: `const modules = import.meta.glob('./**/*messages.ts', { eager: true })`, take every export whose name ends in `_MESSAGES` and whose keys are exactly the `Lang` set; also assert the vi and en objects have the same key set recursively (TypeScript enforces this for catalogues typed `Record<Lang, XMessages>`; `shell/messages.ts:44` uses `satisfies Record<Lang, Record<string,string>>`, where parity is likely enforced through `useMessages<T>` inference but **assumed, not proven**). Optionally move HomeView messages into `views/messages.ts`.
- Contract impact: none.
- Write scope: `src/frontend/src/messages.spec.ts` (+ optional `src/frontend/src/views/HomeView.vue`, `views/messages.ts`).
- Effort S, risk low, confidence high. Verification: spec count rises from 32 cases to at least 32; adding a blank string to any catalogue fails it.
- Alternatives: leave the list (every new catalogue must remember it).

### FRO-7 Give ModalDialog its own default busy text, so dialogs stop importing shell/messages.ts for one word.

- Problems it solves: 12 dialogs import `SHELL_MESSAGES` only to pass `:busy-text="shell.working"` (`rg "shell\.[a-zA-Z]+"` over those files: 12 hits, all `shell.working`; e.g. `src/frontend/src/admin/ConfirmDialog.vue:5,13,17`, `src/frontend/src/plans/DeletePlanDialog.vue:5,11,21`). Repeated logic, and most of `shell/messages.ts`'s fan-in (20) comes from features reaching into the shell for a generic component's text (needless link).
- Callers affected: the 12 dialogs (admin 8, plans 2, sharing 1, account 1), `components/ModalDialog.vue:4`.
- Proposed change: `ModalDialog.vue` reads `useMessages` for its default busy text (a `working` entry in a small `components/messages.ts`, or keep the key in `SHELL_MESSAGES` and read it inside ModalDialog); `busyText` stays an optional override. Remove the import and prop from the 12 dialogs. Add the new catalogue to `messages.spec.ts` (automatic after FRO-6).
- Contract impact: none (same text rendered).
- Write scope: `src/frontend/src/components/ModalDialog.vue` (+ optional `components/messages.ts`), the 12 dialog files under `admin/`, `plans/`, `sharing/`, `account/`.
- Effort S, risk low, confidence high. Verification: `ModalDialog.browser.spec.ts` and the dialog specs that assert the busy text still pass.
- Alternatives: leave it.

## 4. Looked at and left alone

- **Hand-written API types** instead of generated: decided in architecture.md "API types" (openapi-typescript needs TS 5; repo pins 6.0.3). FRO-5 only closes gaps in the existing check.
- **Menu entries on route meta, `shell/nav.ts` reading `routes`**: settled by #201/#203; one source for sidebar, phone bar and public header. FRO-4 keeps it.
- **`index.html` repeating the theme key**: pinned by `shell/theme.spec.ts:62-63`; CSP hash checked by lint.mjs `checkNginxCspScriptHashes`.
- **Kernel vocabulary copies** (`GROUP_IDS`, `TERM_NUMBERS`, `COURSE_CODE_PATTERN`, `GOAL_YEARS_AHEAD`): pinned by `groups.spec.ts`, `transcript/api.spec.ts`, `admin/api.spec.ts:233-234` (imports the backend constant), `onboarding/api.spec.ts:34`. Term month boundaries in `terms.ts:10-12` were not checked against a backend constant (not in my area; flag for the rules surveyor).
- **Per-feature stores watching `auth.user?.id` with `flush: 'sync'`** (`admin/store.ts`, `onboarding/store.ts`, `notifications/store.ts`): the documented "one account at a time" rule (architecture.md); `useAccountCache` already shares the pattern (#191).
- **`grant` and `unreadBadge` flags on `MenuEntry`** (`shell/nav.ts:15-16`): one flag per feature, but a generic slot would be an extension point for two users; leave.
- **`styles.css` global utilities + scoped component styles**: the documented design system port; lint enforces `<style scoped>` except `App.vue`. The `.avatar` rule is duplicated in `AppSidebar.vue:101` and `MobileBars.vue:105` (cosmetic, could move to styles.css; not worth a finding).
- **`Health`/`fetchHealth` in kernel `api.ts`**: one consumer (`components/ApiStatus.vue`), small; moving it is churn on a file with fan-in 36.
- **`App.spec.ts` shell cases** (layout per route, skip link, sidebar key, theme): these are composition behaviour and belong there; only the admin/bell cases move (FRO-4 step 2).

## 5. Open questions

- FRO-2 alternative: may account-scoped browser keys be renamed to a common prefix (students lose last-opened plan and plan locks once)? Recommended answer: no, keep names and use the kernel key list.
- FRO-3: why was the test-mode warm-up added in #207 (which flaky tests)? The outside agent left no record; the author or the PR #207 review thread may know.
- FRO-4: should menu labels come from the feature's messages catalogue (one place per screen name), or stay literal on the route? Product wording owner (Hoà) to decide.
