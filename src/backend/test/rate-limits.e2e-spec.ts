import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp } from './support/app.js';
import { signedInUser } from './support/users.js';

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

  it('refuses the 11th sign-up within a minute', async () => {
    for (let i = 0; i < 10; i++) await http().post('/api/auth/sign-up').send({}).expect(400);
    await http().post('/api/auth/sign-up').send({}).expect(429);
  });

  it('refuses the 11th account deletion within a minute', async () => {
    const { token } = await signedInUser(app);
    const remove = () => http().delete('/api/users/me').set('Authorization', `Bearer ${token}`).send({ password: 'wrong password!' });
    for (let i = 0; i < 10; i++) await remove().expect(403);
    await remove().expect(429);
  });

  it('refuses the 121st request within a minute on a route without a password', async () => {
    for (let i = 0; i < 120; i++) await http().get('/api/health').expect(200);
    await http().get('/api/health').expect(429);
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
