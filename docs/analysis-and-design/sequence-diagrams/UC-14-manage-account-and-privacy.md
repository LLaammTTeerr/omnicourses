# Sequence diagrams: UC-14 Manage account and privacy (export and deletion)

- Use case: UC-14 A4 and A5 (Use-Case Specification v1.0, [`report/assignments/PA2/uc-specs.tex`](../../../report/assignments/PA2/uc-specs.tex)), feature F1 and the privacy NFR
- Drawn from the code on `main` (15 November 2026): `src/frontend/src/account/` (`SettingsView.vue`, `DeleteAccountDialog.vue`, `api.ts`), `src/backend/src/account/` (`account.controller.ts`, `account.service.ts`, `account-export.ts`, `account-purge.service.ts`), `src/backend/src/auth/auth.service.ts`, `src/backend/src/users/users.service.ts` ([ADR 0004](../adr/0004-account-export-and-deletion.md))
- Drawn here: exporting the account, asking for its deletion, the grace period, and the purge. The basic flow of UC-14 (listing and revoking sessions) and signing out are in [UC-01, "Signing out"](UC-01-sign-up-and-onboard.md#signing-out). Not built: withdrawing AI consent (A3), since no AI feature is built.

## A4: export the account

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant View as SettingsView
    participant Auth as useAuth store
    participant Api as account/api.ts
    participant Ctrl as AccountController
    participant Svc as AccountService
    participant Exp as account-export.ts
    participant DB as PostgreSQL

    Student->>View: Export my data
    View->>Auth: authed(exportAccount)
    Auth->>Api: exportAccount(token)
    Api->>Ctrl: GET /api/users/me/export, Bearer token
    Note over Api,Ctrl: ThrottlerGuard, then AuthGuard set request.user
    Ctrl->>Svc: export(user.id)
    Svc->>DB: BEGIN ISOLATION LEVEL REPEATABLE READ, then SET TRANSACTION READ ONLY
    Svc->>Exp: findUserColumns(tx)
    Exp->>DB: the columns of users, from the PostgreSQL catalog
    Svc->>Exp: selectList(columns)
    Exp-->>Svc: every column but those isSecretColumn names
    Svc->>DB: SELECT those columns FROM users WHERE id = user.id
    Svc->>Exp: findUserTables(tx)
    Exp->>DB: every table with a user_id foreign key to users.id, from the catalog
    loop each such table
        Svc->>DB: SELECT its non-secret columns WHERE user_id = user.id
    end
    Svc->>DB: COMMIT
    Svc-->>Ctrl: AccountExportDto { exportedAt, user, tables }
    Ctrl-->>Api: 200 JSON, Content-Disposition: attachment, filename omnicourse-account.json
    Api-->>View: Blob
    View->>Api: saveFile(blob, EXPORT_FILE_NAME)
    Api-->>Student: the browser saves omnicourse-account.json
```

- The export names no table in code: it reads the foreign keys from the catalog, so a module that adds a table with `user_id` is exported with no change here. One snapshot (`REPEATABLE READ`) keeps the tables consistent with each other.
- A secret column is one whose name ends in `_hash`, `_token`, `_secret`, `_key`, `_password`, `_sub`, `_salt` or `_seed`, in snake_case or camelCase (`isSecretColumn`); it is never selected, so `password_hash`, `google_sub` and `sessions.token_hash` never leave the database.
- Rows that only mention the student in another column (a grant they gave, `granted_by`) belong to someone else and are not exported.
- `exportAccount` uses `send`, which has no timeout, because a download may take longer than a JSON call. A failure shows a message in the settings page; a 401 signs the student out as on every page.

## A5: ask for the deletion

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant Dialog as DeleteAccountDialog
    participant Auth as useAuth store
    participant Api as account/api.ts
    participant Throttle as ThrottlerGuard
    participant Ctrl as AccountController
    participant Svc as AccountService
    participant AuthSvc as AuthService
    participant Users as UsersService
    participant DB as PostgreSQL

    Student->>Dialog: Delete account, then the password again
    Dialog->>Auth: authed(deleteAccount)
    Auth->>Api: deleteAccount(token, { password })
    Api->>Throttle: DELETE /api/users/me { password }
    Throttle->>Throttle: count for this address and route (PASSWORD_LIMIT, 10 a minute)
    Throttle->>Ctrl: allowed, AuthGuard set request.user
    Ctrl->>Svc: requestDeletion(user, dto.password)
    Svc->>AuthSvc: verifyPassword(user, password)
    AuthSvc->>AuthSvc: argon2 verify(user.passwordHash, password)
    alt the password is right
        Svc->>Svc: purgeAfter = now + accountDeletionGraceDays() days (30 unless configured)
        Svc->>DB: BEGIN
        Svc->>Users: markDeletionRequestedWithin(tx, user.id, now, purgeAfter)
        Users->>DB: UPDATE users SET deletion_requested_at = now, purge_after = purgeAfter
        Svc->>AuthSvc: revokeAllWithin(tx, user.id)
        AuthSvc->>DB: UPDATE sessions SET revoked_at = now<br/>WHERE user_id = user.id AND revoked_at IS NULL
        Svc->>DB: SharingService.stopAllWithin(tx, user.id) -> DELETE FROM plan_shares WHERE user_id = user.id
        Svc->>DB: COMMIT
        Svc-->>Ctrl: DeletionScheduledDto { purgeAfter }
        Ctrl-->>Api: 202 { purgeAfter }
        Api-->>Dialog: DeletionScheduled
        Dialog->>Dialog: router.push(home), then auth.clear()
        Dialog-->>Student: toast with the date the account will be purged
    else wrong password
        AuthSvc-->>Svc: false
        Svc-->>Ctrl: ForbiddenException
        Ctrl-->>Api: 403 "Wrong password"
        Api-->>Dialog: HttpError 403
        Dialog-->>Student: "wrong password", still signed in, nothing changed
    end
```

**Alternate flows:**

- **403, not 401, on a wrong password:** the client treats every 401 as "signed out", and a mistyped password must not sign the student out.
- **429:** the route takes a password, so it has the brute-force limit of 10 requests a minute per address. `ThrottlerGuard` answers 429 before any controller code, and the dialog says to wait and try again. There is no automatic retry.
- **400:** a missing password fails `DeleteAccountDto`; the dialog's button is off while the box is empty, so the app does not send one.
- **401:** the session ended elsewhere; the dialog says nothing and `App.vue` opens sign-in.
- **No answer within 30 s:** the dialog says the request may have gone through (every session may already be revoked), instead of "failed".
- **An account with no password** (Google-only, not built yet): `verifyPassword` returns false, so the answer is 403.

## The grace period and the purge

```mermaid
sequenceDiagram
    autonumber
    actor Student
    participant SPA as Vue app
    participant AuthSvc as AuthService
    participant Users as UsersService
    participant Purge as AccountPurgeService
    participant DB as PostgreSQL

    Note over Student,DB: from the 202 until purge_after: the account is scheduled for deletion
    opt a request with an old token
        SPA->>AuthSvc: authenticate(token), from AuthGuard
        AuthSvc->>DB: SELECT sessions with user WHERE token_hash = sha256(token)
        AuthSvc-->>SPA: null: 401, the session is revoked<br/>and the user has deletion_requested_at
    end
    alt the student signs in again before purge_after
        Student->>SPA: email, password
        SPA->>AuthSvc: POST /api/auth/sign-in, signIn(dto)
        AuthSvc->>Users: cancelDeletion(user.id, now)
        Users->>DB: UPDATE users SET deletion_requested_at = null, purge_after = null<br/>WHERE id = user.id AND (purge_after IS NULL OR purge_after > now)
        AuthSvc-->>SPA: 200 AuthResultDto, accountRestored = true
        SPA-->>Student: "your account was restored"
    else nobody signs in
        Note over Purge: onApplicationBootstrap, then every hour (setInterval)
        Purge->>DB: SELECT id FROM users WHERE purge_after <= now
        loop each account that is due
            Purge->>DB: DELETE FROM users WHERE id = id AND purge_after <= now
            Note over Purge,DB: ON DELETE CASCADE removes sessions, onboarding answers,<br/>transcript rows, plans, placements, AI usage and grants held
        end
        Purge->>Purge: log the count purged, never an email or an id
    end
```

- **The deadline is stored, not recomputed:** `purge_after` is what the student was told; changing `ACCOUNT_DELETION_GRACE_DAYS` later does not move it.
- **Sign-in racing the purge:** `cancelDeletion` and the purge's `DELETE` each carry the `purge_after` condition in one statement, so exactly one wins. When the deadline has passed, sign-in answers the same 401 as an unknown email ([UC-01 A6](UC-01-sign-up-and-onboard.md#a5-sign-in)).
- **A purge that fails for one account** (a row that blocks the delete) is logged and retried the next hour; the other accounts are still purged, because each account is its own `DELETE`.
- **Two API instances** may run the purge at once: each `DELETE` is idempotent.
- **What stays:** grants the student gave to others keep their rows with `granted_by` cleared (`SET NULL`). Curriculum data is not the student's and is untouched.
