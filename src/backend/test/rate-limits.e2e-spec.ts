import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { bootApp } from './support/app.js';
import { signedInUser } from './support/users.js';

describe('Rate limits (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await bootApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('refuses the 11th sign-in within a minute', async () => {
    for (let i = 0; i < 10; i++) await http().post('/api/auth/sign-in').send({}).expect(400);
    await http().post('/api/auth/sign-in').send({}).expect(429);
  });

  it('refuses the 121st request within a minute on a route without a password', async () => {
    for (let i = 0; i < 120; i++) await http().get('/api/health').expect(200);
    await http().get('/api/health').expect(429);
  });

  it('counts each route on its own: the 121st save of a plan is refused while the plan list still answers (issue #117)', async () => {
    const { token } = await signedInUser(app);
    const auth = { Authorization: `Bearer ${token}` };
    const save = () => http().put(`/api/plans/${randomUUID()}/placements`).set(auth).send({ terms: [] });
    for (let i = 0; i < 120; i++) await save().expect(404);
    await save().expect(429);
    await http().get('/api/plans').set(auth).expect(200);
  });

  it('refuses the 121st guess of a shared-plan link within a minute', async () => {
    const guess = () => http().get(`/api/shared-plans/${randomBytes(32).toString('base64url')}`);
    for (let i = 0; i < 120; i++) await guess().expect(404);
    const refused = await guess().expect(429);
    expect(refused.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(refused.headers['cache-control']).toBe('no-store');
  });
});

describe('Rate limits behind a proxy (e2e)', () => {
  afterEach(() => vi.unstubAllEnvs());

  const signIn = (app: INestApplication, ip: string) =>
    request(app.getHttpServer()).post('/api/auth/sign-in').set('X-Forwarded-For', ip).send({});

  it('counts each forwarded visitor separately when TRUST_PROXY=loopback', async () => {
    vi.stubEnv('TRUST_PROXY', 'loopback');
    const app = await bootApp();
    try {
      for (let i = 0; i < 11; i++) await signIn(app, `203.0.113.${i + 1}`).expect(400);
      for (let i = 0; i < 10; i++) await signIn(app, '198.51.100.7').expect(400);
      await signIn(app, '198.51.100.7').expect(429);
    } finally {
      await app.close();
    }
  });

  it('ignores X-Forwarded-For when TRUST_PROXY is unset', async () => {
    const app = await bootApp();
    try {
      for (let i = 0; i < 10; i++) await signIn(app, `203.0.113.${i + 1}`).expect(400);
      await signIn(app, '203.0.113.99').expect(429);
    } finally {
      await app.close();
    }
  });
});
