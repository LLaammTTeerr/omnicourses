import { gzipSync } from 'node:zlib';
import { Body, Controller, HttpCode, INestApplication, Post, Put } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { configureApp } from '../bootstrap.js';
import type { Need } from '../admin-access/grants.js';
import { CATALOG_IMPORTS, COHORT_IMPORTS, ImportBodyGate } from './import-body-limit.js';

const KIB = 1024;
const SEVEN_MIB = 7 * KIB * KIB;
const DEFAULT_LIMIT = 100 * KIB;
const LONG_LOOP_TIMEOUT_MS = 60_000;
const PROGRAM = '11111111-1111-4111-8111-111111111111';
const OTHER_PROGRAM = '33333333-3333-4333-8333-333333333333';

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
const GRANTED: [string, string][] = [...CATALOG_ROUTES.map((path): [string, string] => [path, MAINTAINER]), ...COHORT_ROUTES.map((path): [string, string] => [path, ADMINISTRATOR])];

const bodyOf = (bytes: number) => `{"csv":"${'a'.repeat(bytes - '{"csv":""}'.length)}"}`;
const DEFAULT_REFUSAL = { statusCode: 413, message: 'request entity too large' };

describe('JSON body limits', () => {
  let app: INestApplication;
  let asked: [string | undefined, Need][];
  let gateFails = false;
  const post = (path: string, body: string | Buffer, authorization?: string) => {
    const test = request(app.getHttpServer()).post(path).set('Content-Type', 'application/json');
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
      expect((await post(path, bodyOf(SEVEN_MIB), caller).expect(200)).body).toEqual({ characters: SEVEN_MIB - 10 });
    }
    expect(asked.filter((_, i) => i % 2 === 0)).toEqual([
      [MAINTAINER, { permission: 'catalog_maintainer' }],
      [MAINTAINER, { permission: 'catalog_maintainer' }],
      [ADMINISTRATOR, { program: PROGRAM }],
      [ADMINISTRATOR, { program: PROGRAM }],
    ]);
  });

  it('refuses one byte over 7 MiB from them with 413 payload_too_large', async () => {
    for (const [path, caller] of GRANTED) {
      const refused = await post(path, bodyOf(SEVEN_MIB + 1), caller).expect(413);
      expect(refused.body).toEqual({ statusCode: 413, code: 'payload_too_large', message: 'The request body is larger than 7 MiB' });
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
        [path, undefined],
        [path, 'Bearer no-such-session'],
        [path, STRANGER],
      ]),
      ...CATALOG_ROUTES.map((path): [string, string] => [path, ADMINISTRATOR]),
      ...COHORT_ROUTES.map((path): [string, string] => [path, MAINTAINER]),
      [`${cohort(OTHER_PROGRAM)}/preview`, ADMINISTRATOR],
      [`${cohort(OTHER_PROGRAM)}/confirm`, ADMINISTRATOR],
    ];
    for (const [path, caller] of callers) {
      expect((await post(path, bodyOf(DEFAULT_LIMIT), caller).expect(200)).body).toEqual({ characters: DEFAULT_LIMIT - 10 });
      for (const bytes of [DEFAULT_LIMIT + 1, SEVEN_MIB]) expect([path, caller, (await post(path, bodyOf(bytes), caller).expect(413)).body]).toEqual([path, caller, DEFAULT_REFUSAL]);
    }
  }, LONG_LOOP_TIMEOUT_MS);

  it('gives nobody the large parser when the gate fails', async () => {
    gateFails = true;
    for (const [path, caller] of GRANTED) {
      await post(path, bodyOf(DEFAULT_LIMIT), caller).expect(200);
      expect((await post(path, bodyOf(DEFAULT_LIMIT + 1), caller).expect(413)).body).toEqual(DEFAULT_REFUSAL);
    }
  });

  it('never inflates a body on an import route: 415 for every caller, before the gate is asked', async () => {
    const small = gzipSync(bodyOf(200));
    const bomb = gzipSync(bodyOf(SEVEN_MIB));
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
    expect((await post(CATALOG_ROUTES[0], bodyOf(200), MAINTAINER).set('Content-Encoding', 'identity').expect(200)).body).toEqual({ characters: 190 });
    expect((await post('/api/admin/catalog/courses', small).set('Content-Encoding', 'gzip').expect(200)).body).toEqual({ characters: 190 });
    await post('/api/admin/catalog/courses', bomb).set('Content-Encoding', 'gzip').expect(413);
  }, LONG_LOOP_TIMEOUT_MS);

  it('keeps the 100 KiB limit on every other route, which still gets its body parsed, whoever calls', async () => {
    const others = ['/api/admin/catalog/courses', '/api/admin/catalog/imports/preview/again', '/api/admin/catalog/imports/other', '/api/admin/catalog/imports', '/API/admin/catalog/imports/preview'];
    for (const path of others) {
      expect((await post(path, bodyOf(DEFAULT_LIMIT), MAINTAINER).expect(200)).body).toEqual({ characters: DEFAULT_LIMIT - 10 });
      expect((await post(path, bodyOf(DEFAULT_LIMIT + 1), MAINTAINER).expect(413)).body).toEqual(DEFAULT_REFUSAL);
    }
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
