# Test scan: tests that could not catch a real bug

Scope: 139 spec files changed since c7bf192 (139 after excluding csv-import.service.spec.ts, curriculum-admin-import.e2e-spec.ts, advisor/, ai/). All 139 were read in full, none skipped. Split over 7 readers (28/20/14/9/24/21/23 files; the file lists are at the head of each chunk below). Mutations of production code were not run by the readers. I ran two myself (restored, git status clean):
- CONFIRMED: removing `FOR UPDATE` in curriculum-admin.service.ts:84 leaves curriculum-admin.service.spec.ts green (10/10 pass).
- CONFIRMED: UNREAD_POLL_MS 60_000 -> 5_000 leaves unread-polling.spec.ts green (2/2 pass).
Other mutation claims below are reasoned, not run. DashboardView.spec.ts:139 (data-group toBeTruthy) is confirmed a kind-3 finding (see chunk 5).

Tally of findings: kind 1 = 14 (approx), kind 2 = 8, kind 3 = 16 (approx); see chunks. Most clear-cut: curriculum-admin.service.spec.ts:44 (survived), unread-polling.spec.ts:37 (survived), DashboardView.spec.ts:155-160.



# Chunk 1
FILES READ (28): src/backend/src/account/account.service.spec.ts, src/backend/src/admin-access/admin-write.service.spec.ts, src/backend/src/admin-access/grants.spec.ts, src/backend/src/audit/curriculum-standing.controller.spec.ts, src/backend/src/auth/auth.service.spec.ts, src/backend/src/auth/sign-in-limiter.spec.ts, src/backend/src/bootstrap.spec.ts, src/backend/src/common/advisory-locks.spec.ts, src/backend/src/common/api-errors.spec.ts, src/backend/src/config/env.spec.ts, src/backend/src/curriculum-admin/admin-errors.spec.ts, src/backend/src/curriculum-admin/curriculum-admin.dto.spec.ts, src/backend/src/curriculum-admin/curriculum-admin.service.spec.ts, src/backend/src/curriculum-admin/import-body-limit.spec.ts, src/backend/src/curriculum-admin/program-admin.dto.spec.ts, src/backend/src/curriculum/curriculum.service.spec.ts, src/backend/src/curriculum/seeds/clc-2025-courses.spec.ts, src/backend/src/curriculum/seeds/curriculum-seeds.spec.ts, src/backend/src/database/migrations/index.spec.ts, src/backend/src/database/seed-options.spec.ts, src/backend/src/health/health.controller.spec.ts, src/backend/src/onboarding/onboarding.dto.spec.ts, src/backend/src/openapi-document.spec.ts, src/backend/src/plans/plans.service.spec.ts, src/backend/src/rules/attempts.spec.ts, src/backend/src/rules/audit.spec.ts, src/backend/src/rules/graduation.spec.ts, src/backend/src/rules/plan-issues.spec.ts

## Findings

