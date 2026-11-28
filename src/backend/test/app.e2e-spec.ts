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

  it('GET /api/health reaches the database, which runs PostgreSQL 18', async () => {
    const response = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'up' });
    const [{ server_version }] = await app.get(DataSource).query('SHOW server_version');
    expect(server_version).toMatch(/^18\./);
  });

  it('serves the OpenAPI 3.2.0 document', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    expect(response.body.openapi).toBe('3.2.0');
    expect(response.body.paths).toHaveProperty('/api/health');
    expect(response.body.components.securitySchemes).toHaveProperty('bearer');
  });
});
