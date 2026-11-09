import { AccountModule } from './account/account.module.js';
import { AiModule } from './ai/ai.module.js';
import { AuthModule } from './auth/auth.module.js';
import { CurriculumModule } from './curriculum/curriculum.module.js';
import { GuidesModule } from './guides/guides.module.js';
import { HealthModule } from './health/health.module.js';
import { OnboardingModule } from './onboarding/onboarding.module.js';
import { TranscriptModule } from './transcript/transcript.module.js';
import { UsersModule } from './users/users.module.js';

// The app and the OpenAPI contract both load this list.
export const FEATURE_MODULES = [HealthModule, UsersModule, AuthModule, AccountModule, AiModule, TranscriptModule, GuidesModule, CurriculumModule, OnboardingModule];
