import { ForbiddenException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../users/user.entity.js';
import { isSecretColumn } from './account-export.js';
import { AccountPurgeService } from './account-purge.service.js';
import { AccountService, deletionGraceMs } from './account.service.js';

const DAY = 86_400_000;
const user = { id: 'u1', passwordHash: 'h' } as User;

describe('secret columns', () => {
  // TypeORM names a column after its property unless `name` is set, so camelCase counts too.
  it.each(['password_hash', 'token_hash', 'google_sub', 'api_key', 'refresh_token', 'client_secret', 'passwordHash', 'apiKey', 'APIKey', 'Password_Hash', 'password', 'token'])(
    'drops %s',
    (column) => {
      expect(isSecretColumn(column)).toBe(true);
    },
  );

  // The documented rule is a suffix (AGENTS.md): a secret word elsewhere in the name is the student's data.
  it.each(['email', 'display_name', 'input_tokens', 'user_id', 'subject_code', 'keyboard_layout', 'key_count', 'sub_total', 'hash_algorithm', 'token_expires_at'])(
    'keeps %s',
    (column) => {
      expect(isSecretColumn(column)).toBe(false);
    },
  );
});

describe('deletionGraceMs', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reads whole days from ACCOUNT_DELETION_GRACE_DAYS', () => {
    vi.stubEnv('ACCOUNT_DELETION_GRACE_DAYS', '7');
    expect(deletionGraceMs()).toBe(7 * DAY);
  });

  // '' would read as 0 (purge at once) and a typo as NaN (never purge).
  it.each(['', ' ', 'abc', '0', '-1', '1.5'])('falls back to 30 days when the setting is %j', (value) => {
    vi.stubEnv('ACCOUNT_DELETION_GRACE_DAYS', value);
    expect(deletionGraceMs()).toBe(30 * DAY);
  });
});

