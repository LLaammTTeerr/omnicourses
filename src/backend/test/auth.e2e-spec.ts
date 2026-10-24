import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';

// Calls to sign-up/sign-in here share the 10/min PASSWORD_LIMIT (auth.controller.ts);
// at about 7 today. Adding more password calls may need a second describe with its own app.
// Synthetic, unique per run, so reruns against the same database never collide.
const email = `student-${randomUUID()}@example.com`;
const password = 'correct horse battery';

describe('Auth against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.get(DataSource).runMigrations({ transaction: 'each' });
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('protects routes by default and keeps health public', async () => {
    await http().get('/api/users/me').expect(401);
    await http().get('/api/health').expect(200);
  });

  it('requires consent and a 10+ character password at sign-up', async () => {
    await http().post('/api/auth/sign-up').send({ email, password, displayName: 'Test Student', acceptedTerms: false }).expect(400);
    await http().post('/api/auth/sign-up').send({ email, password: 'short', displayName: 'Test Student', acceptedTerms: true }).expect(400);
  });

  it('signs up, signs in, rotates, lists, revokes and signs out', async () => {
    const signUp = await http()
      .post('/api/auth/sign-up')
      .send({ email: email.toUpperCase(), password, displayName: 'Test Student', acceptedTerms: true })
      .expect(201);
    expect(signUp.body.user).toMatchObject({ email, displayName: 'Test Student' });
    expect(signUp.body.user).not.toHaveProperty('passwordHash');

    await http().post('/api/auth/sign-up').send({ email, password, displayName: 'Again', acceptedTerms: true }).expect(409);
    await http().post('/api/auth/sign-in').send({ email, password: 'wrong password!' }).expect(401);

    const signIn = await http().post('/api/auth/sign-in').send({ email, password }).expect(200);
    const first = signIn.body.token as string;
    const me = await http().get('/api/users/me').set('Authorization', `Bearer ${first}`).expect(200);
    expect(me.body.email).toBe(email);

    const refreshed = await http().post('/api/auth/refresh').set('Authorization', `Bearer ${first}`).expect(200);
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

  it('publishes the auth routes with bearer security in the OpenAPI document', async () => {
    const res = await http().get('/api/docs-json').expect(200);
    expect(res.body.paths).toHaveProperty('/api/auth/sign-in');
    expect(res.body.components.securitySchemes).toHaveProperty('bearer');
  });
});
