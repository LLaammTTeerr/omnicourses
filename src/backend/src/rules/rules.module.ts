import { Module } from '@nestjs/common';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { PLAN_ISSUES_PROVIDER } from '../plans/plan-issues.js';
import { TranscriptModule } from '../transcript/transcript.module.js';
import { RulesService } from './rules.service.js';

// The rule engine (ADR 0013). No routes: the degree audit API lives in `audit`, plan issues in
// `plans`, which injects RulesService through PLAN_ISSUES_PROVIDER (ADR 0014).
@Module({
  imports: [CurriculumModule, TranscriptModule, OnboardingModule],
  providers: [RulesService, { provide: PLAN_ISSUES_PROVIDER, useExisting: RulesService }],
  exports: [RulesService, PLAN_ISSUES_PROVIDER],
})
export class RulesModule {}
