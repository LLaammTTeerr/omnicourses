import { ForbiddenException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS } from '../config/time.js';
import { User } from '../users/user.entity.js';
import { AccountPurgeService } from './account-purge.service.js';
import { AccountService } from './account.service.js';

const user = { id: 'u1', passwordHash: 'h' } as User;

describe('AccountService', () => {
  let db: { query: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
  const tx = { query: vi.fn() };
  let users: { markDeletionRequestedWithin: ReturnType<typeof vi.fn> };
  let auth: { verifyPassword: ReturnType<typeof vi.fn>; revokeAllWithin: ReturnType<typeof vi.fn> };
  let service: AccountService;

  beforeEach(() => {
    tx.query.mockReset();
    // transaction(cb) and transaction(isolationLevel, cb): the callback is the last argument.
    db = { query: vi.fn(), transaction: vi.fn(async (...args: unknown[]) => (args.at(-1) as (m: unknown) => unknown)(tx)) };
    users = { markDeletionRequestedWithin: vi.fn(async () => undefined) };
    auth = { verifyPassword: vi.fn(async () => true), revokeAllWithin: vi.fn(async () => undefined) };
    service = new AccountService(db as never, users as never, auth as never);
  });

  afterEach(() => vi.unstubAllEnvs());

  describe('export', () => {
    const userTables = [
      { table: 'sessions', qualifiedTable: 'public.sessions', columns: ['id', 'user_id', 'token_hash', 'user_agent'] },
      { table: 'shares', qualifiedTable: 'public.shares', columns: ['id', 'user_id', 'viewer_id'] },
    ];

    beforeEach(() => {
      tx.query.mockImplementation(async (sql: string) => {
        if (sql.includes('pg_constraint')) return userTables;
        if (sql.includes('pg_attribute')) return [{ columns: ['id', 'email', 'password_hash', 'google_sub'] }];
        if (sql.includes('FROM "users"')) return [{ id: 'u1', email: 'a@example.com' }];
        if (sql.includes('public.sessions')) return [{ id: 's1', user_agent: 'Firefox' }];
        return [];
      });
    });

    const selects = () => tx.query.mock.calls.map(([sql]) => sql as string).filter((sql) => sql.startsWith('SELECT') && !sql.includes('pg_'));

    // AGENTS.md: never read users.password_hash. Secret columns are left out of the SELECT, not filtered after it.
    it('never selects a secret column', async () => {
      await service.export('u1');
      expect(selects()).toHaveLength(3);
      for (const sql of selects()) expect(sql).not.toMatch(/password_hash|google_sub|token_hash|\*/);
    });

    // ADR 0004: the contract that the export is one consistent snapshot.
    it('reads every table from one read-only snapshot', async () => {
      await service.export('u1');
      expect(db.transaction).toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function));
      expect(tx.query.mock.calls[0]![0]).toBe('SET TRANSACTION READ ONLY');
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  it('schedules deletion after the grace period and signs out everywhere, in one transaction', async () => {
    vi.stubEnv('ACCOUNT_DELETION_GRACE_DAYS', '30');
    const before = Date.now();
    const { purgeAfter } = await service.requestDeletion(user, 'correct horse battery');
    expect(auth.verifyPassword).toHaveBeenCalledWith(user, 'correct horse battery');
    // The deadline promised to the student is stored, so a later change of the setting can't move it.
    const [manager, userId, requestedAt, storedPurgeAfter] = users.markDeletionRequestedWithin.mock.calls[0]!;
    expect(userId).toBe('u1');
    expect(storedPurgeAfter).toEqual(purgeAfter);
    expect(purgeAfter.getTime() - requestedAt.getTime()).toBe(30 * DAY_MS);
    expect(purgeAfter.getTime() - before).toBeGreaterThanOrEqual(30 * DAY_MS);
    expect(purgeAfter.getTime() - before).toBeLessThan(30 * DAY_MS + 1000);
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(manager).toBe(tx);
    expect(auth.revokeAllWithin).toHaveBeenCalledWith(tx, 'u1');
  });

  it('refuses with 403 (not 401, which would sign the client out) on a wrong password', async () => {
    auth.verifyPassword.mockResolvedValue(false);
    await expect(service.requestDeletion(user, 'wrong')).rejects.toThrow(new ForbiddenException('Wrong password'));
    expect(users.markDeletionRequestedWithin).not.toHaveBeenCalled();
    expect(auth.revokeAllWithin).not.toHaveBeenCalled();
  });
});

describe('AccountPurgeService', () => {
  const due = (...ids: string[]) => vi.fn(async () => ids.map((id) => ({ id })));

  // One account whose rows can't be deleted must not keep every other account past its deadline.
  it('purges each account on its own, so one failure does not block the rest', async () => {
    const users = {
      find: due('u1', 'u2', 'u3'),
      delete: vi.fn(async ({ id }: { id: string }) => (id === 'u2' ? Promise.reject(new Error('violates foreign key')) : { affected: 1 })),
    };
    await expect(new AccountPurgeService(users as never).purge()).resolves.toBe(2);
    expect(users.delete).toHaveBeenCalledTimes(3);
  });

  it('does not count an account signed back in since it was found', async () => {
    const users = { find: due('u1'), delete: vi.fn(async () => ({ affected: 0 })) };
    await expect(new AccountPurgeService(users as never).purge()).resolves.toBe(0);
  });

  it('logs and survives a failed purge, so the next hour retries', async () => {
    const users = { find: vi.fn(async () => Promise.reject(new Error('db down'))), delete: vi.fn() };
    await expect(new AccountPurgeService(users as never).purge()).resolves.toBe(0);
  });
});
