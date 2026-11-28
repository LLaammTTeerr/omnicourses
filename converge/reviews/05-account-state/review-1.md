# Review round 1: batch 05-account-state (cvb/05-account-state, 2335a9ebf9..dce634c)

Verdict: approve. No blocking findings. Eight non-blocking notes at the end.

## What I ran
- `node scripts/lint.mjs` (Lint passed) and `node --test scripts/lint.test.mjs` (35/35).
- `tsc --noEmit -p src/backend/tsconfig.json`: clean.
- Unit: `vitest run src/users src/sharing src/transcript src/plans src/curriculum-admin src/auth src/notifications src/account`: 32 files, 343 tests passed.
- E2E against omnicourse_cv_be: account, curriculum-admin, curriculum-admin-import, curriculum-admin-programs, notifications, plan-sharing, plans, transcript: 8 files, 184 tests passed.
- depgraph on base (git archive of 2335a9ebf9) and on HEAD: 9 new file edges, all to users/account-state.ts, from folders that already depended on users/. No new folder edge, no new cycle. account-state.ts imports only typeorm (type) and users/user.entity.ts (type).

## 1 + 8. Every replaced site, old against new (lock clause, filter, ORDER BY, parameters, transaction)
| Site | Old | New (resolved text) | Same? |
| --- | --- | --- | --- |
| auth.service.ts:86 signIn | `user.deletionRequestedAt !== null` | `isWaitingForDeletion(user)` = `!== null` | yes |
| auth.service.ts:111 authenticate | `if (session.user.deletionRequestedAt)` (truthy) | `!== null` | yes: user comes from `relations: { user: true }`, every column loaded, value is Date or null, never undefined |
| sharing.service.ts:57 share | `SELECT 1 FROM "users" WHERE "id" = $1 AND "deletion_requested_at" IS NULL FOR SHARE`, [userId]; `if (!active) return []` | lockAccountRow(tx, id, ROW_LOCK.share, {activeOnly:true}) builds the same string byte for byte; `rows.length > 0` | yes, same tx, same order before INSERT |
| sharing.service.ts:93 public read | `... WHERE s."share_token" = $1 AND u."deletion_requested_at" IS NULL` | `noDeletionWaitingSql('u')` gives the same text | yes |
| notifications.service.ts:24 INSERT ... SELECT | `u."id" = ANY($1::uuid[]) AND u."deletion_requested_at" IS NULL` | same text via noDeletionWaitingSql('u') | yes |
| plans.service.ts:57 create, :84 copy | `SELECT 1 FROM "users" WHERE "id" = $1 FOR NO KEY UPDATE`, result ignored | lockAccountRow(tx, id, ROW_LOCK.noKeyUpdate): same string, result ignored; copy keeps the earlier `FOR SHARE OF p` read before it | yes |
| transcript.service.ts:30 replace | same as plans | same as plans | yes |
| admin-write.service.ts:35-36 lockAdminWrite | advisory adminWrite, optional accessManager, then `SELECT "id", "deletion_requested_at" AS "deletionRequestedAt" FROM "users" WHERE "id" = ANY($1::uuid[]) ORDER BY "id" FOR NO KEY UPDATE` with `[...new Set(ids)].sort()` | advisory locks unchanged and in place; lockAccountStates builds the same string and the same sorted, de-duplicated ids | yes |
| admin-write.service.ts:40 assertMay | `!caller \|\| caller.deletionRequestedAt` | `!caller \|\| isWaitingForDeletion(caller)` | yes: caller comes from raw pg rows, Date or null |
| admin-write.service.ts:79 read | `SELECT "deletion_requested_at" AS "deletionRequestedAt" FROM "users" WHERE "id" = $1`, no lock, in the REPEATABLE READ READ ONLY tx | deletionStateOf: same string, same tx, after SET TRANSACTION READ ONLY | yes |
| admin-lookups.ts:57 assertActiveRecipient | `SELECT "deletion_requested_at" FROM "users" WHERE "id" = $1`, truthy check on `deletion_requested_at` | deletionStateOf: adds the alias `AS "deletionRequestedAt"`, no lock, same em; `!== null` | one SQL-text difference: the alias `AS "deletionRequestedAt"` is new (see non-blocking 7); same row, same filter, lock (none), parameters, em, and the same 404 and 409 text and codes |
| access-admin.service.ts:18 bootstrap | `user.deletionRequestedAt` truthy | isWaitingForDeletion | yes |
| access-admin.service.ts:32 activeAccessManagers | `u."deletion_requested_at" IS NULL` | same text via noDeletionWaitingSql('u') | yes |

Left alone, correctly: admin-lookups.ts:54 (existence check, no deletion state), account.service.ts:27 (the export, out of scope), auth.service.ts:200 (FOR UPDATE SKIP LOCKED on another table), users.service.ts (owner).

## 2. Contract
`git diff -- src/backend/openapi.json src/backend/src/database/migrations package-lock.json` is empty. No controller, DTO, route, status or error code touched. Error texts unchanged.

