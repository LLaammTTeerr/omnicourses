import { Logger } from '@nestjs/common';
import { QueryFailedError, Repository } from 'typeorm';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Clock } from '../config/clock.js';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { AccountPurgeService } from './account-purge.service.js';

// A database message quotes row values (AGENTS.md hard rule 3). ZZSECRET stands for one.
function refused(): QueryFailedError {
  const driverError = Object.assign(new Error('invalid input syntax for type uuid: "ZZSECRET"'), { code: '22P02' });
  return new QueryFailedError('DELETE FROM "users" WHERE "id" = $1 -- ZZSECRET', ['ZZSECRET'], driverError);
}

function errorLines(): string[] {
  const lines: string[] = [];
  vi.spyOn(Logger.prototype, 'error').mockImplementation((...args: unknown[]) => void lines.push(args.map(String).join(' ')));
  return lines;
}

describe('AccountPurgeService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('logs only the failure kind when it cannot find the accounts that are due', async () => {
    const lines = errorLines();
    const users = { find: vi.fn().mockRejectedValue(refused()) } as unknown as Repository<User>;
    await expect(new AccountPurgeService(new UsersService(users), new Clock()).purge()).resolves.toBe(0);
    expect(lines).toEqual(['Account purge failed: QueryFailedError, SQLSTATE 22P02']);
  });

  it('logs only the failure kind when it cannot delete an account, and goes on with the others', async () => {
    const lines = errorLines();
    const users = {
      find: vi.fn().mockResolvedValue([{ id: 'synthetic-1' }, { id: 'synthetic-2' }]),
      delete: vi.fn().mockRejectedValueOnce(refused()).mockResolvedValueOnce({ affected: 1 }),
    } as unknown as Repository<User>;
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    await expect(new AccountPurgeService(new UsersService(users), new Clock()).purge()).resolves.toBe(1);
    expect(lines[0]).toBe('Could not purge an account: QueryFailedError, SQLSTATE 22P02');
    expect(lines.join('\n')).not.toContain('ZZSECRET');
  });

  it('logs the frames, not the message, of a failure that is not a database error', async () => {
    const lines = errorLines();
    const users = { find: vi.fn().mockRejectedValue(new TypeError('Cannot read ZZSECRET')) } as unknown as Repository<User>;
    await new AccountPurgeService(new UsersService(users), new Clock()).purge();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^Account purge failed: TypeError /);
    expect(lines[0]).toContain('account-purge.service.spec.ts');
    expect(lines[0]).not.toContain('ZZSECRET');
  });
});
