import { gzipSync } from 'node:zlib';
import { Body, Controller, HttpCode, INestApplication, Post, Put } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../bootstrap.js';
import type { Need } from './grants.js';
import { CATALOG_IMPORTS, COHORT_IMPORTS, IMPORT_JSON_LIMIT_BYTES, ImportBodyGate } from './import-body-limit.js';

const KIB = 1024;
const DEFAULT_LIMIT = 100 * KIB;
const PROGRAM = '11111111-1111-4111-8111-111111111111';
const OTHER_PROGRAM = '33333333-3333-4333-8333-333333333333';

// Stand-ins for the routes: they answer how much text arrived, so the test sees the parser alone.
@Controller()
class EchoController {
  @Post([`${CATALOG_IMPORTS}/preview`, `${CATALOG_IMPORTS}/confirm`, `${COHORT_IMPORTS}/preview`, `${COHORT_IMPORTS}/confirm`])
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

const cohort = (program: string) => `/api/admin/programs/${program}/cohorts/22222222-2222-4222-8222-222222222222/imports`;
const CATALOG_ROUTES = ['/api/admin/catalog/imports/preview', '/api/admin/catalog/imports/confirm'];
const COHORT_ROUTES = [`${cohort(PROGRAM)}/preview`, `${cohort(PROGRAM)}/confirm`];
const MAINTAINER = 'Bearer catalog-maintainer';
const ADMINISTRATOR = 'Bearer program-administrator';
const STRANGER = 'Bearer signed-in-without-a-grant';
/** Each route with the caller who holds its grant. */
const GRANTED: [string, string][] = [...CATALOG_ROUTES.map((path): [string, string] => [path, MAINTAINER]), ...COHORT_ROUTES.map((path): [string, string] => [path, ADMINISTRATOR])];

/** A JSON body of exactly `bytes` bytes. */
const bodyOf = (bytes: number) => `{"csv":"${'a'.repeat(bytes - '{"csv":""}'.length)}"}`;
const DEFAULT_REFUSAL = { statusCode: 413, message: 'request entity too large' };

// ADR 0011: a 7 MiB JSON limit on the four import routes only, set where the deployed app and
// the e2e app are both configured (configureApp), and only for a caller the gate allows.
// The gate here is a stand-in for ImportBodyGate, whose session and grant lookups the e2e
// tests exercise: one catalog maintainer, one administrator of PROGRAM, and a database that
// fails on demand.
describe('JSON body limits', () => {
  let app: INestApplication;
  let asked: [string | undefined, Need][];
  let gateFails = false;
  const post = (path: string, body: string | Buffer, authorization?: string) => {
    const test = request(app.getHttpServer()).post(path).set('Content-Type', 'application/json');
    // A string or a Buffer is sent as it is: the test controls the exact bytes.
    return (authorization ? test.set('Authorization', authorization) : test).serialize((bytes) => bytes as string).send(body);
  };

  beforeAll(async () => {
    const gate = {
      allows: async (authorization: string | undefined, need: Need) => {
        asked.push([authorization, need]);
        if (gateFails) throw new Error('database down');
        return 'permission' in need ? authorization === MAINTAINER : authorization === ADMINISTRATOR && need.program === PROGRAM;
      },
    };
    app = (await Test.createTestingModule({ controllers: [EchoController], providers: [{ provide: ImportBodyGate, useValue: gate }] }).compile()).createNestApplication();
    configureApp(app);
    await app.init();
  });

  beforeEach(() => {
    asked = [];
    gateFails = false;
  });

  afterAll(async () => {
    await app?.close();
  });

  it('takes a body over 100 KiB, and up to exactly 7 MiB, from the holder of the grant of each import route', async () => {
    for (const [path, caller] of GRANTED) {
      expect((await post(path, bodyOf(DEFAULT_LIMIT + 1), caller).expect(200)).body).toEqual({ characters: DEFAULT_LIMIT + 1 - 10 });
      expect((await post(path, bodyOf(IMPORT_JSON_LIMIT_BYTES), caller).expect(200)).body).toEqual({ characters: IMPORT_JSON_LIMIT_BYTES - 10 });
    }
    // The gate was asked for the grant of the route family: the catalog permission, or the program of the path.
    expect(asked.filter((_, i) => i % 2 === 0)).toEqual([
      [MAINTAINER, { permission: 'catalog_maintainer' }],
      [MAINTAINER, { permission: 'catalog_maintainer' }],
      [ADMINISTRATOR, { program: PROGRAM }],
      [ADMINISTRATOR, { program: PROGRAM }],
    ]);
  });

  it('refuses one byte over 7 MiB from them with 413 payload_too_large', async () => {
    for (const [path, caller] of GRANTED) {
      const refused = await post(path, bodyOf(IMPORT_JSON_LIMIT_BYTES + 1), caller).expect(413);
      expect(refused.body).toEqual({ statusCode: 413, code: 'payload_too_large', message: 'The request body is larger than 7 MiB' });
      // The CORS headers are set before the body is read, so the browser shows this answer to the screen.
      expect(refused.headers).toHaveProperty('access-control-allow-origin');
    }
  });

  it('takes a 1 MiB CSV whose every character is escaped as six bytes of JSON', async () => {
    const body = `{"csv":"${'\\u0061'.repeat(KIB * KIB)}"}`;
    expect(Buffer.byteLength(body)).toBe(6 * KIB * KIB + 10);
    expect((await post(CATALOG_ROUTES[0], body, MAINTAINER).expect(200)).body).toEqual({ characters: KIB * KIB });
  });

  it('gives a caller without a session, or without the grant of the route, the 100 KiB limit of every other route', async () => {
    const callers: [string, string | undefined][] = [
      ...[...CATALOG_ROUTES, ...COHORT_ROUTES].flatMap((path): [string, string | undefined][] => [
        [path, undefined], // signed out
        [path, 'Bearer no-such-session'],
        [path, STRANGER],
      ]),
      // A grant of the other family, or of another program, is not the grant of the route.
      ...CATALOG_ROUTES.map((path): [string, string] => [path, ADMINISTRATOR]),
      ...COHORT_ROUTES.map((path): [string, string] => [path, MAINTAINER]),
      [`${cohort(OTHER_PROGRAM)}/preview`, ADMINISTRATOR],
      [`${cohort(OTHER_PROGRAM)}/confirm`, ADMINISTRATOR],
    ];
    for (const [path, caller] of callers) {
      // Under the small limit the default parser reads the body, and the route's own 401 or 403 follows.
      expect((await post(path, bodyOf(DEFAULT_LIMIT), caller).expect(200)).body).toEqual({ characters: DEFAULT_LIMIT - 10 });
      // Over it, the default parser refuses: its answer, not the import's, and nothing is read
      // beyond the declared length, whether that is one byte over or 7 MiB.
      for (const bytes of [DEFAULT_LIMIT + 1, IMPORT_JSON_LIMIT_BYTES]) expect([path, caller, (await post(path, bodyOf(bytes), caller).expect(413)).body]).toEqual([path, caller, DEFAULT_REFUSAL]);
    }
  });

  it('gives nobody the large parser when the gate fails', async () => {
    gateFails = true;
    for (const [path, caller] of GRANTED) {
      await post(path, bodyOf(DEFAULT_LIMIT), caller).expect(200);
      expect((await post(path, bodyOf(DEFAULT_LIMIT + 1), caller).expect(413)).body).toEqual(DEFAULT_REFUSAL);
    }
  });

  it('never inflates a body on an import route: 415 for every caller, before the gate is asked', async () => {
    const small = gzipSync(bodyOf(200));
    // About 7 KiB on the wire, 7 MiB once inflated.
    const bomb = gzipSync(bodyOf(IMPORT_JSON_LIMIT_BYTES));
    expect(bomb.length).toBeLessThan(10 * KIB);
    for (const [path, granted] of GRANTED) {
      for (const caller of [undefined, STRANGER, granted]) {
        for (const body of [small, bomb]) {
          const refused = await post(path, body, caller).set('Content-Encoding', 'gzip').expect(415);
          expect(refused.body).toEqual({ statusCode: 415, code: 'unsupported_content_encoding', message: 'The import routes do not accept a compressed request body' });
        }
      }
    }
    expect(asked).toEqual([]);
    // "identity" is no encoding; and another route still inflates, within its own 100 KiB.
    expect((await post(CATALOG_ROUTES[0], bodyOf(200), MAINTAINER).set('Content-Encoding', 'identity').expect(200)).body).toEqual({ characters: 190 });
    expect((await post('/api/admin/catalog/courses', small).set('Content-Encoding', 'gzip').expect(200)).body).toEqual({ characters: 190 });
    await post('/api/admin/catalog/courses', bomb).set('Content-Encoding', 'gzip').expect(413);
  });

  it('keeps the 100 KiB limit on every other route, which still gets its body parsed, whoever calls', async () => {
    const others = ['/api/admin/catalog/courses', '/api/admin/catalog/imports/preview/again', '/api/admin/catalog/imports/other', '/api/admin/catalog/imports', '/API/admin/catalog/imports/preview'];
    for (const path of others) {
      expect((await post(path, bodyOf(DEFAULT_LIMIT), MAINTAINER).expect(200)).body).toEqual({ characters: DEFAULT_LIMIT - 10 });
      expect((await post(path, bodyOf(DEFAULT_LIMIT + 1), MAINTAINER).expect(413)).body).toEqual(DEFAULT_REFUSAL);
    }
    // The same path with another method is not an import route.
    const put = (bytes: number) => request(app.getHttpServer()).put(CATALOG_ROUTES[0]).set('Content-Type', 'application/json').set('Authorization', MAINTAINER).send(bodyOf(bytes));
    await put(DEFAULT_LIMIT).expect(200);
    await put(DEFAULT_LIMIT + 1).expect(413);
    expect(asked).toEqual([]);
  });

  it('answers malformed JSON on an import route with 400, like any other route', async () => {
    await post(CATALOG_ROUTES[0], '{"csv":', MAINTAINER).expect(400);
    await post(CATALOG_ROUTES[0], '{"csv":').expect(400);
    await post('/api/admin/catalog/courses', '{"csv":').expect(400);
  });
});
