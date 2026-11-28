import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { bootApp } from './support/app.js';
import { PASSWORD as password } from './support/users.js';

const email = `student-${randomUUID()}@example.com`;

describe('Auth against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await bootApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  afterEach(() => vi.unstubAllEnvs());

  it('requires consent and a 10+ character password at sign-up', async () => {
    await http().post('/api/auth/sign-up').send({ email, password, displayName: 'Test Student', acceptedTerms: false }).expect(400);
    await http().post('/api/auth/sign-up').send({ email, password: 'short', displayName: 'Test Student', acceptedTerms: true }).expect(400);
  });

  it('signs up, signs in, rotates, lists, revokes and signs out', async () => {
    const signUp = await http()
      .post('/api/auth/sign-up')
      .send({ email: email.toUpperCase(), password, displayName: 'Test Student', acceptedTerms: true })
      .expect(201);
    expect(signUp.body).toMatchObject({ user: { email, displayName: 'Test Student' }, accountRestored: false });
    expect(signUp.body.user).not.toHaveProperty('passwordHash');

    await http().post('/api/auth/sign-up').send({ email, password, displayName: 'Again', acceptedTerms: true }).expect(409);
    await http().post('/api/auth/sign-in').send({ email, password: 'wrong password!' }).expect(401);

    const signIn = await http().post('/api/auth/sign-in').send({ email, password }).expect(200);
    const first = signIn.body.token as string;
    const me = await http().get('/api/users/me').set('Authorization', `Bearer ${first}`).expect(200);
    expect(me.body.email).toBe(email);

    const refreshed = await http().post('/api/auth/refresh').set('Authorization', `Bearer ${first}`).expect(200);
    expect(refreshed.body.accountRestored).toBe(false);
    const second = refreshed.body.token as string;
    await http().get('/api/users/me').set('Authorization', `Bearer ${first}`).expect(401);
    await http().get('/api/users/me').set('Authorization', `Bearer ${second}`).expect(200);

    const list = await http().get('/api/auth/sessions').set('Authorization', `Bearer ${second}`).expect(200);
    expect(list.body).toHaveLength(2);
    const other = list.body.find((s: { current: boolean }) => !s.current);
    await http().delete(`/api/auth/sessions/${other.id}`).set('Authorization', `Bearer ${second}`).expect(204);
    await http().get('/api/users/me').set('Authorization', `Bearer ${signUp.body.token}`).expect(401);

    await http().post('/api/auth/sign-out').set('Authorization', `Bearer ${second}`).expect(204);
    await http().get('/api/users/me').set('Authorization', `Bearer ${second}`).expect(401);
  });

  it('answers 201 and 409 to two concurrent sign-ups with one email', async () => {
    const body = { email: `student-${randomUUID()}@example.com`, password, displayName: 'Test Student', acceptedTerms: true };
    const statuses = (await Promise.all([1, 2].map(() => http().post('/api/auth/sign-up').send(body)))).map((r) => r.status);
    expect(statuses.sort()).toEqual([201, 409]);
  });

  it('persists sign-in attempt limits across separate app instances in PostgreSQL without locking out other accounts', async () => {
    vi.stubEnv('TRUST_PROXY', 'loopback');
    const firstApp = await bootApp();
    const secondApp = await bootApp();
    try {
      const targetEmail = `student-${randomUUID()}@example.com`;
      const otherEmail = `student-${randomUUID()}@example.com`;
      await request(firstApp.getHttpServer())
        .post('/api/auth/sign-up')
        .set('X-Forwarded-For', '198.51.100.21')
        .send({ email: targetEmail, password, displayName: 'Target', acceptedTerms: true })
        .expect(201);
      await request(firstApp.getHttpServer())
        .post('/api/auth/sign-up')
        .set('X-Forwarded-For', '198.51.100.22')
        .send({ email: otherEmail, password, displayName: 'Other', acceptedTerms: true })
        .expect(201);

      for (let i = 0; i < 6; i++) {
        await request(firstApp.getHttpServer())
          .post('/api/auth/sign-in')
          .set('X-Forwarded-For', '203.0.113.77')
          .send({ email: targetEmail, password: 'wrong password!' })
          .expect(401);
      }
      for (let i = 0; i < 4; i++) {
        await request(secondApp.getHttpServer())
          .post('/api/auth/sign-in')
          .set('X-Forwarded-For', '203.0.113.77')
          .send({ email: targetEmail, password: 'wrong password!' })
          .expect(401);
      }
      await request(secondApp.getHttpServer())
        .post('/api/auth/sign-in')
        .set('X-Forwarded-For', '203.0.113.77')
        .send({ email: targetEmail, password })
        .expect(429);

      await request(secondApp.getHttpServer())
        .post('/api/auth/sign-in')
        .set('X-Forwarded-For', '198.51.100.22')
        .send({ email: otherEmail, password })
        .expect(200);
    } finally {
      await firstApp.close();
      await secondApp.close();
    }
  });
});
