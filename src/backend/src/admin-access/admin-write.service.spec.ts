import { ForbiddenException } from '@nestjs/common';
import type { DataSource, EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { SINGLE_KEY_LOCKS } from '../common/advisory-locks.js';
import { AdminWriteService, lockAdminWrite } from './admin-write.service.js';

const ADVISORY_LOCK = 'SELECT pg_advisory_xact_lock($1)';
const ROW_LOCK_SQL = 'SELECT "id", "deletion_requested_at" AS "deletionRequestedAt" FROM "users" WHERE "id" = ANY($1::uuid[]) ORDER BY "id" FOR NO KEY UPDATE';
const CALLER_STATE = 'SELECT "deletion_requested_at" AS "deletionRequestedAt" FROM "users" WHERE "id" = $1';
const [A, B] = ['00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b'];

function manager(rows: unknown[] = []) {
  const query = vi.fn(async (sql: string) => (sql.includes('"users"') ? rows : []));
  return { em: { query } as unknown as EntityManager, query };
}

describe('lockAdminWrite', () => {
  it('takes the admin-write lock, then locks each account row once, in id order', async () => {
    const rows = [{ id: A, deletionRequestedAt: null }];
    const { em, query } = manager(rows);
    await expect(lockAdminWrite(em, [B, A, B])).resolves.toBe(rows);
    expect(query.mock.calls).toEqual([
      [ADVISORY_LOCK, [SINGLE_KEY_LOCKS.adminWrite]],
      [ROW_LOCK_SQL, [[A, B]]],
    ]);
  });

  it('takes the access-manager lock between the admin-write lock and the row lock when asked', async () => {
    const { em, query } = manager();
    await lockAdminWrite(em, [A], { lockAccessManagers: true });
    expect(query.mock.calls).toEqual([
      [ADVISORY_LOCK, [SINGLE_KEY_LOCKS.adminWrite]],
      [ADVISORY_LOCK, [SINGLE_KEY_LOCKS.accessManager]],
      [ROW_LOCK_SQL, [[A]]],
    ]);
  });
});

describe('AdminWriteService.read', () => {
  function reader(rows: unknown[]) {
    const { em, query } = manager(rows);
    const db = { transaction: vi.fn((_level: string, work: (m: EntityManager) => unknown) => work(em)) } as unknown as DataSource;
    return { service: new AdminWriteService(db), query };
  }

  it('reads the caller row without a lock and refuses a caller waiting for deletion or with no account', async () => {
    for (const rows of [[{ deletionRequestedAt: new Date('2030-01-01T00:00:00Z') }], []]) {
      const { service, query } = reader(rows);
      const read = vi.fn();
      const refusal = await service.read(A, { permission: 'catalog_maintainer' }, read).catch((error: unknown) => error);
      expect(refusal).toBeInstanceOf(ForbiddenException);
      expect((refusal as ForbiddenException).getResponse()).toMatchObject({ code: 'account_deletion_pending' });
      expect(query.mock.calls).toEqual([['SET TRANSACTION READ ONLY'], [CALLER_STATE, [A]]]);
      expect(read).not.toHaveBeenCalled();
    }
  });

  it('lets an active caller past the deletion check to the permission check', async () => {
    const { service } = reader([{ deletionRequestedAt: null }]);
    const refusal = await service.read(A, { permission: 'catalog_maintainer' }, vi.fn()).catch((error: unknown) => error);
    expect((refusal as ForbiddenException).getResponse()).toMatchObject({ code: 'permission_required' });
  });
});
