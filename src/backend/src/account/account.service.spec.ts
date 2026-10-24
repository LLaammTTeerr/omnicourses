import { ForbiddenException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { User } from '../users/user.entity.js';
import { isSecretColumn, withoutSecrets } from './account-export.js';
import { AccountPurgeService } from './account-purge.service.js';
import { AccountService } from './account.service.js';

const DAY = 86_400_000;
const user = { id: 'u1', passwordHash: 'h' } as User;

describe('secret columns', () => {
  it.each(['password_hash', 'token_hash', 'google_sub', 'api_key', 'refresh_token', 'client_secret'])('drops %s', (column) => {
    expect(isSecretColumn(column)).toBe(true);
  });

  it.each(['email', 'display_name', 'input_tokens', 'user_id', 'subject_code', 'keyboard_layout'])('keeps %s', (column) => {
    expect(isSecretColumn(column)).toBe(false);
  });

  it('removes them from a row', () => {
    expect(withoutSecrets({ id: 1, email: 'a@example.com', password_hash: 'x', google_sub: 'y' })).toEqual({ id: 1, email: 'a@example.com' });
  });
});

describe('AccountService', () => {
  let db: { query: ReturnType<typeof vi.fn> };
  let users: { requestDeletion: ReturnType<typeof vi.fn> };
  let auth: { verifyPassword: ReturnType<typeof vi.fn>; revokeAll: ReturnType<typeof vi.fn> };
  let service: AccountService;

  beforeEach(() => {
    db = { query: vi.fn() };
    users = { requestDeletion: vi.fn(async () => undefined) };
    auth = { verifyPassword: vi.fn(async () => true), revokeAll: vi.fn(async () => undefined) };
    service = new AccountService(db as never, users as never, auth as never);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('exports the user and every referencing table without secrets', async () => {
    db.query
      .mockResolvedValueOnce([{ id: 'u1', email: 'a@example.com', password_hash: 'x' }])
      .mockResolvedValueOnce([
        { table: 'sessions', column: 'user_id', qualifiedTable: 'public.sessions', quotedColumn: 'user_id', onDelete: 'c' },
        { table: 'shares', column: 'owner_id', qualifiedTable: 'public.shares', quotedColumn: 'owner_id', onDelete: 'c' },
        { table: 'shares', column: 'viewer_id', qualifiedTable: 'public.shares', quotedColumn: 'viewer_id', onDelete: 'c' },
      ])
      .mockResolvedValueOnce([{ id: 's1', token_hash: 'y', user_agent: 'Firefox' }])
      .mockResolvedValueOnce([{ id: 'p1' }])
      .mockResolvedValueOnce([]);
    const result = await service.export('u1');
    expect(result.user).toEqual({ id: 'u1', email: 'a@example.com' });
    expect(result.tables).toEqual({ sessions: [{ id: 's1', user_agent: 'Firefox' }], shares: [{ id: 'p1' }], 'shares.viewer_id': [] });
    expect(db.query).toHaveBeenNthCalledWith(3, 'SELECT * FROM public.sessions WHERE user_id = $1', ['u1']);
  });

  it('schedules deletion after the grace period and signs out everywhere', async () => {
    vi.stubEnv('ACCOUNT_DELETION_GRACE_DAYS', '30');
    const before = Date.now();
    const { purgeAfter } = await service.requestDeletion(user, 'correct horse battery');
    expect(auth.verifyPassword).toHaveBeenCalledWith(user, 'correct horse battery');
    expect(users.requestDeletion).toHaveBeenCalledWith('u1', expect.any(Date));
    expect(auth.revokeAll).toHaveBeenCalledWith('u1');
    expect(purgeAfter.getTime() - before).toBeGreaterThanOrEqual(30 * DAY);
    expect(purgeAfter.getTime() - before).toBeLessThan(30 * DAY + 1000);
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

  it('purges requests older than the grace period', async () => {
    vi.stubEnv('ACCOUNT_DELETION_GRACE_DAYS', '30');
    const users = { purgeDeletionsRequestedBefore: vi.fn(async () => 2) };
    const now = new Date('2026-12-01T00:00:00Z');
    await expect(new AccountPurgeService(users as never).purge(now)).resolves.toBe(2);
    expect(users.purgeDeletionsRequestedBefore).toHaveBeenCalledWith(new Date('2026-11-01T00:00:00Z'));
  });

  it('logs and survives a failed purge, so the next hour retries', async () => {
    const users = { purgeDeletionsRequestedBefore: vi.fn(async () => Promise.reject(new Error('db down'))) };
    await expect(new AccountPurgeService(users as never).purge()).resolves.toBe(0);
  });
});
