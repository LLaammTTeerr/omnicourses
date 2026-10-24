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

// Uses 4 of the 10/min password budget per IP (sign-up, delete ×2, sign-in);
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

  it('exports the account with every user table and no secret column', async () => {
    const res = await http().get('/api/users/me/export').set('Authorization', `Bearer ${token}`).expect(200);
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body.user).toMatchObject({ id: userId, email, display_name: 'Test Student' });
    expect(res.body.tables.sessions).toHaveLength(1);
    for (const t of await findUserTables(db)) expect(res.body.tables).toHaveProperty([t.table]);
    expect(allKeys(res.body).filter(isSecretColumn)).toEqual([]);
    expect(JSON.stringify(res.body)).not.toContain(token);
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

  it('purges the account and its rows once the grace period has passed', async () => {
    await http().delete('/api/users/me').set('Authorization', `Bearer ${token}`).send({ password }).expect(202);
    const purge = app.get(AccountPurgeService, { strict: false });
    await purge.purge(new Date(Date.now() + 31 * 86_400_000));
    expect(await db.query('SELECT 1 FROM users WHERE id = $1', [userId])).toEqual([]);
    expect(await db.query('SELECT 1 FROM sessions WHERE user_id = $1', [userId])).toEqual([]);
  });
});
