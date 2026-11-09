import { CreateUsersAndSessions1761696000000 } from './1761696000000-create-users-and-sessions.js';
import { CreateAiUsage1792800000000 } from './1792800000000-create-ai-usage.js';
import { AddUsersDeletionRequestedAt1792886400000 } from './1792886400000-add-users-deletion-requested-at.js';
import { CreateCurriculumCourseSchema1792912952302 } from './1792912952302-create-curriculum-course-schema.js';
import { CreateTranscriptRows1793159431000 } from './1793159431000-create-transcript-rows.js';
import { CreateGuides1793872582380 } from './1793872582380-create-guides.js';
import { CreateOnboardingAnswers1794216390492 } from './1794216390492-create-onboarding-answers.js';
import { CreatePlans1794218005469 } from './1794218005469-create-plans.js';
import { AddAuditRulesToCurriculum1794300000000 } from './1794300000000-add-audit-rules-to-curriculum.js';

// Imported classes, not a glob: globs break between ts (tests) and compiled js
// (dist) (ADR 0002). A migration left out of this list never runs.
export const MIGRATIONS = [
  CreateUsersAndSessions1761696000000,
  CreateAiUsage1792800000000,
  AddUsersDeletionRequestedAt1792886400000,
  CreateCurriculumCourseSchema1792912952302,
  CreateTranscriptRows1793159431000,
  CreateGuides1793872582380,
  CreateOnboardingAnswers1794216390492,
  CreatePlans1794218005469,
  AddAuditRulesToCurriculum1794300000000,
];
