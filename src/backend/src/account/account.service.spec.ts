import { ForbiddenException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from '../config/clock.js';
import { DAY_MS } from '../config/time.js';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AccountPurgeService } from './account-purge.service.js';
import { AccountService } from './account.service.js';

vi.mock('./account-export.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./account-export.js')>()),
  findUserColumns: vi.fn(async () => ['id', 'email']),
  findUserTables: vi.fn(async () => [{ table: 'sessions', qualifiedTable: 'public.sessions', columns: ['id', 'user_agent'] }]),
}));

const NOW = new Date('2026-11-26T03:00:00Z');
const clock = { now: () => new Date(NOW) } as Clock;

const user = { id: 'u1', passwordHash: 'h' } as User;

describe('AccountService', () => {
  let db: { query: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
  const tx = { query: vi.fn() };
  let users: { markDeletionRequestedWithin: ReturnType<typeof vi.fn> };
  let auth: { verifyPassword: ReturnType<typeof vi.fn>; revokeAllWithin: ReturnType<typeof vi.fn> };
  let sharing: { stopAllWithin: ReturnType<typeof vi.fn> };
  let service: AccountService;

  beforeEach(() => {
    tx.query.mockReset();
    // transaction(cb) and transaction(isolationLevel, cb): the callback is the last argument.
    db = { query: vi.fn(), transaction: vi.fn(async (...args: unknown[]) => (args.at(-1) as (m: unknown) => unknown)(tx)) };
    users = { markDeletionRequestedWithin: vi.fn(async () => undefined) };
    auth = { verifyPassword: vi.fn(async () => true), revokeAllWithin: vi.fn(async () => undefined) };
    sharing = { stopAllWithin: vi.fn(async () => undefined) };
    service = new AccountService(db as never, users as never, auth as never, sharing as never, clock);
  });

  afterEach(() => vi.unstubAllEnvs());

  describe('export', () => {
    beforeEach(() => {
      tx.query.mockResolvedValue([{ id: 'u1' }]);
    });

    // ADR 0004: the contract that the export is one consistent snapshot.
    it('reads every table from one read-only snapshot', async () => {
      await expect(service.export('u1')).resolves.toEqual({ exportedAt: NOW, user: { id: 'u1' }, tables: { sessions: [{ id: 'u1' }] } });
      expect(db.transaction).toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function));
      expect(tx.query.mock.calls[0]![0]).toBe('SET TRANSACTION READ ONLY');
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  it('schedules deletion after the grace period and signs out everywhere, in one transaction', async () => {
    vi.stubEnv('ACCOUNT_DELETION_GRACE_DAYS', '30');
    const { purgeAfter } = await service.requestDeletion(user, 'correct horse battery');
    expect(auth.verifyPassword).toHaveBeenCalledWith(user, 'correct horse battery');
    // The deadline promised to the student is stored, so a later change of the setting can't move it.
    const [manager, userId, requestedAt, storedPurgeAfter] = users.markDeletionRequestedWithin.mock.calls[0]!;
    expect(userId).toBe('u1');
    expect(storedPurgeAfter).toEqual(purgeAfter);
    expect(requestedAt).toEqual(NOW);
    expect(purgeAfter).toEqual(new Date(NOW.getTime() + 30 * DAY_MS));
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(manager).toBe(tx);
    expect(auth.revokeAllWithin).toHaveBeenCalledWith(tx, 'u1');
  });

  // UC-09 A7: every shared plan's link stops with the sessions, in the same transaction, so a
  // failure leaves neither a deletion scheduled nor a link open.
  it("stops every shared plan's link in the transaction that schedules the deletion", async () => {
    await service.requestDeletion(user, 'correct horse battery');
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(sharing.stopAllWithin).toHaveBeenCalledExactlyOnceWith(tx, 'u1');
  });

  it('fails the whole request when the links cannot be stopped', async () => {
    sharing.stopAllWithin.mockRejectedValueOnce(new Error('db down'));
    await expect(service.requestDeletion(user, 'correct horse battery')).rejects.toThrow('db down');
  });

  it('refuses with 403 (not 401, which would sign the client out) on a wrong password', async () => {
    auth.verifyPassword.mockResolvedValue(false);
    await expect(service.requestDeletion(user, 'wrong')).rejects.toThrow(new ForbiddenException('Wrong password'));
    expect(users.markDeletionRequestedWithin).not.toHaveBeenCalled();
    expect(auth.revokeAllWithin).not.toHaveBeenCalled();
    expect(sharing.stopAllWithin).not.toHaveBeenCalled();
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
    await expect(new AccountPurgeService(new UsersService(users as never), clock).purge()).resolves.toBe(2);
    expect(users.delete).toHaveBeenCalledTimes(3);
  });

  it('does not count an account signed back in since it was found', async () => {
    const users = { find: due('u1'), delete: vi.fn(async () => ({ affected: 0 })) };
    await expect(new AccountPurgeService(new UsersService(users as never), clock).purge()).resolves.toBe(0);
  });

  it('logs and survives a failed purge, so the next hour retries', async () => {
    const users = { find: vi.fn(async () => Promise.reject(new Error('db down'))), delete: vi.fn() };
    await expect(new AccountPurgeService(new UsersService(users as never), clock).purge()).resolves.toBe(0);
  });
});
