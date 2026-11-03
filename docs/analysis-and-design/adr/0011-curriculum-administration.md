# ADR 0011: Curriculum administration and program-scoped permissions

- Status: proposed; not authorization to implement
- Date: 2026-11-03
- Owner: Thắng (F12)
- Deciders: Lâm (Project Lead), Triết (curriculum schema and rule engine)
- Reviewers: Lâm (authentication and access), Triết (data boundaries), Hoà (requirements scope)

## Context

F12 needs an API to create and edit programs, cohorts, courses, prerequisites and requirement groups, with administration rights scoped per program. [UC-11](../../requirements/use-cases/UC-11-maintain-curriculum.md) separates program administration, shared catalog maintenance and access management. The [test plan](../../test/test-plan.md#b2-checks) places this work in B2 and requires this ADR before code, after [PR #23](https://github.com/LLaammTTeerr/omnicourses/pull/23) merges. On 3 November 2026, #23 is still open. This change is documentation only.

The inspected [#23 migration at `700213a`](https://github.com/LLaammTTeerr/omnicourses/blob/700213a224fb0486449e83008060d186c751081e/src/backend/src/database/migrations/1792912952302-create-curriculum-course-schema.ts) defines `programs`, `curriculums`, `requirement_groups`, `courses` and `requirement_group_courses`. A curriculum is unique by `(program_id, cohort_year)`; a course is shared across curricula. It supplies no prerequisite or offering-term storage, entities or read/validation interface. Its [ADR 0005](https://github.com/LLaammTTeerr/omnicourses/blob/700213a224fb0486449e83008060d186c751081e/docs/analysis-and-design/adr/0005-curriculum-cohort-and-course-catalog.md) still mentions a link-level `compulsory` column that the migration removed. F12 must reconcile the merged schema and ADR rather than restore that column.

[ADR 0002](0002-authentication-and-sessions.md) already authenticates every request; it leaves F12 permissions to this feature. [ADR 0004](0004-account-export-and-deletion.md) determines grant ownership, export and account purge. [ADR 0003](0003-language-model-scope.md) excludes curriculum PDF import and model calls. The test plan records Lâm's 1 November decision to replace PDF import with deterministic CSV bulk import, including a CSV format and UC-11 flow in this design.

### Explicit scope proposal: school, faculty and program

Vision v2 §6 Security ([source](../../../report/assignments/PA2/Vision.tex)) requires administrator rights per school and per program. The [glossary](../../../GLOSSARY.md) defines a faculty as the HCMUS unit owning programs; it does not make a faculty a school. #23 stores `programs.faculty` as descriptive text, not an authorization boundary.

This ADR proposes **program-scoped grants within the current HCMUS deployment**, plus the two global permissions below. Global means the entire deployment. There is no faculty inheritance or cross-school isolation. This is an explicit proposed reduction of the school-scoping requirement for B2/B3, not evidence that the whole Security NFR passes. Lâm and Hoà must accept that scope change or require school identifiers and scoped catalog/access-manager grants before implementation. Renaming `faculty` to `school` would not resolve it.

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
| **Code follows #23's merge and this design's review. Prerequisites/offering terms additionally require Triết's storage, read and validation handoff.** | Implementing against an unmerged migration; inventing prerequisite semantics from course names or suggested study terms. | UC-11 §8; test-plan §8; #23 has no related tables. Basic CRUD does not complete the requested prerequisite API. |

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

Neither #23's `updated_at` nor grant attribution records who changed a curriculum or catalog row. **Lâm and Triết must decide whether B2 requires a change-history log or explicitly defers it before those mutations are implemented.** No audit trail is claimed by this proposal. If included, the reviewed contract must define recorded operations and before/after fields, transaction failure behavior, read permissions and retention; Thắng adds the storage and acceptance cases here before coding. If deferred, record the missing history in B2's acceptance evidence.

A retained log describes shared curriculum/catalog changes, not a student's owned record. Its actor reference must be nullable `actor_id uuid REFERENCES users(id) ON DELETE SET NULL`, never `user_id`; account purge detaches the actor and preserves the change record. Do not duplicate actor names, email, student identifiers or credentials into the log payload. This does not change the recipient-owned grant tables above. Export/purge tests must prove the log is not exported as the actor's owned data and survives actor purge with `actor_id = NULL`.

### Bootstrap and recovery

Propose `npm run admin:bootstrap -w src/backend -- --user-id <existing-user-uuid>` as an operator-only command, implemented after the dependency gates. It is not an HTTP endpoint, migration default, sign-up option or currently available command. The Project Lead invokes it in a trusted deployment shell against the intended database.

The command runs in one transaction under the F12 write lock, verifies that the target account exists and is active, and grants only `access_manager`, with `granted_by = NULL`. It refuses when any active access manager already exists; two concurrent attempts cannot both succeed. Subsequent grants use the authenticated API. The same zero-active-manager check permits controlled recovery if account deletion removes or disables the last manager; recovery is not an override of an existing active manager.

The grant API rejects revoking the last active access manager with `409 last_access_manager`; grant/revoke operations serialize the count and mutation. Account deletion and purge remain governed by ADR 0004 and are never refused to preserve an administration role. Here, active means `users.deletion_requested_at IS NULL`; expired sessions alone do not remove a grant. Bootstrap tests cover unknown/deleting accounts, repeated/concurrent invocation and recovery without creating a public privilege-escalation route.

## Write boundary and API outline

All routes below are **proposed**, behind `/api/admin`, and require the existing bearer authentication. The implementation supplies validated request/response DTOs with `@ApiProperty`, `@ApiBearerAuth()` and documented errors in OpenAPI 3.2.0. Controller names and internal helper names are implementation choices; authority checks and transaction boundaries are not.

| Routes under `/api/admin` | Permission and behavior |
| --- | --- |
| `GET /programs`; `POST /programs`; `PATCH /programs/:programId` | List editable programs; create with access-manager permission; edit details with that program's grant. Creation never grants editing access implicitly. |
| `GET, POST /programs/:programId/cohorts`; `GET, PATCH /programs/:programId/cohorts/:curriculumId` | Program grant. A cohort is a `curriculums` row, not a second cohort table. Creation uses unique `(program_id, cohort_year)`. |
| `GET, POST /programs/:programId/cohorts/:curriculumId/requirement-groups`; `PATCH, DELETE .../requirement-groups/:groupId`; `PUT, DELETE .../requirement-groups/:groupId/courses/:courseCode` | Program grant, verified against curriculum and group ownership. PUT creates a missing link or returns the existing link; DELETE removes only that link, subject to validation. Group removal follows the reference policy below. |
| `GET, POST /catalog/courses`; `GET, DELETE /catalog/courses/:courseCode`; `POST /catalog/courses/:courseCode/preview`; `PATCH /catalog/courses/:courseCode` | Catalog grant. Existing-course PATCH requires the preview's `reviewVersion` and the same proposed values. Program administrators select existing course codes through the curriculum/catalog read API; they do not gain this catalog-management access. |
| `GET /access/programs`; `GET /access/users/:userId/grants`; `PUT, DELETE /access/users/:userId/programs/:programId`; `PUT, DELETE /access/users/:userId/global/:permission` | Access-manager grant. Program selection and exact user-ID grant lookup; no general export of the user directory. Recipients copy their own ID from the planned account screen below. |
| `POST /catalog/imports/preview`, `POST /catalog/imports/confirm`; `POST /programs/:programId/cohorts/:curriculumId/imports/preview`, `POST .../imports/confirm` | Catalog grant for course rows; program grant for group links. Same CSV and confirmation contract below. Imports cannot create programs or grants. |

Program `code`, curriculum `program_id` and `cohort_year`, group `curriculum_id`, and catalog course `code` are immutable after creation through these routes. Ordinary PATCH requests whitelist editable attributes and explicitly reject attempted identifier/parent changes rather than silently ignoring them. A new cohort is a new curriculum record. A course-code correction needs a separate reviewed migration, including plain-string consumers such as transcripts and plans.

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

The prerequisite API remains part of the requested F12 work. It is **blocked, not dropped**. There is no prerequisite table in #23, and neither F12 nor this ADR may guess whether prerequisites are global, per curriculum, conjunctions, alternatives or equivalences. A shared course code alone is not an authorization boundary for a curriculum rule.

| Gate | Required handoff | Owner/reviewer |
| --- | --- | --- |
| #23 merged and inspected again | Actual table/constraint names; canonical course codes; corrected group-kind and credit-total semantics; agreed read access for catalog selection and saved curricula. | Triết; Thắng integrates. |
| ADR 0011 reviewed and accepted | Program/global permissions, grant storage, bootstrap/recovery, deletion policy and the school-scoping amendment. Before curriculum/catalog mutations, close the audit-trail decision above with an accepted logging contract or explicit B2 deferral. | Lâm and Triết; Hoà aligns requirements. |
| Prerequisite/offering-term storage | Migrations and types identify each record's curriculum/program scope, reference/deletion rules, and supported rule expressions. Any globally shared rule needs its own reviewed permission and impact model. | Triết with Thắng. |
| Rule-engine and impact interfaces | Typed final-state validation, group-total semantics, source/revision identity, deterministic findings and complete impact/reference queries. **Manual group-link PUT/DELETE and CSV group-link preview/confirmation wait for this interface**, as do total-field editing and any affected shared-course correction. TC-B2-ADM-07's group-total checks cannot pass, and full administration cannot be accepted for 29 November, without it. Missing rules block affected writes; prerequisite/offering checks additionally wait for their storage handoff. | Triết; academic examples reviewed with Thắng. |
| Read and regression contracts | Curriculum read API, saved-plan consumers and reference checks; test fixtures proving new cohorts preserve original plan placements and audit results. | Triết and Hoà; Thắng/Dũng test. |

After those handoffs, add concrete prerequisite/offering request and response DTOs and route cases to this ADR before implementing them. Their mutations require the stored program grant, current checks and transaction behavior above. Offering terms follow [ADR 0009](0009-term-encoding.md): term numbers 1/2 for main terms, 3 for summer and `term_year` when year-specific. A suggested study term is not an offering. No academic decision is delegated to a model.

Implement in dependency order: grants/bootstrap and program/cohort writes; groups/membership with reviewed validation; catalog preview/confirmation; CSV using those services; prerequisites/offering terms after their additional handoff. Partially implemented routes must not claim full F12 completion. This ADR does not supply the administration UI.

## Verification required with implementation

These are acceptance obligations, not tests executed by this documentation change. Use Vitest beside services/DTOs and PostgreSQL e2e tests for transactional and relational behavior. Every behavior change ships with a test; no real student records or credentials belong in fixtures.

| Test-plan parent | Required proof |
| --- | --- |
| TC-B2-ADM-01/02 | A program-A grant cannot write program B through substituted curriculum/group IDs or reparenting. Catalog-only users can maintain courses without a program grant; program-only users cannot. Access managers can create programs/grants but cannot edit either without separate grants. Missing authentication returns 401 on every new route. |
| TC-B2-ADM-03/04 | Separate cohorts share catalog courses without sharing membership. Adding a cohort leaves the original curriculum, stored plans and reviewed audit/validation baseline unchanged. Unlinking preserves other links and the catalog. Deletion refuses all saved references, including plain-code consumers. |
| TC-B2-ADM-05 | Canonical code and numeric validation; duplicate and nested-reference failures; transaction rollback after an injected intermediate failure; stale course values or membership between preview/confirmation produce 409 with no write; concurrent membership/catalog writes cannot bypass impact review. |
| TC-B2-ADM-06 | No sign-up/onboarding grants; controlled and concurrent bootstrap; access-manager delegation of all three roles; last-active-manager protection and zero-manager recovery; completed revocation blocks the next write; recipient purge removes only owned grants; granter purge preserves others' grants; export omits others' rows and all credentials. The later account screen copies the signed-in user's own `UserDto.id`. |
| TC-B2-ADM-07 | Quoted commas/newlines/BOM; exact headers; decoded-byte, escaped-JSON and record-limit boundaries above, preserving unrelated route limits; row-numbered missing/duplicate/invalid values; cross-program group names; file with one bad row saves nothing; cancel saves nothing; changed input, source revision or impact invalidates confirmation; revoked permissions refuse it; injected failure rolls back every row; repeat import creates no duplicates. |

B3 TC-B3-ADM-01 still requires entering a second program/cohort through the later administration UI. Service tests cannot substitute for that check. Add prerequisite/offering tests to these parents only after the schema/rule handoff gives reviewed expected outcomes.

## Consequences

The shared catalog remains a deliberate global boundary. Program membership stays isolated, while a confirmed catalog correction may change several curricula's computed results. The single F12 write lock favors a small, reviewable correctness contract over parallel administration throughput; refine it only with evidence of contention and equivalent concurrency tests.

For B2, the catalog maintainer alone confirms shared impact. Affected program administrators receive no automatic notification and do not approve the correction. Adding that notification is a separate F10 handoff; neither an audit trail nor notification delivery is implied by this proposal.

Grant rows integrate with account export/purge without special export code. Bootstrap and deployment access remain operator responsibilities. School isolation, cohort-specific course attributes, identifier migrations and archival need separate accepted designs. No new dependencies, migrations, API routes or product behavior are added by this ADR-only change.
