import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp } from './support/app.js';

describe('API against PostgreSQL (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await bootApp();
  });

  afterAll(async () => {
    await app?.close();
  });

  // The route is public, so it no longer names the version (issue #28); the pin is checked here.
  it('GET /api/health reaches the database, which runs PostgreSQL 18', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
    const [{ server_version }] = await app.get(DataSource).query('SHOW server_version');
    expect(server_version).toMatch(/^18\./);
  });

  it('serves the OpenAPI 3.2.0 document', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(res.body.openapi).toBe('3.2.0');
    expect(res.body.paths).toHaveProperty('/api/health');
    expect(res.body.components.securitySchemes).toHaveProperty('bearer');
  });
});
