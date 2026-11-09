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
});
