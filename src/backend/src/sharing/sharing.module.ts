import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumModule } from '../curriculum/curriculum.module.js';
import { PlansModule } from '../plans/plans.module.js';
import { RulesModule } from '../rules/rules.module.js';
import { PlanShare } from './plan-share.entity.js';
import { PlanShareController, SharedPlansController } from './sharing.controller.js';
import { SharingService } from './sharing.service.js';

export function sharedPlanHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  next();
}

@Module({
  imports: [TypeOrmModule.forFeature([PlanShare]), PlansModule, CurriculumModule, RulesModule],
  controllers: [PlanShareController, SharedPlansController],
  providers: [SharingService],
  exports: [SharingService],
})
export class SharingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(sharedPlanHeaders).forRoutes('shared-plans');
  }
}
