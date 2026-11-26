import { describe, expect, it } from 'vitest';
import { isCalendarDate, yearOf } from './field-validators.js';

describe('isCalendarDate', () => {
  it('accepts a YYYY-MM-DD date that exists, leap days included', () => {
    for (const d of ['2026-09-07', '2028-02-29', '2026-12-31', '2027-01-01']) expect(isCalendarDate(d)).toBe(true);
  });

  it('refuses a date that does not exist', () => {
    for (const d of ['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-04-31', '2026-01-00']) expect(isCalendarDate(d)).toBe(false);
  });

  it('refuses timestamps, other shapes and non-strings', () => {
    for (const d of ['2026-09-07T00:00:00Z', '2026-9-7', '07/09/2026', '20260907', ' 2026-09-07', '', 2026, null, undefined, new Date()]) expect(isCalendarDate(d)).toBe(false);
  });

  it('reads the calendar year', () => {
    expect(yearOf('2027-01-15')).toBe(2027);
  });
});
