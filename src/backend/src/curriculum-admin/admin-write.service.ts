import { applyDecorators, Injectable } from '@nestjs/common';
import { ApiBadRequestResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiProperty } from '@nestjs/swagger';
import { DataSource, EntityManager } from 'typeorm';
import { SINGLE_KEY_LOCKS } from '../common/advisory-locks.js';
import { AdminErrorDto, forbidden } from '../common/api-errors.js';
import { type AccountState, type DeletionState, deletionStateOf, isWaitingForDeletion, lockAccountStates, ROW_LOCK } from '../users/account-state.js';
import { grantsOf, missingPermission, type Need, type PermissionKind } from './grants.js';

class PermissionRequiredDto extends AdminErrorDto {
  @ApiProperty({ enum: ['program_admin', 'catalog_maintainer', 'access_manager'], description: 'The grant the caller lacks' })
  permission!: PermissionKind;
}

const permissionRequired = (permission: PermissionKind) =>
  forbidden('permission_required', `This needs the ${permission} permission`, { permission });

const accountDeletionPending = () =>
  forbidden('account_deletion_pending', 'An account waiting for deletion cannot administer curricula');

export const AdminErrors = ({ notFound = true }: { notFound?: boolean } = {}) =>
  applyDecorators(
    ApiBadRequestResponse({ type: AdminErrorDto, description: '`validation_failed`: a malformed ID or code, an unknown field or an invalid value; nothing is saved' }),
    ApiForbiddenResponse({ type: PermissionRequiredDto, description: '`permission_required`: the caller lacks the grant this needs; `account_deletion_pending`' }),
    ...(notFound ? [ApiNotFoundResponse({ type: AdminErrorDto, description: '`not_found`: nothing with this ID or code within the authorised scope' })] : []),
  );

export async function lockAdminWrite(
  em: EntityManager,
  userIds: string[],
  options: { lockAccessManagers?: boolean } = {},
): Promise<AccountState[]> {
  await em.query('SELECT pg_advisory_xact_lock($1)', [SINGLE_KEY_LOCKS.adminWrite]);
  if (options.lockAccessManagers) {
    await em.query('SELECT pg_advisory_xact_lock($1)', [SINGLE_KEY_LOCKS.accessManager]);
  }
  return lockAccountStates(em, userIds, ROW_LOCK.noKeyUpdate);
}

async function assertMay(em: EntityManager, caller: DeletionState | undefined, callerId: string, need: Need): Promise<void> {
  if (!caller || isWaitingForDeletion(caller)) throw accountDeletionPending();
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
      await assertMay(em, await deletionStateOf(em, callerId), callerId, need);
      return read(em);
    });
  }
}
