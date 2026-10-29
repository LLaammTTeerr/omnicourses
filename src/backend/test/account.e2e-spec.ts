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

// Uses 6 of the 10/min password budget per IP (sign-up, delete ×3, sign-in ×2);
// it runs in its own app, so auth.e2e-spec's budget is separate.
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

  it('refuses a sign-in once the stored deadline has passed, even before the purge runs', async () => {
    await http().delete('/api/users/me').set('Authorization', `Bearer ${token}`).send({ password }).expect(202);
    await db.query(`UPDATE users SET purge_after = now() - interval '1 minute' WHERE id = $1`, [userId]);
    await http().post('/api/auth/sign-in').send({ email, password }).expect(401);
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
