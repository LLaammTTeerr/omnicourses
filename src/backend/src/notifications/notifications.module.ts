import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AcademicCalendarModule } from '../academic-calendar/academic-calendar.module.js';
import { OnboardingModule } from '../onboarding/onboarding.module.js';
import { TranscriptModule } from '../transcript/transcript.module.js';
import { NotificationSchedule } from './notification-schedule.js';
import { Notification } from './notification.entity.js';
import { NotificationsController } from './notifications.controller.js';
import { NotificationsService } from './notifications.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Notification]), AcademicCalendarModule, OnboardingModule, TranscriptModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationSchedule],
})
export class NotificationsModule {}
