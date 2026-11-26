import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { PlansModule } from '../plans/plans.module.js';
import { RulesModule } from '../rules/rules.module.js';
import { PlanShare } from './plan-share.entity.js';
import { PlanShareController, SharedPlansController } from './sharing.controller.js';
import { SharingService } from './sharing.service.js';

/**
 * On every answer that reaches this step under /api/shared-plans, whatever makes it: the plan, the "not shared"
 * 404, the rate limit's 429, and the framework's own 400 and 404 for a path that is no token. Search engines
 * must index none of them (UC-09 §7), and no cache may keep a plan past a stopped link (A2). It is
 * a middleware because it runs before the guards and before the route is matched; a header set in
 * the route handler would miss the answers that never reach it. The CORS answer to an OPTIONS
 * request (204, no body) and the body parser's own 400, 413 and 415 are made before this runs;
 * none of them holds plan data.
 */
export function sharedPlanHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

// F9 shared plans (UC-09, ADR 0010). It reads plans through PlansService, the catalog through
// CurriculumService and the issues through the rule engine (RulesService). It exports
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
