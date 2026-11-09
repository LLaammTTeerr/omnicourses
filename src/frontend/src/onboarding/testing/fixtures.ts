import type { Onboarding } from '../api.js';

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
