import { describe, expect, it, vi } from 'vitest';
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
