import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumAdminModule } from '../curriculum-admin/curriculum-admin.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { AcademicCalendarEvent } from './academic-calendar-event.entity.js';
import { AcademicCalendarController } from './academic-calendar.controller.js';
import { AcademicCalendarService } from './academic-calendar.service.js';

@Module({
  imports: [CurriculumAdminModule, OnboardingModule, TypeOrmModule.forFeature([AcademicCalendarEvent])],
  controllers: [AcademicCalendarController],
  providers: [AcademicCalendarService],
  exports: [AcademicCalendarService],
})
export class AcademicCalendarModule {}
