import { describe, expect, it } from 'vitest';
import { isOutOfDate } from '../out-of-date.js';
import { validateGuideSet } from '../validate-guide.js';
import { addDays, guideFixtures } from './guide-fixtures.js';

const checkedOn = (today: string, id: string) => guideFixtures(today).find((f) => f.id === id)!.lastChecked!.on;

describe('addDays', () => {
  it('adds days across months', () => {
    expect(addDays('2026-05-13', -1)).toBe('2026-05-12');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('guideFixtures (TC-B1-GUIDE-01)', () => {
  it('are valid content files', () => {
    expect(validateGuideSet(guideFixtures('2026-11-13'))).toEqual([]);
  });

  it('date the six-month pair as GUIDE-01j does for a run on 13 November 2026', () => {
    expect(checkedOn('2026-11-13', 'zz-six-months')).toBe('2026-05-13');
    expect(checkedOn('2026-11-13', 'zz-six-months-and-a-day')).toBe('2026-05-12');
  });

  it('keep the pair on each side of the boundary when the month 6 months back is shorter', () => {
    for (const today of ['2026-11-13', '2027-08-31', '2026-03-31', '2028-08-29']) {
      expect(isOutOfDate(checkedOn(today, 'zz-six-months'), today), today).toBe(false);
      expect(isOutOfDate(checkedOn(today, 'zz-six-months-and-a-day'), today), today).toBe(true);
    }
  });
});
