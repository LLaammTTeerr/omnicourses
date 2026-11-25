import { randomBytes } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp } from './support/app.js';

// ADR 0002: 10 requests a minute from one address on a route that takes a
// password, 120 on every other route. Its own app, so no other file's calls count.
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
    // An empty body answers 400, but the throttler counts it before validation.
    for (let i = 0; i < 10; i++) await http().post('/api/auth/sign-in').send({}).expect(400);
    await http().post('/api/auth/sign-in').send({}).expect(429);
  });

  it('refuses the 121st request within a minute on a route without a password', async () => {
    for (let i = 0; i < 120; i++) await http().get('/api/health').expect(200);
    await http().get('/api/health').expect(429);
  });

  // UC-09 §7, ADR 0010: a shared plan's public route is limited like any other, so tokens cannot be
  // guessed in bulk. A guess that opens nothing counts too.
  it('refuses the 121st guess of a shared-plan link within a minute', async () => {
    const guess = () => http().get(`/api/shared-plans/${randomBytes(32).toString('base64url')}`);
    for (let i = 0; i < 120; i++) await guess().expect(404);
    const refused = await guess().expect(429);
    // The refusal is an answer under the public path too: not indexed, not cached (ADR 0010).
    expect(refused.headers['x-robots-tag']).toBe('noindex, nofollow');
    expect(refused.headers['cache-control']).toBe('no-store');
  });
});

// Behind nginx every request comes from 127.0.0.1. With TRUST_PROXY=loopback the limits count the
// visitor nginx names in X-Forwarded-For; without it that header is ignored, so a client cannot
// dodge the limit by inventing addresses.
describe('Rate limits behind a proxy (e2e)', () => {
  const signIn = (app: INestApplication, ip: string) =>
    request(app.getHttpServer()).post('/api/auth/sign-in').set('X-Forwarded-For', ip).send({});

  it('counts each forwarded visitor separately when TRUST_PROXY=loopback', async () => {
    process.env.TRUST_PROXY = 'loopback';
    const app = await bootApp();
    try {
      for (let i = 0; i < 11; i++) await signIn(app, `203.0.113.${i + 1}`).expect(400);
      for (let i = 0; i < 10; i++) await signIn(app, '198.51.100.7').expect(400);
      await signIn(app, '198.51.100.7').expect(429);
    } finally {
      delete process.env.TRUST_PROXY;
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
