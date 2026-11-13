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

  // Worked out by hand: 6 months before 31 August 2027 is 28 February, which is out of date on
  // 31 August (28 Feb + 6 months = 28 Aug), so the oldest fresh date is 1 March.
  it.each([
    ['2027-08-31', '2027-03-01', '2027-02-28'],
    ['2026-03-31', '2025-10-01', '2025-09-30'],
    ['2028-08-29', '2028-02-29', '2028-02-28'],
  ])('keep the pair on each side of the boundary when the month 6 months back is shorter: %s', (today, fresh, stale) => {
    expect(checkedOn(today, 'zz-six-months')).toBe(fresh);
    expect(checkedOn(today, 'zz-six-months-and-a-day')).toBe(stale);
    expect(isOutOfDate(fresh, today)).toBe(false);
    expect(isOutOfDate(stale, today)).toBe(true);
  });
});
