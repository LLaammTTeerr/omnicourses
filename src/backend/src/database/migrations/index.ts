import { CreateUsersAndSessions1761696000000 } from './1761696000000-create-users-and-sessions.js';
import { CreateAiUsage1792800000000 } from './1792800000000-create-ai-usage.js';
import { AddUsersDeletionRequestedAt1792886400000 } from './1792886400000-add-users-deletion-requested-at.js';
import { CreateCurriculumCourseSchema1792912952302 } from './1792912952302-create-curriculum-course-schema.js';
import { CreateTranscriptRows1793159431000 } from './1793159431000-create-transcript-rows.js';
import { CreateGuides1793872582380 } from './1793872582380-create-guides.js';
import { CreateOnboardingAnswers1794216390492 } from './1794216390492-create-onboarding-answers.js';
import { CreatePlans1794218005469 } from './1794218005469-create-plans.js';
import { CreateCurriculumAdmin1794230000000 } from './1794230000000-create-curriculum-admin.js';
import { AddAuditRulesToCurriculum1794300000000 } from './1794300000000-add-audit-rules-to-curriculum.js';
import { CreateAcademicCalendar1794500000000 } from './1794500000000-create-academic-calendar.js';
import { CreatePlanShares1795564800000 } from './1795564800000-create-plan-shares.js';
import { CreateNotifications1795575059760 } from './1795575059760-create-notifications.js';
import { HardenConstraintsAndIndexes1795600000000 } from './1795600000000-harden-constraints-and-indexes.js';
import { CreateSignInAttempts1795600000001 } from './1795600000001-create-sign-in-attempts.js';
import { AddUsersStudentIdAndClassName1795700000000 } from './1795700000000-add-users-student-id-and-class-name.js';

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
  CreateCurriculumAdmin1794230000000,
  AddAuditRulesToCurriculum1794300000000,
  CreateAcademicCalendar1794500000000,
  CreatePlanShares1795564800000,
  CreateNotifications1795575059760,
  HardenConstraintsAndIndexes1795600000000,
  CreateSignInAttempts1795600000001,
  AddUsersStudentIdAndClassName1795700000000,
];
