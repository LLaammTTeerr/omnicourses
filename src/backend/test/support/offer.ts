import { INestApplication } from '@nestjs/common';
import { vi } from 'vitest';
import { OnboardingService } from '../../src/onboarding/onboarding.service.js';

export function offerAlso(app: INestApplication, programCode: string, cohortYears: readonly number[]): void {
  const onboarding = app.get(OnboardingService);
  const offers = onboarding.offers.bind(onboarding);
  vi.spyOn(onboarding, 'offers').mockImplementation((program, cohort) => (program === programCode && cohortYears.includes(cohort)) || offers(program, cohort));
}
