import { describe, expect, it } from 'vitest';
import { seed as seedCurricula } from './curriculum/seeds/index.js';
import { seed as seedGuides } from './guides/seed-guides.js';
import { SEEDERS } from './seeders.js';

describe('SEEDERS', () => {
  // A refused --guide-fixtures run must stop before the curricula step writes anything.
  it('runs the guides before the curricula', () => {
    expect(SEEDERS).toEqual([seedGuides, seedCurricula]);
  });
});
