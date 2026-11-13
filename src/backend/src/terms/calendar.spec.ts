import { describe, expect, it } from 'vitest';
import { currentTerm, vietnamDate, type VietnamDay } from './calendar.js';

describe('vietnamDate', () => {
  it('is the UTC date during the Vietnamese day', () => {
    expect(vietnamDate(new Date('2026-11-13T05:00:00Z'))).toBe('2026-11-13');
  });

  it('is already the next day between 00:00 and 07:00 in Vietnam, while the UTC date is the day before', () => {
    expect(vietnamDate(new Date('2026-11-12T17:00:00Z'))).toBe('2026-11-13');
    expect(vietnamDate(new Date('2026-11-12T16:59:59Z'))).toBe('2026-11-12');
  });
});

describe('currentTerm', () => {
  it.each([
    ['2026-09-01', { year: 2026, number: 1 }],
    ['2026-11-09', { year: 2026, number: 1 }],
    ['2026-12-31', { year: 2026, number: 1 }],
    ['2027-01-01', { year: 2026, number: 2 }],
    ['2027-05-31', { year: 2026, number: 2 }],
    ['2027-06-01', { year: 2026, number: 3 }],
    ['2027-08-31', { year: 2026, number: 3 }],
  ])('on %s is %j', (day, term) => {
    expect(currentTerm(day as VietnamDay)).toEqual(term);
  });

  it('refuses a value that is not a date', () => {
    expect(() => currentTerm('soon' as VietnamDay)).toThrow(RangeError);
  });
});
