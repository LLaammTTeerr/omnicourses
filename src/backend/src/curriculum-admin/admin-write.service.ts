import { applyDecorators, ForbiddenException, Injectable } from '@nestjs/common';
import { ApiBadRequestResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiProperty } from '@nestjs/swagger';
import { DataSource, EntityManager } from 'typeorm';
import { AdminErrorDto } from '../common/api-errors.js';
import { grantsOf, missingPermission, type Need, type PermissionKind } from './grants.js';

class PermissionRequiredDto extends AdminErrorDto {
  @ApiProperty({ enum: ['program_admin', 'catalog_maintainer', 'access_manager'], description: 'The grant the caller lacks' })
  permission!: PermissionKind;
}

const permissionRequired = (permission: PermissionKind) =>
  new ForbiddenException({ statusCode: 403, code: 'permission_required', permission, message: `This needs the ${permission} permission` });

const accountDeletionPending = () =>
  new ForbiddenException({ statusCode: 403, code: 'account_deletion_pending', message: 'An account waiting for deletion cannot administer curricula' });

export const AdminErrors = ({ notFound = true }: { notFound?: boolean } = {}) =>
  applyDecorators(
    ApiBadRequestResponse({ type: AdminErrorDto, description: '`validation_failed`: a malformed ID or code, an unknown field or an invalid value; nothing is saved' }),
    ApiForbiddenResponse({ type: PermissionRequiredDto, description: '`permission_required`: the caller lacks the grant this needs; `account_deletion_pending`' }),
    ...(notFound ? [ApiNotFoundResponse({ type: AdminErrorDto, description: '`not_found`: nothing with this ID or code within the authorised scope' })] : []),
  );

export const ADMIN_WRITE_LOCK = 11_012_001;
export const ACCESS_MANAGER_LOCK = 11_012_002;

export async function lockAdminWrite(
  em: EntityManager,
  userIds: string[],
  options: { lockAccessManagers?: boolean } = {},
): Promise<{ id: string; deletionRequestedAt: Date | null }[]> {
  await em.query('SELECT pg_advisory_xact_lock($1)', [ADMIN_WRITE_LOCK]);
  if (options.lockAccessManagers) {
    await em.query('SELECT pg_advisory_xact_lock($1)', [ACCESS_MANAGER_LOCK]);
  }
  const ids = [...new Set(userIds)].sort();
  return em.query(`SELECT "id", "deletion_requested_at" AS "deletionRequestedAt" FROM "users" WHERE "id" = ANY($1::uuid[]) ORDER BY "id" FOR NO KEY UPDATE`, [ids]);
}

async function assertMay(em: EntityManager, caller: { deletionRequestedAt: Date | null } | undefined, callerId: string, need: Need): Promise<void> {
  if (!caller || caller.deletionRequestedAt) throw accountDeletionPending();
  const missing = missingPermission(await grantsOf(em, callerId), need);
  if (missing) throw permissionRequired(missing);
}

@Injectable()
export class AdminWriteService {
  constructor(private readonly db: DataSource) {}

  run<T>(callerId: string, need: Need, write: (em: EntityManager) => Promise<T>): Promise<T> {
    return this.runLocked(callerId, [], need, write);
  }

  runForRecipient<T>(
    callerId: string,
    recipientId: string,
    write: (em: EntityManager) => Promise<T>,
    options: { lockAccessManagers?: boolean } = {},
  ): Promise<T> {
    return this.runLocked(callerId, [recipientId], { permission: 'access_manager' }, write, options);
  }

  private async runLocked<T>(
    callerId: string,
    recipientIds: string[],
    need: Need,
    write: (em: EntityManager) => Promise<T>,
    options: { lockAccessManagers?: boolean } = {},
  ): Promise<T> {
    return this.db.transaction(async (em) => {
      const users = await lockAdminWrite(em, [callerId, ...recipientIds], options);
      await assertMay(em, users.find((u) => u.id === callerId), callerId, need);
      return write(em);
    });
  }

  async read<T>(callerId: string, need: Need, read: (em: EntityManager) => Promise<T>): Promise<T> {
    return this.db.transaction('REPEATABLE READ', async (em) => {
      await em.query('SET TRANSACTION READ ONLY');
      const [caller]: { deletionRequestedAt: Date | null }[] = await em.query('SELECT "deletion_requested_at" AS "deletionRequestedAt" FROM "users" WHERE "id" = $1', [callerId]);
      await assertMay(em, caller, callerId, need);
      return read(em);
    });
  }
}
