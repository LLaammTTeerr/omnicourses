import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { DAY_MS } from '../src/config/time.js';
import { UsersService } from '../src/users/users.service.js';
import { bootApp } from './support/app.js';
import { storedUser } from './support/users.js';

describe('Deletion state of a users row against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let users: UsersService;
  const created: string[] = [];

  const account = async (purgeAfter?: Date): Promise<string> => {
    const id = await storedUser(app);
    created.push(id);
    if (purgeAfter) {
      await db.query('UPDATE users SET deletion_requested_at = $2, purge_after = $3 WHERE id = $1', [id, new Date(purgeAfter.getTime() - DAY_MS), purgeAfter]);
    }
    return id;
  };
  const exists = async (id: string) => (await db.query('SELECT 1 FROM users WHERE id = $1', [id])).length === 1;

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
    users = app.get(UsersService);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await db.query('DELETE FROM users WHERE id = ANY($1)', [created.splice(0)]);
  });

  afterAll(async () => {
    await app?.close();
  });

  // ADR 0004: the deadline promised to the student is stored, so a later change of the setting can't move it.
  it('stores the request and the deadline the grace setting gives, and returns the stored deadline', async () => {
    vi.stubEnv('ACCOUNT_DELETION_GRACE_DAYS', '3');
    const id = await account();
    const at = new Date('2026-11-13T05:00:00Z');
    const returned = await users.markDeletionRequestedWithin(db.manager, id, at);
    const [row] = await db.query('SELECT deletion_requested_at, purge_after FROM users WHERE id = $1', [id]);
    expect(row).toEqual({ deletion_requested_at: at, purge_after: new Date('2026-11-16T05:00:00Z') });
    expect(returned).toEqual(row.purge_after);
  });

  it('finds the accounts whose stored deadline has passed, and no other', async () => {
    const now = new Date();
    const past = await account(new Date(now.getTime() - 60_000));
    const atDeadline = await account(now);
    const ahead = await account(new Date(now.getTime() + DAY_MS));
    const notRequested = await account();
    const due = await users.findDueForPurge(now);
    expect(due).toEqual(expect.arrayContaining([past, atDeadline]));
    expect(due).not.toContain(ahead);
    expect(due).not.toContain(notRequested);
  });

  it('purges an account still due and answers true; leaves any other and answers false', async () => {
    const now = new Date();
    const due = await account(new Date(now.getTime() - 60_000));
    const ahead = await account(new Date(now.getTime() + DAY_MS));
    const notRequested = await account();
    expect(await users.purgeIfDue(due, now)).toBe(true);
    expect(await exists(due)).toBe(false);
    // Already purged, for example by another instance.
    expect(await users.purgeIfDue(due, now)).toBe(false);
    for (const id of [ahead, notRequested]) {
      expect(await users.purgeIfDue(id, now)).toBe(false);
      expect(await exists(id)).toBe(true);
    }
  });
});
