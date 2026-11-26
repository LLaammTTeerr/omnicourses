import type { INestApplication } from '@nestjs/common';
import { AcademicCalendarModule } from './academic-calendar/academic-calendar.module.js';
import { AccountModule } from './account/account.module.js';
import { AiModule } from './ai/ai.module.js';
import { AuditModule } from './audit/audit.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CurriculumModule } from './curriculum/curriculum.module.js';
import { CurriculumAdminModule } from './curriculum-admin/curriculum-admin.module.js';
import { installImportBodyLimit } from './curriculum-admin/import-body-limit.js';
import { GuidesModule } from './guides/guides.module.js';
import { HealthModule } from './health/health.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { PlansModule } from './plans/plans.module.js';
import { SharingModule } from './sharing/sharing.module.js';
import { TranscriptModule } from './transcript/transcript.module.js';
import { UsersModule } from './users/users.module.js';

export const FEATURE_MODULES = [HealthModule, UsersModule, AuthModule, AiModule, TranscriptModule, GuidesModule, CurriculumModule, OnboardingModule, AuditModule, PlansModule, CurriculumAdminModule, AcademicCalendarModule, SharingModule, NotificationsModule, AccountModule];

type FeatureSetup = (app: INestApplication, globalPrefix: string) => void;

export const FEATURE_SETUPS: FeatureSetup[] = [installImportBodyLimit];
