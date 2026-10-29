# ADR 0004: Account export and deletion

- Status: accepted
- Date: 2026-10-24
- Deciders: Lâm (owner of `auth`, `users`, `account`)

## Context

The privacy NFR (Vision §6) requires "export and deletion of a whole account", under Luật 91/2025/QH15. Every module will add tables holding a student's data (plans, transcripts, advisor usage), written by five different people.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **`GET /users/me/export` reads every table with a foreign key to `users` from the PostgreSQL catalog**, and drops columns named like credentials (`*_hash`, `*_token`, `*_secret`, `*_key`, `*_password`, `*_sub`) | Each module registers its own export section | A forgotten section leaves data out of the export without anyone noticing. With the catalog, completeness follows from the existing rule that every user table references `users(id)`. The e2e test checks that every such table appears and that no secret-named key does. |
| **`DELETE /users/me` asks for the password again**; 403 on a wrong one, 10/min rate limit | Bearer token alone | A stolen token alone cannot wipe an account. 403, not 401, because the client treats 401 as "signed out". |
| **30-day grace period** (`ACCOUNT_DELETION_GRACE_DAYS`): every session is revoked at once, and **signing in again before the deadline cancels the deletion**. The deadline is stored on the row (`users.purge_after`) when the student asks | Immediate hard delete; locked account restored by an admin; deadline computed from the current setting | Lets a student undo a mistake without email (none is sent yet) or staff. Sign-in returns `accountRestored: true` so the UI can say so. A stored deadline is the one the student was shown: changing the setting later doesn't move it, and a sign-in after it is refused like an unknown email even if the hourly purge hasn't run yet. |
| **Purge is a hard `DELETE FROM users`**, cascading to every user table, run at start-up and hourly by a plain interval | `@nestjs/schedule`; soft delete kept forever | One idempotent statement needs no scheduler dependency. An e2e test fails if any table referencing `users` lacks `ON DELETE CASCADE`. |

## Consequences

- A new table that references `users` is exported and purged automatically. A credential column must be named with one of the secret suffixes.
- An email stays taken during the grace period: sign-up answers 409, and signing in restores the account.
- Google-only accounts (no password) cannot confirm deletion yet. Handle this with Google OAuth.
- Nightly backups (not set up yet) will hold purged accounts until they rotate out; the backup retention must be stated in the privacy notice.
