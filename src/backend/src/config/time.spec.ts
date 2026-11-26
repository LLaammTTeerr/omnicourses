import { describe, expect, it } from 'vitest';
import { addDays, DAY_MS, msUntilVietnamMidnight, vietnamDate } from './time.js';

describe('vietnamDate', () => {
  it('changes day at 17:00:00 UTC exactly', () => {
    expect(vietnamDate(new Date('2026-12-01T16:59:59.999Z'))).toBe('2026-12-01');
    expect(vietnamDate(new Date('2026-12-01T17:00:00.000Z'))).toBe('2026-12-02');
  });

  it('crosses a month and a year', () => {
    expect(vietnamDate(new Date('2026-12-31T16:59:59Z'))).toBe('2026-12-31');
    expect(vietnamDate(new Date('2026-12-31T17:00:00Z'))).toBe('2027-01-01');
  });
});

describe('msUntilVietnamMidnight', () => {
  it('counts down to 17:00:00 UTC', () => {
    expect(msUntilVietnamMidnight(new Date('2026-12-01T16:59:59.000Z'))).toBe(1000);
    expect(msUntilVietnamMidnight(new Date('2026-12-01T05:00:00.000Z'))).toBe(12 * 3_600_000);
  });

  it('is a whole day at midnight itself, never zero', () => {
    expect(msUntilVietnamMidnight(new Date('2026-12-01T17:00:00.000Z'))).toBe(DAY_MS);
  });

  it('lands on the first instant of the next Vietnam day', () => {
    const now = new Date('2026-12-01T09:12:34.567Z');
    const next = new Date(now.getTime() + msUntilVietnamMidnight(now));
    expect(next.toISOString()).toBe('2026-12-01T17:00:00.000Z');
    expect(vietnamDate(next)).toBe(addDays(vietnamDate(now), 1));
  });
});

describe('addDays', () => {
  it('adds and subtracts whole days across months, years and a leap day', () => {
    expect(addDays('2026-12-02', 7)).toBe('2026-12-09');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-01-04', -7)).toBe('2026-12-28');
    expect(addDays('2026-12-02', 0)).toBe('2026-12-02');
    expect(addDays('2026-05-13', -1)).toBe('2026-05-12');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });
});
