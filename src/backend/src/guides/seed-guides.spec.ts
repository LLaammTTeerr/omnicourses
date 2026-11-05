import { describe, expect, it } from 'vitest';
import { guideFixtures } from './testing/guide-fixtures.js';
import { contentHash, contentOf } from './seed-guides.js';

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

describe('contentOf', () => {
  it('leaves out the fields stored in their own columns', () => {
    expect(Object.keys(contentOf(file)).sort()).toEqual(['appliesTo', 'ifPortalDown', 'notes', 'portal', 'prepare', 'steps', 'summary', 'when']);
  });
});
