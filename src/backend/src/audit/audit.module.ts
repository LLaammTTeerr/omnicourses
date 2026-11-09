import { Module } from '@nestjs/common';
import { RulesModule } from '../rules/rules.module.js';
import { AuditController } from './audit.controller.js';

// F3, the degree audit API (ADR 0013). The computation is the rule engine's.
@Module({
  imports: [RulesModule],
  controllers: [AuditController],
})
export class AuditModule {}
