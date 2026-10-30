# ADR 0004: Account export and deletion

- Status: accepted
- Date: 2026-10-24
- Deciders: Lâm (owner of `auth`, `users`, `account`)

## Context

The privacy NFR (Vision §6) requires "export and deletion of a whole account", under Luật 91/2025/QH15. Every module will add tables holding a student's data (plans, transcripts, advisor usage), written by five different people.

## Decisions

| Decision | Alternatives rejected | Evidence |
| --- | --- | --- |
| **`GET /users/me/export` reads every table whose `user_id` references `users(id)` from the PostgreSQL catalog, and only the rows the student owns** (`user_id` = them; a row that merely references them, such as `viewer_id`, belongs to someone else and is not exported), in one read-only `REPEATABLE READ` snapshot, and never selects columns named like credentials (suffix `_hash`, `_token`, `_secret`, `_key`, `_password`, `_sub`, in snake_case or camelCase) | Each module registers its own export section | A forgotten section leaves data out of the export without anyone noticing. With the catalog, completeness follows from the existing rule that every user table references `users(id)`. The e2e test checks that every such table appears and that no secret-named key does. |
| **`DELETE /users/me` asks for the password again**; 403 on a wrong one, 10/min rate limit | Bearer token alone | A stolen token alone cannot wipe an account. 403, not 401, because the client treats 401 as "signed out". |
| **30-day grace period** (`ACCOUNT_DELETION_GRACE_DAYS`): every session is revoked at once, and **signing in again before the deadline cancels the deletion**. The deadline is stored on the row (`users.purge_after`) when the student asks | Immediate hard delete; locked account restored by an admin; deadline computed from the current setting | Lets a student undo a mistake without email (none is sent yet) or staff. Sign-in returns `accountRestored: true` so the UI can say so. A stored deadline is the one the student was shown: changing the setting later doesn't move it, and a sign-in after it is refused like an unknown email even if the hourly purge hasn't run yet. |
| **Purge is a hard `DELETE FROM users`**, one account at a time, cascading to every user table, run at start-up and hourly by a plain interval | `@nestjs/schedule`; soft delete kept forever; one `DELETE` for every due account | One idempotent statement per account needs no scheduler dependency, and an account whose rows can't be deleted doesn't hold back the others. E2e tests read the catalog and fail if a `user_id` key to `users` lacks `ON DELETE CASCADE`, if a key to `users` in another column (`reviewed_by`) is neither `SET NULL` nor `CASCADE` (`SET NULL` keeps the other student's row when this one is purged), if any key into a user table (grandchild, composite, self-reference, `SET NULL` on a `NOT NULL` column) would block the delete, or if a table the purge deletes from has no `user_id` of its own and so would be missing from the export. |

## Consequences

- A new table with a `user_id` that references `users` is exported and purged automatically. A credential column must be named with one of the secret suffixes.
- An email stays taken during the grace period: sign-up answers 409, and signing in restores the account.
- The purge runs hourly, so an account can outlive its deadline by up to an hour. In that window sign-in answers the generic 401 `Invalid email or password` (it doesn't reveal that the account existed) and sign-up still answers 409. Accepted by the Project Lead; there is no inline purge.
- Google-only accounts (no password) cannot confirm deletion yet. Handle this with Google OAuth.
- Nightly backups (not set up yet) will hold purged accounts until they rotate out; the backup retention must be stated in the privacy notice.
