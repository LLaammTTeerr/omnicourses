import { INestApplication } from '@nestjs/common';
import { OpenAPIObject } from '@nestjs/swagger';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp } from './support/app.js';

const PUBLIC_ROUTES = [
  'GET /api/health',
  'GET /api/guides',
  'GET /api/guides/{id}',
  'GET /api/shared-plans/{token}',
  'POST /api/auth/sign-up',
  'POST /api/auth/sign-in',
];
const PUBLIC_WRITES = ['POST /api/auth/sign-up', 'POST /api/auth/sign-in'];

const METHODS = ['get', 'put', 'post', 'delete', 'patch'] as const;
type Method = (typeof METHODS)[number];

const PATH_PARAM = '00000000-0000-4000-8000-000000000000';

const isDocsPage = (path: string) => path === '/api/docs' || path.startsWith('/api/docs/') || path.startsWith('/api/docs-');

interface ExpressApp {
  router: { stack: { route?: { path: string; methods: Record<string, boolean> } }[] };
}

function servedRoutes(app: INestApplication): string[] {
  const { router } = app.getHttpAdapter().getInstance() as ExpressApp;
  return router.stack.flatMap(({ route }) =>
    route ? Object.keys(route.methods).map((m) => `${m.toUpperCase()} ${route.path.replace(/:(\w+)/g, '{$1}')}`) : [],
  );
}

describe('Public routes (e2e)', () => {
  let app: INestApplication;
  let routes: { method: Method; path: string; key: string }[];
  const http = () => request(app.getHttpServer());
  const call = (method: Method, path: string) => http()[method](path.replace(/\{[^}]+\}/g, PATH_PARAM));

  beforeAll(async () => {
    app = await bootApp();
    const document: OpenAPIObject = (await http().get('/api/docs-json').expect(200)).body;
    routes = Object.entries(document.paths).flatMap(([path, item]) =>
      METHODS.filter((method) => item[method]).map((method) => ({ method, path, key: `${method.toUpperCase()} ${path}` })),
    );
  });

  afterAll(async () => {
    await app?.close();
  });

  it('documents every route the app serves, except the docs pages', () => {
    const keys = routes.map((r) => r.key);
    const served = servedRoutes(app);
    expect(served).toContain('GET /api/users/me');
    const hidden = served.filter((key) => !isDocsPage(key.slice(key.indexOf(' ') + 1)) && !keys.includes(key));
    expect(hidden).toEqual([]);
  });

  it('finds every listed public route in the OpenAPI document', () => {
    const keys = routes.map((r) => r.key);
    expect(PUBLIC_ROUTES.filter((key) => !keys.includes(key))).toEqual([]);
  });

  it('answers 401 without a token on every route that is not listed', async () => {
    expect(routes.map((r) => r.key)).toContain('GET /api/users/me');
    const open: string[] = [];
    for (const { method, path, key } of routes.filter((r) => !PUBLIC_ROUTES.includes(r.key))) {
      const response = await call(method, path);
      if (response.status !== 401) open.push(`${key} answered ${response.status}`);
    }
    expect(open).toEqual([]);
  });

  it('keeps the listed public routes open', async () => {
    for (const { method, path, key } of routes.filter((r) => PUBLIC_ROUTES.includes(r.key))) {
      expect((await call(method, path)).status, key).not.toBe(401);
    }
  });

  it('lets a signed-out caller write only to sign-up and sign-in', async () => {
    const open: string[] = [];
    for (const { method, path, key } of routes.filter((r) => r.method !== 'get')) {
      if ((await call(method, path)).status !== 401) open.push(key);
    }
    expect(open.sort()).toEqual([...PUBLIC_WRITES].sort());
  });
});
