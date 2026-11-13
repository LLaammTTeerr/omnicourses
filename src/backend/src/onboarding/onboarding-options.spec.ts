import { describe, expect, it } from 'vitest';
import type { VietnamDay } from '../terms/calendar.js';
import { goalTermWindow, isInGoalTermWindow, isOfferedCohort, OFFERED_PROGRAMS } from './onboarding-options.js';

describe('offered programs (B1 §6 item 1)', () => {
  it('offers only APCS, cohorts 2024 and 2025 (USER-01b)', () => {
    expect(OFFERED_PROGRAMS).toEqual(['APCS']);
    expect(isOfferedCohort('APCS', 2024)).toBe(true);
    expect(isOfferedCohort('APCS', 2025)).toBe(true);
  });

  it.each([
    ['APCS', 2023],
    ['APCS', 2026],
    ['APCS', '2024'],
    ['APCS', 2024.5],
    ['CLC', 2025],
    ['toString', 2024],
  ])('does not offer %s %j', (program, cohort) => {
    expect(isOfferedCohort(program, cohort)).toBe(false);
  });
});

describe('goal term window (B1 §6 item 4)', () => {
  const today = '2026-11-09' as VietnamDay;

  it('runs from the current term to term 3 eight academic years ahead', () => {
    expect(goalTermWindow(today)).toEqual({ first: { year: 2026, number: 1 }, last: { year: 2034, number: 3 } });
  });

  it.each([
    [{ year: 2026, number: 1 }, true],
    [{ year: 2034, number: 3 }, true],
    [{ year: 2027, number: 3 }, true],
    [{ year: 2025, number: 3 }, false],
    [{ year: 2035, number: 1 }, false],
  ] as const)('%j is in it: %s', (term, inside) => {
    expect(isInGoalTermWindow(term, today)).toBe(inside);
  });

  it('moves with the date: in June the current term is term 3 of the year before', () => {
    expect(isInGoalTermWindow({ year: 2026, number: 2 }, '2027-06-01' as VietnamDay)).toBe(false);
    expect(isInGoalTermWindow({ year: 2026, number: 3 }, '2027-06-01' as VietnamDay)).toBe(true);
  });
});
