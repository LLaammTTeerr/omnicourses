# Sequence diagrams: UC-09 Share or export a plan

- Use cases: UC-09 ([specification](../../requirements/use-cases/UC-09-share-or-export-a-plan.md)) and UC-16 (Use-Case Specification v1.0, [`report/assignments/PA2/uc-specs.tex`](../../../report/assignments/PA2/uc-specs.tex#L881-L920)), feature F9
- Drawn from the code on `main`: `src/frontend/src/sharing/` (`SharePlanDialog.vue`, `SharedPlanView.vue`, `api.ts`), `src/frontend/src/plans/PlanEditorView.vue`, `src/backend/src/sharing/` (`sharing.controller.ts`, `sharing.service.ts`, `shared-plan.ts`, `sharing.module.ts`), `src/backend/src/plans/plans.service.ts`, `src/backend/src/curriculum/curriculum.service.ts`, `src/backend/src/rules/rules.service.ts`, `src/backend/src/account/account.service.ts` ([ADR 0010](../adr/0010-public-pages-and-guide-content.md), amendment of 25 November 2026)
- Built: the owner's Share dialog (`GET`, `PUT`, `DELETE /api/plans/{id}/share`), per-link choices (`showName`, `showTranscriptChecks`), the public read-only shared page at `/shared/{token}` (`GET /api/shared-plans/{token}`) with `noindex` and `no-store` headers, browser Print/PDF export (`window.print()`), and immediate link teardown on plan or account deletion. Not built: the estimated graduation term ([design differences](../design-differences.md#uc-09-share-or-export-a-plan-f9)).

## Open the Share dialog, create or update a link, and stop sharing (UC-09 steps 1–5, A2–A4)

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Editor as PlanEditorView
    participant Dialog as SharePlanDialog
    participant Api as sharing/api.ts
    participant Ctrl as PlanShareController
    participant Svc as SharingService
    participant Plans as PlansService
    participant DB as PostgreSQL

    Student->>Editor: presses Share on an open plan
    Editor->>Dialog: opens dialog for planId
    Dialog->>Api: GET /api/plans/{id}/share, Bearer token
    Note over Api,Ctrl: ThrottlerGuard, AuthGuard set request.user, PlanId pipe checks UUID
    Api->>Ctrl: state(user, id)
    Ctrl->>Svc: shareOf(user.id, id)
    Svc->>Plans: get(user.id, id)
    Plans->>DB: SELECT plans and plan_placements WHERE id = id AND user_id = user.id
    Svc->>DB: SELECT share_token, show_name, show_transcript_checks, created_at<br/>FROM plan_shares WHERE plan_id = id AND user_id = user.id
    DB-->>Svc: row or none
    Svc-->>Ctrl: PlanShareDto or null
    Ctrl-->>Dialog: 200 PlanShareStateDto { share }, Cache-Control: no-store
    Dialog-->>Student: live link with Copy and Stop sharing (A4),<br/>or Create link with Show my name and Show transcript checks boxes

    alt Student creates a link or updates showName / showTranscriptChecks (steps 3–4)
        Student->>Dialog: Create link or toggles a choice
        Dialog->>Api: PUT /api/plans/{id}/share { showName, showTranscriptChecks }
        Api->>Ctrl: share(user, id, dto) via ShareBodyPipe
        Ctrl->>Svc: share(user.id, id, choices)
        Svc->>Plans: get(user.id, id)
        Svc->>DB: BEGIN
        Svc->>DB: SELECT 1 FROM users WHERE id = user.id<br/>AND deletion_requested_at IS NULL FOR SHARE
        Svc->>DB: INSERT INTO plan_shares (plan_id, user_id, share_token, show_name, show_transcript_checks)<br/>ON CONFLICT (plan_id) DO UPDATE SET choices keeping existing share_token<br/>RETURNING share_token, show_name, show_transcript_checks, created_at
        Svc->>DB: COMMIT
        Svc-->>Ctrl: PlanShareDto { token, showName, showTranscriptChecks, createdAt }
        Ctrl-->>Dialog: 200 PlanShareDto, Cache-Control: no-store
        Dialog-->>Student: /shared/{token} ready to Copy, plus privacy notice when showTranscriptChecks is true
    else Student presses Stop sharing (A2)
        Student->>Dialog: Stop sharing
        Dialog->>Api: DELETE /api/plans/{id}/share
        Api->>Ctrl: stop(user, id)
        Ctrl->>Svc: stop(user.id, id)
        Svc->>Plans: get(user.id, id)
        Svc->>DB: DELETE FROM plan_shares WHERE plan_id = id AND user_id = user.id
        Svc-->>Ctrl: void
        Ctrl-->>Dialog: 204 No Content
        Dialog-->>Student: link removed, Share again makes a fresh 32-byte token (A3)
    end
```

- **Idempotent `PUT`:** `PUT /api/plans/{id}/share` creates a 43-character base64url token from 32 random bytes (`newShareToken`) when no `plan_shares` row exists, and keeps the existing token when one already exists. Choices omitted from the JSON body keep their current stored value (default `false` on creation).
- **Alternate flows on owner routes:** a non-object body (`ShareBodyPipe`) or a non-boolean `showName` / `showTranscriptChecks` (`null` included) answers `400`; a missing plan, another student's plan, a malformed UUID (`PlanId` pipe) or an account waiting for deletion answers `404`; an expired session answers `401` (`useAuth` clears the session and redirects to `/sign-in`); exceeding 120 requests a minute per address answers `429`.

## Open a shared plan link and export or print PDF (UC-09 steps 6–8, A1, A8, A9 and UC-16)

```mermaid
sequenceDiagram
    autonumber
    actor Reader as Advisor or Student
    participant View as SharedPlanView
    participant Api as sharing/api.ts
    participant Hdr as sharedPlanHeaders
    participant Ctrl as SharedPlansController
    participant Svc as SharingService
    participant Plans as PlansService
    participant Rules as RulesService
    participant Cat as CurriculumService
    participant Map as sharedPlan (shared-plan.ts)
    participant DB as PostgreSQL

    Reader->>View: opens /shared/{token} (no sign-in needed)
    Note over View: sets document robots meta to noindex
    View->>Api: GET /api/shared-plans/{token}
    Api->>Hdr: request enters /api/shared-plans
    Hdr->>Hdr: set X-Robots-Tag: noindex, nofollow and Cache-Control: no-store
    Hdr->>Ctrl: @Public() read(token)
    Ctrl->>Svc: read(token)
    alt token is not 43 base64url characters
        Svc-->>Ctrl: NotFoundException (NOT_SHARED_MESSAGE, no DB query)
        Ctrl-->>View: 404 NotSharedDto { statusCode: 404, message: "This plan is not shared" }
        View-->>Reader: "This plan is not shared" (A8)
    else well-formed token
        Svc->>DB: SELECT plan_id, user_id, show_transcript_checks, ownerName (only when show_name)<br/>FROM plan_shares JOIN users WHERE share_token = token AND deletion_requested_at IS NULL
        alt no row (stopped, never existed, or owner deletion pending) or plan missing
            Svc-->>Ctrl: NotFoundException (NOT_SHARED_MESSAGE)
            Ctrl-->>View: 404 NotSharedDto
            View-->>Reader: "This plan is not shared" (UC-09 A2, A6, A7, A8 and UC-16 A1)
        else live shared plan found
            Svc->>Plans: find(share.userId, share.planId)
            Plans->>DB: SELECT plans and plan_placements
            Plans-->>Svc: PlanDto
            par evaluate plan and load labels
                alt showTranscriptChecks is true
                    Svc->>Rules: issuesFor(plan, share.userId)
                    Note over Rules,DB: reads curriculum rules, owner transcript rows, and catalog credits
                else showTranscriptChecks is false
                    Svc->>Rules: issuesFor(plan, null)
                    Note over Rules,DB: reads curriculum rules and catalog credits only (transcript is not read)
                end
                Rules-->>Svc: PlanIssuesReport
            and
                Svc->>Cat: catalogCourses(placed course codes)
                Cat->>DB: SELECT courses WHERE code IN (...)
            and
                Svc->>Cat: curriculumLabels(plan.curriculum.id)
                Cat->>DB: SELECT curriculums with program and requirement_groups
            end
            Svc->>Map: sharedPlan({ plan, report, courses, curriculum, ownerName, showTranscriptChecks })
            Map-->>Svc: SharedPlanDto (names in place of IDs, no grades, issueCodesNotShown when choice is false)
            Svc-->>Ctrl: SharedPlanDto
            Ctrl-->>View: 200 SharedPlanDto
            View-->>Reader: read-only banner with last-changed time, term rows, credit meters,<br/>violations, and notice when issueCodesNotShown is non-empty (A9)
            opt Print or Download PDF (UC-09 A1, UC-16 A2)
                Reader->>View: presses Print / Export PDF
                View->>View: window.print() with A4 print stylesheet (no server file)
                View-->>Reader: browser saves or prints PDF with the same visibility choices
            end
        end
    end
```

- **Transcript privacy guarantee:** when `showTranscriptChecks` is `false`, `RulesService.issuesFor(plan, null)` does not query `transcript_rows`, `SharedPlanDto.coverage` is omitted, and `issueCodesNotShown` lists `prerequisite_not_met`, `already_passed`, `already_in_progress` and `requirement_not_covered` so the screen states plainly that those checks are hidden.

## Plan deletion and account deletion stopping shared links (UC-09 A6, A7)

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant AcctCtrl as AccountController
    participant AcctSvc as AccountService
    participant Users as UsersService
    participant AuthSvc as AuthService
    participant ShareSvc as SharingService
    participant DB as PostgreSQL

    alt Student deletes a plan (A6)
        Student->>DB: DELETE /api/plans/{id} -> DELETE FROM plans WHERE id = id AND user_id = user.id
        Note over DB: ON DELETE CASCADE removes plan_shares row for that plan at once
    else Student requests account deletion (A7)
        Student->>AcctCtrl: DELETE /api/users/me { password }
        AcctCtrl->>AcctSvc: requestDeletion(user, password)
        AcctSvc->>AuthSvc: verifyPassword(user, password)
        AcctSvc->>DB: BEGIN
        AcctSvc->>Users: markDeletionRequestedWithin(tx, user.id, requestedAt, purgeAfter)
        AcctSvc->>AuthSvc: revokeAllWithin(tx, user.id)
        AcctSvc->>ShareSvc: stopAllWithin(tx, user.id)
        ShareSvc->>DB: DELETE FROM plan_shares WHERE user_id = user.id
        AcctSvc->>DB: COMMIT
        AcctCtrl-->>Student: 202 DeletionScheduledDto { purgeAfter }
        Note over ShareSvc,DB: rows are deleted, not flagged, so restoring the account<br/>during the 30-day grace period never revives old links
    end
```
