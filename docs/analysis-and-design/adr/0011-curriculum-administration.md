# ADR 0011: Curriculum administration and program-scoped permissions

- Status: accepted (Lâm, Project Lead, 12 November 2026, on Discord). Amended 9 November 2026: prerequisites and offering terms built now (see [the amendment](#amendment-9-november-2026-prerequisites-and-offering-terms-now)). Acceptance records the scope exception and the audit deferral below and closes the prerequisite storage gate; [Implementation notes (12 November 2026)](#implementation-notes-12-november-2026) describe what `main` does where it differs from the text
- Date: 2026-11-03
- Owner: Thắng (F12)
- Deciders: Lâm (Project Lead), Triết (curriculum schema and rule engine)
- Reviewers: Lâm (authentication and access), Triết (data boundaries), Hoà (requirements scope)

## Context

F12 needs an API to create and edit programs, cohorts, courses, prerequisites and requirement groups, with administration rights scoped per program. [UC-11](../../requirements/use-cases/UC-11-maintain-curriculum.md) separates program administration, shared catalog maintenance and access management. The [test plan](../../test/test-plan.md#b2-checks) places this work in B2 and requires this ADR before code, after [PR #23](https://github.com/LLaammTTeerr/omnicourses/pull/23) merges. #23 is no longer open: it merged on 3 November 2026 as `900b1b8`, after this ADR was first written, and its migration is byte-identical to the inspected `700213a` below. The first F12 writes then merged in [#74](https://github.com/LLaammTTeerr/omnicourses/pull/74) (`4a97fa7`).

The inspected [#23 migration at `700213a`](https://github.com/LLaammTTeerr/omnicourses/blob/700213a224fb0486449e83008060d186c751081e/src/backend/src/database/migrations/1792912952302-create-curriculum-course-schema.ts) defines `programs`, `curriculums`, `requirement_groups`, `courses` and `requirement_group_courses`. A curriculum is unique by `(program_id, cohort_year)`; a course is shared across curricula. It supplies no prerequisite or offering-term storage, entities or read/validation interface. Its [ADR 0005](https://github.com/LLaammTTeerr/omnicourses/blob/700213a224fb0486449e83008060d186c751081e/docs/analysis-and-design/adr/0005-curriculum-cohort-and-course-catalog.md) still mentions a link-level `compulsory` column that the migration removed. F12 must reconcile the merged schema and ADR rather than restore that column.

[ADR 0002](0002-authentication-and-sessions.md) already authenticates every request; it leaves F12 permissions to this feature. [ADR 0004](0004-account-export-and-deletion.md) determines grant ownership, export and account purge. [ADR 0003](0003-language-model-scope.md) excludes curriculum PDF import and model calls. The test plan records Lâm's 1 November decision to replace PDF import with deterministic CSV bulk import, including a CSV format and UC-11 flow in this design.

### Explicit scope proposal: school, faculty and program

Vision v2 §6 Security ([source](../../../report/assignments/PA2/Vision.tex)) requires administrator rights per school and per program. The [glossary](../../../GLOSSARY.md) defines a faculty as the HCMUS unit owning programs; it does not make a faculty a school. #23 stores `programs.faculty` as descriptive text, not an authorization boundary.

This ADR proposes **program-scoped grants within the current HCMUS deployment**, plus the two global permissions below. Global means the entire deployment. There is no faculty inheritance or cross-school isolation. This is an explicit proposed reduction of the school-scoping requirement for B2/B3, not evidence that the whole Security NFR passes. Lâm and Hoà must accept that scope change or require school identifiers and scoped catalog/access-manager grants before implementation. Renaming `faculty` to `school` would not resolve it.

**Decided (Lâm, 9 November 2026):** accepted for B2 and B3. OmniCourse serves one school (HCMUS), so a school level would add a boundary with nothing on the other side of it. The Security NFR's per-school clause is recorded as a known exception in the B2/B3 acceptance evidence; a second school needs a new ADR first.

**Accepted (Lâm, 12 November 2026):** program-scoped grants plus the two global permissions replace the Vision's school-scoped administration. This is a deliberate exception to Vision §6 Security, not a claim that its per-school clause passes.

### Open from review (Thắng, 9 November 2026)

Thắng's review listed three findings. At acceptance (12 November 2026) each is answered from `main` as it stands; where `main` has a gap, it is stated, not filled in:

1. **Catalog read path for program administrators.** *Answered, with a gap.* `main` has the F4 read routes from [#65](https://github.com/LLaammTTeerr/omnicourses/pull/65) (`src/backend/src/curriculum/curriculum.controller.ts`), open to every signed-in user, ordinary students included: `GET /api/programs` (every program with its cohorts), `GET /api/programs/:program/curricula/:cohort` (the curriculum and its requirement groups with their UUIDs, and each course with `prerequisites` and `offeringTerms`, `null` when not recorded) and `GET /api/courses/:code` (one catalog course by exact code, with every group linking it). #74 added `GET /api/admin/programs`: only the programs the caller holds a program grant for, with their cohorts' curriculum IDs. None of these filters or paginates. **Gap:** no route lists or searches the shared catalog, for administrators or anyone else, so a program administrator links a course by a code they already know. A catalog listing/search route needs its permission, fields, filtering and pagination added here before it is built.
2. **Rejecting unknown and immutable PATCH fields.** *Closed by #74.* Admin request bodies use `@StrictBody()` (`src/backend/src/curriculum-admin/strict-body.ts`), a custom parameter decorator the global pipe skips, validated by a route pipe with `whitelist` and `forbidNonWhitelisted`: an unknown, identifier or gated field (a credit total) answers `400 validation_failed` naming it. It covers requirement-group `POST`/`PATCH`, prerequisites and offering-terms `PUT`, and catalog `POST`/`PATCH`; the membership, access and `DELETE` routes take no body. The global `ValidationPipe` (`src/backend/src/bootstrap.ts`) still uses `whitelist: true` without `forbidNonWhitelisted` for every other route. The e2e test "rejects malformed codes, unknown fields and a gated credit total" (`src/backend/test/curriculum-admin.e2e-spec.ts`) proves it.
3. **Field contracts outside courses.** *Answered for requirement groups; open for programs and curricula.* Requirement groups (`curriculum-admin.dto.ts`): `name` required, nonempty, at most 255 characters and unique within the curriculum; `kind` one of the stored kinds, refused on `PATCH` while the group stores a credit total; `officialNotes` nullable, blank stored as null; `curriculumId` and the totals are not accepted. No route on `main` creates or edits a program or a curriculum, so their field contract is not yet written. `curriculums.code` (`varchar(50) NOT NULL`, no uniqueness constraint in #23's migration) is written only by the seeds (`APCS2024`, `APCS2025`) and is read-only in `GET /api/admin/programs`; its format, uniqueness and immutability must be added here with the first program/cohort write route.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **Three independent grants, denied by default:** program administrator for one program; catalog maintainer for the shared catalog; access manager for program creation and granting/revoking all three roles, including other access managers. No permission implies either of the others. | One `users.is_admin` flag; letting program administrators edit globally shared courses; operator-only creation of every access manager; inferring grants from onboarding. | UC-11 A2, A4, A8 and §8; TC-B2-ADM-01/02/06. Delegation after the first operator bootstrap matches the glossary and makes last-active-manager protection necessary. |
| **A `curriculum-admin` Nest module owns F12 write services, controllers, DTOs and grants.** Reuse the global `AuthGuard` and `@CurrentUser()`; check authorization inside every service mutation. No new authentication guard or `@Public()` route. | Permissions checked only by the UI or controller; a second sign-in mechanism; roles stored in session tokens. | ADR 0002; UC-11 A4 requires direct requests and revocations to be checked. A seed or service caller must not bypass the write boundary. |
| **Separate program and global grant tables**, keyed by recipient and scope, with direct `user_id ... ON DELETE CASCADE`. No owner-user foreign key on shared curriculum/catalog rows. | Nullable program scope in one role table; storing role lists in `users`; making the catalog belong to its creator. | ADR 0004 and AGENTS.md require exportable owned rows and purge without deleting shared academic data. Separate tables prevent a null program grant from becoming global access. |
| **Resolve ownership through stored relations, inside the write transaction.** A path's program ID never authorizes a group or curriculum merely because the client supplied it. Parent identifiers are immutable in ordinary edits. | Trusting nested IDs or body fields; allowing edits to move data between programs or cohorts. | UC-11 A1/A4; TC-B2-ADM-02/03. Cohorts are separate curriculum versions in ADR 0005. |
| **A shared catalog correction requires a preview and confirmation of current values and all affected links.** Recheck under the same serialization used by membership edits. Course codes are immutable through ordinary edits. | Silent cross-program changes; taking the client's affected-program list as authoritative; renaming codes without migrating their consumers. | UC-11 A8; TC-B2-ADM-01/05; ADR 0007 matches transcript rows by canonical code. |
| **Manual entry and CSV confirmation use the same transactional write/validation services.** F12 checks data shape and references; the rule engine decides academic consistency. | Independent CSV rules; row-by-row partial imports; duplicated academic rules or model calls. | UC-11 step 4 and A3/A7; TC-B2-ADM-05/07; AGENTS.md hard rule 1 and ADR 0003. |
| **Use `csv-parse` exactly `6.1.0` for CSV parsing when implementation is unblocked.** This ADR records the library choice; no dependency is installed by this documentation change. | Splitting on commas; a browser-focused parser for a server-only import; installing the full CSV package. | The [tagged package](https://github.com/adaltas/node-csv/blob/csv-parse@6.1.0/packages/csv-parse/package.json) exports ESM and TypeScript types; the [parser documentation](https://csv.js.org/parse/) covers quotes/escaping and line breaks with no runtime dependencies. These support the CSV contract below without academic interpretation. |
| **Refuse deletion of referenced curriculum/catalog data.** Unlinking one course from one group is a separate operation. | Relying on every schema cascade as permission to delete; deleting catalog courses with their groups; adding archival/versioning without a reader contract. | UC-11 A5/A8; TC-B2-ADM-04. #23 cascades group membership, which must not erase data still needed by another saved record. |
| **Code follows #23's merge and this design's review. Prerequisites/offering terms additionally require Triết's storage, read and validation handoff.** | Implementing against an unmerged migration; inventing prerequisite semantics from course names or suggested study terms. | UC-11 §8; test-plan §8; #23 has no related tables. Basic CRUD does not complete the requested prerequisite API. *Both gates are closed: #23 merged as `900b1b8`, and #74 built prerequisite/offering storage under the amendment below.* |

## Permission and storage contract

| Permission | Allowed operations | Scope and exclusions |
| --- | --- | --- |
| Program administrator | Read the administration view; edit program details; create/edit cohorts, requirement groups and group-course links; later maintain prerequisites/offering terms. | The specifically granted program and its stored descendant records only. No program creation, catalog changes or grant management. |
| Catalog maintainer | Read the catalog directly, create courses, preview/confirm shared corrections, delete unreferenced courses. | No program grant needed. No curriculum membership changes or grants. |
| Access manager | Create programs, list grants and grant/revoke any of these three permissions for existing users. | No automatic curriculum/catalog editing rights, including for a program just created. |

An ordinary signed-in student gets no F12 grants. Holding several grants is allowed. The administration program list contains only programs the caller may edit; access managers separately list program identifiers and names needed to assign grants. Grant responses contain user IDs and scopes, never identity credentials. Selecting a faculty, program or cohort during onboarding does not grant access.

Proposed migration-owned tables:

| Table | Keys and constraints | Other fields |
| --- | --- | --- |
| `program_admin_grants` | `PRIMARY KEY (user_id, program_id)`; `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`; `program_id uuid NOT NULL REFERENCES programs(id) ON DELETE RESTRICT`. | `granted_at timestamptz NOT NULL DEFAULT now()`; nullable `granted_by uuid REFERENCES users(id) ON DELETE SET NULL`. |
| `global_admin_grants` | `PRIMARY KEY (user_id, permission)`; the same `user_id` foreign key; `permission varchar(32) NOT NULL CHECK (permission IN ('catalog_maintainer', 'access_manager'))`. | The same `granted_at` and nullable `granted_by` fields. |

Granting is an idempotent upsert; repeating the same grant preserves its original attribution. Revoking an absent grant is an idempotent no-op, after checking the caller's current access-manager permission. Recipients must exist and must not have pending account deletion. No operation accepts a role outside the allowed set or a missing program for a program grant.

Account export includes only the recipient's grant rows. Purging a recipient removes their grants; purging a granter nulls `granted_by` and preserves other recipients' grants. Neither action deletes programs, curricula or courses. No new grant table may reach `users` only through another table. These properties must pass the existing account-export/purge e2e checks.

### Audit trail: open before curriculum/catalog writes

Neither #23's `updated_at` nor grant attribution records who changed a curriculum or catalog row. **Lâm and Triết must decide whether B2 requires a change-history log or explicitly defers it before those mutations are implemented.** No audit trail is claimed by this ADR. If included, the reviewed contract must define recorded operations and before/after fields, transaction failure behavior, read permissions and retention; Thắng adds the storage and acceptance cases here before coding. If deferred, record the missing history in B2's acceptance evidence.

**Decided (Lâm, 9 November 2026): deferred until after B3.** Curriculum and catalog writes may be implemented without a change-history log. B2's acceptance evidence records the missing history, and nothing in B2 or B3 may claim an audit trail.

**Decided (Lâm, 12 November 2026), superseding the line above: deferred to B3.** This is an explicit deferral: B2 has no logging contract and no change-history log, and B2's acceptance evidence records the missing history. If B3 builds the log, its contract (recorded operations, before/after fields, transaction failure behavior, read permission and retention) is added to this ADR first, under the actor rule below; until a log ships, nothing may claim an audit trail.

A retained log describes shared curriculum/catalog changes, not a student's owned record. Its actor reference must be nullable `actor_id uuid REFERENCES users(id) ON DELETE SET NULL`, never `user_id`; account purge detaches the actor and preserves the change record. Do not duplicate actor names, email, student identifiers or credentials into the log payload. This does not change the recipient-owned grant tables above. Export/purge tests must prove the log is not exported as the actor's owned data and survives actor purge with `actor_id = NULL`.

### Bootstrap and recovery

`npm run admin:bootstrap -w src/backend -- --user-id <existing-user-uuid>` is an operator-only command, built in #74 (`src/backend/src/curriculum-admin/bootstrap-cli.ts`). It is not an HTTP endpoint, migration default or sign-up option. The Project Lead invokes it in a trusted deployment shell against the intended database.

The command runs in one transaction under the F12 write lock, verifies that the target account exists and is active, and grants only `access_manager`, with `granted_by = NULL`. It refuses when any active access manager already exists; two concurrent attempts cannot both succeed. Subsequent grants use the authenticated API. The same zero-active-manager check permits controlled recovery if account deletion removes or disables the last manager; recovery is not an override of an existing active manager.

The grant API rejects revoking the last active access manager with `409 last_access_manager`; grant/revoke operations serialize the count and mutation. Account deletion and purge remain governed by ADR 0004 and are never refused to preserve an administration role. Here, active means `users.deletion_requested_at IS NULL`; expired sessions alone do not remove a grant. Bootstrap tests cover unknown/deleting accounts, repeated/concurrent invocation and recovery without creating a public privilege-escalation route.

## Write boundary and API outline

All routes below are the accepted outline, behind `/api/admin`, and require the existing bearer authentication. Not all of them exist yet: the [implementation notes](#implementation-notes-12-november-2026) list which ones `main` serves. The implementation supplies validated request/response DTOs with `@ApiProperty`, `@ApiBearerAuth()` and documented errors in OpenAPI 3.2.0. Controller names and internal helper names are implementation choices; authority checks and transaction boundaries are not.

| Routes under `/api/admin` | Permission and behavior |
| --- | --- |
| `GET /programs`; `POST /programs`; `PATCH /programs/:programId` | List editable programs; create with access-manager permission; edit details with that program's grant. Creation never grants editing access implicitly. |
| `GET, POST /programs/:programId/cohorts`; `GET, PATCH /programs/:programId/cohorts/:curriculumId` | Program grant. A cohort is a `curriculums` row, not a second cohort table. Creation uses unique `(program_id, cohort_year)`. |
| `GET, POST /programs/:programId/cohorts/:curriculumId/requirement-groups`; `PATCH, DELETE .../requirement-groups/:groupId`; `PUT, DELETE .../requirement-groups/:groupId/courses/:courseCode` | Program grant, verified against curriculum and group ownership. PUT creates a missing link or returns the existing link; DELETE removes only that link, subject to validation. Group removal follows the reference policy below. |
| `GET, POST /catalog/courses`; `GET, DELETE /catalog/courses/:courseCode`; `POST /catalog/courses/:courseCode/preview`; `PATCH /catalog/courses/:courseCode` | Catalog grant. Existing-course PATCH requires the preview's `reviewVersion` and the same proposed values. Program administrators select existing course codes through the curriculum/catalog read API; they do not gain this catalog-management access. |
| `GET /access/programs`; `GET /access/users/:userId/grants`; `PUT, DELETE /access/users/:userId/programs/:programId`; `PUT, DELETE /access/users/:userId/global/:permission` | Access-manager grant. Program selection and exact user-ID grant lookup; no general export of the user directory. Recipients copy their own ID from the planned account screen below. |
| `POST /catalog/imports/preview`, `POST /catalog/imports/confirm`; `POST /programs/:programId/cohorts/:curriculumId/imports/preview`, `POST .../imports/confirm` | Catalog grant for course rows; program grant for group links. Same CSV and confirmation contract below. Imports cannot create programs or grants. |

Program `code`, curriculum `program_id` and `cohort_year`, group `curriculum_id`, and catalog course `code` are immutable after creation through these routes. `curriculums.code` is not yet covered (see review finding 3 above). Ordinary PATCH requests whitelist editable attributes and explicitly reject attempted identifier/parent changes rather than silently ignoring them. A new cohort is a new curriculum record. A course-code correction needs a separate reviewed migration, including plain-string consumers such as transcripts and plans.

The B2 account screen must display a read-only **User ID** with a **Copy** action, using `id` from the existing authenticated `GET /api/users/me` response (`UserDto.id`). The recipient gives that ID to the access manager, who enters it in the grant form. The ID is an identifier, not a credential or authority to grant access. This screen field is a planned UI handoff to Hoà/Thắng, not an existing feature; it must be available before the grant-management UI is accepted. No email-search endpoint or user-directory listing is added.

For nested writes, resolve `group → curriculum → program` from the database and require both the path relationship and the caller's grant to match. Check the path program grant before returning nested record details. A grant for program A with a group ID from B never authorizes a write to B. For link creation, resolve the course independently from the shared catalog; permission to select it is not permission to alter it.

### Transaction and concurrency contract

All F12 mutations, grant changes and bootstrap operations take one transaction advisory lock, then lock the caller and any grant recipient with `FOR NO KEY UPDATE` in UUID order. Reject pending deletion, check current grants and resolve ownership inside that transaction. Completed revocation blocks the next write; an already authorized mutation finishes before revocation. Seeds and other writers must follow the same locking contract or run with administration writes disabled.

Previews use a consistent read-only snapshot; hold no transaction while the user reviews it. Confirmation takes the write lock, repeats permission/reference/shape/academic checks, compares the review version, and commits the whole change or rolls it back. Locking includes membership edits and parent deletion, so impact cannot change between comparison and commit.

Catalog previews return old/proposed values, all affected `(programId, curriculumId, cohortYear)` tuples and `reviewVersion`, derived from the normalized proposal, current course values and sorted complete group-course references with curriculum/program identities. It grants no permission. Confirmation recomputes it; a mismatch returns `409 impact_changed` without writing and requires another preview.

Shared corrections affect every linked curriculum without rewriting transcripts or saved plan placements. Refuse cohort-specific course values. Adding a cohort preserves the original curriculum identity, membership, saved plans and audit/validation results; only confirmed shared corrections may change computed results across cohorts.

### Validation, errors and removal

Normalize course codes by trimming and uppercasing, then require `^[A-Z0-9]{2,20}$` in manual and CSV paths, matching ADR 0007 and #23. Follow the merged schema's lengths and uniqueness keys; require nonempty names, positive integer catalog credits and nonnegative integer period counts. `cohort_year` follows #23's 2000–2100 bound. These are structural checks; totals and academic consistency use Triết's reviewed rule-engine contract, never a sum-of-credits rule invented in F12.

**B2 totals are gated fields, not accepted everywhere.** Once Triết supplies their meanings and validation, cohort POST/PATCH may accept `totalCreditsMin` (`curriculums.total_credits_min`); requirement-group POST/PATCH may accept `creditsTotal` and `creditsTotalMin` (the corresponding group columns). Validate supplied values as nonnegative integers or explicit null where the reviewed contract permits unknown values. Before that handoff, those fields are rejected with `400 validation_failed`; creation leaves them null and unrelated edits preserve stored values. Reads may show existing totals. Catalog, group-link and CSV routes never accept total fields. Creating or changing links still needs final-state group-total validation, even though its input has no totals. B2 completion depends on those handoffs; the date alone does not enable the fields or satisfy the tests.

A write to a row that has an `updated_at` column sets it in the same statement or save: entities use `@UpdateDateColumn` (TypeORM sets it on `update()` and `save()`, as the group and catalog `PATCH` do), and raw SQL sets `"updated_at" = now()` (the prerequisite-list upsert), the pattern `users` and `guide_texts` already follow. No trigger is added. Group-course links, prerequisite rows and offering-term rows have only `created_at`: they are inserted or deleted, never updated.

Reject unsupported fields and nonexistent references before saving. Reconcile #23's nullable period fields and missing nonnegative-total constraints with this contract in a follow-up migration, never by editing an applied migration. Resolve ADR 0005's stale compulsory-link description: the inspected schema has only group `kind`, not a second source on each link.

| Response | Meaning |
| --- | --- |
| `401` | Missing, expired or revoked sign-in, handled by the existing global guard. |
| `403 permission_required` | Missing current program, catalog or access-manager grant; the response identifies the permission kind, without disclosing another program's data. |
| `404` | Item absent within the authorized scope, including mismatched nested IDs. |
| `400 validation_failed` | Malformed/unsupported fields, invalid CSV or a deterministic validation failure; return field/row errors and rule-engine findings where applicable. |
| `409` with a stable reason | Uniqueness conflict, `impact_changed`, `referenced_item`, or `last_access_manager`; no partial save. |
| `413` | JSON body, decoded CSV bytes or data-record count exceeds the import limits below; no partial save. |

Unexpected storage failures roll back and return the existing server-error response without SQL, credentials or private data. A lost response leaves the client in an unknown state: reload the saved resource before retrying or reporting success. Cancellation before confirmation sends no write.

Deleting a group requires confirmation and refusal if it still has course links or another saved reference; unlink courses explicitly first. Deleting a course requires catalog permission, no catalog/curriculum/plan references, and the same write serialization. The implementation must inventory both foreign-key and plain-code consumers before enabling deletion; absence of a foreign key is not proof of no reference. In particular, ADR 0007 stores transcript codes without a catalog foreign key. If the required reference check is unavailable, deletion stays unavailable. This ADR introduces no program/cohort delete route or archival state. The database's existing cascades do not bypass these service rules.

## CSV contract and UC-11 handoff

CSV is deterministic bulk entry for **courses or group links**, in two separate file types. It does not create programs, cohorts, groups or grants and does not import prerequisites/offering terms before their handoff. F12 supplies downloadable header templates; use synthetic records in fixtures and examples.

| File type | Exact header | Row meaning |
| --- | --- | --- |
| Catalog courses | `code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods` | Upsert by canonical course code. `name_vi` and positive integer `credits` are required; blank `name_en` becomes null; each blank period count becomes zero. Existing rows with changed attributes require shared-impact review; identical rows are no-ops. |
| Group links, within the route's program and cohort | `requirement_group_name,course_code` | Resolve the exact trimmed group name uniquely within the selected curriculum, and link an existing canonical catalog code. Missing groups/courses are errors, not implicit creation. No compulsory flag: group kind is the sole source in the inspected schema. |

Accept UTF-8 with optional BOM, comma delimiters, LF or CRLF, and quoted fields with doubled quotes; a quoted field may span physical lines. Headers must match the selected template exactly. Trim field-edge whitespace, normalize course codes as above, preserve case in names, and reject malformed quoting, unknown/missing columns and non-integer numbers. Report logical CSV record numbers with the header as record 1; include physical start lines when useful for multiline records. Ignore fully empty records; reject partially filled rows with missing required values. Bound the decoded CSV to 1 MiB of UTF-8 bytes and 1,000 data records; these are input limits, not academic rules.

Keep JSON transport. Configure a **7 MiB JSON-body limit only on the four import preview/confirm POST routes**, before the default parser runs; preserve the current 100 KiB limit on unrelated routes. This allows a 1 MiB CSV plus JSON escaping (up to six encoded bytes per ASCII character), wrapper and a bounded review-version value. Apply the independent decoded-byte and record limits after JSON parsing. Put parser setup in the shared app configuration so deployment and e2e use the same limits. Return 413 before any write for either size bound or the record bound. The boundary tests must send a valid CSV larger than 100 KiB, a maximally escaped 1 MiB CSV, and oversized JSON/CSV to both preview and confirmation; also verify unrelated routes keep their original bound.

Duplicate canonical course codes or duplicate `(requirement_group_name, course_code)` pairs within one file are row errors, even when identical. Re-importing a valid file is idempotent by the database's unique keys: unchanged courses and existing links are no-ops; changed course attributes require a fresh preview. Omitted rows never delete existing data. Do not read a cohort or program identifier from a CSV field to override the route's scope.

Preview endpoints accept `{ csv }`, parse and validate every row using the manual-entry services, and return normalized rows, planned inserts/updates/no-ops, all row-numbered errors and the union of affected curricula for shared corrections. They write nothing. A file with any error has no confirmable review version. Group-link validation considers the proposed final set, not only each row separately, through the agreed deterministic validation interface.

For a valid file, return `reviewVersion`, covering the canonical proposed rows, file type, target scope, current affected records/references and the validation-source revision. Confirmation sends `{ csv, reviewVersion }` to the matching route. The server reparses the supplied CSV, checks current grants, revalidates the whole proposed state and compares the version inside the F12 transaction. Changed input, references, existing values or validation-source revision requires another preview; revoked grants refuse confirmation. The whole file commits once or not at all. A repeat confirmed file can produce only no-ops after a fresh preview, never duplicate records.

Neither endpoint retains raw files or server-side preview sessions. The client keeps the draft until confirmation/cancellation; logs must not contain file contents. The import therefore adds no user-owned upload or preview table. Parse with `csv-parse` `6.1.0`, pinning that exact version when implementation is unblocked; use strict quoting/column validation and keep numeric conversion in the shared validation service. Do not skip invalid records or use parser casting to infer academic meaning.

UC-11 A9 records the matching upload → preview → correction → confirmation flow. TC-B2-ADM-07 remains its acceptance parent; the CSV proposal does not revive the excluded PDF-import use case.

## Prerequisites, offering terms and implementation gates

The prerequisite API remains part of the requested F12 work. It is **blocked, not dropped**.

**Decided (Lâm, 9 November 2026):** basic program, cohort, group and catalog create/edit go ahead in dependency order (below) once the remaining gates allow, without prerequisites. F12 is reported as **partial** until Triết hands off prerequisite/offering storage and the rule-engine interfaces. There is no prerequisite table in #23, and neither F12 nor this ADR may guess whether prerequisites are global, per curriculum, conjunctions, alternatives or equivalences. A shared course code alone is not an authorization boundary for a curriculum rule.

| Gate | Required handoff | Owner/reviewer |
| --- | --- | --- |
| #23 merged and inspected again | Actual table/constraint names; canonical course codes; corrected group-kind and credit-total semantics; agreed read access for catalog selection and saved curricula. | Triết; Thắng integrates. |
| ADR 0011 reviewed and accepted | Program/global permissions, grant storage, bootstrap/recovery, deletion policy and the school-scoping amendment. Before curriculum/catalog mutations, close the audit-trail decision above with an accepted logging contract or explicit B2 deferral. | Lâm and Triết; Hoà aligns requirements. |
| Prerequisite/offering-term storage | Migrations and types identify each record's curriculum/program scope, reference/deletion rules, and supported rule expressions. Any globally shared rule needs its own reviewed permission and impact model. | Triết with Thắng. |
| Rule-engine and impact interfaces | Typed final-state validation, group-total semantics, source/revision identity, deterministic findings and complete impact/reference queries. **Manual group-link PUT/DELETE and CSV group-link preview/confirmation wait for this interface**, as do total-field editing and any affected shared-course correction. TC-B2-ADM-07's group-total checks cannot pass, and full administration cannot be accepted for 29 November, without it. Missing rules block affected writes; prerequisite/offering checks additionally wait for their storage handoff. | Triết; academic examples reviewed with Thắng. |
| Read and regression contracts | Curriculum read API, saved-plan consumers and reference checks; test fixtures proving new cohorts preserve original plan placements and audit results. | Triết and Hoà; Thắng/Dũng test. |

**Gate status at acceptance (12 November 2026):**

- **#23 merged and inspected again:** closed (`900b1b8`).
- **ADR 0011 reviewed and accepted:** closed by Lâm's acceptance, with the scope exception and the B3 audit deferral above.
- **Prerequisite/offering-term storage:** closed by #74. Migration `1794230000000-create-curriculum-admin.ts` adds `course_prerequisite_lists`, `course_prerequisites` and `course_offering_terms`, keyed by curriculum. `prerequisite-cycle.ts` refuses cycles on write with `400 prerequisite_cycle`. The routes are `PUT`/`DELETE …/cohorts/:curriculumId/courses/:courseCode/prerequisites` and `…/offering-terms`.
- **Rule-engine and impact interfaces:** still open for group totals. Membership writes run with structural checks only (amendment below), and credit totals stay read-only.
- **Read and regression contracts:** the curriculum read API exists (#65; review finding 1 above). The cohort-preservation regression fixtures were not checked for this acceptance.

After those handoffs, add concrete prerequisite/offering request and response DTOs and route cases to this ADR before implementing them. Their mutations require the stored program grant, current checks and transaction behavior above. Offering terms follow [ADR 0009](0009-term-encoding.md) as amended by [ADR 0012](0012-credit-caps-by-training-type.md): term numbers 1, 2 and 3, where 3 is a third main term in a Tiên tiến, Liên kết or Chất lượng cao program and the summer term only in a đại trà program, plus `term_year` when year-specific. A suggested study term is not an offering. No academic decision is delegated to a model.

*The paragraphs above are superseded for prerequisites and offering terms by the amendment below.*

Implement in dependency order: grants/bootstrap and program/cohort writes; groups/membership with reviewed validation; catalog preview/confirmation; CSV using those services; prerequisites/offering terms after their additional handoff. Partially implemented routes must not claim full F12 completion. This ADR does not supply the administration UI.

### Amendment, 9 November 2026: prerequisites and offering terms now

**Decided (Lâm, through his delegate, 9 November 2026):** prerequisites and offering terms are no longer gated on a separate handoff. The rule engine and the curriculum explorer cannot work without them, and no source document supplies them: the APCS curriculum PDFs print none. Data entry through F12 is therefore the only way they reach the database, so their storage and write endpoints ship with the first F12 writes. The seeds stay without them: no prerequisite or offering term is invented.

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **Per curriculum.** `course_prerequisites` and `course_offering_terms` are keyed by `(curriculum_id, course_code, …)`. A program grant edits them for that program's cohorts only. | Catalog-wide rows on `courses`, edited by the catalog maintainer. | This ADR: "a shared course code alone is not an authorization boundary for a curriculum rule", and a globally shared rule would need its own permission and impact model. UC-11 §8 puts prerequisites/offering terms under the program administrator. The [admin prototype](../ui-prototypes/admin.html) edits them only in the curriculum view, never in the shared catalog view. Cohorts get separate curricula precisely because they differ (ADR 0005). Catalog-wide rows would let the APCS administrator change CLC's rules. |
| **A prerequisite list is a conjunction of courses, with no kind.** Every listed course must be passed first. Both the course and each prerequisite must be linked to a group of the same curriculum; prerequisites reference `courses(code) ON DELETE RESTRICT`. | A `kind` column (tiên quyết / học trước / song hành); alternatives (A or B); prerequisites outside the curriculum. | GLOSSARY defines only *Prerequisite*: "a course that must be passed before another course may be taken". No document in the repository names a co-requisite or "học trước". A kind is an additive column later, defaulting to the current meaning. Equivalences (`apcs-equivalences.ts`) are a different relation. Keeping both ends inside the curriculum lets an unlink refuse to strand a rule, as the prototype does ("vẫn cần … làm tiên quyết"). |
| **"Not recorded" is explicit.** `course_prerequisite_lists` holds one row per `(curriculum_id, course_code)` whose prerequisites were entered, even as none. Offering terms are recorded when the course has at least one row. The read API (`CurriculumCourseDto`) answers `prerequisites: string[] \| null` and `offeringTerms: number[] \| null`: `null` is not recorded (unknown), `[]` is a recorded "no prerequisite"; offering terms are never `[]`. `DELETE` on either returns the course to `null`. | Treating no rows as "none"; one flag per curriculum. | The curriculum read PR's rule: a missing list must not read as "none" (test plan, data gaps). A per-curriculum flag would turn every course not yet entered into "none" as soon as the first one is. |
| **Cycles are refused when written.** `PUT …/prerequisites` replaces the course's list and answers `400 prerequisite_cycle` with the cycle, e.g. `["A", "C", "B", "A"]`, if the curriculum's graph would contain one; nothing is saved. | Accepting the data and leaving the cycle to the rule engine. | A cycle makes every course in it impossible, so it is a data error, like a code outside the curriculum; the prototype refuses it on save. The check is a pure graph function (`prerequisite-cycle.ts`); whether a student meets a prerequisite stays with the rule engine (AGENTS.md hard rule 1). |
| **Offering terms are term numbers 1–3 only,** `term_number smallint CHECK (term_number IN (1, 2, 3))`. Whether 3 is a main or a summer term follows the program's training type (ADR 0012). No `term_year` yet. | Year-specific offerings; a stored term kind. | ADR 0009/0012. No source gives year-specific offerings; `term_year` is an additive column when one does. |

**What #74 implements, under `/api/admin`:** `GET /programs` (the caller's editable programs and cohorts); requirement-group `POST`, `PATCH` (name, kind, notes) and `DELETE` (refused while it links courses); membership `PUT`/`DELETE …/requirement-groups/:groupId/courses/:courseCode` (unlinking is refused while a rule of the curriculum names the course, `409 referenced_item`); `PUT`/`DELETE …/cohorts/:curriculumId/courses/:courseCode/prerequisites` and `…/offering-terms`; catalog `POST`, `PATCH`, `DELETE /catalog/courses/:courseCode` (delete only an unreferenced course, transcript rows included); access `GET /access/programs`, `GET /access/users/:userId/grants`, `PUT`/`DELETE /access/users/:userId/programs/:programId` and `…/global/:permission`; and `npm run admin:bootstrap -w src/backend -- --user-id <uuid>`. Grant tables, the single advisory write lock, `409 last_access_manager` and the bootstrap/recovery rule are as specified above.

- **Shared-catalog review without a separate preview route.** `PATCH /catalog/courses/:code` on a course linked to any curriculum answers `409 impact_confirmation_required` with `affectedCurricula` and a `reviewVersion` (a hash of the current values, the proposed values and the affected curricula). Sending the same change with `confirmImpact: <reviewVersion>` saves it; any difference answers `409 impact_changed` with the new list. This is the confirmation flag the scope change asked for, kept safe against a stale review as this ADR requires. A course no curriculum links is saved directly.
- **Unknown fields (open item 2, closed).** Admin request bodies use `@StrictBody()`, a custom parameter decorator the global pipe skips, validated with `forbidNonWhitelisted`: an unknown, identifier or gated field answers `400 validation_failed` instead of being dropped.
- **Membership writes go ahead with structural checks only.** Codes, ownership and references are checked; group-total final-state validation still waits for the rule-engine interface, and credit totals stay read-only (`400`) until then.
- **Still partial:** program and cohort creation/editing, CSV import, the audit log (deferred to B3 by the 12 November decision above) and the account screen's User ID field. F12 remains **partial**.

### Implementation notes (12 November 2026)

What `main` serves under `/api/admin` (`src/backend/src/curriculum-admin/*.controller.ts`), against the outline above:

| Outline | On `main` |
| --- | --- |
| `GET /programs` | Built: the caller's editable programs and cohorts. |
| `POST /programs`, `PATCH /programs/:programId`, cohort `GET`/`POST`/`PATCH` | Not built. Programs and cohorts enter through the seeds. |
| Requirement groups `GET` | Not built. Groups are read through `GET /api/programs/:program/curricula/:cohort`. |
| Requirement groups `POST`, `PATCH`, `DELETE`; membership `PUT`, `DELETE` | Built. |
| Prerequisites and offering terms `PUT`, `DELETE` | Built (amendment). |
| Catalog `POST`, `PATCH`, `DELETE /catalog/courses/:courseCode` | Built. |
| Catalog `GET /catalog/courses`, `GET /catalog/courses/:courseCode`, `POST …/preview` | Not built. The `PATCH` answers `409 impact_confirmation_required` instead of a preview route (amendment). Courses are read through `GET /api/courses/:code`. |
| Access `GET /programs`, `GET /users/:userId/grants`, `PUT`/`DELETE` program and global grants | Built. |
| CSV import preview/confirm, catalog and group links | Not built. `csv-parse` is not installed, and the 7 MiB import body limit is not configured. |
| `admin:bootstrap` | Built (`bootstrap-cli.ts`). |

Other differences from the text:

- Besides the codes in the response table, the write services answer `403 account_deletion_pending` when the caller's account is waiting for deletion, and `400 prerequisite_cycle` with the cycle (`admin-errors.ts`).
- The administration screens and the account screen's **User ID** field are not built; no frontend route calls `/api/admin`.
- The amendment says the curriculum PDFs print no prerequisites. Since then, [#75](https://github.com/LLaammTTeerr/omnicourses/pull/75) extracted the "Prior-course" lines of the APCS course-description booklet into `src/backend/src/database/seeds/apcs-prerequisites.ts`. That file is not loaded: no seed writes `course_prerequisites` or `course_offering_terms`.

## Verification required with implementation

These are acceptance obligations, not tests executed by this documentation change. Use Vitest beside services/DTOs and PostgreSQL e2e tests for transactional and relational behavior. Every behavior change ships with a test; no real student records or credentials belong in fixtures.

| Test-plan parent | Required proof |
| --- | --- |
| TC-B2-ADM-01/02 | A program-A grant cannot write program B through substituted curriculum/group IDs or reparenting. Catalog-only users can maintain courses without a program grant; program-only users cannot. Access managers can create programs/grants but cannot edit either without separate grants. Missing authentication returns 401 on every new route. |
| TC-B2-ADM-03/04 | Separate cohorts share catalog courses without sharing membership. Adding a cohort leaves the original curriculum, stored plans and reviewed audit/validation baseline unchanged. Unlinking preserves other links and the catalog. Deletion refuses all saved references, including plain-code consumers. |
| TC-B2-ADM-05 | Canonical code and numeric validation; duplicate and nested-reference failures; transaction rollback after an injected intermediate failure; stale course values or membership between preview/confirmation produce 409 with no write; concurrent membership/catalog writes cannot bypass impact review. |
| TC-B2-ADM-06 | No sign-up/onboarding grants; controlled and concurrent bootstrap; access-manager delegation of all three roles; last-active-manager protection and zero-manager recovery; completed revocation blocks the next write; recipient purge removes only owned grants; granter purge preserves others' grants; export omits others' rows and all credentials. The later account screen copies the signed-in user's own `UserDto.id`. |
| TC-B2-ADM-07 | Quoted commas/newlines/BOM; exact headers; decoded-byte, escaped-JSON and record-limit boundaries above, preserving unrelated route limits; row-numbered missing/duplicate/invalid values; cross-program group names; file with one bad row saves nothing; cancel saves nothing; changed input, source revision or impact invalidates confirmation; revoked permissions refuse it; injected failure rolls back every row; repeat import creates no duplicates. |

B3 TC-B3-ADM-01 still requires entering a second program/cohort through the later administration UI. Service tests cannot substitute for that check. #74 added prerequisite/offering tests (`prerequisite-cycle.spec.ts`, `curriculum-admin.e2e-spec.ts`) under the amendment; add them to these parents in the test plan.

## Consequences

The shared catalog remains a deliberate global boundary. Program membership stays isolated, while a confirmed catalog correction may change several curricula's computed results. The single F12 write lock favors a small, reviewable correctness contract over parallel administration throughput; refine it only with evidence of contention and equivalent concurrency tests.

For B2, the catalog maintainer alone confirms shared impact. Affected program administrators receive no automatic notification and do not approve the correction. Adding that notification is a separate F10 handoff; neither an audit trail nor notification delivery is implied by this ADR.

Grant rows integrate with account export/purge without special export code. Bootstrap and deployment access remain operator responsibilities. School isolation, cohort-specific course attributes, identifier migrations and archival need separate accepted designs. No new dependencies, migrations, API routes or product behavior are added by this ADR-only change.
