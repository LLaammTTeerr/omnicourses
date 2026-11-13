import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAY_MS } from '../config/time.js';
import { UsersService } from './users.service.js';

// The SQL conditions are checked against PostgreSQL in test/account.e2e-spec.ts.
describe('UsersService purge steps', () => {
  const now = new Date('2026-11-13T00:00:00Z');

  it('findDueForPurge returns the ids of the due accounts', async () => {
    const users = { find: vi.fn(async () => [{ id: 'u1' }, { id: 'u2' }]) };
    await expect(new UsersService(users as never).findDueForPurge(now)).resolves.toEqual(['u1', 'u2']);
  });

  it.each([
    [1, true],
    [0, false],
    [undefined, false],
  ])('purgeIfDue answers %j deleted rows with %j', async (affected, purged) => {
    const users = { delete: vi.fn(async () => ({ affected })) };
    await expect(new UsersService(users as never).purgeIfDue('u1', now)).resolves.toBe(purged);
  });
});

describe('UsersService.markDeletionRequestedWithin', () => {
  afterEach(() => vi.unstubAllEnvs());

  // ADR 0004: the deadline promised to the student is stored, so a later change of the setting can't move it.
  it('stores the request and its deadline after the grace period, and returns that deadline', async () => {
    vi.stubEnv('ACCOUNT_DELETION_GRACE_DAYS', '30');
    const manager = { update: vi.fn(async () => ({ affected: 1 })) };
    const at = new Date('2026-11-13T05:00:00Z');
    const purgeAfter = await new UsersService({} as never).markDeletionRequestedWithin(manager as never, 'u1', at);
    expect(purgeAfter.getTime() - at.getTime()).toBe(30 * DAY_MS);
    expect(manager.update).toHaveBeenCalledWith(expect.anything(), 'u1', { deletionRequestedAt: at, purgeAfter });
  });
});
