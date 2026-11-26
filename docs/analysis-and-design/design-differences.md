# Design vs. use-case specification differences

The [class model](class-model.md) and the [sequence diagrams](sequence-diagrams/README.md) draw the code on `main` as of 15 November 2026 (the class model also draws the academic calendar and the notification inbox, added later); UC-12 below was rewritten on 25 November 2026 with the notification inbox API ([ADR 0018](adr/0018-notification-inbox.md)). Where that code differs from a use-case specification ([`docs/requirements/use-cases/`](../requirements/use-cases/README.md), and the Use-Case Specification v1.0 in [`report/assignments/PA2/uc-specs.tex`](../../report/assignments/PA2/uc-specs.tex)), the code is drawn and the difference is listed here. Each "not built" below was checked by searching `src/` for the code it would need. Which features have an API and a screen is in the [README feature table](../../README.md#what-is-built); this file lists only specific differences.

## UC-01 Sign up and onboard

| Specification | As built | Follow-up |
| --- | --- | --- |
| A student whose onboarding is unfinished can open the dashboard, which asks them to finish it (B1 test case USER-01k). | The router guard (`src/frontend/src/router.ts`, `onboardingFirst`) sends them to `/onboarding` before any private page except `/settings`. `AuditGate`'s notice for 409 `onboarding_required` shows only when the guard could not load the onboarding answers. | Issue #115 |
| Sign-in with Google. | Not built; `users.google_sub` exists and is unused ([ADR 0002](adr/0002-authentication-and-sessions.md), deferred). | |

## UC-02 Import transcript (F2)

| Specification | As built | Follow-up |
| --- | --- | --- |
| The student pastes the grades table from the portal; a deterministic parser reads it (steps 1–5, A1, A8). | There is no paste and no parser. The student types every row in (`TranscriptView.vue`), as in A4. | The Project Lead decided on 15 November 2026 to change F2 to "paste the grades table, or type it in" ([ADR 0007, amendment](adr/0007-transcript.md#amendment-15-november-2026-paste-or-type-no-file)); UC-02 and the glossary follow it since 26 November 2026. Pasting is not on `main` yet, and the paste format is not decided. |
| Rows not in the student's curriculum are marked **Not in your curriculum** in the review table (step 5). | The transcript page marks nothing. The degree audit reports such courses as unmatched courses with a `not_in_curriculum` warning. | |
| Manual entry offers the curriculum's courses to pick from and fills in the credits (A4). | The student types the course code, name and credits; nothing is looked up. | |
| Saving over an existing transcript first shows the rows added, changed and removed (A5). | The save replaces the whole set in one transaction; no comparison is shown. | |
| After saving, the degree audit opens (step 9). | The page stays on the transcript and shows a toast. | |

## UC-03 View degree audit (F3)

| Specification | As built |
| --- | --- |
| The summary shows the estimated graduation term (step 3). | The rule engine does not compute one: nothing in `src/` does. `DegreeAudit.graduation` says `done` or `not_yet` with the conditions met, unmet and not checked. |
| A past-term picker shows the dashboard as it stood at the end of a term (A2). | Not built. The audit page lists each term's credits and averages (`DegreeAudit.terms`). |
| **Needs attention** items link to the planner, a guide or the transcript (step 6). | The dashboard lists up to five unmet graduation conditions, each linking to its place on the audit page. |
| Precondition only: a program and cohort are chosen. | The API also answers 409 `curriculum_not_found` when the chosen program and cohort have no curriculum ([ADR 0013](adr/0013-rule-engine-and-degree-audit.md)). |

## UC-04 Explore curriculum (F4)

| Specification | As built |
| --- | --- |
| The system asks the rule engine for each course's state; the list shows in progress, available now, locked and passed (steps 2–3). | The explorer does not call the rule engine. It lists the courses by requirement group and adds a neutral "in your transcript" mark from the saved transcript's course codes. |
| Prerequisite graph (A1). | Not built. |
| The drawer shows prerequisites with their state, the courses it unlocks, the offering terms, and a link to place the course in a plan (step 7). | The drawer shows the catalog record, the requirement groups that list the course, and the course's recorded prerequisites (`CurriculumDto.prerequisites`), or a note when none are recorded. It always says that offering terms are not recorded. It shows no state for the prerequisites and no unlocked courses. |
| The student sees their own curriculum. | The student can also switch to another offered program and cohort. |

## UC-05 Build and edit a plan (F5)

| Specification | As built |
| --- | --- |
| Planned for B2. | Built in B1. |
| The strip shows the estimated graduation term (steps 2, 6). | Not computed. The strip shows the coverage of each requirement group and whether the plan would meet the curriculum (`PlanCoverage.graduation`). |
| While dragging, terms that cannot take the course fade out and refuse the drop (step 4). | No term refuses a drop. Each row shows the rule engine's verdict and reason, and a drop that breaks a rule still lands and is saved, with the violation listed ([ADR 0012](adr/0012-credit-caps-by-training-type.md), [ADR 0014](adr/0014-plan-model.md)). |
| A fix suggestion with **Apply** (A2). | Not built: the Issues panel lists each issue with its citation and no fix. |
| A change is validated in under 300 ms. | The preview is one request to the API per drag (`POST /api/plans/{id}/issues/drops`); the time was not measured for this document. [ADR 0015](adr/0015-rule-engine-in-the-browser.md) would run the check in the browser; it is not built. |
| A plan holds courses. | A placement is a course or a slot: credits held for a requirement group until a course is chosen. A plan can also be locked on one browser. Neither is in the specification. |
| (none) | `POST /api/plans/{id}/issues` is built and tested, but no screen calls it since the batched drops route replaced it. |

## UC-09 Share or export a plan (F9)

The API is in `src/backend/src/sharing/` ([ADR 0010](adr/0010-public-pages-and-guide-content.md), amendment of 25 November 2026).

| Specification | As built | Follow-up |
| --- | --- | --- |
| The Share panel, the shared page with its banner, and **Download PDF** (steps 1–8, A1). | Not built. The API has the owner's routes (`GET`, `PUT`, `DELETE /api/plans/{id}/share`) and the reader's route (`GET /api/shared-plans/{token}`). | The screens. The PDF is the browser's print layout of the shared page (agreed by Dũng and accepted by Lâm, 25 November 2026; no server PDF), and it follows the owner's choice below |
| **Create link** creates a link; a plan already shared shows its link instead (steps 3–4, A4). | One request does both: `PUT /api/plans/{id}/share` creates the link when there is none and returns the live one when there is. It also carries the two tick boxes, `showName` and `showTranscriptChecks`: only an explicit `true` turns one on, and one left out stays as it is. `GET` shows the link and both choices without changing anything. | |
| A reader sees the violations the rule engine finds; the same problems as the student when the student chose to show the checks from the transcript (step 2, A9). | As specified, in the API. With the choice off, the answer holds the engine's issues that follow from the plan and its curriculum alone, does not read the transcript, and names the four codes left out in `issueCodesNotShown` (`prerequisite_not_met`, `already_passed`, `already_in_progress`, `requirement_not_covered`). With it on, the answer holds the owner's own issue list and the coverage of each requirement, with names in place of ids and never a grade. | The Share panel must warn the student when the box is ticked (a reader can then tell which courses the student passed, failed or is taking), and the shared page and the PDF must say "some checks are not shown" when `issueCodesNotShown` is not empty. The choice was agreed by Dũng and accepted by Lâm on 25 November 2026. |
| With that choice on, a reader sees the estimated graduation term (step 2, §7; UC-16). | A gap: nothing computes one (see UC-03 and UC-05), and only the rule engine may. With the choice on, the answer gives the coverage of each requirement and whether the plan would meet the curriculum (`coverage.graduation`); with it off, neither. | The rule engine; then the same choice |
| The prototype `shared.html` shows a row of passed courses and the coverage of each requirement group. | The coverage is in the answer when the owner chose to show the checks from the transcript. The row of passed courses is in no answer: UC-09 step 2 does not list it. | |
| A reader sees the plan's "program, cohort and curriculum version" (step 2). | The answer gives the curriculum's code, cohort and names and the program's code and names, and no id. | |
| The token is "at least as strong as a session token" (§7). | 32 random bytes. Unlike a session token it is stored readable, because A4 shows the live link again (agreed by Dũng and accepted by Lâm, 25 November 2026). | |
| The page tells search engines not to index it (§7). | Every answer that reaches the header step under `/api/shared-plans` carries `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`: the plan, the "not shared" answer, and the 429, 400 and 404 that the route's own code does not make. The CORS answer to `OPTIONS` and the body parser's own 400, 413 and 415 are made earlier and do not carry them; none holds plan data (ADR 0010). The page must add its own `noindex`. | The shared page |

## UC-10 Follow a school-task guide (F11)

As the specification schedules: B1 has browsing, search and reading (steps 1–7, A1, A2, A5, A8). The parts that use the student's data (A3 program values from the rule engine, A4 courses from a plan) and reporting a problem (A6) are not built, and no guide route reads the signed-in user.

## UC-11 Maintain curriculum (F12)

This section holds what `main` does for F12 where [ADR 0011](adr/0011-curriculum-administration.md) left a choice open or where the code differs from it. It moved here from ADR 0011 on 26 November 2026; the decisions, the amendments and the open questions stay in the ADR. The routes and their fields are in the OpenAPI contract, `src/backend/openapi.json`.

### Routes on main against the ADR 0011 outline

What `main` serves under `/api/admin` (`src/backend/src/curriculum-admin/*.controller.ts`), against the outline in [ADR 0011](adr/0011-curriculum-administration.md#write-boundary-and-api-outline):

| Outline | On `main` |
| --- | --- |
| `GET /programs` | Built: the caller's editable programs and cohorts. |
| `POST /programs`, `PATCH /programs/:programId`, cohort `GET`/`POST`/`PATCH` | Built on 25 November 2026 (`program-admin.controller.ts`): `POST /programs` (access manager; no grant for the creator), `PATCH /programs/:programId`, `GET` and `POST /programs/:programId/cohorts`, `GET` and `PATCH /programs/:programId/cohorts/:curriculumId` (program grant). A new program stores no training type and a new cohort no credit total, and no route can set either. The seeds still enter the APCS and CLC programs. See [Programs and cohorts as built](#programs-and-cohorts-as-built). |
| Requirement groups `GET` | Not built. Groups are read through `GET /api/programs/:program/curricula/:cohort`. |
| Requirement groups `POST`, `PATCH`, `DELETE`; membership `PUT`, `DELETE` | Built. |
| Prerequisites and offering terms `PUT`, `DELETE` | Built (ADR 0011, amendment of 9 November 2026). |
| Catalog `POST`, `PATCH`, `DELETE /catalog/courses/:courseCode` | Built. |
| Catalog `GET /catalog/courses`, `GET /catalog/courses/:courseCode`, `POST …/preview` | Not built. The `PATCH` answers `409 impact_confirmation_required` instead of a preview route (ADR 0011, amendment of 9 November 2026). Courses are read through `GET /api/courses/:code`. |
| Access `GET /programs`, `GET /users/:userId/grants`, `PUT`/`DELETE` program and global grants | Built. |
| CSV import preview/confirm, catalog and group links | Built on 25 November 2026 (`csv-import.controller.ts`): `POST /catalog/imports/preview` and `/confirm` (catalog maintainer), `POST /programs/:programId/cohorts/:curriculumId/imports/preview` and `/confirm` (program grant). `csv-parse` `6.1.0` is installed. `configureApp` (`bootstrap.ts`) gives these four routes the 7 MiB JSON limit, only for a signed-in caller who holds the grant of the route; every other caller and every other route keeps 100 KiB, and a compressed body on these routes answers `415`. Group links get structural checks only, under the [amendment of 25 November 2026](adr/0011-curriculum-administration.md#amendment-25-november-2026-csv-group-links-with-structural-checks-only). See [CSV import as built](#csv-import-as-built). |
| `admin:bootstrap` | Built (`bootstrap-cli.ts`). |
| Not in the outline: `GET /grants` | Built ([#146](https://github.com/LLaammTTeerr/omnicourses/issues/146)): the caller's own program grants and global permissions (`UserGrantsDto`), for any signed-in user, with empty lists when they hold none. It takes no user ID, so it cannot answer about another user, and it authorises nothing: every write still checks the grants inside its own transaction. The screens use it to offer the administration entry and its sections. |

The first writes, from #74, under `/api/admin`: `GET /programs` (the caller's editable programs and cohorts); requirement-group `POST`, `PATCH` (name, kind, notes) and `DELETE` (refused while it links courses; since #171 also while a saved plan's slot names it, `409 referenced_item` with only the count of those plans); membership `PUT`/`DELETE …/requirement-groups/:groupId/courses/:courseCode` (unlinking is refused while a rule of the curriculum names the course, `409 referenced_item`); `PUT`/`DELETE …/cohorts/:curriculumId/courses/:courseCode/prerequisites` and `…/offering-terms`; catalog `POST`, `PATCH`, `DELETE /catalog/courses/:courseCode` (delete only an unreferenced course, transcript rows included); access `GET /access/programs`, `GET /access/users/:userId/grants`, `PUT`/`DELETE /access/users/:userId/programs/:programId` and `…/global/:permission`; and `npm run admin:bootstrap -w src/backend -- --user-id <uuid>`. Grant tables, the single advisory write lock, `409 last_access_manager` and the bootstrap/recovery rule are as ADR 0011 specifies.

- **Shared-catalog review without a separate preview route.** `PATCH /catalog/courses/:code` on a course linked to any curriculum answers `409 impact_confirmation_required` with `affectedCurricula` and a `reviewVersion` (a hash of the current values, the proposed values and the affected curricula). Sending the same change with `confirmImpact: <reviewVersion>` saves it; any difference answers `409 impact_changed` with the new list. This is the confirmation flag ADR 0011's scope change asked for, kept safe against a stale review as ADR 0011 requires. A course no curriculum links is saved directly.
- **Unknown fields (ADR 0011 open item 2, closed).** Admin request bodies use `@StrictBody()`, a custom parameter decorator the global pipe skips, validated with `forbidNonWhitelisted`: an unknown, identifier or gated field answers `400 validation_failed` instead of being dropped.
- 2026-11-26: Swagger cannot read the type of a custom parameter decorator, so every route with `@StrictBody()` also declares `@ApiBody({ type: Dto })`.
- 2026-11-26: A plan save does not take the F12 write lock. A group delete locks the group row with `FOR UPDATE` first. A new plan placement that names the group then waits, because PostgreSQL takes a `FOR KEY SHARE` lock on the referenced row when it checks a foreign key. So the count of plans that use the group is exact.
- 2026-11-26: If PostgreSQL still refuses a group delete because a plan slot names the group, the service answers `409 referenced_item` with no plan count, because the transaction is aborted and can run no query. The service accepts SQLSTATE 23001 (`ON DELETE RESTRICT`) and 23503 (`NO ACTION`) for that key only; any other refusal stays a 500. It does not read the driver message or detail, because they quote IDs.

### Programs and cohorts as built

The six routes follow the first two rows of ADR 0011's outline, UC-11 A1 and A2, and ADR 0011's response table. This is the field contract that ADR 0011's review finding 3 asked for, then what the ADR left open. What is not decided stays in [ADR 0011](adr/0011-curriculum-administration.md#open-questions-from-the-program-and-cohort-routes).

Field contract. A request body goes through `@StrictBody()`, so a field that is not in this table answers `400 validation_failed` and names the field; it is never ignored.

| Route | Accepted fields | Refused with `400` |
| --- | --- | --- |
| `POST /programs` | `code` (required), `nameVi` (required, nonempty, at most 255), `nameEn` (at most 255, optional), `faculty` (at most 100, optional). | `trainingType`, and any other field. |
| `PATCH /programs/:programId` | `nameVi`, `nameEn`, `faculty`: any subset. `null` or blank clears `nameEn` or `faculty`. | `code` (the identifier), `trainingType`, and any other field. |
| `POST /programs/:programId/cohorts` | `cohortYear` (required, a whole number from 2000 to 2100, the schema's bound), `code` (required), `nameVi` (required, nonempty, at most 255), `nameEn` (at most 255, optional), `language` (at most 10, optional). | `totalCreditsMin` (gated), `programId` (the path gives the program), and any other field. |
| `PATCH /programs/:programId/cohorts/:curriculumId` | `nameVi`, `nameEn`, `language`: any subset. `null` or blank clears `nameEn` or `language`. | `programId`, `cohortYear` and `code` (the identifiers), `totalCreditsMin` (gated), and any other field. |

- **Code format.** `programs.code` and `curriculums.code` are `varchar(50)` with no format in the schema. Both routes trim and upper-case the code, as a course code is, then require capital letters and digits in parts joined by single hyphens: `^[A-Z0-9]+(?:-[A-Z0-9]+)*$`, at most 50 characters (`admin-code.ts`). Every seeded code passes, in both formats of ADR 0011 review finding 3 (`admin-code.spec.ts` checks all of them). This is a structural rule, chosen when the routes were built: a program code is a path segment of `GET /api/programs/:program/curricula/:cohort`, so it holds no space or slash.
- **`curriculums.code`.** The administrator supplies it; it is not derived, because the two seeded formats differ. It is unique among all curricula and immutable. The uniqueness is checked in the service, under the F12 write lock, and answers `409 duplicate_code`. An e2e test sends 20 concurrent creations of one code, split across two programs by 20 callers: one is saved and 19 answer `409 duplicate_code` (the test fails when the lock is removed). The database has no unique constraint on the column, so a seed, which does not take the lock, could still store a second curriculum with a code an administrator used.
- **Duplicates.** A second program with a stored code answers `409 duplicate_code`. A second cohort of the same program and year answers `409 duplicate_cohort`. Two spellings of one code (`zz-prog`, `ZZ-PROG`) are one code. Nothing is saved.
- **No grant on creation.** `POST /programs` writes one `programs` row and no grant row. The access manager who created the program gets `403 permission_required` (`program_admin`) on its `PATCH` and on its cohort routes until an access manager grants the program to them.
- **A new cohort is empty.** `POST …/cohorts` writes one `curriculums` row. It copies no group, link, prerequisite list or offering term, and it changes no row of another cohort.
- **Text fields.** Every text field of the table refuses the null character (U+0000) and counts its length in code points, as PostgreSQL counts a `varchar`, so a value that passes the check always fits its column: `400 validation_failed`, never a `500`. (class-validator's `MaxLength` does not count a variation selector, so it alone would let a value one character too long reach the database.)
- **Path IDs.** `:programId` and `:curriculumId` are UUIDs in any letter case. The route reads them in lower case, as PostgreSQL prints a UUID, so an upper-case spelling of a granted program is the same program. The same parser (`uuidParam`, `admin-params.ts`) reads every UUID path parameter of the F12 and academic-calendar admin routes.
- **Reads need the program grant too.** The two cohort `GET` routes run in `AdminWriteService.read` (a read-only snapshot, the caller's current grants checked first). A cohort ID of another program answers `404`; a program the caller holds no grant for answers `403`, also when no such program exists.
- **Answers.** A program answers `id`, `code`, `nameVi`, `nameEn`, `faculty`, `trainingType` and `updatedAt`. A cohort answers `id` (the curriculum ID), `programId`, `cohortYear`, `code`, `nameVi`, `nameEn`, `language`, `totalCreditsMin` and `updatedAt`. `trainingType` and `totalCreditsMin` are read-only there. A `PATCH` that changes nothing writes nothing, so `updated_at` stays.

### CSV import as built

The four routes follow "CSV contract and UC-11 handoff" in [ADR 0011](adr/0011-curriculum-administration.md#csv-contract-and-uc-11-handoff). This is what `main` does where the ADR left a choice open, and where it differs from the ADR.

Limits of what is built:

- **Group links get structural checks only**, which ADR 0011's text does not allow: it makes the group-link import wait for the rule-engine interface. The [amendment of 25 November 2026](adr/0011-curriculum-administration.md#amendment-25-november-2026-csv-group-links-with-structural-checks-only) allows it, by the Project Lead's decision. The place to call the interface is marked in `csv-import.service.ts` (`planLinks`).
- **The review version holds no rule-source revision.** No validation source with a revision exists yet. `IMPORT_VALIDATION_REVISION` (`csv-import.service.ts`), a constant, is hashed into every `reviewVersion` in its place, through `CsvImportService.validationRevision()`. Change the constant when a check changes meaning: a review made before that deploy can then not be confirmed after it.
- **No template download route.** The two headers are fixed and are in the OpenAPI summary of each preview route; the administration screen at `/admin/import` (#165) calls the import.

Choices ADR 0011 left open:

- **Answers.** A preview answers `200` with `rows` (the rows without an error, normalized, each with `insert`, `update` or `no_op`), `errors`, `summary` and `reviewVersion`, which is `null` while the file has any error. A file from which no row can be read answers `400 validation_failed` with `errors`: malformed quoting, another header, text that is not UTF-8. A confirmation answers `400 validation_failed` when the file has an error that holds whatever the database stores, and `409 impact_changed` for every other difference from the reviewed preview: another file, a changed saved value, a changed link, a group renamed or a course deleted since. The `409` carries no new version; the client previews again. The size bounds answer `413 payload_too_large`.
- **The browser decodes the file strictly** (recorded 26 November 2026). The import screen reads the file as UTF-8, drops a BOM at the start, and refuses a byte that is not UTF-8 before it sends anything. A lenient decode would turn that byte into "�", and the API would then save "�" into a name.
- **What the review version covers.** Catalog file: the canonical rows in file order, what each row would do, and for each changed course the `reviewVersion` of the manual `PATCH` (`impactVersion`: saved values, proposed values, every curriculum linking the course). Group-links file: the route's program and cohort, the canonical rows, the ID each group name resolves to, and whether each link exists.
- **Record numbers, and no line numbers.** The header is record 1. A blank line is not a record. A record whose fields are all empty is ignored but keeps its number. The record number is the only position a row or an error carries. ADR 0011 makes physical lines optional ("when useful"), and `csv-parse` counts a CR and an LF inside a quoted field as two lines, so a line number could not be given reliably.
- **Order of the checks.** The caller's grant comes first, then (for group links) the cohort of the route, then the file. A caller without the grant gets `403` for any file, never a `400` or a `413` about its content. A confirmation checks the grant once before it reads the file and again under the write lock.
- **Missing values.** A blank code, name or credit count is refused by the validation of manual entry, with its messages; the import has no required-value check of its own for a catalog row. The group-links file has one, for a blank group name: the manual `PUT` takes the group's ID from the path, so no shared check exists.
- **Field counts.** A record with another number of fields than the template is a row error, and every such record is reported. The parser runs with `relax_column_count` for that reason only; `csv-file.ts` then requires the exact header and the exact count, and pads or drops nothing.
- **Numbers.** A cell of digits only becomes a number (`wholeNumberOrText`, `curriculum-admin.dto.ts`); any other text reaches `CreateCourseDto` as text and is refused by the same `@IsInt` as a manual body. The parser casts nothing.
- **Duplicates.** The second and later rows with the same canonical code, or the same group name and code, are the errors; each names the record that came first.
- **Affected curricula.** The preview uses `AffectedCurriculumDto` as the manual `PATCH` does: `curriculumId`, `curriculumCode`, `programCode`, `cohortYear`. It has no `programId`, although ADR 0011 lists one.
- **Preview transaction.** `AdminWriteService.read`: one `REPEATABLE READ`, `READ ONLY` transaction, the caller's current grants checked first, no lock.

Differences that reach manual entry or the rest of the app:

- **A blank period count is 0, also over a stored `NULL`.** The period columns allow `NULL` ("the official table leaves the cell blank"), and a seeded course can hold one. A file row for such a course with a blank period cell is an update from `NULL` to 0, shown in the preview like any other change.
- **A whole number above 2,147,483,647 as a credit or period count is a `400`** in manual entry too (`StorableInteger` on `CreateCourseDto` and `UpdateCourseDto`). Before, the manual routes answered `500` from the database. A value that is not a whole number gets the same messages as before.
- **`express` `5.2.1` is a declared dependency of the backend.** The import body parser is `express.json`. The version is the one `@nestjs/platform-express` already installed.
- **Who gets the 7 MiB parser.** A body parser runs before every guard, so before authentication and before the rate limit: the rate limit does not protect a parser. Two rules do (`import-body-limit.ts`, `import-body-gate.ts`):
  - *The gate.* The 7 MiB parser reads a body only when the request carries a live session (the lookup of the `AuthGuard`, `AuthService.authenticate`) whose user holds, at that moment, the grant of the route: `catalog_maintainer` for the catalog imports, the program of the path for the cohort imports. Every other caller of these routes gets the default 100 KiB parser, so a body over 100 KiB is refused on its declared length, as on any other route. The gate is not the authorization of an import; that stays in the services.
  - *No inflation.* A request with a `Content-Encoding` on these four routes answers `415 unsupported_content_encoding` before anything is read, for every caller. A few compressed kilobytes cannot become megabytes here.
  - *What it still costs.* A request on these paths with a bearer token costs one session lookup before the rate limit, and two grant lookups when the session is live; a request without a token costs none. A holder of the grant can still send 7 MiB per request; their requests are rate-limited after the body is read, like every request.
- **The production proxy allows 8 MiB.** `deploy/server/nginx-site.conf` sets `client_max_body_size 8m`: a 1 MiB CSV with every character escaped is 6,291,466 bytes of JSON, more than the 6 MiB it allowed before. nginx applies it to every route; the app keeps 100 KiB everywhere else. The host needs `deploy/server/setup.sh` run again for the change to take effect.
- **An unexpected failure of an import logs only its kind** (the error class and the SQLSTATE), and answers the usual `500`. Nest would log the error object, and a storage error holds the failed statement's parameters, which are rows of the file.

Other differences from ADR 0011:

- Besides the codes in ADR 0011's response table, the write services answer `403 account_deletion_pending` when the caller's account is waiting for deletion, and `400 prerequisite_cycle` with the cycle (`admin-errors.ts`). Granting a program or global permission (`PUT /access/users/:userId/programs/:programId` and `PUT …/global/:permission`) to an account waiting for deletion answers `409 recipient_deletion_pending` (`access-admin.service.ts`).
- The administration screens (`src/frontend/src/admin/`, under `/admin`) call the routes above: the curriculum editor for a program grant, with program and cohort controls (#146, #165); the shared catalog for a catalog maintainer; the CSV import (#165); and access management for an access manager. The account screen shows the read-only **User ID** with **Copy**. No screen enters a credit total or a training type, because no route accepts one. The catalog screen opens a course by its exact code, because no route lists or searches the catalog (ADR 0011 review finding 1). After a write that gets no answer, a screen reloads the saved resource before it reports an outcome.
- **How the screens read a refusal** (recorded 26 November 2026). The stable `code` of the error body decides, not the HTTP status: `prerequisite_cycle` is a 400 and `referenced_item` a 409, and both saved nothing. Two answers have no `code`: a 413 from the body parser, which runs before the route, and the plain 404 of the read routes.
- ADR 0011's amendment of 9 November 2026 says the curriculum PDFs print no prerequisites. Since then, [#75](https://github.com/LLaammTTeerr/omnicourses/pull/75) extracted the "Prior-course" lines of the APCS course-description booklet into `src/backend/src/database/seeds/apcs-prerequisites.ts`. Those lines are not loaded as rules. Since #111 (the [15 November amendment](adr/0011-curriculum-administration.md#amendment-15-november-2026-apcs-courses-have-no-prerequisite)), `db:seed` writes one `course_prerequisite_lists` row per course of APCS 2024 and APCS 2025. An empty list means "no prerequisite"; CS470's list holds CS469. No seed writes `course_offering_terms`.
- 2026-11-26: The import parser is registered before the app initialises, because Nest adds its default JSON parser then, and that parser skips a body that is already read. Do not name the import parser function `jsonParser`: Nest takes a middleware with that name for its own default parser and then does not add the default parser for the other routes.
- 2026-11-26: The import parser is registered after CORS, so a browser can read its 413. It looks up the gate on each request, because Nest providers do not exist yet when the parser is registered. An app without the curriculum-admin module has no gate, so no caller gets the 7 MiB parser.

## UC-12 Receive notifications (F10)

The school dates and their calendar page are built ([ADR 0017](adr/0017-academic-calendar.md)). The notification inbox is built in the API only ([ADR 0018](adr/0018-notification-inbox.md), proposed): the single-page app has no bell and no inbox screen yet. Dũng, the owner of F10, decided the timing, the time zone and the repeat rules on 25 November 2026; UC-12 gives "seven days" only as an example.

| Specification | As built | Follow-up |
| --- | --- | --- |
| At a scheduled moment, for example seven days before a registration window opens, the system creates a notification (steps 1 and 3). | Built. A registration window makes one notification 7 days before it opens and one on the day it opens; a term makes one on its first day (Dũng, 25 November 2026). Days follow Vietnam time. One function creates what is due today: a timer runs it when the app starts, every 10 minutes and at 00:00 in Vietnam, and each read of the inbox or of the unread count runs it for the caller. A day that has passed is skipped, and a moved date sends nothing again. The students of the date's program receive it; an account waiting for deletion does not. | |
| The student has finished onboarding (precondition). | A student receives the notifications of a school date once onboarding has saved their program, finished or not: the same rule as the calendar's default program. Dũng confirmed this on 25 November 2026 ([ADR 0018](adr/0018-notification-inbox.md), decision 6). The single-page app sends a student whose onboarding is unfinished to onboarding first, so such a student sees the notifications after finishing. | |
| The system asks the rule engine what applies to the student, and the registration notification says what the active plan places: "Your plan places 5 courses, 19 credits" (steps 2–3, A6). | Not built (confirmed by Dũng, 25 November 2026). The registration notification holds the date only: a kind, a copy of the school date and link keys. The module reads no plan and calls no rule-engine function. No rule-engine function reads the calendar; ADR 0017 keeps it that way, so a date never decides an academic rule. | **B3:** the plan's courses and credits in the registration notification. They must come from the rule engine and the plans module (ADR 0018, decision 10). |
| The registration notification links to the plan and to the registration guide (step 3). | The API returns link targets as keys, not URLs: `calendar` and `planner` for a registration notification, `calendar` for a term start, `audit` for a transcript change. There is no guide link: no stable key names a guide. B2 does not need it (Dũng, review of #156, 25 November 2026). | **B3:** a key for the registration guide, once guides have a stable key (ADR 0018, open question 3). |
| A bell with the unread count, a popover, and an inbox listed newest first; opening a notification marks it read (steps 4–7). **Mark all as read** (A3) and filters (A4). | Built in the API: `GET /api/notifications` (newest first; filters `unread` and `kind`; pages), `GET /api/notifications/unread-count`, `POST /api/notifications/{id}/read` and `POST /api/notifications/read-all`. No screen calls them yet. A4's "plan" filter has no kind, because A2 is not built. The calendar page at `/calendar` shows the school dates of the student's program in a week view and a month view, with the term week; it has no read state and is not in UC-12: it follows the calendar UI prototype. | The bell, the popover and the inbox screen |
| The student saves a new transcript, and the notification lists what changed in the audit (A1). | Built without the list (confirmed by Dũng, 25 November 2026). Each save that changes a transcript that was not empty makes one notification, inside the save's transaction. It says only that the saved transcript changed and links to the degree audit: no grade, no course and no audit result. The first import, a save with the same rows in any order, a refused save and a failed save make none. | **B3:** the list of what changed in the audit. It must come from the rule engine (ADR 0018, decision 10). |
| A curriculum change makes the active plan break a rule, and the system creates a notification that names the rule (A2). | Not built. Not in B2 (Dũng, 25 November 2026). | |
| The student turns a kind of notification off in settings (A5). | Not built. Not in B2 (Dũng, 25 November 2026). | |
| A notification never states a rule's value on its own; it shows the rule engine's result (special requirements). | A notification states no rule value and no rule-engine result at all: it holds a kind, a copy of a school date and link keys. | |
| Notifications are in-app only; there is no mail sender before B3 (special requirements). | As specified: the inbox only, no email (Lâm, 12 November 2026). | |
| (none) | An add/drop window (`add_drop` in the calendar) makes no notification. Not in B2 (Dũng, 25 November 2026). | |
| (none) | A notification keeps a copy of the school date as it was announced. It stays when an administrator deletes the date (confirmed by Dũng, 25 November 2026), and it does not follow a later change of the date. | |
| The dates come from the published school calendar, entered by the team (special requirements). | A program administrator of that program enters them through the API: `POST /api/admin/programs/{programId}/calendar-events`, and `PATCH` and `DELETE` on `…/calendar-events/{eventId}`. The writes use F12's program grant and write lock ([ADR 0011](adr/0011-curriculum-administration.md)). No screen calls these routes yet. Nothing is seeded, so a program shows no dates until its administrator enters them. | An administration screen for the dates |
| (none) | The API also returns another program's dates when asked by program code (`program` query). The page always shows the student's own program. | |
| (none) | The calendar prototype also shows a personal timetable: the student's classes, rooms, deadlines, exams and notes. It is not built. ADR 0017 leaves it to a separate feature with its own ADR, and the Project Lead approved it as that separate feature. | Personal timetable, its own PR and ADR |

## UC-14 Manage account and privacy

| Specification | As built |
| --- | --- |
| The sessions list shows the place each device was last used (step 4). | A session stores the browser's user agent and its times; no place. |
| Withdraw AI consent (A3). | Not built: no AI feature is built, and the only consent stored is `users.consent_at` from sign-up. |
| The export holds notifications; deletion stops every shared link (A4, A5). | The export holds the student's notifications: the `notifications` table has a `user_id` key to `users`, and the export holds every table that has one. A deletion request deletes every shared plan's link in the transaction that revokes the sessions, and a restored account gets none back (UC-09 A7). A `plan_shares` row is exported without its token. |
| 30 days of grace. | The default of `ACCOUNT_DELETION_GRACE_DAYS`; the deadline promised is stored in `users.purge_after`. |

## Documents that lag the code

- The [class model](class-model.md) has `PlanShare` in §1.4 and §1.7 only; §3 does not draw `SharingService` and its two controllers, and no sequence diagram of UC-09 is drawn.
- [`sequence-diagrams/UC-01-sign-up-and-onboard.md`](sequence-diagrams/UC-01-sign-up-and-onboard.md) draws sign-up, sign-in and sessions; onboarding (`GET` and `PUT /api/users/me/onboarding`) is not drawn.
- No sequence diagram is drawn for curriculum administration (UC-11, UC-17, UC-18).
