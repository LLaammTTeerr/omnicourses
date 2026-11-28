import { compareTerms, currentTerm, LAST_TERM_NUMBER, Term } from '../terms/term.js';

export const OFFERED_COHORTS: Readonly<Record<string, readonly number[]>> = { APCS: [2024, 2025] };

export const OFFERED_PROGRAMS = Object.keys(OFFERED_COHORTS);

export function isOfferedCohort(program: string, cohort: unknown): boolean {
  return Object.hasOwn(OFFERED_COHORTS, program) && OFFERED_COHORTS[program].includes(cohort as number);
}

export const YEARS_AHEAD = 8;

export function goalTermWindow(vietnamDay: string): { first: Term; last: Term } {
  const first = currentTerm(vietnamDay);
  return { first, last: { year: first.year + YEARS_AHEAD, number: LAST_TERM_NUMBER } };
}

export function isInGoalTermWindow(term: Term, vietnamDay: string): boolean {
  const { first, last } = goalTermWindow(vietnamDay);
  return compareTerms(term, first) >= 0 && compareTerms(term, last) <= 0;
}
