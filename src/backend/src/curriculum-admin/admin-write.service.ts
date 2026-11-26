import { applyDecorators, ForbiddenException, Injectable } from '@nestjs/common';
import { ApiBadRequestResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiProperty } from '@nestjs/swagger';
import { DataSource, EntityManager } from 'typeorm';
import { AdminErrorDto } from '../common/api-errors.js';
import type { GlobalPermission } from './admin-grant.entities.js';
import { type Grants, missingPermission, type Need, type PermissionKind } from './grant-scope.js';

export class PermissionRequiredDto extends AdminErrorDto {
  @ApiProperty({ enum: ['program_admin', 'catalog_maintainer', 'access_manager'], description: 'The grant the caller lacks' })
  permission!: PermissionKind;
}

const permissionRequired = (permission: PermissionKind) =>
  new ForbiddenException({ statusCode: 403, code: 'permission_required', permission, message: `This needs the ${permission} permission` });

const accountDeletionPending = () =>
  new ForbiddenException({ statusCode: 403, code: 'account_deletion_pending', message: 'An account waiting for deletion cannot administer curricula' });

/**
 * The errors every F12 route can answer, on top of the 401 of @Authenticated(). `notFound: false`
 * leaves out the 404, for a route with no ID or code to look up.
 */
export const AdminErrors = ({ notFound = true }: { notFound?: boolean } = {}) =>
  applyDecorators(
    ApiBadRequestResponse({ type: AdminErrorDto, description: '`validation_failed`: a malformed ID or code, an unknown field or an invalid value; nothing is saved' }),
    ApiForbiddenResponse({ type: PermissionRequiredDto, description: '`permission_required`: the caller lacks the grant this needs; `account_deletion_pending`' }),
    ...(notFound ? [ApiNotFoundResponse({ type: AdminErrorDto, description: '`not_found`: nothing with this ID or code within the authorised scope' })] : []),
  );

/**
 * The one F12 write lock (ADR 0011, "Transaction and concurrency contract"): every curriculum,
 * catalog and grant mutation and the bootstrap take it, so a check and the write it guards see
 * the same data. A transaction-scoped advisory lock: released at commit or rollback.
 */
export const ADMIN_WRITE_LOCK = 11_012_001;

/** Locks the F12 writers, then the given users in UUID order, inside `em`'s transaction. */
export async function lockAdminWrite(em: EntityManager, userIds: string[]): Promise<{ id: string; deletionRequestedAt: Date | null }[]> {
  await em.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_WRITE_LOCK]);
  const ids = [...new Set(userIds)].sort();
  // NO KEY UPDATE: a concurrent deletion request on these users waits for this write.
  return em.query(`SELECT "id", "deletion_requested_at" AS "deletionRequestedAt" FROM "users" WHERE "id" = ANY($1::uuid[]) ORDER BY "id" FOR NO KEY UPDATE`, [ids]);
}

export async function grantsOf(em: EntityManager, userId: string): Promise<Grants> {
  const programs: { program_id: string }[] = await em.query('SELECT "program_id" FROM "program_admin_grants" WHERE "user_id" = $1', [userId]);
  const globals: { permission: GlobalPermission }[] = await em.query('SELECT "permission" FROM "global_admin_grants" WHERE "user_id" = $1', [userId]);
  return { programIds: new Set(programs.map((r) => r.program_id)), permissions: new Set(globals.map((r) => r.permission)) };
}

/** Refuses a caller who is gone or waiting for deletion, or who lacks the grant `need` names. */
async function assertMay(em: EntityManager, caller: { deletionRequestedAt: Date | null } | undefined, callerId: string, need: Need): Promise<void> {
  if (!caller || caller.deletionRequestedAt) throw accountDeletionPending();
  const missing = missingPermission(await grantsOf(em, callerId), need);
  if (missing) throw permissionRequired(missing);
}

// Runs an F12 mutation: one transaction, the write lock, then the caller's current grants.
// A revocation that committed first blocks this write; one that comes later waits for it.
@Injectable()
export class AdminWriteService {
  constructor(private readonly db: DataSource) {}

  async run<T>(callerId: string, need: Need, write: (em: EntityManager) => Promise<T>, otherUserIds: string[] = []): Promise<T> {
    return this.db.transaction(async (em) => {
      const users = await lockAdminWrite(em, [callerId, ...otherUserIds]);
      await assertMay(em, users.find((u) => u.id === callerId), callerId, need);
      return write(em);
    });
  }

  /**
   * Runs an F12 preview (ADR 0011: "Previews use a consistent read-only snapshot"): one
   * REPEATABLE READ transaction that PostgreSQL itself keeps read-only, with the caller's
   * current grants checked first and no lock taken. It decides nothing: the confirmation
   * repeats every check under the write lock.
   */
  async read<T>(callerId: string, need: Need, read: (em: EntityManager) => Promise<T>): Promise<T> {
    return this.db.transaction('REPEATABLE READ', async (em) => {
      await em.query('SET TRANSACTION READ ONLY');
      const [caller]: { deletionRequestedAt: Date | null }[] = await em.query('SELECT "deletion_requested_at" AS "deletionRequestedAt" FROM "users" WHERE "id" = $1', [callerId]);
      await assertMay(em, caller, callerId, need);
      return read(em);
    });
  }
}
