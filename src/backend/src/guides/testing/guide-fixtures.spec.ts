import { describe, expect, it } from 'vitest';
import { isOutOfDate } from '../out-of-date.js';
import { validateGuideSet } from '../validate-guide.js';
import { guideFixtures } from './guide-fixtures.js';

const checkedOn = (today: string, id: string) => guideFixtures(today).find((f) => f.id === id)!.lastChecked!.on;

describe('guideFixtures (TC-B1-GUIDE-01)', () => {
  it('are valid content files', () => {
    expect(validateGuideSet(guideFixtures('2026-11-13'))).toEqual([]);
  });

  it('hold the guides the test cases name, in the languages and statuses they name', () => {
    const shape = guideFixtures('2026-11-13').map((f) => `${f.id}.${f.lang}:${f.status}`);
    expect(shape).toEqual([
      'zz-fresh.vi:published',
      'zz-fresh.en:published',
      'zz-six-months.vi:published',
      'zz-six-months.en:published',
      'zz-six-months-and-a-day.vi:published',
      'zz-six-months-and-a-day.en:published',
      'zz-vi-only.vi:published',
      'zz-en-only.en:published',
      'zz-draft.vi:draft',
      'zz-draft.en:draft',
      'zz-withdrawn.vi:withdrawn',
      'zz-withdrawn.en:withdrawn',
    ]);
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

  it('put their ID in every title, so a search finds them', () => {
    for (const f of guideFixtures('2026-11-13')) expect(f.title).toContain(f.id);
  });
});
