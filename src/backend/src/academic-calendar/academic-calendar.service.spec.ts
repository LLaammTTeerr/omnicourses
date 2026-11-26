import { getMetadataArgsStorage } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { MAX_ACADEMIC_YEAR, MIN_ACADEMIC_YEAR, TERM_NUMBERS } from '../terms/term.js';
import { AcademicCalendarEvent, CALENDAR_EVENT_KINDS } from './academic-calendar-event.entity.js';
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

describe('the CHECK constraints of academic_calendar', () => {
  const checkOf = (name: string) => getMetadataArgsStorage().checks.find((check) => check.target === AcademicCalendarEvent && check.name === name)?.expression;

  it('allow exactly the kinds, terms and years the API accepts', () => {
    expect(checkOf('ck_academic_calendar_kind')).toBe(`"kind" IN (${CALENDAR_EVENT_KINDS.map((kind) => `'${kind}'`).join(', ')})`);
    expect(checkOf('ck_academic_calendar_term')).toBe(`"term" IN (${TERM_NUMBERS.join(', ')})`);
    expect(checkOf('ck_academic_calendar_academic_year')).toBe(`"academic_year" BETWEEN ${MIN_ACADEMIC_YEAR} AND ${MAX_ACADEMIC_YEAR}`);
  });
});
