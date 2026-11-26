import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { RulesModule } from '../rules/rules.module.js';
import { PlanPlacement } from './plan-placement.entity.js';
import { Plan } from './plan.entity.js';
import { PlansController } from './plans.controller.js';
import { PlansService } from './plans.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Plan, PlanPlacement]), CurriculumModule, OnboardingModule, RulesModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
