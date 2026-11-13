import type { Onboarding } from '../api.js';

/** What the API answers before the first save. */
export const NOT_STARTED: Onboarding = {
  program: null,
  cohort: null,
  targetGraduationTerm: null,
  creditsPerTerm: null,
  internshipTerm: null,
  finished: false,
};

/** A finished onboarding for the synthetic student, unless overridden. */
export function onboarding(overrides: Partial<Onboarding> = {}): Onboarding {
  return {
    program: 'APCS',
    cohort: 2024,
    targetGraduationTerm: { year: 2027, number: 2 },
    creditsPerTerm: 18,
    internshipTerm: 'none',
    finished: true,
    ...overrides,
  };
}
