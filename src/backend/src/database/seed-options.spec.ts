import { describe, expect, it } from 'vitest';
import { parseSeedOptions } from './seed-options.js';

describe('parseSeedOptions', () => {
  it('turns guide fixtures on only when the flag is given', () => {
    expect(parseSeedOptions(['node', 'seed.js'])).toEqual({ guideFixtures: false });
    expect(parseSeedOptions(['node', 'seed.js', '--guide-fixtures'])).toEqual({ guideFixtures: true });
  });
});
