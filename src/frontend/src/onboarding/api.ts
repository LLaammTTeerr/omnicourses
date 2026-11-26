import { requestAsUser } from '../auth/store.js';
import type { Term } from '../terms.js';

export const NO_INTERNSHIP = 'none';

export interface Onboarding {
  program: string | null;
  cohort: number | null;
  targetGraduationTerm: Term | null;
  creditsPerTerm: number | null;
  internshipTerm: Term | typeof NO_INTERNSHIP | null;
  finished: boolean;
}

export const NOT_STARTED: Onboarding = {
  program: null,
  cohort: null,
  targetGraduationTerm: null,
  creditsPerTerm: null,
  internshipTerm: null,
  finished: false,
};

export const OFFERED_COHORTS: Readonly<Record<string, readonly number[]>> = { APCS: [2024, 2025] };

export const fetchOnboarding = () => requestAsUser<Onboarding>('GET', '/users/me/onboarding');

export const saveOnboarding = (answers: Onboarding) => requestAsUser<Onboarding>('PUT', '/users/me/onboarding', { body: answers });
