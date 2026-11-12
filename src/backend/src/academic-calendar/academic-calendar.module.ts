import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CurriculumAdminModule } from '../curriculum-admin/curriculum-admin.module.js';
import { AcademicCalendarEvent } from './academic-calendar-event.entity.js';
import { AcademicCalendarController } from './academic-calendar.controller.js';
import { AcademicCalendarService } from './academic-calendar.service.js';

// F10 school dates (ADR 0016). Writes reuse F12's AdminWriteService: the same program grant,
// the same write lock and the same error codes (ADR 0011).
@Module({
  imports: [CurriculumAdminModule, TypeOrmModule.forFeature([AcademicCalendarEvent])],
  controllers: [AcademicCalendarController],
  providers: [AcademicCalendarService],
})
export class AcademicCalendarModule {}
