import { Module } from '@nestjs/common';
import { RulesModule } from '../rules/rules.module.js';
import { AuditController } from './audit.controller.js';
import { CurriculumStandingController } from './curriculum-standing.controller.js';

@Module({
  imports: [RulesModule],
  controllers: [AuditController, CurriculumStandingController],
})
export class AuditModule {}
