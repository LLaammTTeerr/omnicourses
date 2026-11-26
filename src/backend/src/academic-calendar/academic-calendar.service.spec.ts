import { describe, expect, it } from 'vitest';
import { datesProblem } from './academic-calendar.service.js';

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
