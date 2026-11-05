import { describe, expect, it } from 'vitest';
import { addDays, addMonths, isOutOfDate, vietnamDate } from './out-of-date.js';

describe('vietnamDate', () => {
  it('is the UTC date during the Vietnamese day', () => {
    expect(vietnamDate(new Date('2026-11-13T05:00:00Z'))).toBe('2026-11-13');
  });

  it('is already the next day between 00:00 and 07:00 in Vietnam, while the UTC date is the day before', () => {
    expect(vietnamDate(new Date('2026-11-12T17:00:00Z'))).toBe('2026-11-13');
    expect(vietnamDate(new Date('2026-11-12T16:59:59Z'))).toBe('2026-11-12');
  });
});

describe('addMonths', () => {
  it('adds and subtracts calendar months', () => {
    expect(addMonths('2026-05-13', 6)).toBe('2026-11-13');
    expect(addMonths('2026-11-13', -6)).toBe('2026-05-13');
    expect(addMonths('2026-09-15', 6)).toBe('2027-03-15');
  });

  it('moves a day the target month lacks to its last day', () => {
    expect(addMonths('2026-08-31', 6)).toBe('2027-02-28');
    expect(addMonths('2027-08-31', 6)).toBe('2028-02-29');
  });
});

describe('addDays', () => {
  it('adds days across months', () => {
    expect(addDays('2026-05-13', -1)).toBe('2026-05-12');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});

describe('isOutOfDate (UC-10 A5)', () => {
  // GUIDE-01j, run on 13 November 2026.
  it('keeps a guide checked exactly 6 months ago fresh', () => {
    expect(isOutOfDate('2026-05-13', '2026-11-13')).toBe(false);
  });

  it('marks a guide checked 6 months and a day ago out of date', () => {
    expect(isOutOfDate('2026-05-12', '2026-11-13')).toBe(true);
  });

  it('keeps a guide checked today fresh', () => {
    expect(isOutOfDate('2026-11-13', '2026-11-13')).toBe(false);
  });

  it('counts the Vietnam date, not the UTC date', () => {
    // 00:30 on 14 November in Vietnam is still 13 November in UTC.
    expect(isOutOfDate('2026-05-13', vietnamDate(new Date('2026-11-13T17:30:00Z')))).toBe(true);
  });

  it('uses the last day of a shorter month', () => {
    expect(isOutOfDate('2026-08-31', '2027-02-28')).toBe(false);
    expect(isOutOfDate('2026-08-31', '2027-03-01')).toBe(true);
  });
});
