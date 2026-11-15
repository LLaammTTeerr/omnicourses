import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiModule } from '../ai/ai.module.js';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { TranscriptModule } from '../transcript/transcript.module.js';
import { AdvisorConsent } from './advisor-consent.entity.js';
import { AdvisorConsentService } from './advisor-consent.service.js';
import { AuditSource, CourseSource, PlanIssuesSource, RecordSource, UnavailableAuditSource, UnavailablePlanIssuesSource } from './advisor-sources.js';
import { AdvisorController } from './advisor.controller.js';
import { AdvisorService, CLAUSE_INDEX } from './advisor.service.js';
import { CatalogCourseSource, StudentRecordSource } from './main-sources.js';
import { corpusIndex } from './retrieval/regulation-corpus.js';

// F8 advisor chat (UC-08, ADR 0016). The rule engine (PR #72) and plans (PR #71) connect by
// replacing UnavailableAuditSource and UnavailablePlanIssuesSource below.
@Module({
  imports: [AiModule, CurriculumModule, OnboardingModule, TranscriptModule, TypeOrmModule.forFeature([AdvisorConsent])],
  controllers: [AdvisorController],
  providers: [
    AdvisorService,
    AdvisorConsentService,
    { provide: CLAUSE_INDEX, useFactory: corpusIndex },
    { provide: RecordSource, useClass: StudentRecordSource },
    { provide: CourseSource, useClass: CatalogCourseSource },
    { provide: AuditSource, useClass: UnavailableAuditSource },
    { provide: PlanIssuesSource, useClass: UnavailablePlanIssuesSource },
  ],
})
export class AdvisorModule {}
