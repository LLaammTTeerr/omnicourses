import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { RulesModule } from '../rules/rules.module.js';
import { PlanPlacement } from './plan-placement.entity.js';
import { Plan } from './plan.entity.js';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';

// F5 plans (ADR 0014). Exports PlansService for the plan generator (UC-07 step 10) and for the
// sharing module, which only reads through it (ADR 0010): `get` to check that a plan is the
// signed-in student's, `find` to read the plan a link opens. The rule engine judges the plans
// (RulesService from RulesModule); this module never does. OnboardingModule answers which
// cohorts a new plan may name: the ones onboarding offers (Project Lead, 25 November 2026).
@Module({
  imports: [TypeOrmModule.forFeature([Plan, PlanPlacement]), CurriculumModule, OnboardingModule, RulesModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
