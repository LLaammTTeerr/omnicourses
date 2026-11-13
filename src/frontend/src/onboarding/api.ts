import { request } from '../api.js';
import type { Term } from '../terms.js';

// The onboarding DTO of the API (UC-01 steps 6–9, A8, A9), written by hand; api.spec.ts checks it against
// src/backend/openapi.json.

/** internshipTerm when the student plans no internship; null means not answered. */
export const NO_INTERNSHIP = 'none';

export interface Onboarding {
  /** A program code the release offers, or null until the student picks one. */
  program: string | null;
  /** The year the student entered the program; set and cleared together with program. */
  cohort: number | null;
  targetGraduationTerm: Term | null;
  /** A whole number of 1 or more, with no upper limit: the rule engine applies the credit cap when it plans. */
  creditsPerTerm: number | null;
  internshipTerm: Term | typeof NO_INTERNSHIP | null;
  /** The student pressed Finish; needs a program and cohort. */
  finished: boolean;
}

/** What the API answers before the first save. */
export const NOT_STARTED: Onboarding = {
  program: null,
  cohort: null,
  targetGraduationTerm: null,
  creditsPerTerm: null,
  internshipTerm: null,
  finished: false,
};

export const fetchOnboarding = (token: string) => request<Onboarding>('GET', '/users/me/onboarding', { token });

/** Replaces every answer, so the whole object is sent; the saved answers come back. 400: an answer is invalid. */
export const saveOnboarding = (token: string, answers: Onboarding) => request<Onboarding>('PUT', '/users/me/onboarding', { token, body: answers });
