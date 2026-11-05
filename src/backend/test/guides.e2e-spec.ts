import { randomBytes, randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module.js';
import { hashToken } from '../src/auth/auth.service.js';
import { configureApp } from '../src/bootstrap.js';
import { GUIDE_FILES } from '../src/guides/content/index.js';
import { GUIDES_CLOCK } from '../src/guides/guides.service.js';
import { vietnamDate } from '../src/guides/out-of-date.js';
import { seedGuides } from '../src/guides/seed-guides.js';
import { guideFixtures } from '../src/guides/testing/guide-fixtures.js';

// 12:00 on 13 November 2026 in Vietnam, the run day of GUIDE-01j.
const NOW = new Date('2026-11-13T05:00:00Z');
const TODAY = vietnamDate(NOW);

interface Listed {
  id: string;
  group: string;
  texts: Record<string, { outOfDate: boolean } & Record<string, unknown>>;
}

describe('Guides API (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;
  const http = () => request(app.getHttpServer());
  const listed = async (token?: string): Promise<Listed[]> => {
    const req = http().get('/api/guides');
    const res = await (token ? req.set('Authorization', `Bearer ${token}`) : req).expect(200);
    // Other guides may be loaded in this database; the test-only ones are this file's.
    return (res.body.guides as Listed[]).filter((g) => g.id.startsWith('zz-'));
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GUIDES_CLOCK)
      .useValue(() => NOW)
      .compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    db = app.get(DataSource);
    await db.runMigrations({ transaction: 'each' });
    await app.init();
    await seedGuides(db, [...GUIDE_FILES, ...guideFixtures(TODAY)]);
  });

  afterAll(async () => {
    // Seeding the content files alone withdraws the test-only guides again.
    if (db) await seedGuides(db, GUIDE_FILES);
    await app?.close();
  });

  it('lists the published guides without a token, in each language they are written in', async () => {
    const guides = await listed();
    expect(guides.map((g) => g.id)).toEqual(['zz-en-only', 'zz-fresh', 'zz-six-months', 'zz-six-months-and-a-day', 'zz-vi-only']);
    const byId = Object.fromEntries(guides.map((g) => [g.id, g]));
    expect(Object.keys(byId['zz-vi-only'].texts)).toEqual(['vi']);
    expect(Object.keys(byId['zz-en-only'].texts)).toEqual(['en']);
    expect(byId['zz-fresh']).toEqual({
      id: 'zz-fresh',
      group: 'registration',
      texts: {
        en: {
          title: 'Test guide zz-fresh',
          keywords: ['zz-fresh'],
          portal: { name: 'Test portal', url: 'https://example.com/portal/zz-fresh', account: 'Test account' },
          version: 1,
          lastCheckedOn: TODAY,
          outOfDate: false,
        },
        vi: expect.objectContaining({ title: 'Hướng dẫn thử zz-fresh' }),
      },
    });
  });

  it('marks only the guide checked more than 6 months ago out of date (UC-10 A5)', async () => {
    const outOfDate = (await listed()).filter((g) => Object.values(g.texts).some((t) => t.outOfDate)).map((g) => g.id);
    expect(outOfDate).toEqual(['zz-six-months-and-a-day']);
  });

  it('returns a whole guide in both languages', async () => {
    const { body } = await http().get('/api/guides/zz-fresh').expect(200);
    expect(Object.keys(body.texts).sort()).toEqual(['en', 'vi']);
    expect(body.texts.en).toEqual({
      title: 'Test guide zz-fresh',
      keywords: ['zz-fresh'],
      portal: { name: 'Test portal', url: 'https://example.com/portal/zz-fresh', account: 'Test account' },
      version: 1,
      lastCheckedOn: TODAY,
      outOfDate: false,
      changeNote: 'Test version.',
      lastCheckedBy: 'Test team',
      summary: 'A synthetic guide for testing, not a real school task.',
      when: { text: 'When the tests run.', announcement: { label: 'Test announcement', url: 'https://example.com/announcement' } },
      appliesTo: 'Test accounts',
      prepare: [{ text: 'A test account.' }],
      steps: [{ text: 'Open the test portal.' }, { text: 'Press “Gửi” (Send).' }],
      notes: [{ text: 'A test note.', source: { kind: 'team' } }],
      citations: [],
      ifPortalDown: 'Try again later.',
      related: [],
      portals: [],
    });
  });

  it('answers an unknown, draft or withdrawn guide with the same 404', async () => {
    for (const id of ['no-such-guide', 'zz-draft', 'zz-withdrawn', 'NOT A GUIDE', 'a'.repeat(65)]) {
      const res = await http().get(`/api/guides/${encodeURIComponent(id)}`).expect(404);
      expect(res.body, id).toEqual({ message: 'Guide not found', error: 'Not Found', statusCode: 404 });
    }
  });

  it('gives a signed-in reader exactly what a signed-out reader gets (GUIDE-01l)', async () => {
    const [{ id }] = await db.query(
      `INSERT INTO users (email, password_hash, display_name, consent_at) VALUES ($1, 'not-a-real-hash', 'Test Student', now()) RETURNING id`,
      [`guides-${randomUUID()}@example.com`],
    );
    const token = randomBytes(32).toString('base64url');
    await db.query(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '1 day')`, [id, hashToken(token)]);

    expect(await listed(token)).toEqual(await listed());
    const signedIn = await http().get('/api/guides/zz-fresh').set('Authorization', `Bearer ${token}`).expect(200);
    const signedOut = await http().get('/api/guides/zz-fresh').expect(200);
    expect(signedIn.body).toEqual(signedOut.body);
  });
});
