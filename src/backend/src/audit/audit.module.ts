import { Module } from '@nestjs/common';
import { RulesModule } from '../rules/rules.module.js';
import { AuditController } from './audit.controller.js';

@Module({
  imports: [RulesModule],
  controllers: [AuditController],
})
export class AuditModule {}
