import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { accountDeletionPending, permissionRequired } from './admin-errors.js';
import type { GlobalPermission } from './admin-grant.entities.js';
import { type Grants, missingPermission, type Need } from './grant-scope.js';

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

// Runs an F12 mutation: one transaction, the write lock, then the caller's current grants.
// A revocation that committed first blocks this write; one that comes later waits for it.
@Injectable()
export class AdminWriteService {
  constructor(private readonly db: DataSource) {}

  async run<T>(callerId: string, need: Need, write: (em: EntityManager) => Promise<T>, otherUserIds: string[] = []): Promise<T> {
    return this.db.transaction(async (em) => {
      const users = await lockAdminWrite(em, [callerId, ...otherUserIds]);
      const caller = users.find((u) => u.id === callerId);
      if (!caller || caller.deletionRequestedAt) throw accountDeletionPending();
      const missing = missingPermission(await grantsOf(em, callerId), need);
      if (missing) throw permissionRequired(missing);
      return write(em);
    });
  }
}
