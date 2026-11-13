import { ForbiddenException, Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { User } from '../users/user.entity.js';
import { AccountPurgeService } from './account-purge.service.js';
import { AccountService } from './account.service.js';

// The export and the deletion request are checked against PostgreSQL in test/account.e2e-spec.ts.
describe('AccountService', () => {
  it('refuses with 403 (not 401, which would sign the client out) on a wrong password', async () => {
    const db = { transaction: vi.fn() };
    const users = { markDeletionRequestedWithin: vi.fn() };
    const auth = { verifyPassword: vi.fn(async () => false), revokeAllWithin: vi.fn() };
    const service = new AccountService(db as never, users as never, auth as never);
    await expect(service.requestDeletion({ id: 'u1' } as User, 'wrong')).rejects.toThrow(new ForbiddenException('Wrong password'));
    expect(users.markDeletionRequestedWithin).not.toHaveBeenCalled();
    expect(auth.revokeAllWithin).not.toHaveBeenCalled();
  });
});

describe('AccountPurgeService', () => {
  const due = (...ids: string[]) => vi.fn(async () => ids);

  afterEach(() => vi.restoreAllMocks());

  // One account whose rows can't be deleted must not keep every other account past its deadline.
  it('purges each account on its own, so one failure does not block the rest', async () => {
    const users = {
      findDueForPurge: due('u1', 'u2', 'u3'),
      purgeIfDue: vi.fn(async (id: string) => (id === 'u2' ? Promise.reject(new Error('violates foreign key')) : true)),
    };
    await expect(new AccountPurgeService(users as never).purge()).resolves.toBe(2);
    expect(users.purgeIfDue).toHaveBeenCalledTimes(3);
  });

  it('does not count an account signed back in since it was found', async () => {
    const users = { findDueForPurge: due('u1'), purgeIfDue: vi.fn(async () => false) };
    await expect(new AccountPurgeService(users as never).purge()).resolves.toBe(0);
  });

  it('logs and survives a failed purge, so the next hour retries', async () => {
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const users = { findDueForPurge: vi.fn(async () => Promise.reject(new Error('db down'))), purgeIfDue: vi.fn() };
    await expect(new AccountPurgeService(users as never).purge()).resolves.toBe(0);
    expect(logged).toHaveBeenCalledWith('Account purge failed: db down');
  });
});