## 3. Tests
Only additions in test files (admin-write.service.spec.ts new, sharing.service.spec.ts +14, transcript.service.spec.ts +7, curriculum-admin.e2e-spec.ts +12, users/account-state.spec.ts new, lint.test.mjs +30). No it/expect lost.
Characterization tests came first in their own commit (641a669). Per-site pinning: auth (auth.service.spec.ts:263, :435), sharing write (new unit + plan-sharing e2e "crosses a deletion request"), sharing read (new unit + plan-sharing e2e "opens nothing for an account waiting for deletion"), notifications (notifications e2e :496), plans (plans.service.spec.ts:190, :192, exact SQL), transcript (new unit + transcript e2e lock test), lockAdminWrite and read (new admin-write spec, exact SQL and call order), assertActiveRecipient (new e2e), bootstrap (e2e :361), activeAccessManagers filter (e2e :402-405: bootstrap succeeds when the only access manager waits for deletion).
New logic is tested: account-state.spec.ts pins each SQL string exactly and the predicate both ways. From reading the cases (no mutants run), the lint tests catch dropping the folder exemption, the production-file filter and the trailing word boundary; not the leading one (non-blocking 8).

## 4. Completeness
`git grep deletion_requested_at|deletionRequestedAt` in src/backend/src outside specs: only users/ and migrations. The lint rule enforces it (lint passes). Sequence diagrams (UC-02, UC-09, UC-11, UC-12) and class-model.md still show the SQL; that SQL is unchanged, so they stay true.

## 5. Structure
Simpler: one file owns the column name and the lock text; nine inline copies are gone. Two lock functions (single-row SELECT 1 and multi-row with state) are needed to keep each site's exact SQL. No new folder edge.

## 6. Repo rules
No comments added, no dependency, .js suffixes present, no magic numbers. All 10 commits signed (G), Conventional subjects. Exactly one new changeset (.changeset/05-account-state.md, empty front matter like 01 to 04).

## 7. Scope
No off-limits file touched (no frontend, no csv-import, no ai/ or advisor/, no ADR 0011, no test-cases-b2.md). layers.mjs gets only identifierHomes; no backendEdges change was needed (every new edge's folder pair already existed, and lint reports none gone).

## Non-blocking
1. docs/analysis-and-design/architecture.md:132: the users row still lists "is deletion pending" among the UsersService methods; UsersService has no such method (stale before this batch). The predicate now is isWaitingForDeletion in account-state.ts, named in the last column. Fix: drop "is deletion pending" from the responsibility list, or replace it with "the account-state check and row locks (account-state.ts)".
2. scripts/lint.mjs:440 checkIdentifierHomes uses isBackendProduction, which also exempts any testing/ folder under src/backend/src, not only specs and e2e as the brief says. Harmless today (ai/testing has no hit). Also the RegExp is built from the identifier unescaped; fine for word identifiers, which is all the table holds. Fix if wanted: state the testing/ exemption in the rule message or escape the identifier.
3. src/backend/src/curriculum-admin/admin-write.service.spec.ts:8 defines a local ROW_LOCK (an SQL string) while users/account-state.ts exports ROW_LOCK (the lock-mode map). Rename the spec constant to ROW_LOCK_SQL.
4. src/backend/src/curriculum-admin/admin-lookups.ts:58 assertActiveRecipient re-reads the recipient's state that lockAdminWrite already returned under the row lock. Pre-existing and kept on purpose (brief: do not unify); worth a follow-up.
5. src/backend/src/sharing/sharing.service.spec.ts:66 pins the public read with toContain on one fragment; the plan-sharing e2e covers the behaviour, so this is fine.
6. Commit 762e30f's subject is 84 characters; only PR titles are length-checked (72), so this matters only if it becomes a PR title.

7. src/backend/src/curriculum-admin/admin-lookups.ts:58: the old select list was `"deletion_requested_at"` with no alias; deletionStateOf adds `AS "deletionRequestedAt"`, merging this site with admin-write's caller read, which differed at base. Filter, lock (none), parameters and transaction are identical and the caller now reads the aliased field, so behaviour is the same. Reported as the brief asks for differing sites; no fix needed.
8. scripts/lint.test.mjs:220-246: the cases cover the trailing word boundary (secret_columns) but not the leading one; dropping the leading \b would pass. Fix: add a file containing "my_secret_column" to the allowed case.

Also checked: lint.mjs has no mode that rewrites scripts/layers.mjs, so identifierHomes cannot be dropped by a regeneration.

## Implementer report
/tmp/claude-1000/-home-lamter-omnicourses/ee2891ec-152a-4592-ad64-6ac8f4460668/scratchpad/batches/05-account-state/report.md did not exist when I looked (also searched converge/ and /tmp/claude-1000 for report*: none), so I could not check the implementer's stated omissions or their per-site SQL list (part A asks for it in the report). My per-site table above covers it.
