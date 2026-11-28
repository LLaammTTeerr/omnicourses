import type { DynamicModule, INestApplication } from '@nestjs/common';
import { AcademicCalendarModule } from './academic-calendar/academic-calendar.module.js';
import { AccountModule } from './account/account.module.js';
import { AdminAccessModule } from './admin-access/admin-access.module.js';
import { AiModule } from './ai/ai.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ClockModule } from './config/clock.js';
import { CurriculumAdminModule } from './curriculum-admin/curriculum-admin.module.js';
import { installImportBodyLimit } from './curriculum-admin/import-body-limit.js';
import { CurriculumModule } from './curriculum/curriculum.module.js';
import { GuidesModule } from './guides/guides.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { PlansModule } from './plans/plans.module.js';
import { SharingModule } from './sharing/sharing.module.js';
import { TranscriptModule } from './transcript/transcript.module.js';
import { UsersModule } from './users/users.module.js';

export const FEATURE_MODULES = [
  AcademicCalendarModule,
  AccountModule,
  AdminAccessModule,
  AiModule,
  AuditModule,
  AuthModule,
  CurriculumAdminModule,
  CurriculumModule,
  GuidesModule,
  HealthModule,
  NotificationsModule,
  OnboardingModule,
  PlansModule,
  SharingModule,
  TranscriptModule,
  UsersModule,
];

export const platformImports = (typeOrmRoot: DynamicModule, features: readonly (typeof FEATURE_MODULES)[number][] = FEATURE_MODULES) => [typeOrmRoot, ClockModule, ...features];

type FeatureSetup = (app: INestApplication, globalPrefix: string) => void;

export const FEATURE_SETUPS: FeatureSetup[] = [installImportBodyLimit];
