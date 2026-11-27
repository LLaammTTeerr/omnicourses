# Survey: frontend admin and content features (src/frontend/src/{admin,calendar,account,privacy,notifications,guides})

## 1. Model of the area
- admin/ (25 prod files) owns the F12/F10 administration UI. Five lazy screens (CurriculumAdmin, CalendarAdmin, CatalogAdmin, ImportAdmin, AccessAdmin) under AdminView, a router child per screen.
- Plumbing in admin/: api.ts (hand-written types and calls, pinned to openapi.json by api.spec.ts via testing/contract.ts), errors.ts (HTTP error -> Failure union), write.ts (settleWrite, useWrites, useAdminDialog: busy, "no answer" recheck, focus return), problem.ts (Failure -> ProblemView text), forms.ts (form values <-> request bodies, diff and "did it land" matchers), store.ts (useAdminAccess grants store, useProgramPicker), sections.ts (section registry), messages.ts (1162 lines, all admin text, vi and en).
- State: grants in Pinia (useAdminAccess, over auth's useAccountCache). Per-screen state is local refs in each .vue (status, stale, notice, saved document).
- calendar/ is the student calendar (CalendarView 515 lines); admin/api.ts re-exports its types. notifications/ has a Pinia unread poller plus a list view. account/ is SettingsView plus the delete dialog. privacy/ is a static page. guides/ is a read-only list and detail view over /guides.
- Dependencies: everything imports locale.ts, api.ts, async-load.ts, shell/Icon, shell/toast. shell, App.vue, AppSidebar, MobileBars import admin/store.ts. router.ts names admin routes and imports every screen. privacy imports account/messages and account/api. admin imports calendar/api and curriculum/api and curriculum/present.
- Message catalogs are Record<Lang, T> with one interface per file, so both languages are checked for key completeness by tsc (not for empty strings). One catalog file per folder.
- #207 added CalendarAdmin (+346), CalendarEventDialog (+194), 160 lines of messages, 84 lines of forms.ts. It copied the CurriculumAdmin scaffolding rather than sharing it.

## 2. Ideal direction
- One "administer a scoped document" composable (pick program/cohort, load, stale, write, confirm, dialog) used by the two screens that edit one program document. Screens declare only their rows, dialogs and bodies.
- The admin section list is one registry that also feeds the router, so adding a section is one entry plus one screen file and its messages.
- Grants (who may see Administration) is a small leaf the shell reads. The admin editing code is not in the shell's import graph.
- Calendar event presentation (colour group, bilingual title, span) in one module that student calendar, admin calendar and notifications share.
- Server prose is never parsed in the client. Where it is, a test fails when the server's list grows.
- Message catalogs split per screen, so two screens never edit the same file.

## 3. Findings

### FRO-1 Pin the client's parsing of server "reference" strings to the server's list with a spec
Problems it solves:
- Hidden link: admin/errors.ts:86-100 (`readReference`) and :76-84 (`COUNTED`) parse English sentences that src/backend/src/curriculum-admin/admin-errors.ts:64-81 builds (`REFERENCES`, `COUNTED_REFERENCES`). Nothing ties the two. Verified drift today: the backend emits `REFERENCES.groupOverflows` ("overflow rules name it"), `groupCombinedMinimums` ("combined-minimum rules name it") and `countingRule` ("counting_rule:CODE") (curriculum-admin.service.ts:104,105,154,299,302). readReference has no case for them, so the UI shows the raw English sentence or the raw `counting_rule:CODE` token in a vi screen (falls to kind 'other', problem.ts via m.reference). Bug found in passing.
- Enforcement gap: errors.spec.ts:112-142 and problem.spec.ts:45-53 use hand-typed sentences, so they cannot notice a new backend reference.
Callers and dependents: readReference is used only by problem.ts (conflict case) and errors.spec.ts (rg "readReference"). The Reference union is consumed by AdminMessages.reference in messages.ts:346 and both language implementations.
Cost today: add a reference on the backend and the client silently shows English. A person must remember a second file in another workspace.
Proposed change:
1. Add a frontend spec that builds every REFERENCES entry (and every COUNTED_REFERENCES key) and asserts readReference(text).kind !== 'other'. Importing backend admin-errors.ts from a frontend spec has the same reach as testing/contract.ts importing backend/openapi.json. Assumption: Vitest can load it (it imports @nestjs/common, hoisted in the workspace). If it cannot, put the spec in the backend and import the frontend errors.ts instead, or lift the reference sentences into a tiny dependency-free file read by both.
2. Add the three missing Reference kinds plus vi and en wording in messages.ts (a person should confirm the wording, see open question 1).
3. Keep the sentences as they are on the wire.
Contract impact: none (wire text unchanged). A structured reference (`{kind, ...}` in `references`) would change the 409 body and openapi.json: needs decision, not recommended now.
Write scope: src/frontend/src/admin/errors.ts, errors.spec.ts, messages.ts (reference part), problem.ts only if a new case needs a branch.
Effort S, risk low, confidence high (drift verified by reading both sides). Verification: new spec fails before step 2, passes after; the existing 409 tests unchanged.
Alternatives: leave it (drift continues); structured references (contract change); move wording to the server (breaks the vi/en split).

### FRO-2 Extract the "scoped saved document" scaffolding shared by CurriculumAdmin and CalendarAdmin into admin/store.ts (or a new admin/scoped-document.ts)
Problems it solves:
- Hidden link / copy: admin/CalendarAdmin.vue:55-107 is a near-verbatim copy of admin/CurriculumAdmin.vue:84-135: `Scope`+`onScreen`, `grantedIds`/`listedIds` watch that calls `loadPrograms(true)`, `status/stale/newest`, `readSaved`, `load`, `showSaved`. Then `notice`, `useAdminDialog({fallback, notice, stale:{reloadId,is,mark}})`, `open` (stale guard, notice reset), `finish` wrapper (`before: showSaved`), `recheckDialog`, and the two `describeProblem(...)` computeds repeat (CalendarAdmin.vue:127-196 vs CurriculumAdmin.vue:160-200).
- Contention: #207 grew this by copying; a third scoped screen would copy it again, and a fix to stale/refresh logic must be made twice. The window rules (`newest.upcoming()`, `isNewest?.() && onScreen(of)`) are subtle and easy to desync.
- Special case: CurriculumAdmin's load also maps not_found to a 'missing' status; Calendar has no such state.
Callers and dependents: useProgramPicker is used by CurriculumAdmin, CalendarAdmin, ImportAdmin, AccessAdmin (rg "useProgramPicker"). Only Curriculum and Calendar own a saved document with stale handling.
Cost today: any change to refresh, stale banner, or notice behaviour is two edits in 840- and 347-line files plus two big specs.
Proposed change: move the program-grant refresh watch into useProgramPicker (it already owns programList, programsStatus, loadPrograms) and add `useSavedDocument<T, S>({scope, fetch, what})` returning {document, status, stale, readSaved, load, showSaved}. Both screens call it. `useAdminDialog` takes the stale object from it directly, so the `stale: {reloadId,is,mark}` literal also disappears. Do not change dialogs, forms or messages.
Contract impact: none.
Write scope: admin/store.ts (+ new admin/scoped-document.ts), CurriculumAdmin.vue, CalendarAdmin.vue, and their store spec.
Effort M, risk med (async races; the specs are large, 1256 and 278 lines, and cover them), confidence high. Verification: CurriculumAdmin.spec.ts, CalendarAdmin.spec.ts, store.spec.ts, Admin.browser.spec.ts unchanged and green; add a spec for the composable's newest-only rule.
Alternatives: leave it (cheap now, costs at the next scoped screen); a generic CRUD screen component (rejected: CurriculumAdmin has bespoke group and course interactions, a general component would take parameters only one screen understands).

### FRO-3 Make ADMIN_SECTIONS the only list of admin screens and build the router children from it
Problems it solves:
- Hidden link: a new admin screen needs entries in admin/sections.ts:9-15 (id, route name, permissions), router.ts:130-134 (path, name, lazy import), AdminMessages.sectionNames type and both languages (messages.ts:302,364,764), AdminView, plus the screen. The route name strings are typed twice with nothing checking they match (AdminView finds the section by `route.name`).
- Contention: router.ts is the second most edited file (15 commits since 1 Nov).
Callers and dependents: rg "ADMIN_SECTIONS" gives AdminView.vue and messages.ts only; rg "admin-curriculum|admin-calendar" gives router.ts, sections.ts, specs.
Cost today: adding F10 meant touching four shared files; a typo in the route name gives a screen that is never denied or never tabbed.
Proposed change: add `path` and `load: () => import(...)` to each AdminSection, export `ADMIN_ROUTES` derived from it, and have router.ts spread `children: ADMIN_ROUTES`. sectionNames stays Record keyed by id, so tsc already enforces text for a new id. Add one assertion in AdminView.spec.ts that every router child name appears in ADMIN_SECTIONS.
Contract impact: none (same paths and names).
Write scope: admin/sections.ts, router.ts (admin block only), AdminView.spec.ts. Router.ts is not under an in-flight PR in the list given.
Effort S, risk low, confidence high. Verification: AdminView.spec.ts, router tests, App.spec.ts, Admin.browser.spec.ts.
Alternatives: leave it; generate routes from file names (new mechanism, rejected).

### FRO-4 Move the grants store out of admin/store.ts so the shell does not import the admin editing stack
Problems it solves:
- Needless link / cycle: shell/AppSidebar.vue:5, shell/MobileBars.vue:5 and App.vue:4 import useAdminAccess from admin/store.ts, which imports admin/api.ts (392 lines, which itself imports calendar/api and curriculum/api), admin/errors.ts and useProgramPicker. Admin screens import shell/toast and shell/Icon back (write.ts imports shell/toast), so shell<->admin is a cycle. Stable shell code depends on volatile admin code.
- Surplus: the shell only needs `held`, `any`, `holds`, `seed`, `load`.
Callers and dependents: rg "useAdminAccess" (shell x2, App.vue, admin store.spec, AdminView, write.ts, screens).
Cost today: a change to admin/api.ts types rebuilds and re-tests the shell; the shell's graph looks like it depends on all of admin.
Proposed change: split admin/store.ts into admin/access.ts (useAdminAccess, MAX_FAILED_LOADS) importing only auth/store, api.ts and a small grants api (fetchOwnGrants, PermissionKind, GLOBAL_PERMISSIONS moved with it or imported from a grants-only file), and keep useProgramPicker in store.ts. Shell and App.vue import access.ts. Check the bundle: does the eager main chunk currently include admin/api.ts? (assumption, not measured; I did not run a build).
Contract impact: none.
Write scope: admin/store.ts, new admin/access.ts, admin/api.ts (move grant types), shell/AppSidebar.vue, shell/MobileBars.vue, App.vue, store.spec.ts. App.vue is edited by 9 commits, small collision risk.
Effort S, risk low, confidence medium. Verification: store.spec.ts, App.spec.ts, shell specs, typecheck, build (compare main chunk size).
Alternatives: leave it; a depcruise-style folder rule (not in the repo today, see section 5 of this list in other surveys).

### FRO-5 One calendar event presentation module for CalendarView, CalendarAdmin and notifications
Problems it solves:
- Copy: `KIND_GROUP` is byte-identical in calendar/CalendarView.vue:187-195 and admin/CalendarAdmin.vue:33-41 (verified with diff). `titleOf/titleIn` and `otherTitle` are duplicated at CalendarView.vue:196-197 and CalendarAdmin.vue:111-112; notifications/messages.ts:27 (`eventLine`) re-implements the bilingual title and span a third time with a slightly different rule (`titleEn ?? title` vs `titleEn` truthy).
- Hidden link: adding an event kind needs the colour map in two files; the Record<CalendarEventKind,string> makes tsc fail in both, but the colours can still disagree. notifications/NotificationsView.vue has a fourth kind-to-group table (`KIND_LOOK`) for notification kinds.
Callers and dependents: rg "KIND_GROUP|otherTitle|titleOf|titleIn|eventLine" in calendar, admin, notifications.
Cost today: change the display rule for a bilingual title in three places.
Proposed change: add calendar/present.ts exporting `EVENT_KIND_GROUP`, `titleIn(event, lang)`, `otherTitle(event, lang)`, `spanIn`. The three modules import it (admin already imports calendar/api). Delete the copies. Decide the one title-fallback rule (open question 2).
Contract impact: none.
Write scope: new calendar/present.ts and spec, calendar/CalendarView.vue, admin/CalendarAdmin.vue, notifications/messages.ts.
Effort S, risk low, confidence high. Verification: CalendarView.spec, CalendarAdmin.spec, NotificationsView.spec, Calendar.browser.spec.
Alternatives: leave it (three small copies); this is a modest win, rank below FRO-1..3.

### FRO-6 Split admin/messages.ts by screen
Problems it solves:
- Contention / shallow giant: messages.ts is 1162 lines holding six interfaces (CurriculumMessages, CatalogMessages, ProgramMessages, ImportMessages, AccessMessages, CalendarAdminMessages) plus AdminMessages and two full language objects (359-762 vi, 763-1162 en). #207 added 160 lines here while CalendarAdmin was written, and the vi and en text of one screen sit 400 lines apart, so a reviewer cannot see both at once.
- It imports types from api.ts, errors.ts, forms.ts, sections.ts, curriculum/api, locale, course-code while each of those imports AdminText back (problem.ts, ConfirmDialog, screens): a wide, volatile hub.
Callers and dependents: rg "ADMIN_MESSAGES" lists every admin screen and dialog; all use `m.<screen>` or shared keys.
Proposed change: keep the `ADMIN_MESSAGES` export and `AdminText` type, but compose them from per-screen files (admin/messages/curriculum.ts, calendar.ts, ...) each with its own vi and en pair next to its interface. The repo already did this for the dashboard (audit/dashboard-messages.ts), so there is precedent. Screens keep reading the same keys, so no screen file changes.
Contract impact: none.
Write scope: admin/messages.ts and new admin/messages/*.ts.
Effort M (mechanical), risk low (tsc proves both languages complete), confidence medium on value. Verification: typecheck, all admin specs.
Alternatives: leave it. Defer if FRO-1 is in flight, both touch messages.ts.

## 4. Looked at and left alone
- Frontend constants that mirror backend limits (STUDENT_ID_PATTERN, CLASS_NAME_MAX_LENGTH in account/api.ts:24-25, course-code.ts, IMPORT_MAX_*, enums, shapes) are already pinned to openapi.json by account/api.spec.ts:21-22, admin/api.spec.ts:216-250 through testing/contract.ts. Hand-written types plus contract specs are a sound choice. SIGNED_OUT_BODY_MAX_KIB=100 is not pinned (the openapi text for it lives in a response description), a minor gap.
- The write machinery (settleWrite, useWrites, useAdminDialog in write.ts) looks heavy but encodes the "no answer, did it land" rule in one place; the three "unknown"/"not_applied"/"confirmed" outcomes are used by every dialog. Keep.
- admin/problem.ts fan-in 14: it is the right single place for Failure -> text. The size comes from the Failure union, not from needless coupling.
- useAsyncLoad is used by notifications, guides, account; admin screens use newestOnly directly because they have scope switching and write races that a plain loader cannot express (see FRO-2 for the part that is a real copy).
- Admin Record<Lang,...> catalogs: tsc already proves both languages have the same keys. Empty strings are not caught; not worth a mechanism.
- guides/GUIDE_LANGS duplicates Lang keys: the guide texts are partial by design (pick-text.ts falls back), so a separate type is fine. A one-line `GuideLang extends Lang` check would be cosmetic.
- privacy imports account/messages and account/api (DELETION_GRACE_DAYS, SETTINGS_MESSAGES): one concept (account deletion text) read in two screens; leave.
- Notifications: Pinia unread poller with newestOnly and a view with useAsyncLoad; small, tests exist (PRs #205). Nothing to converge.
- account/SettingsView (341 lines): five unrelated blocks (sessions, export, profile, delete, language) in one view, but no shared logic across them; splitting would be cosmetic.

## 5. Open questions
1. What should the three unparsed reference sentences say to a vi-reading admin: "N overflow rules name it", "N combined-minimum rules name it", "counting_rule:CODE" (a rule-engine concept)? Wording is product text; a person confirms (FRO-1).
2. Calendar event title in en: fall back to the vi title when titleEn is empty everywhere (CalendarView, Admin) but eventLine uses `titleEn ?? title` so an empty-string titleEn would display blank in notifications. Is titleEn ever ""? (FRO-5)
3. Is ImportAdmin/AccessAdmin worth moving onto the FRO-2 composable (they have status machines of their own: CatalogAdmin.vue:26, AccessAdmin.vue:46)? I think not until a third document screen exists.