### src/backend/src/auth/auth.service.spec.ts
- **:240-256 (case 'beyond 30-day max lifetime') and :274-292 'caps refreshed expiry at 30 days...'** - kind 1. Expected values are built from MAX_SESSION_LIFETIME_DAYS imported from auth.service.ts (createdAt = now - MAX*DAY_MS; cap = createdAt + MAX*DAY_MS). No literal 30 anywhere in the file. Surviving mutation: MAX_SESSION_LIFETIME_DAYS = 28 (or 31 for the authenticate case); every expectation moves with it. The titles say 30 days. Rewrite: add `const THIRTY_DAYS_MS = 30 * DAY_MS` in the spec and use it in place of MAX_SESSION_LIFETIME_DAYS * DAY_MS (keep the import only for the 26-day setup if wanted).
- **:295-299 revoke 'only touches sessions owned by the caller'** - kind 2. Only checks the first argument (the where filter) of the first update call. Surviving mutation: second argument changed to `{}` or a wrong time (revoke no longer sets revokedAt, or sets the wrong time), or the `revokedAt: IsNull()` filter dropped (toMatchObject ignores extra keys). Rewrite: assert `expect(sessions.update).toHaveBeenCalledWith({ id: 'session-1', userId: 'user-1', revokedAt: IsNull() }, { revokedAt: currentNow })`.
- **:106-114 'stores only the SHA-256 ... and cleans up expired sessions'** - kind 2. `expect(sessions.delete).toHaveBeenCalledOnce()` asserts only that a delete happened. Surviving mutation: delete with a wrong filter (all of the user's sessions, or no expiry cutoff, or a cutoff in the future). Rewrite: assert the call args `{ userId, expiresAt: LessThanOrEqual(currentNow) }`, or drive a fake session store and check a live session survives.

### src/backend/src/curriculum-admin/curriculum-admin.dto.spec.ts
- **:34-42 'refuses a whole number above what the database stores, and only that'** - kind 1. Boundary is MAX_INTEGER imported from the DTO module and used for both input and message. Title says "what the database stores" (int4 = 2147483647). Surviving mutation: MAX_INTEGER = 2_147_483_648 or 1e9: input moves with it, message moves with it. Rewrite: const INT4_MAX = 2_147_483_647 in the spec; use INT4_MAX + 1 / INT4_MAX and the literal message.
- **:45-66 'bounds officialNotes to 2000 code points and confirmImpact / reviewVersion to 128'** - kind 1. The table's max column is OFFICIAL_NOTES_MAX_LENGTH / CONFIRM_IMPACT_MAX_LENGTH / REVIEW_VERSION_MAX_LENGTH imported from production; title says 2000 and 128. Surviving mutation: OFFICIAL_NOTES_MAX_LENGTH = 5000 (or 128 = 256): the code-point boundary tests still pass at the new value. Rewrite: table literals 2000, 128, 128 (as program-admin.dto.spec does with 255/100/10).

### src/backend/src/curriculum-admin/import-body-limit.spec.ts
- **:78-97 'takes ... up to exactly 7 MiB' / 'refuses one byte over 7 MiB'** (also :119, :133) - kind 1. Sizes come from IMPORT_JSON_LIMIT_BYTES imported from production (title and the 413 message say 7 MiB; spec has only KIB). Surviving mutation: IMPORT_JSON_LIMIT_BYTES = 70 * MIB or 8 * MIB: bodies scale with it and still pass or fail at the same relative edge; the 1 MiB-escaped test (6 MiB+10) only pins a lower bound. Rewrite: `const SEVEN_MIB = 7 * KIB * KIB` in the spec and use it everywhere IMPORT_JSON_LIMIT_BYTES is used as a size.

### src/backend/src/rules/graduation.spec.ts
- **:55-65 'returns done when all ruled groups...' line 64** `expect(verdict.notChecked).toEqual(NOT_CHECKED_CONDITIONS)` - kind 1. Constant imported from the module under test, compared with itself (the module spreads it into the result). Surviving mutation: delete, add or reword any not-checked condition. (audit.spec.ts:52 pins them against the literal EXPECTED_NOT_CHECKED_CONDITIONS from fixtures, so a real regression is caught elsewhere, but this assertion adds nothing.) Rewrite: drop it, or `expect(verdict.notChecked.map(c => c.id)).toEqual([...literal ids])`.

### src/backend/src/plans/plans.service.spec.ts
- **:58-71 'creates a plan with its placements against the cohort's curriculum' line 62** - kind 2. `tx.insert.mock.calls[1][1]).toHaveLength(2)` checks row count of a mock call; content never asserted for create (the replace test :164 checks fields for a course only, never a slot). Surviving mutation: swap courseCode and requirementGroupId, drop credits of slot, wrong position or userId on inserted rows. Rewrite: `toEqual([objectContaining({planId:'p1', userId:'u1', kind:'course', courseCode:'ZZ001', position:0}), objectContaining({kind:'slot', requirementGroupId:'g1', credits:3, position:1})])`.
- **:84 case 4 of 'refuses an unknown curriculum, ...' (course placed twice)** - kind 3. Message regex is `/./`, matches any text. Only BadRequest + no insert is asserted. Surviving mutation: duplicate placement rejected with a wrong or empty-reason message, or rejected by another validation. Rewrite: regex on the duplicate text (e.g. /ZZ001.*twice/ per production message).

### src/backend/src/auth/sign-in-limiter.spec.ts
- **:230 `expect(SignInAttempt.name).toBe('SignInAttempt')`** - kind 3. Asserts an imported class name against a literal; no behaviour. Fails only on renaming the class; the surrounding test is unaffected by it. Rewrite: delete the line and the unused import.

### src/backend/src/curriculum-admin/curriculum-admin.service.spec.ts
- **:44-48 'locks the group row before it counts the plans that use it'** - kind 3 (and 2). `findIndex(FOR UPDATE)` returns -1 when the lock is missing, and -1 < any index, so removing the `SELECT ... FOR UPDATE` (curriculum-admin.service.ts:84) leaves the test green. Rewrite: assert both indexes are >= 0 first (`expect(lockAt).toBeGreaterThanOrEqual(0); expect(lockAt).toBeLessThan(plansAt)`).

## Unsure
- grants.spec.ts:36-40: CHECK expression built from GLOBAL_PERMISSIONS.map; the entity holds its own literal list, so it is a drift check between two prod lists, not a self-comparison. Kept out as deliberate by title.
- account.service.spec.ts:61 and auth.service.spec.ts:162-167,196: DAY_MS imported from config/time.js; only a problem if DAY_MS itself is wrong, which no spec here pins.
- account.service.spec.ts:112 'logs and survives a failed purge': asserts only the 0 result, never the log; a mutation removing the log (not the swallow) survives.
- auth.service.spec.ts:102 (consentAt toBeInstanceOf(Date)) and :190 (cancelDeletion called with expect.any(Date)): would survive using new Date() instead of clock.now() or a wrong time.
- audit.spec.ts:8 halfUpTo2 mirrors the production rounding rule (used at :35-37, :365); and :172-184 compares as-of audits to slices of the full audit (production vs production) though literal tests exist at :40-49.
- curriculum-seeds.spec.ts:326-331 pins prose substrings of apcsNoPrerequisites.source; and :325 toBe(apcsNoPrerequisites) is identity on a shared constant. Data pins, probably intended.
- onboarding.dto.spec.ts:121-127: `not.toEqual([])` per missing key passes on any error, not the right one.
- curriculum.service.spec.ts:95-99: `courses.every(...)` is vacuous if the fixture lost its courses; the :72 test already pins the nulls.
- curriculum.service.spec.ts:179: JSON.stringify of a FindOperator's internals (TypeORM-internal shape); result map is also asserted.
- clc-2025-courses.spec.ts:65-68: expected rows derived from the same group modules the seed is built from; checks the builder wiring only, titled as such.


# Chunk 2
FILES READ (20): src/backend/src/rules/prerequisites.spec.ts, src/backend/src/rules/rules.service.spec.ts, src/backend/src/rules/standing.spec.ts, src/backend/src/sharing/sharing.controller.spec.ts, src/backend/src/sharing/sharing.service.spec.ts, src/backend/src/transcript/transcript.service.spec.ts, src/backend/src/users/account-state.spec.ts, src/backend/src/users/user.dto.spec.ts, src/backend/src/users/users.service.spec.ts, src/backend/test/academic-calendar.e2e-spec.ts, src/backend/test/account.e2e-spec.ts, src/backend/test/app.e2e-spec.ts, src/backend/test/audit.e2e-spec.ts, src/backend/test/auth.e2e-spec.ts, src/backend/test/curriculum-admin-programs.e2e-spec.ts, src/backend/test/curriculum-admin.e2e-spec.ts, src/backend/test/curriculum-schema-migration.e2e-spec.ts, src/backend/test/curriculum-seed.e2e-spec.ts, src/backend/test/curriculum.e2e-spec.ts, src/backend/test/guides.e2e-spec.ts

## Findings

### src/backend/src/users/users.service.spec.ts
- **:53 "findByEmail queries lowercase email without selecting passwordHash"** (kind 2). Only the mock call list is asserted. The return value is never checked, and the mock returns null. Mutation: `findByEmail` does `await this.repo.findOneBy({ email: lower }); return null;` survives. Rewrite: make `repo.findOneBy` resolve a user and assert `resolves.toBe(user)`. Keep the lowercase argument check.
- **:83 "normalizes email to lowercase on create"** (kind 2). `repo.create` is checked with its argument, but `repo.save` is only checked with `toHaveBeenCalledOnce()`. The result of `service.create` is not asserted. Mutation: `save` receives a different object than `create` returned (or a fresh `{}`), or `create` returns the unsaved entity. Both survive. Rewrite: `expect(repo.save).toHaveBeenCalledWith(created)` and assert that `create` resolves to the saved entity.

### src/backend/src/sharing/sharing.service.spec.ts
- **:184-188 "stops every link of an account inside the transaction it is given"** (kind 2). The only assertion is `manager.delete` called once with `expect.anything()` and `{ userId: 'u1' }`. Mutation: delete from a different entity (for example `User` or `Plan`) with the same where-clause. It survives, and so does one that deletes with the wrong table's `userId`. Rewrite: assert `toHaveBeenCalledExactlyOnceWith(PlanShare, { userId: 'u1' })` using the real entity class. The e2e route (or a DB-backed test) would be better, with two students' links checked afterwards.

### src/backend/test/academic-calendar.e2e-spec.ts
- **:256 "updates the given fields, ..."**, the line `expect(moved.updatedAt >= registration.updatedAt).toBe(true)` (kind 3). The `>=` accepts equal timestamps. Mutation: PATCH stops bumping `updated_at` (raw update, or the column excluded). The values stay equal and the test still passes. Rewrite: `expect(Date.parse(moved.updatedAt)).toBeGreaterThan(Date.parse(registration.updatedAt))`. The programs e2e already uses strict `>`.

### src/backend/test/curriculum-seed.e2e-spec.ts
- **:253-257 "keeps an admin edit to a group, ..."**, the line `notes.every(n => n.official_notes === 'edited by an admin')` (kind 3). `every` on an empty array is true, so the check is vacuous when no rows are returned. Mutation: the seeder deletes and re-creates the "Kiến thức Math" groups, or the UPDATE matched nothing. The test would then fail only if rows came back with other notes. A seeder that removes the groups passes. Rewrite: `expect(notes).toEqual([{ official_notes: 'edited by an admin' }, { official_notes: 'edited by an admin' }, ...])`, or at least `expect(notes.length).toBeGreaterThan(0)` first.

### src/backend/test/curriculum.e2e-spec.ts
- **:164-170 "returns a course with the groups that link to it, across cohorts"**, the assertion `credits: expect.any(Number)` (kind 3). Mutation: `/api/courses/:code` returns `credits: 0`, or the credits of another course. It survives. Rewrite: assert the literal credits of the first Math course. Take it from the seed row, or hard-code it.

## Unsure
- src/backend/test/audit.e2e-spec.ts:314-317 (cumulativeAccumulatedAverageChange): the expected value is recomputed in the spec as `Math.round((cum - prev) * 100) / 100` from the response's own averages. This is kind 1 in form, because it copies the production rounding formula. It does catch a skipped or wrong baseline, or missing rounding. Literal expected changes for the five terms would be sturdier.
- src/backend/test/audit.e2e-spec.ts:326-328 and :333-345: the expectation is derived from the response itself (`today.terms[...]`). The title says "agrees with", so it is a consistency test on purpose. It cannot catch a bug that is the same in both views.
- src/backend/test/account.e2e-spec.ts:102: `for (const t of await findUserTables(db)) expect(body.tables).toHaveProperty(t.table)`. The expected list comes from the production function the export itself uses (kind 1). It still catches the export dropping a table. A bug inside `findUserTables` is covered only by the neighbouring tests at :38-95.
- src/backend/test/curriculum-admin-programs.e2e-spec.ts:527-528: `JSON.stringify(read.audit).toContain(C1)` and `...(read.issues).toContain(C4)` in the precondition test. A substring match anywhere in the JSON is weak (kind 3 flavour). It survives an audit that lists the course in the wrong place, and the `before` snapshot at :535 carries the real weight.
- src/backend/test/curriculum-schema-migration.e2e-spec.ts:74 and :107-109: alternation regexes (`requirement_group_courses_pkey|uq_`) accept any unique constraint with a `uq_` name. The constraint named is not pinned exactly.
- src/backend/src/rules/rules.service.spec.ts:33, :71, :98: `reads` call lists (kind 2 flavour). Each case also asserts observable results, so they are only extra coupling. The `reads.sort()` order is irrelevant.
- src/backend/src/transcript/transcript.service.spec.ts:38-40: `invocationCallOrder` assertions are internals, but the lock-before-read order is the behaviour being protected. The listener arguments are asserted too.
- src/backend/src/sharing/sharing.service.spec.ts:86 and :99: `mock.calls[0][0]).toBe(plan)` repeats the preceding `toHaveBeenCalledExactlyOnceWith(plan, ...)`, adding only reference identity. No harm.


# Chunk 3
FILES READ (14): src/backend/test/notifications.e2e-spec.ts, src/backend/test/onboarding.e2e-spec.ts, src/backend/test/plan-issues.e2e-spec.ts, src/backend/test/plan-sharing.e2e-spec.ts, src/backend/test/plans.e2e-spec.ts, src/backend/test/profile.e2e-spec.ts, src/backend/test/public-routes.e2e-spec.ts, src/backend/test/rate-limits.e2e-spec.ts, src/backend/test/text-fields.e2e-spec.ts, src/backend/test/transcript.e2e-spec.ts, src/frontend/src/App.spec.ts, src/frontend/src/Shell.browser.spec.ts, src/frontend/src/account-storage.spec.ts, src/frontend/src/account/SettingsView.spec.ts

## Findings

### src/backend/test/public-routes.e2e-spec.ts
- **:82-84** "lets a signed-out caller write only to sign-up and sign-in" (kind 3). It filters two spec-local constants (`PUBLIC_ROUTES`, `PUBLIC_WRITES`) against each other. It never touches the app or the OpenAPI document, so no production change can fail it.
  - Mutation it misses: a new public write route (for example `@Public() @Post('/guides')`) added to the app. The test stays green because nothing from the app feeds it.
  - Rewrite: derive the open routes from the served routes (the "keeps the listed public routes open" loop at :76-80 with the real status), and assert that every non-GET route answering non-401 without a token is in `PUBLIC_WRITES`. Or delete it, since the constant check is a lint of the test data.

### src/backend/test/plan-sharing.e2e-spec.ts
- **:541-563** "reads the transcript for a reader only while the choice is on" (kind 2). The only assertions are a spy on `TranscriptService.rowsFor` (not called, then called with `[[owner.userId]]`, then not called). The reader response is checked only for status 200.
  - Mutation it misses: none that changes behaviour. A refactor that renames `rowsFor`, batches it, or goes through a repository breaks the test while the share output stays correct. A real leak (reading and showing the transcript with the choice off) is caught by :488-501 and :410-486, not by this case.
  - Rewrite: assert the observable outcome that the call gates: with the choice off, the body equals the `off` body and has no `coverage`/transcript issue codes even though the owner's transcript holds rows. That duplicates :488; if the spy is kept for privacy, keep it but add the body assertion, and name it as an internals pin.

### src/frontend/src/account/SettingsView.spec.ts
- **:50, :70, :75, :89, :105, :130, :141, :152, :183, :217, :244, :266, :330, :355** (kind 1). The expected text is `SETTINGS_MESSAGES.vi.<key>`, imported from the module that supplies the rendered text. Examples: "shows the profile the API knows" (:50), "copies the user ID" (:70, :75), "saves the student ID" (:105), "refuses the student ID" (:130), "says when saving failed" (:152).
  - Mutation it survives: edit the Vietnamese string of any of these keys to a wrong, empty or swapped-meaning text (for example `profileSaved: 'Lỗi'`). The UI and the expectation change together. A wrong key in the component (`userIdNotCopied` shown on success) is caught, so these pin the wiring only, not the copy. Other cases in the same file pin literals (:209, :258, :306, :320), so the file is inconsistent.
  - Smallest rewrite: use a literal for the user-visible strings that matter (`'Đã lưu hồ sơ.'`, the error texts). Alternatively add one table test that pins `SETTINGS_MESSAGES.vi` against literals, if the project treats copy as a contract.

## Unsure
- src/backend/test/onboarding.e2e-spec.ts:13-16, :133-139 and the `past`/`ahead` cases at :142-145 (kind 1?): `now`, `past` and `lastTerm` come from production `currentTerm`/`vietnamDate`. An off-by-one in `currentTerm` moves the boundary and the test follows it. It is fine only if `term.spec.ts` pins `currentTerm` with literal dates, which I did not read.
- src/backend/test/plan-sharing.e2e-spec.ts:276-279, :432-436, :524-529 (kind 1?): the expected reader issues are the owner's issues passed through a copy of the production mapping (drop three id fields, map group id to name). Literal lists at :280-288 and :440-446 pin most of it. Fields not in those lists (for example `message`) are compared only against the owner's own output.
- src/backend/test/notifications.e2e-spec.ts:635-636 (kind 1?): the expected order is the list sorted by a comparator that restates the production order (createdAt desc, id desc). A fully inverted comparator in both places would be unlikely, and the other cases pin the order literally.
- src/backend/test/notifications.e2e-spec.ts:453 `expect(await total(term)).toBeGreaterThan(2)` (kind 3?): it passes for any extra row from other students joined to the program. It cannot tell "createDue made rows for all program students" from "made one more". Rewrite: compare `total` with the count of users of `codeA` that this file created.
- src/backend/test/notifications.e2e-spec.ts:701 (kind 1?): `target.kind === 'transcript_changed' ? 0 : 1` is a ternary on data. `list[1]` is never `transcript_changed` (list[0] is), so the expected value is always 1. Write the literal 1.
- src/frontend/src/App.spec.ts:136-145 (kind 1?): the expected label and the next theme are chosen by a `before === 'dark'` ternary. Only one direction is exercised, the one that matches the ambient default. A bug in the other direction survives. Rewrite: it.each over both starting themes with literal expectations.
- src/backend/test/notifications.e2e-spec.ts:576 and :541-549: call counts (`startingOn` 2 calls, error line count) next to observable assertions. I kept them out because results are asserted in the same case.


# Chunk 4
FILES READ (9): src/frontend/src/account/api.spec.ts, src/frontend/src/admin/AccessAdmin.spec.ts, src/frontend/src/admin/AdminView.spec.ts, src/frontend/src/admin/CalendarAdmin.spec.ts, src/frontend/src/admin/CatalogAdmin.spec.ts, src/frontend/src/admin/CurriculumAdmin.spec.ts, src/frontend/src/admin/ImportAdmin.spec.ts, src/frontend/src/admin/access-session.spec.ts, src/frontend/src/admin/access.spec.ts

## Findings

### src/frontend/src/admin/AccessAdmin.spec.ts
- **:320** test "knows the access manager's own account when the ID is typed in capitals" (kind 3). `expect(fetch).toHaveBeenCalled()` cannot fail: the test already loaded grants and programs through this mock. Mutation that survives: none specific to this line; it is dead weight. The tab list on :319 and the revoke dialog on :316 carry the test. Rewrite: delete the line (or assert the PUT path: `expect(calls(fetch,'PUT').map(pathOf)).toEqual([\`/admin/access/users/${capitals}/global/catalog_maintainer\`])`, which would catch the UI lowercasing the typed ID in the URL).

### src/frontend/src/admin/CurriculumAdmin.spec.ts
- **:1066** test "says when the programs or the curriculum cannot be loaded, and tries again" (kind 3). `expect(fetch).toHaveBeenCalled()` is always true after the earlier retries. Mutation that survives: none; the group-row count on :1065 is the real check. Rewrite: delete the line (the retry is already proven by the 503 to success transitions).

## Unsure
- AccessAdmin.spec.ts:515 `expect(document.activeElement?.getAttribute('data-test')).not.toBe('dialog-save')` (kind 3 leaning): passes when focus is on body or anywhere else. A mutation that drops focus restore after the dialog closes survives. Rewrite: assert the element that should hold focus (e.g. `program-add`).
- AccessAdmin.spec.ts:133 `access.refusal = {...}; expect(access.refusal).toEqual(...)` reads back what the test just wrote (kind 3, first half of the test only). The sign-out clear on :136 is the real assertion, so the test as a whole can fail.
- Many specs compare rendered text to `ADMIN_MESSAGES.<locale>...` imported from production messages.ts (AdminView.spec.ts:38,40,47,68,151; AccessAdmin.spec.ts:88,101,106,151 etc.; CalendarAdmin.spec.ts:85,135,223,273; CatalogAdmin.spec.ts; CurriculumAdmin.spec.ts; ImportAdmin.spec.ts). Kind 1 in form: a reworded or blanked message survives. They do catch a wrong key or a missing locale switch, and neighbouring assertions use literal Vietnamese text, so I did not list them as findings. A mutation that changes the vi title string itself is not caught by AdminView.spec.ts:38.
- access-session.spec.ts:56 `expect(useAuth().signedIn).toBe(false)`: render() was called with signedIn false, so this is true by setup. The empty /admin/ fetch list on :55 is the real check.
- CurriculumAdmin.spec.ts:437 and :523 fake server handlers normalise input (trim, upper-case, sort) in the test double, so the UI's displayed list reflects the double, not the frontend. The sent body is asserted literally on :451/:536, so a frontend bug in what is sent is still caught; only display-from-response is shallow.
- CurriculumAdmin.spec.ts:308 and :328 the `refuse` flag is always true (name inverted, `refuse = true` at :328 is a no-op), so the 'deleted twice' guard can never throw on its own; double-delete is only caught by the later toast/row-count checks.
- CatalogAdmin.spec.ts:348 `calls(fetch,'PATCH').every(...)` is vacuously true if PATCH were never sent; here earlier steps in the test send PATCH, so it can fail, but add a length check to be safe.


# Chunk 5
FILES READ (24): src/frontend/src/admin/api.spec.ts, src/frontend/src/admin/forms.spec.ts, src/frontend/src/admin/references.spec.ts, src/frontend/src/admin/saved-document.spec.ts, src/frontend/src/admin/store.spec.ts, src/frontend/src/admin/write.spec.ts, src/frontend/src/api.spec.ts, src/frontend/src/async-load.spec.ts, src/frontend/src/audit/AuditView.spec.ts, src/frontend/src/audit/api.spec.ts, src/frontend/src/auth/api.spec.ts, src/frontend/src/auth/store.spec.ts, src/frontend/src/calendar/Calendar.browser.spec.ts, src/frontend/src/calendar/CalendarView.spec.ts, src/frontend/src/calendar/api.spec.ts, src/frontend/src/calendar/present.spec.ts, src/frontend/src/components/ExternalLink.spec.ts, src/frontend/src/components/ModalDialog.browser.spec.ts, src/frontend/src/components/ModalDialog.spec.ts, src/frontend/src/components/SelectMenu.spec.ts, src/frontend/src/contract-coverage.spec.ts, src/frontend/src/curriculum/api.spec.ts, src/frontend/src/curriculum/group-colours.spec.ts, src/frontend/src/dashboard/DashboardView.spec.ts

## Findings

### src/frontend/src/dashboard/DashboardView.spec.ts
- :142-161, "gives each figure PERF-01 times its own selector, and marks the load as busy", kind 3 (the loop at :155-160).
  - `groups.length > 0`, `data-group` truthy and `group-credits` not '' pass for any non-empty render. Mutation that survives: every row gets the wrong group id, or credits text "NaN/undefined". The next test (:173) already pins ids and credits literally.
  - Rewrite: delete :155-160, or assert `groups.map(g => g.attributes('data-group')).sort()` equals `[COMBINED, GROUP_A, GROUP_MATH].sort()`.
- :187-193, "opens a group spoiler and keeps it open", kind 3.
  - The test sets `details.open = true` itself, fires toggle, then reads `open` back. It passes if the toggle handler does nothing and nothing re-renders. Surviving mutation: delete the toggle handler that stores open state.
  - Rewrite: after the toggle, force a re-render (for example `useLocale().set('en')` plus flushPromises) and then assert open. Or assert the stored open-state key.
- :277-282, the 4th item of the attention list is `expect.any(String)`, kind 3.
  - Surviving mutation: the unread-notification line renders '' or "undefined".
  - Rewrite: use the literal label for a `transcript_changed` notification.

### src/frontend/src/audit/AuditView.spec.ts
- :304-306, "leaves no scrollIntoView behind for later tests", kind 3.
  - It checks the test file's own teardown, not production. No production mutation can fail it.
  - Rewrite: delete it. If the cleanup matters, assert it in a shared afterEach.

### src/frontend/src/api.spec.ts
- :93-102 (:97) and :120-130 (:126), "gives every JSON call a timeout by default..." and "sends no token... like any JSON call", kind 1 (weak).
  - Expected value is `REQUEST_TIMEOUT_MS`, imported from the module under test. Surviving mutation: the constant set to 0 or 1. The check pins only "default applied", not the value.
  - Rewrite: if the value matters, pin a literal (for example 15_000). Otherwise accept it, since the intent is "default is applied".

## Unsure
- src/frontend/src/components/ModalDialog.spec.ts:19-21. Expected text is `SHELL_MESSAGES.vi/en.working`, taken from production. A wrong or blank message passes, but a wrong key is caught (and :24 pins ''). Weak kind 1.
- src/frontend/src/audit/AuditView.spec.ts:66, 117, 171, 176, 238, 246, 259, 331-339 use `AUDIT_MESSAGES` as expected values. Mixed with literals elsewhere in the file. Catches a wrong key, not a wrong wording. Likely accepted.
- src/frontend/src/dashboard/DashboardView.spec.ts:329. `.meta` text is compared with another production output, `credits-in-progress`. The literal is pinned in the next line (:330), so low risk.
- src/frontend/src/contract-coverage.spec.ts:31. `checkedSchemas.size > NOT_READ_BY_THE_SCREENS.length` (> 1) is a very loose sanity bound. A regex regression is already caught by the first test, so it is redundant, not wrong.
- src/frontend/src/admin/api.spec.ts:340. `expect(paths[path]).toBeDefined()` is redundant with the next line, which throws on undefined. Harmless; it only supplies the message.
- src/frontend/src/audit/api.spec.ts:144-147. `it.each(AUDIT_UNAVAILABLE_CODES)` expects `{status: code}`, the identity of the loop variable. It is a declared-list test, and the list is pinned to the contract at :125. Probably fine.
- src/frontend/src/admin/saved-document.spec.ts:152. `staleness.reloadId` echoes the option passed in setup. This is wiring; a hard-coded id would be caught.

No kind 2 findings. Pure contract/enum pins, characterization tests, literal tables and the other files were reviewed and are not findings.


# Chunk 6
FILES READ (21): src/frontend/src/dashboard/dashboard.spec.ts, src/frontend/src/explorer/ExplorerView.spec.ts, src/frontend/src/explorer/readiness.spec.ts, src/frontend/src/groups.spec.ts, src/frontend/src/guides/GuideView.spec.ts, src/frontend/src/guides/GuidesView.spec.ts, src/frontend/src/guides/api.spec.ts, src/frontend/src/messages.spec.ts, src/frontend/src/notifications/Notifications.browser.spec.ts, src/frontend/src/notifications/NotificationsView.spec.ts, src/frontend/src/notifications/api.spec.ts, src/frontend/src/notifications/store.spec.ts, src/frontend/src/notifications/unread-polling.spec.ts, src/frontend/src/onboarding/OnboardingView.spec.ts, src/frontend/src/onboarding/StudySettings.spec.ts, src/frontend/src/onboarding/api.spec.ts, src/frontend/src/onboarding/store.spec.ts, src/frontend/src/plans/PlanEditorView.spec.ts, src/frontend/src/plans/PlannerEntry.spec.ts, src/frontend/src/plans/Plans.browser.spec.ts, src/frontend/src/plans/PlansView.spec.ts

## Findings

### src/frontend/src/groups.spec.ts
- :17 `looks up the glyph and the short name of $id` — kind 1. Expected glyph and short names are read from the same GROUPS table that groupGlyph/groupShort look up (production `groupOf` is `GROUPS.find`). Mutation survived: swap two glyphs or the vi/en short names inside GROUPS (or point an entry at the wrong id); the lookup and the expectation move together. Only a broken lookup is caught. Rewrite: literal table, e.g. `it.each([['core','</>','Cốt lõi','Core'],['math','∑','Toán','Maths'], ...])` with hand-written glyph/vi/en.

### src/frontend/src/notifications/unread-polling.spec.ts
- :37 `reads the count again on each page and every minute while the tab is shown, and never while signed out` — kind 1. Advances fake timers by `UNREAD_POLL_MS` imported from store.ts (lines 45, 49, 57), but the title promises "every minute". Mutation survived: change UNREAD_POLL_MS from 60_000 to 5_000 or 3_600_000; the interval and the advance both change. Rewrite: `const ONE_MINUTE = 60_000` literal in the spec and advance by it (and by `ONE_MINUTE - 1` first, expecting no extra read).

### src/frontend/src/notifications/NotificationsView.spec.ts
- :150 `waits for the notification to be marked read before it follows the link` — kind 2. Asserts only `vi.spyOn(router,'push')` not called, then called once (lines 157-163); never what it was called with or where the router ends up. Mutation survived: follow the link to the wrong route (e.g. push('/') or the calendar link instead of /audit) after the read resolves. Rewrite: drop the spy; assert `router.currentRoute.value.name` is still 'notifications' before `answer()` and 'audit' after.

### src/frontend/src/dashboard/dashboard.spec.ts
- :100 inside `lays the donut out as all passed arcs, then in progress, then remaining, filling the whole turn` — kind 3. `parts.every(p => p.path.startsWith('M') && p.hit.startsWith('M'))` is true for any SVG path string. The "filling the whole turn" part of the title is not asserted at all. Mutation survived: arcs whose angles sum to less than/more than 360 degrees, overlapping arcs, or segments with a wrong sweep, as long as each string starts with M. Rewrite: assert the arc angles/fractions (literal expected, e.g. sum of the segment sweeps equals 2*PI within 1e-6, and the first arc starts at the top), or a literal path for a tiny fixture.

### src/frontend/src/plans/PlanEditorView.spec.ts
- :1205 `caps + Add Term at MAX_PLAN_TERMS (30) and slices previewAll targets to 30` — kind 1. Loop bound, row count, and `sentTargets` length (lines 1207-1235) all use `MAX_PLAN_TERMS` imported from board.ts, though the title says 30. Mutation survived: change MAX_PLAN_TERMS to 31, 10 or 100 (the 100 case only passes slowly); everything is compared with itself. Rewrite: `const PLAN_TERM_CAP = 30` literal in the spec (the backend limit) and use it in all four expectations.

## Unsure
- src/frontend/src/explorer/ExplorerView.spec.ts:162, 275, 278, 326 — expected text built from `EXPLORER_MESSAGES.*` (the catalogue the component renders). A wording change is not caught, a wrong key is; the same strings are pinned as literals in the it.each at :281-299, so low risk.
- Same pattern, low risk: GuideView.spec.ts:114,129,153; GuidesView.spec.ts:82,96,102,113,124,135; OnboardingView.spec.ts:56,66,101,113,153,174,179,191,199; StudySettings.spec.ts:45,46,53,60,68,95. They read GUIDE_/ONBOARDING_/GOAL_/STUDY_MESSAGES; messages.spec.ts guarantees they are non-empty.
- src/frontend/src/dashboard/dashboard.spec.ts:91 — expected cell colour read from the production model's own `rows` (relational check). Catches a cell taking another group's colour, not a wrong colour for the whole group.
- src/frontend/src/groups.spec.ts:9 — `GROUPS.map(id)` vs `GROUP_IDS`: both production lists, but they are two separate declarations, so this is a consistency check; fine unless GROUP_IDS is ever derived from GROUPS.
- src/frontend/src/plans/PlanEditorView.spec.ts:651 — `[...children].every(role === 'listitem')` is vacuously true if the list has no children; a following explicit non-empty check would harden it.
- src/frontend/src/plans/PlanEditorView.spec.ts:860-861 — identical duplicate assertion `ok-drop` on row 2026-1 (copy-paste, no extra coverage).
- src/frontend/src/plans/PlanEditorView.spec.ts:871-873 — `FLIP_MS - 1` / `+ 1` uses the imported constant; fine as a boundary check, but a changed FLIP_MS value is not caught.
- src/frontend/src/messages.spec.ts:77 — `CATALOGUE_LIST.length` vs `Object.keys(CATALOGUES).length`: compares an array to a map built from itself, but does catch duplicate catalogue names.


# Chunk 7
FILES READ (23): src/frontend/src/plans/api.spec.ts, src/frontend/src/plans/board.spec.ts, src/frontend/src/plans/drag.spec.ts, src/frontend/src/plans/flip.spec.ts, src/frontend/src/plans/issue-view.spec.ts, src/frontend/src/plans/present.spec.ts, src/frontend/src/router.spec.ts, src/frontend/src/sharing/SharePlanDialog.spec.ts, src/frontend/src/sharing/SharedPlan.browser.spec.ts, src/frontend/src/sharing/SharedPlanView.spec.ts, src/frontend/src/sharing/api.spec.ts, src/frontend/src/sharing/view.spec.ts, src/frontend/src/shell/AppSidebar.spec.ts, src/frontend/src/shell/MobileBars.spec.ts, src/frontend/src/shell/TooltipHost.spec.ts, src/frontend/src/shell/nav.spec.ts, src/frontend/src/shell/sidebar.spec.ts, src/frontend/src/shell/toast.spec.ts, src/frontend/src/transcript/TranscriptView.spec.ts, src/frontend/src/transcript/api.spec.ts, src/frontend/src/transcript/draft.spec.ts, src/frontend/src/transcript/paste.spec.ts, src/frontend/src/transcript/rows.spec.ts

## Findings

### src/frontend/src/plans/board.spec.ts
- :48 "draws rows from the current term to the target, widened to every term of the plan" (kind 1, last assertion). Expected is `termsBetween(t(2025,3), t(2027,1))`, which is production code. Surviving mutation: `termsBetween` returns a wrong span (for example it drops the end term). `rowsFor` would be wrong in the same way and the spec still passes. The literal `termsBetween` case above it does not cover `rowsFor`'s widening. Rewrite: `toEqual([t(2025,3), t(2026,1), t(2026,2), t(2026,3), t(2027,1)])`.

### src/frontend/src/plans/issue-view.spec.ts
- :11-13 "runs past the maximum, so a load above it still shows" (kind 1). `scale = 22 + METER_HEADROOM_CREDITS` repeats the production formula and imports the constant. Surviving mutation: headroom changed from N to any other value. Rewrite with literals, for example `expect(drawn.max).toBeCloseTo(78.57)` and `expect(drawn.fill).toBeCloseTo(89.29)`, computed for the real headroom. Or keep only `fill > max` and `fill < 100`.

### src/frontend/src/sharing/view.spec.ts
- :161 "names each withheld check by its issue title" (kind 1). Expected is `[planner.issueTitle.not_offered, planner.issueTitle.placed_twice]`, the same table production reads. Surviving mutation: `withheldTitles` switches to the `issue` wording table, or maps the codes in the wrong order or the wrong language. Rewrite with literal English strings, `['<title text>', '<title text>']`.

### src/frontend/src/shell/AppSidebar.spec.ts
- :43 "keeps collapse aria-label and title consistent..." (kind 3 on one assertion). `themeBtn().attributes('title')).toBeTruthy()` passes for any non-empty string. Surviving mutation: the mini theme button title holds the wrong text (the language button's title, or "undefined"). Rewrite: `toBe('<literal vi title>')`, as the next line does for the language button.

### src/frontend/src/shell/nav.spec.ts
- :38 "lists each page once" (kind 3, redundant). The literal ordered list at :18 already contains no duplicates, so this only fails if :18 fails. Rewrite: delete it.
- :42-47 "puts every page on the phone once..." (kind 3 on part). `phone.every(Boolean)` cannot fail, because the next line already throws on `item.route` of an undefined item. `toHaveLength(4)` repeats :19. The sorted comparison against NAV is the real check. Rewrite: keep only line :46.

### src/frontend/src/transcript/paste.spec.ts
- :169 "takes the delimiter from the first line that has one..." (kind 3 on one field). `reason: expect.any(String)` for the repeated header line. Surviving mutation: the header row gets reason 'term' or 'courseCode' instead of the intended one. Rewrite with the literal reason the code gives.

## Unsure
- src/frontend/src/shell/AppSidebar.spec.ts:64: asserts that raw SFC source does not match `/\.sign-in\s*\{\s*display:\s*none/`. This reads source text, not behaviour. `visibility:hidden`, `display : none` or a media-query reformat survive.
- src/frontend/src/shell/toast.spec.ts:17-61: imports `TOAST_MS` and advances timers by that same constant. A change of the constant itself (5 s to 60 s) passes. Fine only if the duration is not a requirement.
- src/frontend/src/router.spec.ts:59: `withViews.length >= 22` is a magic floor. Removing a few routes passes, and adding one does not tighten it.
- src/frontend/src/plans/drag.spec.ts:69: `pos()[2]).not.toBe(0)` for the lean rotation. It passes for any non-zero angle, wrong sign included.
- src/frontend/src/sharing/view.spec.ts:70,113: `meter not.toBeNull` and `slot.colour not.toBeNull` accept any value, so a wrong colour or meter passes.
- src/frontend/src/shell/nav.spec.ts:14: `item.label.vi && item.label.en toBeTruthy` only catches an empty label.
- src/frontend/src/transcript/TranscriptView.spec.ts:89,203: expectations come from TRANSCRIPT_MESSAGES. This is fine for wording, but it cannot catch a wrong message.
