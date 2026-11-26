import { Module } from '@nestjs/common';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { TranscriptModule } from '../transcript/transcript.module.js';
import { RulesService } from './rules.service.js';

@Module({
  imports: [CurriculumModule, TranscriptModule, OnboardingModule],
  providers: [RulesService],
  exports: [RulesService],
})
export class RulesModule {}
