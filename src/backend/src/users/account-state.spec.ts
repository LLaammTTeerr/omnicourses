import type { EntityManager } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { deletionStateOf, isWaitingForDeletion, lockAccountRow, lockAccountStates, noDeletionWaitingSql, ROW_LOCK } from './account-state.js';

const [A, B] = ['00000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b'];

function manager(rows: unknown[]) {
  const query = vi.fn(async () => rows);
  return { em: { query } as unknown as EntityManager, query };
}

describe('isWaitingForDeletion', () => {
  it('is true exactly when a deletion request is recorded', () => {
    expect(isWaitingForDeletion({ deletionRequestedAt: new Date('2030-01-01T00:00:00Z') })).toBe(true);
    expect(isWaitingForDeletion({ deletionRequestedAt: null })).toBe(false);
  });
});

describe('noDeletionWaitingSql', () => {
  it('names the column, with the table alias when one is given', () => {
    expect(noDeletionWaitingSql()).toBe('"deletion_requested_at" IS NULL');
    expect(noDeletionWaitingSql('u')).toBe('u."deletion_requested_at" IS NULL');
  });
});

describe('lockAccountRow', () => {
  it('locks the row in the mode asked and says whether it was found', async () => {
    const found = manager([{}]);
    await expect(lockAccountRow(found.em, A, ROW_LOCK.noKeyUpdate)).resolves.toBe(true);
    expect(found.query).toHaveBeenCalledExactlyOnceWith('SELECT 1 FROM "users" WHERE "id" = $1 FOR NO KEY UPDATE', [A]);

    const missing = manager([]);
    await expect(lockAccountRow(missing.em, A, ROW_LOCK.share)).resolves.toBe(false);
    expect(missing.query).toHaveBeenCalledExactlyOnceWith('SELECT 1 FROM "users" WHERE "id" = $1 FOR SHARE', [A]);
  });

  it('locks only an account with no deletion waiting when asked for an active one', async () => {
    const { em, query } = manager([]);
    await expect(lockAccountRow(em, A, ROW_LOCK.share, { activeOnly: true })).resolves.toBe(false);
    expect(query).toHaveBeenCalledExactlyOnceWith('SELECT 1 FROM "users" WHERE "id" = $1 AND "deletion_requested_at" IS NULL FOR SHARE', [A]);
  });
});

describe('lockAccountStates', () => {
  it('locks each row once, in id order, and returns the state of each account found', async () => {
    const rows = [{ id: A, deletionRequestedAt: null }];
    const { em, query } = manager(rows);
    await expect(lockAccountStates(em, [B, A, B], ROW_LOCK.noKeyUpdate)).resolves.toBe(rows);
    expect(query).toHaveBeenCalledExactlyOnceWith(
      'SELECT "id", "deletion_requested_at" AS "deletionRequestedAt" FROM "users" WHERE "id" = ANY($1::uuid[]) ORDER BY "id" FOR NO KEY UPDATE',
      [[A, B]],
    );
  });
});

describe('deletionStateOf', () => {
  it('reads the state without a lock, and nothing for a missing account', async () => {
    const pending = { deletionRequestedAt: new Date('2030-01-01T00:00:00Z') };
    const found = manager([pending]);
    await expect(deletionStateOf(found.em, A)).resolves.toBe(pending);
    expect(found.query).toHaveBeenCalledExactlyOnceWith('SELECT "deletion_requested_at" AS "deletionRequestedAt" FROM "users" WHERE "id" = $1', [A]);
    await expect(deletionStateOf(manager([]).em, A)).resolves.toBeUndefined();
  });
});
