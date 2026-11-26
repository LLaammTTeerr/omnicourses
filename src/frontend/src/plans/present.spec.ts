import { describe, expect, it } from 'vitest';
import type { Term } from '../terms.js';
import { capOf, commonestCredits, meter, METER_HEADROOM_CREDITS } from './present.js';
import { curriculumCourse, ELECTIVE_GROUP, group, issue } from './testing/fixtures.js';

const TERM: Term = { year: 2026, number: 1 };

describe('commonestCredits', () => {
  it('offers the credits most courses of the group carry', () => {
    const g = group(ELECTIVE_GROUP, 'Tự chọn', 'elective', [curriculumCourse('ZZ401', 'A', 4), curriculumCourse('ZZ402', 'B', 3), curriculumCourse('ZZ403', 'C', 3)]);
    expect(commonestCredits(g)).toBe(3);
  });

  it('takes the larger credits on a tie', () => {
    const g = group(ELECTIVE_GROUP, 'Tự chọn', 'elective', [curriculumCourse('ZZ401', 'A', 2), curriculumCourse('ZZ402', 'B', 4)]);
    expect(commonestCredits(g)).toBe(4);
  });
});

describe('meter', () => {
  it('runs past the maximum, so a load above it still shows', () => {
    const drawn = meter({ term: TERM, kind: 'main', credits: 25, caps: { min: 10, max: 22 } }, 25)!;
    const scale = 22 + METER_HEADROOM_CREDITS;
    expect(drawn.max).toBeCloseTo((22 / scale) * 100);
    expect(drawn.fill).toBeCloseTo((25 / scale) * 100);
    expect(drawn.fill).toBeLessThan(100);
  });

  it('draws nothing for a term with no caps on record', () => {
    expect(meter({ term: TERM, kind: null, credits: 8, caps: null }, 8)).toBeNull();
  });
});

describe('capOf', () => {
  it('reads over and under from the engine, and never judges a load itself', () => {
    expect(capOf([issue({ code: 'load_above_maximum', kind: 'violation', term: TERM })], 30)).toBe('over');
    expect(capOf([issue({ code: 'load_below_minimum', kind: 'flag', term: TERM })], 2)).toBe('under');
    expect(capOf([], 40)).toBe('ok');
    expect(capOf([], 0)).toBe('');
  });
});
