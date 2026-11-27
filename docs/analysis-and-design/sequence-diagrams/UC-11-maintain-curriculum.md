# Sequence diagrams: UC-11 Maintain curriculum

- Use cases: UC-11 ([specification](../../requirements/use-cases/UC-11-maintain-curriculum.md)), UC-17 ([PA2 `uc-specs.tex`](../../../report/assignments/PA2/uc-specs.tex#L923-L966)) and UC-18 ([PA2 `uc-specs.tex`](../../../report/assignments/PA2/uc-specs.tex#L969-L1008)), feature F12 (plus `/admin/calendar` for F10 school dates)
- Drawn from the code on `main`: `src/frontend/src/admin/` (`AdminView.vue`, `CurriculumAdmin.vue`, `CatalogAdmin.vue`, `ImportAdmin.vue`, `AccessAdmin.vue`, `CalendarAdmin.vue`, `access.ts`, `grants.ts`, `store.ts`, `write.ts`, `csv-file.ts`, `api.ts`), `src/backend/src/curriculum-admin/` (`curriculum-admin.controller.ts`, `program-admin.controller.ts`, `catalog-admin.controller.ts`, `csv-import.controller.ts`, `access-admin.controller.ts`, `admin-write.service.ts`, `curriculum-admin.service.ts`, `program-admin.service.ts`, `catalog-admin.service.ts`, `csv-import.service.ts`, `access-admin.service.ts`, `import-body-limit.ts`, `prerequisite-cycle.ts`, `bootstrap-cli.ts`), `src/backend/src/academic-calendar/` ([ADR 0011](../adr/0011-curriculum-administration.md), [ADR 0017](../adr/0017-academic-calendar.md))
- Built: `/admin` sections (`curriculum`, `catalog`, `import`, `calendar`, `access`), program and cohort create/edit, requirement-group CRUD, course links, prerequisites with cycle check, offering terms, shared catalog CRUD with impact confirmation, CSV preview/confirm with 7 MiB gated body parser, `admin:bootstrap` CLI and access-grant management. Not built: setting `trainingType` or credit totals over HTTP, group-total validation on link/CSV writes, and a change-history log ([design differences, UC-11](../design-differences.md#uc-11-maintain-curriculum-f12)).

## Open `/admin` and maintain a program's curriculum (UC-11 basic flow, A1–A7)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Program administrator
    participant Shell as App.vue / AdminView
    participant Store as useAdminAccess
    participant View as CurriculumAdmin
    participant Write as write.ts (settleWrite)
    participant Api as admin/api.ts
    participant Ctrl as CurriculumAdminController / ProgramAdminController
    participant Svc as CurriculumAdminService / ProgramAdminService
    participant Lock as AdminWriteService
    participant DB as PostgreSQL

    Admin->>Shell: signs in and opens /admin/curriculum
    Shell->>Store: load() -> GET /api/admin/grants
    Store->>Ctrl: grants(user)
    Ctrl->>Svc: ownGrants(user.id)
    Svc->>DB: SELECT program_admin_grants and global_admin_grants WHERE user_id = user.id
    Ctrl-->>Store: 200 UserGrantsDto { userId, programs, permissions }
    View->>Api: fetchAdminPrograms() -> GET /api/admin/programs
    Api->>Ctrl: programs(user)
    Ctrl->>Svc: editablePrograms(user.id)
    Svc->>DB: SELECT granted programs and their cohorts
    Ctrl-->>View: 200 AdminProgramListDto
    View->>Api: fetchCurriculum(program.code, cohort.cohortYear)
    Api-->>View: 200 CurriculumDto (groups, linked courses, prerequisites, offeringTerms)
    View-->>Admin: editable program, cohort, groups, links and rules

    Admin->>View: submits an edit (cohort, group, course link, prerequisites or offering terms)
    View->>Write: send(writeCall, landedReload)
    Write->>Api: request with @StrictBody() payload
    Api->>Ctrl: route handler (uuidParam checks path UUIDs, StrictBody rejects unknown or gated fields with 400)
    Ctrl->>Svc: service mutation(user.id, programId, ...)
    Svc->>Lock: run(callerId, { program: programId }, write)
    Lock->>DB: BEGIN
    Lock->>DB: SELECT pg_advisory_xact_lock(11012001)
    Lock->>DB: SELECT id, deletion_requested_at FROM users WHERE id = callerId FOR NO KEY UPDATE
    Lock->>DB: SELECT grantsOf(callerId)
    alt caller waiting for deletion or lacks program grant (A4)
        Lock->>DB: ROLLBACK
        Lock-->>Api: 403 account_deletion_pending or 403 permission_required
        Api-->>Write: HttpError 403
        Write->>Store: load({ fresh: true }) on permission refusal
        Write-->>Admin: refusal banner naming the required permission
    else authorized
        Svc->>DB: verify cohort / group belongs to programId (404 not_found on mismatch)
        Note over Svc,DB: check uniqueness (409 duplicate_*), references on delete/unlink (409 referenced_item),<br/>or findPrerequisiteCycle (400 prerequisite_cycle, A3)
        Svc->>DB: INSERT / UPDATE / DELETE target rows
        Lock->>DB: COMMIT
        Svc-->>Ctrl: saved DTO (or 204)
        Ctrl-->>Write: 200 / 201 / 204
        Write-->>Admin: dialog closes, curriculum reloads, toast shown
    end

    opt connection drops or request times out with no answer (A7)
        Api-->>Write: network or timeout error (kind = no_answer)
        Write->>Api: landedReload() reads saved cohort / curriculum state
        alt landedReload finds the change saved
            Write-->>Admin: notice confirming the change landed
        else landedReload finds the earlier state
            Write-->>Admin: notice that nothing was applied, dialog stays open to retry
        else landedReload also fails
            Write-->>Admin: outcome = unknown, blocks further writes until recheck() succeeds
        end
    end
```

- **Calendar administration (`/admin/calendar`):** `CalendarAdmin.vue` uses the same `useProgramPicker`, `useAdminDialog` and `AdminWriteService.run(callerId, { program: programId }, ...)` boundary through `AcademicCalendarController` (`POST`, `PATCH`, `DELETE /api/admin/programs/{programId}/calendar-events`).

## Maintain the shared course catalog with impact review (UC-17, UC-11 A8)

```mermaid
sequenceDiagram
    autonumber
    actor Maintainer as Catalog maintainer
    participant View as CatalogAdmin
    participant Api as admin/api.ts
    participant Ctrl as CatalogAdminController
    participant Svc as CatalogAdminService
    participant Lock as AdminWriteService
    participant DB as PostgreSQL

    Maintainer->>View: looks up course by code (GET /api/courses/{code}) and edits attributes
    View->>Api: PATCH /api/admin/catalog/courses/{code} (without confirmImpact)
    Api->>Ctrl: update(user, code, dto)
    Ctrl->>Svc: updateCourse(user.id, code, dto)
    Svc->>Lock: run(user.id, { permission: "catalog_maintainer" }, write)
    Lock->>DB: BEGIN, advisory lock 11012001, lock caller row, verify catalog_maintainer grant
    Svc->>DB: SELECT course and linked curricula (requirement_group_courses -> requirement_groups -> curriculums -> programs)
    alt course is not linked to any curriculum
        Svc->>DB: UPDATE courses, COMMIT
        Ctrl-->>View: 200 CourseDto
        View-->>Maintainer: saved at once
    else course is linked to one or more curricula
        Svc->>Svc: compute reviewVersion hash(current values, proposed values, affectedCurricula)
        Lock->>DB: ROLLBACK (nothing written)
        Ctrl-->>View: 409 impact_confirmation_required { affectedCurricula, reviewVersion }
        View-->>Maintainer: shows old vs new values and every affected program and cohort
        Maintainer->>View: presses Confirm and save
        View->>Api: PATCH /api/admin/catalog/courses/{code} { ...dto, confirmImpact: reviewVersion }
        Api->>Ctrl: update(user, code, dto)
        Ctrl->>Svc: updateCourse(user.id, code, dto)
        Svc->>Lock: run(user.id, { permission: "catalog_maintainer" }, write)
        Lock->>DB: BEGIN, advisory lock 11012001, verify grant, recompute current reviewVersion
        alt reviewVersion matches
            Svc->>DB: UPDATE courses, COMMIT
            Ctrl-->>View: 200 CourseDto
            View-->>Maintainer: saved across all linked curricula
        else values or links changed during review (UC-17 A2)
            Lock->>DB: ROLLBACK
            Ctrl-->>View: 409 impact_changed { affectedCurricula, reviewVersion }
            View-->>Maintainer: shows updated impact list and asks to confirm again
        end
    end
```

- **Course deletion (`DELETE /api/admin/catalog/courses/{code}`):** refused with `409 referenced_item` under the same write lock if any curriculum group link, prerequisite list, prerequisite edge, offering term, saved plan placement or transcript row still names the course code.

## Bulk CSV preview and confirmation (UC-11 A9)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Catalog maintainer or Program administrator
    participant View as ImportAdmin
    participant Csv as admin/csv-file.ts
    participant Gate as importBodyLimit
    participant Ctrl as CsvImportController
    participant Svc as CsvImportService
    participant Lock as AdminWriteService
    participant DB as PostgreSQL

    Admin->>View: selects catalog_courses or group_links CSV file
    View->>Csv: decode strict UTF-8 (strip BOM, reject invalid UTF-8 bytes), check 1 MiB and 1,000-record bounds
    View->>Gate: POST /api/admin/.../imports/preview { csv }
    alt Content-Encoding header present
        Gate-->>View: 415 unsupported_content_encoding
    else body exceeds 7 MiB (or 100 KiB when caller lacks live session + route grant)
        Gate-->>View: 413 payload_too_large
    else body parsed
        Gate->>Ctrl: previewCatalog or previewLinks (@StrictBody)
        Ctrl->>Svc: preview(...)
        Svc->>Lock: read(callerId, need, plan)
        Lock->>DB: BEGIN ISOLATION LEVEL REPEATABLE READ, SET TRANSACTION READ ONLY
        Lock->>DB: verify caller active and holds catalog_maintainer or program grant (403 otherwise)
        Svc->>Svc: readCsv (csv-parse 6.1.0), validate each row and duplicates, compute affectedCurricula and reviewVersion
        Lock->>DB: COMMIT
        Ctrl-->>View: 200 PreviewDto { rows, errors, summary, reviewVersion (null when errors exist) }
        View-->>Admin: normalized inserts/updates/no_ops, affected curricula, or row-numbered errors
    end

    opt preview has zero errors and Admin presses Confirm
        Admin->>View: Confirm import
        View->>Gate: POST /api/admin/.../imports/confirm { csv, reviewVersion }
        Gate->>Ctrl: confirmCatalog or confirmLinks
        Ctrl->>Svc: confirm(...)
        Svc->>Lock: read(callerId, need, inScope) pre-check, then readCsv(dto.csv)
        Svc->>Lock: run(callerId, need, atomicWrite)
        Lock->>DB: BEGIN, advisory lock 11012001, lock caller row, re-verify grant
        Svc->>DB: re-plan rows against current stored courses / groups / links
        alt reviewVersion matches current plan
            Svc->>DB: insert / update every planned row, COMMIT
            Ctrl-->>View: 200 ImportResultDto { fileType, summary }
            View-->>Admin: import summary toast
        else saved data or file changed since preview
            Lock->>DB: ROLLBACK
            Ctrl-->>View: 409 impact_changed (no partial save)
            View-->>Admin: asks to run preview again
        end
    end
```

## Bootstrap and manage administration access (UC-18)

```mermaid
sequenceDiagram
    autonumber
    actor Operator as Project Lead (shell)
    actor Manager as Access manager
    participant Cli as admin:bootstrap CLI
    participant View as AccessAdmin
    participant Ctrl as AccessAdminController
    participant Svc as AccessAdminService
    participant Lock as AdminWriteService
    participant DB as PostgreSQL

    opt First-time bootstrap or zero-active-manager recovery
        Operator->>Cli: npm run admin:bootstrap -w src/backend -- --user-id <uuid>
        Cli->>DB: BEGIN, pg_advisory_xact_lock(11012001), lock target user FOR NO KEY UPDATE
        Cli->>DB: verify target user active and count active access_manager grants = 0
        Cli->>DB: INSERT global_admin_grants (user_id, permission = "access_manager", granted_by = null), COMMIT
    end

    Manager->>View: enters recipient User ID (copied from recipient's /settings)
    View->>Ctrl: GET /api/admin/access/users/{userId}/grants
    Ctrl->>Svc: grantsOf(manager.id, userId)
    Svc->>Lock: read(manager.id, { permission: "access_manager" }, ...)
    Ctrl-->>View: 200 UserGrantsDto

    alt Grant program or global permission
        Manager->>View: Grant permission
        View->>Ctrl: PUT /api/admin/access/users/{userId}/programs/{programId} or .../global/{permission}
        Ctrl->>Svc: grantProgram or grantGlobal
        Svc->>Lock: runForRecipient(manager.id, userId, write)
        Lock->>DB: BEGIN, advisory lock 11012001, lock manager and recipient rows in UUID order FOR NO KEY UPDATE
        Svc->>DB: verify recipient exists (404) and deletion_requested_at IS NULL (409 recipient_deletion_pending)
        Svc->>DB: INSERT grant ON CONFLICT DO NOTHING (keeps original attribution), COMMIT
        Ctrl-->>View: 200 UserGrantsDto
    else Revoke permission (UC-18 A1, A4)
        Manager->>View: Revoke permission
        View->>Ctrl: DELETE /api/admin/access/users/{userId}/programs/{programId} or .../global/{permission}
        Ctrl->>Svc: revokeProgram or revokeGlobal
        Svc->>Lock: runForRecipient(manager.id, userId, write)
        Lock->>DB: BEGIN, advisory lock 11012001, lock manager and recipient rows in UUID order
        Note over Svc,DB: if revoking access_manager would leave 0 active access managers,<br/>ROLLBACK and answer 409 last_access_manager (A4)
        Svc->>DB: DELETE grant row, COMMIT
        Ctrl-->>View: 200 UserGrantsDto
    end
```
