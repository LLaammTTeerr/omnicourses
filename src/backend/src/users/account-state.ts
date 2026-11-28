import type { EntityManager } from 'typeorm';
import type { User } from './user.entity.js';

export type DeletionState = Pick<User, 'deletionRequestedAt'>;
export type AccountState = Pick<User, 'id' | 'deletionRequestedAt'>;

export const ROW_LOCK = { share: 'FOR SHARE', noKeyUpdate: 'FOR NO KEY UPDATE' } as const;
export type RowLock = (typeof ROW_LOCK)[keyof typeof ROW_LOCK];

export const isWaitingForDeletion = (account: DeletionState): boolean => account.deletionRequestedAt !== null;

export const noDeletionWaitingSql = (alias?: string): string => `${alias ? `${alias}.` : ''}"deletion_requested_at" IS NULL`;

export async function lockAccountRow(manager: EntityManager, userId: string, lock: RowLock, { activeOnly = false }: { activeOnly?: boolean } = {}): Promise<boolean> {
  const filter = activeOnly ? ` AND ${noDeletionWaitingSql()}` : '';
  const rows: unknown[] = await manager.query(`SELECT 1 FROM "users" WHERE "id" = $1${filter} ${lock}`, [userId]);
  return rows.length > 0;
}

export function lockAccountStates(manager: EntityManager, userIds: string[], lock: RowLock): Promise<AccountState[]> {
  const ids = [...new Set(userIds)].sort();
  return manager.query(`SELECT "id", "deletion_requested_at" AS "deletionRequestedAt" FROM "users" WHERE "id" = ANY($1::uuid[]) ORDER BY "id" ${lock}`, [ids]);
}

export async function deletionStateOf(manager: EntityManager, userId: string): Promise<DeletionState | undefined> {
  const [state]: DeletionState[] = await manager.query('SELECT "deletion_requested_at" AS "deletionRequestedAt" FROM "users" WHERE "id" = $1', [userId]);
  return state;
}
