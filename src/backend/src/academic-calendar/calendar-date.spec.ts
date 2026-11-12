import { describe, expect, it } from 'vitest';
import { datesProblem } from './academic-calendar.service.js';
import { isCalendarDate, yearOf } from './calendar-date.js';

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

describe('datesProblem', () => {
  it('accepts a one-day date and a range within the academic year', () => {
    expect(datesProblem({ academicYear: 2026, startsOn: '2026-09-07', endsOn: '2026-09-07' })).toBeNull();
    expect(datesProblem({ academicYear: 2026, startsOn: '2027-06-01', endsOn: '2027-08-15' })).toBeNull();
  });

  it('refuses an end before the start', () => {
    expect(datesProblem({ academicYear: 2026, startsOn: '2026-09-07', endsOn: '2026-09-06' })).toMatch(/^endsOn: /);
  });

  it('refuses a first day outside the two calendar years of the academic year', () => {
    expect(datesProblem({ academicYear: 2026, startsOn: '2025-12-31', endsOn: '2026-01-02' })).toMatch(/^startsOn: .*2026–2027/);
    expect(datesProblem({ academicYear: 2026, startsOn: '2028-01-01', endsOn: '2028-01-01' })).toMatch(/^startsOn: /);
  });
});
