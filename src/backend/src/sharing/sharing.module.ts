import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { PlansModule } from '../plans/plans.module.js';
import { RulesModule } from '../rules/rules.module.js';
import { PlanShare } from './plan-share.entity.js';
import { sharedPlanHeaders } from './shared-plan-headers.js';
import { PlanShareController, SharedPlansController } from './sharing.controller.js';
import { SharingService } from './sharing.service.js';

// F9 shared plans (UC-09, ADR 0010). It reads plans through PlansService, the catalog through
// CurriculumService and the issues through the rule engine (PLAN_ISSUES_PROVIDER). It exports
// SharingService for the account module, which stops every link when a deletion is requested.
@Module({
  imports: [TypeOrmModule.forFeature([PlanShare]), PlansModule, CurriculumModule, RulesModule],
  controllers: [PlanShareController, SharedPlansController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule implements NestModule {
  // The public route's headers go on its whole path prefix, so that answers the route handler never
  // makes (429, 400, a 404 for a longer path) carry them too.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(sharedPlanHeaders).forRoutes('shared-plans');
  }
}
