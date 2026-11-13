import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CLOCK } from '../src/common/clock.js';
import { GUIDE_FILES } from '../src/guides/content/index.js';
import { seedGuides } from '../src/guides/seed-guides.js';
import { guideFixtures } from '../src/guides/testing/guide-fixtures.js';
import { vietnamDate } from '../src/terms/calendar.js';
import { bootApp } from './support/app.js';
import { signedInUser } from './support/users.js';

// 12:00 on 13 November 2026 in Vietnam, the run day of GUIDE-01j.
const NOW = new Date('2026-11-13T05:00:00Z');
const TODAY = vietnamDate(NOW);
const FIXTURES = guideFixtures(TODAY);
const fixture = (id: string, lang: string) => FIXTURES.find((f) => f.id === id && f.lang === lang)!;

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
    app = await bootApp((builder) => builder.overrideProvider(CLOCK).useValue(() => NOW));
    db = app.get(DataSource);
    await seedGuides(db, [...GUIDE_FILES, ...FIXTURES]);
  });

  afterAll(async () => {
    // Seeding the content files alone withdraws the test-only guides again.
    if (db) await seedGuides(db, GUIDE_FILES);
    await app?.close();
  });

  it('lists the published guides without a token, in each language they are written in', async () => {
    const guides = await listed();
    const published = [...new Set(FIXTURES.filter((f) => f.status === 'published').map((f) => f.id))].sort();
    expect(guides.map((g) => g.id)).toEqual(published);
    const byId = Object.fromEntries(guides.map((g) => [g.id, g]));
    expect(Object.keys(byId['zz-vi-only'].texts)).toEqual(['vi']);
    expect(Object.keys(byId['zz-en-only'].texts)).toEqual(['en']);
    const fresh = fixture('zz-fresh', 'en');
    expect(byId['zz-fresh']).toEqual({
      id: 'zz-fresh',
      group: fresh.group,
      texts: {
        en: { title: fresh.title, keywords: fresh.keywords, portal: fresh.portal, version: fresh.version, lastCheckedOn: TODAY, outOfDate: false },
        vi: expect.objectContaining({ title: fixture('zz-fresh', 'vi').title }),
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
    const fresh = fixture('zz-fresh', 'en');
    // The fixture leaves citations, related and portals out: the API sends them as [].
    expect(body.texts.en).toEqual({
      title: fresh.title,
      keywords: fresh.keywords,
      portal: fresh.portal,
      version: fresh.version,
      lastCheckedOn: TODAY,
      outOfDate: false,
      changeNote: fresh.changeNote,
      lastCheckedBy: fresh.lastChecked!.by,
      summary: fresh.summary,
      when: fresh.when,
      appliesTo: fresh.appliesTo,
      prepare: fresh.prepare,
      steps: fresh.steps,
      notes: fresh.notes,
      citations: [],
      ifPortalDown: fresh.ifPortalDown,
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
    const { token } = await signedInUser(app);
    expect(await listed(token)).toEqual(await listed());
    const signedIn = await http().get('/api/guides/zz-fresh').set('Authorization', `Bearer ${token}`).expect(200);
    const signedOut = await http().get('/api/guides/zz-fresh').expect(200);
    expect(signedIn.body).toEqual(signedOut.body);
  });
});
