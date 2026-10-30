import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/bootstrap.js';

// Every route needs a signed-in user unless it is listed here (ADR 0002, ADR 0010).
// A new public route fails this test until it is added to the list, so the
// change shows up in the pull request for reviewers.
const PUBLIC_ROUTES = [
  'GET /api/health',
  // The only public writes: they must stay open, or nobody can get in.
  'POST /api/auth/sign-up',
  'POST /api/auth/sign-in',
];
const PUBLIC_WRITES = ['POST /api/auth/sign-up', 'POST /api/auth/sign-in'];

const METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;
type Method = (typeof METHODS)[number];

// Any well-formed value works: the auth guard runs before pipes parse the path.
const PATH_PARAM = '00000000-0000-4000-8000-000000000000';

describe('Public routes (e2e)', () => {
  let app: INestApplication;
  let routes: { method: Method; path: string; key: string }[];
  const http = () => request(app.getHttpServer());
  const call = (method: Method, path: string) => http()[method](path.replace(/\{[^}]+\}/g, PATH_PARAM));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    // The document of the whole app, as served at /api/docs-json. openapi.json is
    // built from a hand-written module list, so it could miss a route.
    const document: OpenAPIObject = configureApp(app);
    await app.get(DataSource).runMigrations({ transaction: 'each' });
    await app.init();

    routes = Object.entries(document.paths).flatMap(([path, item]) =>
      METHODS.filter((method) => item[method]).map((method) => ({ method, path, key: `${method.toUpperCase()} ${path}` })),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('finds every listed public route in the OpenAPI document', () => {
    const keys = routes.map((r) => r.key);
    expect(PUBLIC_ROUTES.filter((key) => !keys.includes(key))).toEqual([]);
  });

  it('answers 401 without a token on every route that is not listed', async () => {
    const open: string[] = [];
    for (const { method, path, key } of routes.filter((r) => !PUBLIC_ROUTES.includes(r.key))) {
      const res = await call(method, path);
      if (res.status !== 401) open.push(`${key} answered ${res.status}`);
    }
    expect(open).toEqual([]);
  });

  it('keeps the listed public routes open', async () => {
    for (const { method, path, key } of routes.filter((r) => PUBLIC_ROUTES.includes(r.key))) {
      // Sign-up and sign-in answer 400 to an empty body, which is not a 401.
      expect((await call(method, path)).status, key).not.toBe(401);
    }
  });

  it('lets a signed-out caller write only to sign-up and sign-in', () => {
    expect(PUBLIC_ROUTES.filter((key) => !key.startsWith('GET ') && !PUBLIC_WRITES.includes(key))).toEqual([]);
  });
});
