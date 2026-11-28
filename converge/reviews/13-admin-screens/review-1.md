# Review round 1: 13-admin-screens (cvb/13-admin-screens, a84e9347..fb20c2c)

Verdict: approve. No blocking findings.

## What I checked
1. Behaviour, line by line:
   - useSavedDocument.readSaved/load/showSaved vs the old copies in CalendarAdmin.vue and CurriculumAdmin.vue: same newest-only rules (start() only when on screen, upcoming() in load, isNewest?.() && onScreen(of) before writing), same reset order in load, same signed_out silence, same console.error texts ("Loading the academic calendar to administer failed:", "Loading the curriculum to administer failed:", "Reloading ... failed:"), not_found -> 'missing' with no log for Curriculum, 'failed' otherwise.
   - onScreen: old compared scope.value?.<id> === of.<id>; new compares scopeKey(scope.value) === scopeKey(of) with a null guard. Same result (ids are non-empty uuids).
   - staleness object: same reloadId values ('calendar-reload', 'curriculum-reload'), same is/mark.
   - Grant refresh watch moved verbatim into useProgramPicker (same grantedIds/listedIds/refusal condition, same quiet loadPrograms(true)).
   - present.ts: EVENT_KIND_GROUP byte-identical to both old KIND_GROUP tables; eventTitle/otherEventTitle identical to the old CalendarView/CalendarAdmin helpers; spanIn identical to CalendarView's; CalendarAdmin datesOf and eventLine render the same span.
   - Title fallback trap: empty titleEn cannot reach the client. Create uses nullIfBlank(dto.titleEn), update uses sentFields(..., OPTIONAL_TEXT) with titleEn: nullIfBlank (trims, so whitespace-only also becomes null); no seed or import writes calendar events; notifications copy title_en from the stored event (startingOn). So unifying on the falsy rule is correct; eventLine output is unchanged for every reachable value.
2. Contract: git diff over openapi.json, migrations, package-lock.json is empty. No backend file changed.
3. Tests: only two spec files changed, both new (saved-document.spec.ts, present.spec.ts); no existing test touched. Ran vitest on src/admin, src/calendar, src/notifications: 21 files, 422 tests pass. Admin browser spec: 17/17 pass. The composable spec covers newest-wins, other-scope reads not closing the window, scope leaving mid-read, key matching, failure vs raced failure, own status without log, signed_out, stale set/clear, staleness guard, null scope. Mutations I tried mentally (drop onScreen in the write guard, start() instead of upcoming() in load, log on own status, clear stale on failed showSaved) are each caught.
4. Completeness: no KIND_GROUP, local titleIn/titleOf/otherTitle implementations, formatSpan in the three callers, or grant watch copies remain; old and new do not coexist. class-model.md updated.
5. Structure: two ~45-line copies replaced by one 69-line composable; new edge notifications -> calendar (listed in layers.mjs, calendar does not import notifications, no cycle). admin -> calendar already existed.
6. Repo rules: no comments added, no dependency, all four commits signed (G) with Conventional subjects, exactly one new .changeset file (empty frontmatter, no release). npm run typecheck and npm run lint pass.
7. Scope: only the 12 files listed in the stat; no off-limits file touched.

## Non-blocking
- src/frontend/src/admin/store.ts:36-41: moving the grant-refresh watch into useProgramPicker also gives it to ImportAdmin.vue (the third caller), which never had it. ImportAdmin now quietly refetches its program list when the signed-in admin's program grants change while the group_links list is loaded. Harmless and arguably right, and it is what the brief's step 1 implies, but it is a behaviour change in a screen the brief says does not change; the report should name it (and a small ImportAdmin or store spec could pin it).
- src/frontend/src/admin/saved-document.ts:14 (failedAs + generic X): only CurriculumAdmin uses it. The mapping lives in the screen, so it meets the brief's "expressed by that screen", but it is still an option one caller understands. Acceptable; mention it in the report as the chosen shape.
- The academic_calendar_events.title_en column has no CHECK against ''. Only a direct SQL edit could store one; then notifications would now fall back to the vi title (before: blank). Not reachable through the app.
- Returning both stale (ref) and staleness (dialog guard) is slightly redundant; fine.

## Implementer's report
No report.md existed in /tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/13-admin-screens at review time, so I could not check the implementer's stated omissions. The ImportAdmin side effect above and the titleEn finding (empty string cannot reach the client; one falsy rule used) should be in it.
