import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { GUIDE_FILES } from '../src/guides/content/index.js';
import { type GuideFile, textKey } from '../src/guides/guide-file.js';
import { GuideSeedError, seed, seedGuides } from '../src/guides/seed-guides.js';
import { guideFixtures } from '../src/guides/testing/guide-fixtures.js';
import { privateSchema } from './support/schema.js';

const FIXTURES = guideFixtures('2026-11-13');
const DRAFTS = FIXTURES.filter((f) => f.status === 'draft').length;
const PUBLISHED = FIXTURES.filter((f) => f.status === 'published')
  .map(textKey)
  .sort();

/** The fixtures with one text changed. */
const changing = (id: string, lang: string, change: Partial<GuideFile>) =>
  FIXTURES.map((f) => (f.id === id && f.lang === lang ? { ...f, ...change } : f));

// The seed tests rewrite and withdraw guides.
describe('Guide seed against PostgreSQL (e2e)', () => {
  let db: DataSource;
  let drop: (() => Promise<void>) | undefined;
  const texts = (): Promise<{ key: string; status: string; version: number; title: string; checked: string }[]> =>
    db.query(`SELECT guide_id || '.' || lang AS key, status, version, title, to_char(last_checked_on, 'YYYY-MM-DD') AS checked
              FROM guide_texts ORDER BY (guide_id || '.' || lang) COLLATE "C"`);
  const text = async (key: string) => (await texts()).find((t) => t.key === key);

  beforeAll(async () => {
    ({ dataSource: db, drop } = await privateSchema('guide_seed_e2e'));
  });

  beforeEach(async () => {
    await db.query(`DELETE FROM guides`);
  });

  afterAll(async () => {
    await drop?.();
  });

  it('loads the published texts only, then nothing more when run again', async () => {
    expect(await seedGuides(db, FIXTURES)).toEqual({ inserted: PUBLISHED.length, updated: 0, rechecked: 0, unchanged: 0, withdrawn: 0, drafts: DRAFTS });
    expect((await texts()).map((t) => t.key)).toEqual(PUBLISHED);
    expect(await seedGuides(db, FIXTURES)).toEqual({ inserted: 0, updated: 0, rechecked: 0, unchanged: PUBLISHED.length, withdrawn: 0, drafts: DRAFTS });
  });

  it('replaces a text when its version goes up', async () => {
    await seedGuides(db, FIXTURES);
    const report = await seedGuides(db, changing('zz-fresh', 'en', { version: 2, title: 'Test guide zz-fresh, revised', changeNote: 'Revised.' }));
    expect(report.updated).toBe(1);
    expect(await text('zz-fresh.en')).toMatchObject({ version: 2, title: 'Test guide zz-fresh, revised' });
  });

  it('takes a new last-checked date without a new version', async () => {
    await seedGuides(db, FIXTURES);
    const report = await seedGuides(db, changing('zz-fresh', 'en', { lastChecked: { on: '2026-11-20', by: 'Another tester' } }));
    expect(report).toMatchObject({ rechecked: 1, unchanged: PUBLISHED.length - 1 });
    expect(await text('zz-fresh.en')).toMatchObject({ version: 1, checked: '2026-11-20' });
  });

  it('refuses a change without a new version, and changes nothing', async () => {
    await seedGuides(db, FIXTURES);
    const before = await texts();
    const files = changing('zz-fresh', 'en', { title: 'Edited in place' }).map((f) =>
      f.id === 'zz-vi-only' ? { ...f, version: 2, title: 'A valid change in the same run' } : f,
    );
    await expect(seedGuides(db, files)).rejects.toThrow(/zz-fresh\.en: changed without a new version/);
    expect(await texts()).toEqual(before);
  });

  it('refuses a lower version', async () => {
    await seedGuides(db, changing('zz-fresh', 'en', { version: 2 }));
    await expect(seedGuides(db, FIXTURES)).rejects.toThrow(/zz-fresh\.en: version 1 is lower than the loaded version 2/);
  });

  it('refuses to turn a published text back into a draft', async () => {
    await seedGuides(db, FIXTURES);
    await expect(seedGuides(db, changing('zz-fresh', 'en', { status: 'draft' }))).rejects.toThrow(/zz-fresh\.en: is published/);
    expect((await text('zz-fresh.en'))?.status).toBe('published');
  });

  it('withdraws a text whose file is removed or marked withdrawn, keeps it, and shows it again when it comes back', async () => {
    await seedGuides(db, FIXTURES);
    const files = FIXTURES.filter((f) => !(f.id === 'zz-fresh' && f.lang === 'vi')).map((f) =>
      f.id === 'zz-vi-only' ? { ...f, status: 'withdrawn' as const } : f,
    );
    expect((await seedGuides(db, files)).withdrawn).toBe(2);
    expect(await text('zz-fresh.vi')).toMatchObject({ status: 'withdrawn', version: 1 });
    expect(await text('zz-vi-only.vi')).toMatchObject({ status: 'withdrawn' });
    expect((await seedGuides(db, FIXTURES)).rechecked).toBe(2);
    expect((await texts()).every((t) => t.status === 'published')).toBe(true);
  });

  it('refuses an invalid file before touching the database', async () => {
    const error = await seedGuides(db, changing('zz-fresh', 'en', { steps: [] })).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GuideSeedError);
    expect((error as GuideSeedError).problems).toEqual(['zz-fresh.en: steps needs at least one step']);
    expect(await texts()).toEqual([]);
  });

  it('db:seed loads the zz-* test guides only with --guide-fixtures, and withdraws them without it', async () => {
    const zz = async () => (await texts()).filter((t) => t.key.startsWith('zz-'));
    await seed(db, { guideFixtures: true });
    expect((await zz()).filter((t) => t.status === 'published').map((t) => t.key)).toEqual(PUBLISHED);
    await seed(db, { guideFixtures: false });
    expect((await zz()).every((t) => t.status === 'withdrawn')).toBe(true);
  });

  it('loads the content files of the repository', async () => {
    const report = await seedGuides(db, GUIDE_FILES);
    expect(report.inserted).toBe(GUIDE_FILES.filter((f) => f.status === 'published').length);
    expect(report.drafts).toBe(GUIDE_FILES.filter((f) => f.status === 'draft').length);
  });
});
