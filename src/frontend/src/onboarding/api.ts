import { request } from '../api.js';
import type { OnboardingDto } from '../api-schema/types.gen.js';

// The onboarding DTO of the API (UC-01 steps 6–9, A8, A9), generated from the contract (ADR 0018).

/**
 * The answers. `program` is one of the programs the release offers (curriculum/programs.ts OFFERED_COHORTS), or null
 * until the student picks one.
 */
export type Onboarding = OnboardingDto;

/** internshipTerm when the student plans no internship; null means not answered. */
export const NO_INTERNSHIP = 'none' satisfies Extract<Onboarding['internshipTerm'], string>;

export const fetchOnboarding = (token: string) => request<Onboarding>('GET', '/users/me/onboarding', { token });

/** Replaces every answer, so the whole object is sent; the saved answers come back. 400: an answer is invalid. */
export const saveOnboarding = (token: string, answers: Onboarding) => request<Onboarding>('PUT', '/users/me/onboarding', { token, body: answers });
