import { afterEach, describe, expect, it, vi } from 'vitest';
import { guideFixtures } from './testing/guide-fixtures.js';
import { contentHash, seed } from './seed-guides.js';

const file = guideFixtures('2026-11-13')[0];

describe('contentHash', () => {
  it('ignores key order', () => {
    const reordered = Object.fromEntries(Object.entries(file).reverse()) as typeof file;
    expect(contentHash(reordered)).toBe(contentHash(file));
  });

  it('ignores the last-checked date, so a re-check needs no new version', () => {
    expect(contentHash({ ...file, lastChecked: { on: '2027-01-02', by: 'Someone else' } })).toBe(contentHash(file));
  });

  it('changes with any text a reader sees', () => {
    expect(contentHash({ ...file, steps: [{ text: 'Another step.' }] })).not.toBe(contentHash(file));
    expect(contentHash({ ...file, title: 'Another title' })).not.toBe(contentHash(file));
  });
});

describe('seed', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('refuses the test guides on a production server, where they would be published, before touching the database', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const dataSource = { transaction: vi.fn() };
    await expect(seed(dataSource as never, { guideFixtures: true })).rejects.toThrow(
      '--guide-fixtures publishes the zz-* test guides: refused when NODE_ENV is production',
    );
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });
});