describe('AccountService', () => {
  let db: { query: ReturnType<typeof vi.fn>; transaction: ReturnType<typeof vi.fn> };
  const tx = { query: vi.fn() };
  let users: { requestDeletion: ReturnType<typeof vi.fn> };
  let auth: { verifyPassword: ReturnType<typeof vi.fn>; revokeAll: ReturnType<typeof vi.fn> };
  let service: AccountService;

  beforeEach(() => {
    tx.query.mockReset();
    // transaction(cb) and transaction(isolationLevel, cb): the callback is the last argument.
    db = { query: vi.fn(), transaction: vi.fn(async (...args: unknown[]) => (args.at(-1) as (m: unknown) => unknown)(tx)) };
    users = { requestDeletion: vi.fn(async () => undefined) };
    auth = { verifyPassword: vi.fn(async () => true), revokeAll: vi.fn(async () => undefined) };
    service = new AccountService(db as never, users as never, auth as never);
  });

  afterEach(() => vi.unstubAllEnvs());

  describe('export', () => {
    const userTables = [
      { table: 'sessions', column: 'user_id', qualifiedTable: 'public.sessions', quotedColumn: 'user_id', onDelete: 'c', columns: ['id', 'user_id', 'token_hash', 'user_agent'] },
      { table: 'shares', column: 'user_id', qualifiedTable: 'public.shares', quotedColumn: 'user_id', onDelete: 'c', columns: ['id', 'user_id', 'viewer_id'] },
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

    it('exports the user and every referencing table', async () => {
      const result = await service.export('u1');
      expect(result.user).toEqual({ id: 'u1', email: 'a@example.com' });
      expect(result.tables.sessions).toEqual([{ id: 's1', user_agent: 'Firefox' }]);
    });

    // AGENTS.md: never read users.password_hash. Secret columns are left out of the SELECT, not filtered after it.
    it('never selects a secret column', async () => {
      await service.export('u1');
      expect(selects()).toContain('SELECT "id", "email" FROM "users" WHERE "id" = $1');
      expect(selects()).toContain('SELECT "id", "user_id", "user_agent" FROM public.sessions WHERE user_id = $1');
      for (const sql of selects()) expect(sql).not.toMatch(/password_hash|google_sub|token_hash|\*/);
    });

    it('keys each table by its name', async () => {
      const result = await service.export('u1');
      expect(Object.keys(result.tables)).toEqual(['sessions', 'shares']);
    });

    it('reads every table from one read-only snapshot', async () => {
      await service.export('u1');
      expect(db.transaction).toHaveBeenCalledWith('REPEATABLE READ', expect.any(Function));
      expect(tx.query.mock.calls[0]![0]).toBe('SET TRANSACTION READ ONLY');
      expect(db.query).not.toHaveBeenCalled();
    });
  });

  it('schedules deletion after the grace period and signs out everywhere', async () => {
    vi.stubEnv('ACCOUNT_DELETION_GRACE_DAYS', '30');
    const before = Date.now();
    const { purgeAfter } = await service.requestDeletion(user, 'correct horse battery');
    expect(auth.verifyPassword).toHaveBeenCalledWith(user, 'correct horse battery');
    // The deadline promised to the student is stored, so a later change of the setting can't move it.
    const [, requestedAt, storedPurgeAfter] = users.requestDeletion.mock.calls[0]!;
    expect(storedPurgeAfter).toEqual(purgeAfter);
    expect(purgeAfter.getTime() - requestedAt.getTime()).toBe(30 * DAY);
    expect(auth.revokeAll).toHaveBeenCalledWith('u1', tx);
    expect(purgeAfter.getTime() - before).toBeGreaterThanOrEqual(30 * DAY);
    expect(purgeAfter.getTime() - before).toBeLessThan(30 * DAY + 1000);
  });

  // If revoking failed after the request was saved, the client got a 500 for a
  // deletion that was in fact scheduled, with its sessions still unrevoked.
  it('schedules the deletion and revokes the sessions in one transaction', async () => {
    await service.requestDeletion(user, 'correct horse battery');
    expect(db.transaction).toHaveBeenCalledOnce();
    expect(users.requestDeletion).toHaveBeenCalledWith('u1', expect.any(Date), expect.any(Date), tx);
    expect(auth.revokeAll).toHaveBeenCalledWith('u1', tx);
  });

  it('fails the request when revoking fails, so the transaction rolls the schedule back', async () => {
    auth.revokeAll.mockRejectedValue(new Error('db down'));
    await expect(service.requestDeletion(user, 'correct horse battery')).rejects.toThrow('db down');
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it('refuses with 403 (not 401, which would sign the client out) on a wrong password', async () => {
    auth.verifyPassword.mockResolvedValue(false);
    await expect(service.requestDeletion(user, 'wrong')).rejects.toThrow(new ForbiddenException('Wrong password'));
    expect(users.requestDeletion).not.toHaveBeenCalled();
    expect(auth.revokeAll).not.toHaveBeenCalled();
  });
});

describe('AccountPurgeService', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('purges the accounts whose stored deadline has passed, whatever the grace setting is now', async () => {
    vi.stubEnv('ACCOUNT_DELETION_GRACE_DAYS', '1');
    const users = { findDue: vi.fn(async () => ['u1', 'u2']), purge: vi.fn(async () => true) };
    const now = new Date('2026-12-01T00:00:00Z');
    await expect(new AccountPurgeService(users as never).purge(now)).resolves.toBe(2);
    expect(users.findDue).toHaveBeenCalledWith(now);
    expect(users.purge.mock.calls).toEqual([['u1', now], ['u2', now]]);
  });

  // One account whose rows can't be deleted must not keep every other account past its deadline.
  it('purges each account on its own, so one failure does not block the rest', async () => {
    const users = {
      findDue: vi.fn(async () => ['u1', 'u2', 'u3']),
      purge: vi.fn(async (id: string) => (id === 'u2' ? Promise.reject(new Error('violates foreign key')) : true)),
    };
    await expect(new AccountPurgeService(users as never).purge()).resolves.toBe(2);
    expect(users.purge).toHaveBeenCalledTimes(3);
  });

  it('does not count an account signed back in since it was found', async () => {
    const users = { findDue: vi.fn(async () => ['u1']), purge: vi.fn(async () => false) };
    await expect(new AccountPurgeService(users as never).purge()).resolves.toBe(0);
  });

  it('logs and survives a failed purge, so the next hour retries', async () => {
    const users = { findDue: vi.fn(async () => Promise.reject(new Error('db down'))), purge: vi.fn() };
    await expect(new AccountPurgeService(users as never).purge()).resolves.toBe(0);
  });
});
