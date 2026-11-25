import { INestApplication } from '@nestjs/common';
import { vi } from 'vitest';
import { OnboardingService } from '../../src/onboarding/onboarding.service.js';

/**
 * Adds one synthetic program's cohorts to what onboarding offers, for one e2e file's app only.
 * The plans API refuses a new plan for a cohort onboarding does not offer (Project Lead, 25
 * November 2026), and the offer is APCS 2024 and 2025. The files that test plans on synthetic
 * data (AGENTS.md hard rule 3) call this so they can still create them. It widens the offer and
 * never replaces it: every other cohort keeps onboarding's real answer, so a file can still prove
 * the refusal with another cohort. plans.e2e-spec.ts and the empty-cohort test of
 * curriculum-admin-programs.e2e-spec.ts check the refusal itself.
 */
export function offerAlso(app: INestApplication, programCode: string, cohortYears: readonly number[]): void {
  const onboarding = app.get(OnboardingService);
  const offers = onboarding.offers.bind(onboarding);
  vi.spyOn(onboarding, 'offers').mockImplementation((program, cohort) => (program === programCode && cohortYears.includes(cohort)) || offers(program, cohort));
}
