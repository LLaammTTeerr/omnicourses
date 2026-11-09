import { compareTerms, currentTerm } from '../terms/current-term.js';
import { Term } from '../terms/term.js';

// B1 test cases §6 item 1 (Lâm, 9 November 2026): onboarding offers only APCS, cohorts 2024 and
// 2025. The CLC curricula are seeded but not offered until they are verified, so the seeded
// tables alone can't answer which ones a student may pick.
// TODO: switch to CurriculumService (offered curricula) once the curriculum module lands.
export const OFFERED_COHORTS: Readonly<Record<string, readonly number[]>> = { APCS: [2024, 2025] };

export const OFFERED_PROGRAMS = Object.keys(OFFERED_COHORTS);

/** True when the program is offered and the cohort is one of its offered cohorts. */
export function isOfferedCohort(program: string, cohort: unknown): boolean {
  return Object.hasOwn(OFFERED_COHORTS, program) && OFFERED_COHORTS[program].includes(cohort as number);
}

// B1 test cases §6 item 4 (Lâm, 9 November 2026): from the current term up to 8 academic years ahead.
export const YEARS_AHEAD = 8;

/** The first and last term a goal may name on a Vietnam date: the current term, and term 3 of the academic year 8 years on. */
export function goalTermWindow(vietnamDay: string): { first: Term; last: Term } {
  const first = currentTerm(vietnamDay);
  return { first, last: { year: first.year + YEARS_AHEAD, number: 3 } };
}

export function isInGoalTermWindow(term: Term, vietnamDay: string): boolean {
  const { first, last } = goalTermWindow(vietnamDay);
  return compareTerms(term, first) >= 0 && compareTerms(term, last) <= 0;
}
