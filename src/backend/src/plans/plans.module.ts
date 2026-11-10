import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { RulesModule } from '../rules/rules.module.js';
import { PlanPlacement } from './plan-placement.entity.js';
import { Plan } from './plan.entity.js';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';

// F5 plans (ADR 0014). Exports PlansService for the plan generator (UC-07 step 10) and, later,
// a read-only method for the sharing module (ADR 0010). The rule engine judges the plans
// (PLAN_ISSUES_PROVIDER from RulesModule); this module never does.
@Module({
  imports: [TypeOrmModule.forFeature([Plan, PlanPlacement]), CurriculumModule, RulesModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
