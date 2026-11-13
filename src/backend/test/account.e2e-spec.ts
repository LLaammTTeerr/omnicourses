import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { findUserTables, isSecretColumn } from '../src/account/account-export.js';
import { AccountPurgeService } from '../src/account/account-purge.service.js';
import { AuthService } from '../src/auth/auth.service.js';
import { DAY_MS } from '../src/config/time.js';
import { bootApp } from './support/app.js';
import { PASSWORD as password, signedInUser, storedUser } from './support/users.js';
import { ownedButNotExported, purgeBlockers, wrongDeleteRuleToUsers } from './user-table-rules.js';

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
  let email: string;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
    ({ token, userId, email } = await signedInUser(app));
  });

  afterAll(async () => {
    await app?.close();
  });

  it('every user_id key to users cascades, and every other key cascades or sets null (AGENTS.md rule)', async () => {
    expect(await wrongDeleteRuleToUsers(db)).toEqual([]);
  });

  it('nothing blocks the purge and every table it deletes from is exported', async () => {
    expect(await purgeBlockers(db)).toEqual([]);
    expect(await ownedButNotExported(db)).toEqual([]);
  });

  it('the schema rules catch a grandchild table, a key not named user_id, a composite key, a self-reference and a wrong ON DELETE, and accept SET NULL on reviewed_by', async () => {
    const qr = db.createQueryRunner();
    await qr.startTransaction();
    try {
      // Rolled back below. zz_plans and zz_reviews are well-formed; the rest break a rule.
      await qr.query(`CREATE TABLE zz_plans (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE)`);
      await qr.query(`CREATE TABLE zz_plan_notes (plan_id uuid REFERENCES zz_plans(id))`);
      await qr.query(`CREATE TABLE zz_plan_items (plan_id uuid REFERENCES zz_plans(id) ON DELETE CASCADE)`);
      // References users, but not as user_id: the export (owned rows only) would skip it.
      await qr.query(`CREATE TABLE zz_owned_by (owner_id uuid REFERENCES users(id) ON DELETE CASCADE)`);
      await qr.query(`CREATE UNIQUE INDEX zz_users_id_email ON users (id, email)`);
      await qr.query(`CREATE TABLE zz_pairs (user_id uuid, email varchar(254), FOREIGN KEY (user_id, email) REFERENCES users(id, email))`);
      await qr.query(`ALTER TABLE users ADD COLUMN zz_invited_by uuid REFERENCES users(id)`);
      // reviewed_by points at another user: SET NULL keeps the owner's row when the reviewer is purged.
      await qr.query(`CREATE TABLE zz_reviews (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL)`);
      // A non-owner key with NO ACTION blocks the purge; an owner key must cascade, not set null.
      await qr.query(`CREATE TABLE zz_audits (actor_id uuid REFERENCES users(id))`);
      await qr.query(`CREATE TABLE zz_half (user_id uuid REFERENCES users(id) ON DELETE SET NULL)`);
      // SET NULL on a NOT NULL column makes the purge's DELETE fail.
      await qr.query(`CREATE TABLE zz_signoffs (signed_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL)`);
      expect(await wrongDeleteRuleToUsers(qr)).toEqual([
        'zz_audits.zz_audits_actor_id_fkey',
        'zz_half.zz_half_user_id_fkey',
        'zz_pairs.zz_pairs_user_id_email_fkey',
      ]);
      expect(await purgeBlockers(qr)).toEqual([
        'users.users_zz_invited_by_fkey',
        'zz_audits.zz_audits_actor_id_fkey',
        'zz_pairs.zz_pairs_user_id_email_fkey',
        'zz_plan_notes.zz_plan_notes_plan_id_fkey',
        'zz_signoffs.zz_signoffs_signed_by_fkey',
      ]);
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
      const found = (await findUserTables(qr)).map((t) => t.table).filter((name) => name.includes('zz_'));
      expect(found).toEqual(['zz_parted']);
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
    for (const t of await findUserTables(db)) expect(res.body.tables).toHaveProperty(t.table);
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
    const other = { id: await storedUser(app) };
    // Committed, so the request's own connection sees it; dropped in finally.
    await db.query(`CREATE TABLE zz_shares (
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      viewer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note text NOT NULL)`);
    try {
      await db.query(`INSERT INTO zz_shares VALUES ($1, $2, 'mine'), ($2, $1, 'theirs')`, [userId, other.id]);
      const res = await http().get('/api/users/me/export').set('Authorization', `Bearer ${token}`).expect(200);
      expect(res.body.tables.zz_shares).toEqual([{ user_id: userId, viewer_id: other.id, note: 'mine' }]);
    } finally {
      await db.query('DROP TABLE zz_shares');
      await db.query('DELETE FROM users WHERE id = $1', [other.id]);
    }
  });

  // AGENTS.md: never read users.password_hash. Secret columns are left out of the SELECT, not filtered after it.
  it('selects no secret column, in one read-only transaction that only reads', async () => {
    const logged: { sql: string; runner: unknown }[] = [];
    const spy = vi.spyOn(db.logger, 'logQuery').mockImplementation((sql, _parameters, runner) => {
      logged.push({ sql: sql.trim(), runner });
    });
    try {
      await http().get('/api/users/me/export').set('Authorization', `Bearer ${token}`).expect(200);
    } finally {
      spy.mockRestore();
    }
    const runners = [...new Set(logged.filter((q) => q.sql === 'START TRANSACTION').map((q) => q.runner))];
    expect(runners).toHaveLength(1);
    const statements = logged.filter((q) => q.runner === runners[0]).map((q) => q.sql);
    expect(statements).toContain('SET TRANSACTION READ ONLY');
    const reads = statements.filter((sql) => !/^(START TRANSACTION|SET TRANSACTION |COMMIT$)/.test(sql));
    expect(reads.filter((sql) => !sql.startsWith('SELECT'))).toEqual([]);
    // The users row and every user table, besides the catalog lookups.
    expect(reads.length).toBeGreaterThan((await findUserTables(db)).length + 1);
    for (const sql of reads) expect(sql).not.toMatch(/password_hash|google_sub|token_hash|\*/);
  });

  // ADR 0004: the export is one consistent snapshot of the account.
  it('reads every table from the snapshot it starts with, not a write committed while it runs', async () => {
    await db.query(`CREATE TABLE zz_snapshot (user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, note text NOT NULL)`);
    const writer = db.createQueryRunner();
    try {
      await writer.startTransaction();
      // Holds the export at its read of zz_snapshot, after it has read the users row.
      await writer.query('LOCK TABLE zz_snapshot IN ACCESS EXCLUSIVE MODE');
      await writer.query(`INSERT INTO zz_snapshot VALUES ($1, 'written during the export')`, [userId]);
      const exported = http().get('/api/users/me/export').set('Authorization', `Bearer ${token}`).then((res) => res);
      await vi.waitFor(
        async () => expect(await db.query(`SELECT 1 FROM pg_locks WHERE NOT granted AND relation = 'zz_snapshot'::regclass`)).toHaveLength(1),
        { timeout: 10_000, interval: 50 },
      );
      await writer.commitTransaction();
      const res = await exported;
      expect(res.status).toBe(200);
      expect(await db.query('SELECT note FROM zz_snapshot')).toEqual([{ note: 'written during the export' }]);
      expect(res.body.tables.zz_snapshot).toEqual([]);
    } finally {
      if (writer.isTransactionActive) await writer.rollbackTransaction();
      await writer.release();
      await db.query('DROP TABLE zz_snapshot');
    }
  });

  // Independent of isSecretColumn: any column that merely mentions a credential word, in any
  // case or plural, must either be dropped by the export or be listed here as the student's data.
  it('every exported column that looks like a credential is dropped or known to be data', async () => {
    const looksSecret = /(^|_)(hash|token|secret|key|password|sub|salt|seed)(e?s)?(_|$)/;
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

  it('schedules nothing when revoking the sessions fails, so the 500 is not a hidden deletion', async () => {
    const revoke = vi.spyOn(app.get(AuthService), 'revokeAllWithin').mockRejectedValueOnce(new Error('db down'));
    try {
      await http().delete('/api/users/me').set('Authorization', `Bearer ${token}`).send({ password }).expect(500);
    } finally {
      revoke.mockRestore();
    }
    const [row] = await db.query('SELECT deletion_requested_at, purge_after FROM users WHERE id = $1', [userId]);
    expect(row).toEqual({ deletion_requested_at: null, purge_after: null });
    await http().get('/api/users/me').set('Authorization', `Bearer ${token}`).expect(200);
  });

  it('schedules deletion, signs out everywhere, and a sign-in within the grace period restores the account', async () => {
    const res = await http().delete('/api/users/me').set('Authorization', `Bearer ${token}`).send({ password }).expect(202);
    expect(new Date(res.body.purgeAfter).getTime()).toBeGreaterThan(Date.now() + 29 * DAY_MS);
    // The deadline promised to the student is the one stored, from the time of the request.
    const [scheduled] = await db.query('SELECT deletion_requested_at, purge_after FROM users WHERE id = $1', [userId]);
    expect(new Date(res.body.purgeAfter)).toEqual(scheduled.purge_after);
    expect(Math.abs(scheduled.deletion_requested_at.getTime() - Date.now())).toBeLessThan(5_000);
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
    const waiting = { id: await storedUser(app) };
    await db.query(`UPDATE users SET deletion_requested_at = now(), purge_after = now() + interval '1 day' WHERE id = $1`, [waiting.id]);
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
