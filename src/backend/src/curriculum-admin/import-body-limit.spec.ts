import { Body, Controller, HttpCode, INestApplication, Post, Put } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { configureApp } from '../bootstrap.js';
import { CATALOG_IMPORTS, COHORT_IMPORTS, IMPORT_JSON_LIMIT_BYTES } from './import-body-limit.js';

const KIB = 1024;
const DEFAULT_LIMIT = 100 * KIB;

// Stand-ins for the routes: they answer how much text arrived, so the test sees the parser alone.
@Controller()
class EchoController {
  @Post([`${CATALOG_IMPORTS}/preview`, `${CATALOG_IMPORTS}/confirm`, `${COHORT_IMPORTS}/preview`, `${COHORT_IMPORTS}/confirm`])
  @Post()
  @HttpCode(200)
  imports(@Body() body: { csv?: string }) {
    return { characters: body.csv?.length ?? null };
  }

  @Post(['admin/catalog/courses', `${CATALOG_IMPORTS}/preview/again`, `${CATALOG_IMPORTS}/other`, `${CATALOG_IMPORTS}`])
  @HttpCode(200)
  other(@Body() body: { csv?: string }) {
    return { characters: body.csv?.length ?? null };
  }

  @Put(`${CATALOG_IMPORTS}/preview`)
  put(@Body() body: { csv?: string }) {
    return { characters: body.csv?.length ?? null };
  }
}

const IMPORT_ROUTES = [
  '/api/admin/catalog/imports/preview',
  '/api/admin/catalog/imports/confirm',
  '/api/admin/programs/11111111-1111-4111-8111-111111111111/cohorts/22222222-2222-4222-8222-222222222222/imports/preview',
  '/api/admin/programs/11111111-1111-4111-8111-111111111111/cohorts/22222222-2222-4222-8222-222222222222/imports/confirm',
];

/** A JSON body of exactly `bytes` bytes. */
const bodyOf = (bytes: number) => `{"csv":"${'a'.repeat(bytes - '{"csv":""}'.length)}"}`;

// ADR 0011: a 7 MiB JSON limit on the four import routes only, set where the deployed app and
// the e2e app are both configured (configureApp).
describe('JSON body limits', () => {
  let app: INestApplication;
  const post = (path: string, body: string) => request(app.getHttpServer()).post(path).set('Content-Type', 'application/json').send(body);

  beforeAll(async () => {
    app = (await Test.createTestingModule({ controllers: [EchoController] }).compile()).createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('takes a body over 100 KiB, and up to exactly 7 MiB, on each of the four import routes', async () => {
    for (const path of IMPORT_ROUTES) {
      expect((await post(path, bodyOf(DEFAULT_LIMIT + 1)).expect(200)).body).toEqual({ characters: DEFAULT_LIMIT + 1 - 10 });
      expect((await post(path, bodyOf(IMPORT_JSON_LIMIT_BYTES)).expect(200)).body).toEqual({ characters: IMPORT_JSON_LIMIT_BYTES - 10 });
    }
  });

  it('refuses one byte over 7 MiB on each of them with 413 payload_too_large', async () => {
    for (const path of IMPORT_ROUTES) {
      const refused = await post(path, bodyOf(IMPORT_JSON_LIMIT_BYTES + 1)).expect(413);
      expect(refused.body).toEqual({ statusCode: 413, code: 'payload_too_large', message: 'The request body is larger than 7 MiB' });
      // The CORS headers are set before the body is read, so the browser shows this answer to the screen.
      expect(refused.headers).toHaveProperty('access-control-allow-origin');
    }
  });

  it('takes a 1 MiB CSV whose every character is escaped as six bytes of JSON', async () => {
    const body = `{"csv":"${'\\u0061'.repeat(KIB * KIB)}"}`;
    expect(Buffer.byteLength(body)).toBe(6 * KIB * KIB + 10);
    expect((await post(IMPORT_ROUTES[0], body).expect(200)).body).toEqual({ characters: KIB * KIB });
  });

  it('keeps the 100 KiB limit on every other route, which still gets its body parsed', async () => {
    const others = ['/api/admin/catalog/courses', '/api/admin/catalog/imports/preview/again', '/api/admin/catalog/imports/other', '/api/admin/catalog/imports', '/API/admin/catalog/imports/preview'];
    for (const path of others) {
      expect((await post(path, bodyOf(DEFAULT_LIMIT)).expect(200)).body).toEqual({ characters: DEFAULT_LIMIT - 10 });
      await post(path, bodyOf(DEFAULT_LIMIT + 1)).expect(413);
    }
    // The same path with another method is not an import route.
    const put = (bytes: number) => request(app.getHttpServer()).put(IMPORT_ROUTES[0]).set('Content-Type', 'application/json').send(bodyOf(bytes));
    await put(DEFAULT_LIMIT).expect(200);
    await put(DEFAULT_LIMIT + 1).expect(413);
  });

  it('answers malformed JSON on an import route with 400, like any other route', async () => {
    await post(IMPORT_ROUTES[0], '{"csv":').expect(400);
    await post('/api/admin/catalog/courses', '{"csv":').expect(400);
  });
});
