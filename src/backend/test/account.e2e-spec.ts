import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findUserTables, isSecretColumn } from '../src/account/account-export.js';
import { AccountPurgeService } from '../src/account/account-purge.service.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';
import { notCascadingToUsers, ownedButNotExported, purgeBlockers } from './user-table-rules.js';

// The 10/min password budget is per IP and per route: this file uses sign-in ×5,
// delete ×4, sign-up ×1. It runs in its own app, so auth.e2e-spec's budget is separate.
const email = `account-${randomUUID()}@example.com`;
const password = 'correct horse battery';

function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(allKeys);
  if (value && typeof value === 'object') return Object.entries(value).flatMap(([k, v]) => [k, ...allKeys(v)]);
  return [];
}

describe('Account export and deletion against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  let token: string;
  let userId: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    db = app.get(DataSource);
    await db.runMigrations({ transaction: 'each' });
    await app.init();
    const res = await http().post('/api/auth/sign-up').send({ email, password, displayName: 'Test Student', acceptedTerms: true }).expect(201);
    token = res.body.token;
    userId = res.body.user.id;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('every table that references users cascades on delete (AGENTS.md rule)', async () => {
    const notCascading = (await findUserTables(db)).filter((t) => t.onDelete !== 'c').map((t) => `${t.table}.${t.column}`);
    expect(notCascading).toEqual([]);
    expect(await notCascadingToUsers(db)).toEqual([]);
  });

  it('nothing blocks the purge and every table it deletes from is exported', async () => {
    expect(await purgeBlockers(db)).toEqual([]);
    expect(await ownedButNotExported(db)).toEqual([]);
  });

  it('the schema rules catch a grandchild table, a key not named user_id, a composite key and a self-reference', async () => {
    const qr = db.createQueryRunner();
    await qr.startTransaction();
    try {
      // Rolled back below. zz_plans is a well-formed user table; the rest break a rule.
      await qr.query(`CREATE TABLE zz_plans (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE)`);
      await qr.query(`CREATE TABLE zz_plan_notes (plan_id uuid REFERENCES zz_plans(id))`);
      await qr.query(`CREATE TABLE zz_plan_items (plan_id uuid REFERENCES zz_plans(id) ON DELETE CASCADE)`);
      // References users, but not as user_id: the export (owned rows only) would skip it.
      await qr.query(`CREATE TABLE zz_owned_by (owner_id uuid REFERENCES users(id) ON DELETE CASCADE)`);
      await qr.query(`CREATE UNIQUE INDEX zz_users_id_email ON users (id, email)`);
      await qr.query(`CREATE TABLE zz_pairs (user_id uuid, email varchar(254), FOREIGN KEY (user_id, email) REFERENCES users(id, email))`);
      await qr.query(`ALTER TABLE users ADD COLUMN zz_invited_by uuid REFERENCES users(id)`);
      expect(await notCascadingToUsers(qr)).toEqual(['zz_pairs.zz_pairs_user_id_email_fkey']);
      expect(await purgeBlockers(qr)).toEqual(['users.users_zz_invited_by_fkey', 'zz_pairs.zz_pairs_user_id_email_fkey', 'zz_plan_notes.zz_plan_notes_plan_id_fkey']);
      expect(await ownedButNotExported(qr)).toEqual(['zz_owned_by', 'zz_plan_items']);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });

  it('finds each user table once, and only keys that point at users.id', async () => {
    const qr = db.createQueryRunner();
    await qr.startTransaction();
    try {
      // DDL is transactional in PostgreSQL: all of this is rolled back below.
      await qr.query(`CREATE TABLE zz_parted (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, term smallint NOT NULL) PARTITION BY LIST (term)`);
      await qr.query(`CREATE TABLE zz_parted_1 PARTITION OF zz_parted FOR VALUES IN (1)`);
      await qr.query(`CREATE TABLE zz_by_email (email varchar(254) REFERENCES users(email) ON DELETE CASCADE)`);
      await qr.query(`ALTER TABLE users ADD COLUMN zz_invited_by uuid REFERENCES users(id) ON DELETE SET NULL`);
      const found = (await findUserTables(qr)).map((t) => `${t.table}.${t.column}`).filter((name) => name.includes('zz_'));
      expect(found).toEqual(['zz_parted.user_id']);
    } finally {
      await qr.rollbackTransaction();
      await qr.release();
    }
  });

  it('exports the account with every user table and no secret column', async () => {
    const res = await http().get('/api/users/me/export').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.user).toMatchObject({ id: userId, email, display_name: 'Test Student' });
    expect(res.body.tables.sessions).toHaveLength(1);
    for (const t of await findUserTables(db)) expect([t.table, `${t.table}.${t.column}`].some((key) => key in res.body.tables)).toBe(true);
    // Checked against the stored values, not the filter's own predicate: only sha256(token) is stored.
    const [{ password_hash }] = await db.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
    const [{ token_hash }] = await db.query('SELECT token_hash FROM sessions WHERE user_id = $1', [userId]);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain(password_hash);
    expect(body).not.toContain(token_hash);
    for (const key of ['password_hash', 'google_sub', 'token_hash']) expect(allKeys(res.body)).not.toContain(key);
  });

  // Lâm's decision: a row that references the student but belongs to someone else is theirs, not exported.
  it('exports only the rows the student owns (user_id), not rows that merely reference them', async () => {
    const [other] = await db.query(
      `INSERT INTO users (email, password_hash, display_name, consent_at) VALUES ($1, 'not-a-real-hash', 'Other Student', now()) RETURNING id`,
      [`account-other-${randomUUID()}@example.com`],
    );
    // Committed, so the request's own connection sees it; dropped in finally.
    await db.query(`CREATE TABLE zz_shares (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      viewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note text NOT NULL)`);
    try {
      await db.query(`INSERT INTO zz_shares VALUES ($1, $2, 'mine'), ($2, $1, 'theirs')`, [userId, other.id]);
      const res = await http().get('/api/users/me/export').set('Authorization', `Bearer ${token}`).expect(200);
      expect(res.body.tables.zz_shares).toEqual([{ user_id: userId, viewer_id: other.id, note: 'mine' }]);
      expect(Object.keys(res.body.tables).filter((key) => key.startsWith('zz_shares'))).toEqual(['zz_shares']);
    } finally {
      await db.query('DROP TABLE zz_shares');
      await db.query('DELETE FROM users WHERE id = $1', [other.id]);
    }
  });

  // Independent of isSecretColumn: any column that merely mentions a credential word, in any
  // case or plural, must either be dropped by the export or be listed here as the student's data.
  it('every exported column that looks like a credential is dropped or known to be data', async () => {
    const looksSecret = /(^|_)(hash|token|secret|key|password|sub)(e?s)?(_|$)/;
    const known = ['ai_usage.input_tokens', 'ai_usage.output_tokens'];
    const columns: { table: string; column: string }[] = await db.query(`
      SELECT DISTINCT cl.relname AS "table", a.attname AS "column"
      FROM pg_attribute a JOIN pg_class cl ON cl.oid = a.attrelid
      WHERE a.attnum > 0 AND NOT a.attisdropped
        AND (cl.oid = 'users'::regclass OR cl.oid IN (SELECT conrelid FROM pg_constraint WHERE contype = 'f' AND confrelid = 'users'::regclass))`);
    const unflagged = columns
      .filter(({ column }) => looksSecret.test(column.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()))
      .filter(({ column }) => !isSecretColumn(column))
      .map(({ table, column }) => `${table}.${column}`)
      .filter((name) => !known.includes(name));
    expect(unflagged).toEqual([]);
  });

  it('refuses deletion with a wrong password with 403, keeping the session', async () => {
    await http().delete('/api/users/me').set('Authorization', `Bearer ${token}`).send({ password: 'wrong password!' }).expect(403);
    await http().get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('schedules deletion, signs out everywhere, and a sign-in within the grace period restores the account', async () => {
    const res = await http().delete('/api/users/me').set('Authorization', `Bearer ${token}`).send({ password }).expect(202);
    expect(new Date(res.body.purgeAfter).getTime()).toBeGreaterThan(Date.now() + 29 * 86_400_000);
    await http().get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(401);

    const signIn = await http().post('/api/auth/sign-in').send({ email, password }).expect(200);
    expect(signIn.body.accountRestored).toBe(true);
    token = signIn.body.token;
    const [row] = await db.query('SELECT deletion_requested_at FROM users WHERE id = $1', [userId]);
    expect(row.deletion_requested_at).toBeNull();
  });

  // A double-click or two tabs: the first sign-in clears the deadline before the second
  // cancels, and an already-cancelled deletion must still count as restored (PR #14 review).
  it('two concurrent sign-ins to an account pending deletion both succeed', async () => {
    await http().delete('/api/users/me').set('Authorization', `Bearer ${token}`).send({ password }).expect(202);
    const [first, second] = await Promise.all([
      http().post('/api/auth/sign-in').send({ email, password }),
      http().post('/api/auth/sign-in').send({ email, password }),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(first.body.token).toEqual(expect.any(String));
    expect(second.body.token).toEqual(expect.any(String));
    token = first.body.token;
    const [row] = await db.query('SELECT deletion_requested_at, purge_after FROM users WHERE id = $1', [userId]);
    expect(row).toEqual({ deletion_requested_at: null, purge_after: null });
  });

  it('refuses a sign-in once the stored deadline has passed, even before the purge runs', async () => {
    await http().delete('/api/users/me').set('Authorization', `Bearer ${token}`).send({ password }).expect(202);
    await db.query(`UPDATE users SET purge_after = now() - interval '1 minute' WHERE id = $1`, [userId]);
    // Lâm's decision: exactly the answer to an unknown email, so it doesn't reveal the account existed.
    const unknown = await http().post('/api/auth/sign-in').send({ email: `nobody-${randomUUID()}@example.com`, password }).expect(401);
    const afterDeadline = await http().post('/api/auth/sign-in').send({ email, password }).expect(401);
    expect(afterDeadline.body).toEqual(unknown.body);
    expect(afterDeadline.body.message).toBe('Invalid email or password');
    const [row] = await db.query('SELECT deletion_requested_at FROM users WHERE id = $1', [userId]);
    expect(row.deletion_requested_at).not.toBeNull();
    expect(await db.query('SELECT 1 FROM sessions WHERE user_id = $1 AND revoked_at IS NULL', [userId])).toEqual([]);
  });

  it('purges only the accounts whose deadline has passed, with their rows', async () => {
    // A second account, deletion requested but still inside its grace period: it must survive.
    const [waiting] = await db.query(
      `INSERT INTO users (email, password_hash, display_name, consent_at, deletion_requested_at, purge_after)
       VALUES ($1, 'not-a-real-hash', 'Waiting Student', now(), now(), now() + interval '1 day') RETURNING id`,
      [`account-waiting-${randomUUID()}@example.com`],
    );
    try {
      await app.get(AccountPurgeService, { strict: false }).purge();
      expect(await db.query('SELECT 1 FROM users WHERE id = $1', [userId])).toEqual([]);
      expect(await db.query('SELECT 1 FROM sessions WHERE user_id = $1', [userId])).toEqual([]);
      expect(await db.query('SELECT 1 FROM users WHERE id = $1', [waiting.id])).toHaveLength(1);
    } finally {
      await db.query('DELETE FROM users WHERE id = $1', [waiting.id]);
    }
  });
});
