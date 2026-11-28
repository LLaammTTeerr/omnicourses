import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildOpenApiConfig, configureApp } from './bootstrap.js';

describe('OpenAPI contract', () => {
  it('declares the bearer token as opaque, not a JWT', () => {
    const config = buildOpenApiConfig();

    expect(config.components?.securitySchemes?.bearer).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'opaque',
    });
    expect(JSON.stringify(config)).not.toMatch(/jwt/i);
  });
});

describe('configureApp', () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.unstubAllEnvs();
  });

  async function boot(): Promise<ReturnType<typeof request>> {
    app = (await Test.createTestingModule({}).compile()).createNestApplication();
    configureApp(app);
    await app.init();
    return request(app.getHttpServer());
  }

  it('serves the API docs outside production only', async () => {
    await (await boot()).get('/api/docs-json').expect(200);
    await app!.close();

    vi.stubEnv('NODE_ENV', 'production');
    const http = await boot();
    await http.get('/api/docs').expect(404);
    await http.get('/api/docs-json').expect(404);
  });

  it('serves them in production when API_DOCS=true, for a staging server', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('API_DOCS', 'true');
    await (await boot()).get('/api/docs-json').expect(200);
  });

  it('still builds the OpenAPI document in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    app = (await Test.createTestingModule({}).compile()).createNestApplication();
    expect(configureApp(app).openapi).toBe('3.2.0');
  });

  it('does not advertise the framework', async () => {
    const response = await (await boot()).get('/api/anything');
    expect(response.headers).not.toHaveProperty('x-powered-by');
  });

  it('sets default security headers on every response', async () => {
    const response = await (await boot()).get('/api/anything');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBe('DENY');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});
