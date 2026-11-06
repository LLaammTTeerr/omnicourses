import { CreateUsersAndSessions1761696000000 } from './1761696000000-create-users-and-sessions.js';
import { CreateAiUsage1792800000000 } from './1792800000000-create-ai-usage.js';
import { AddUsersDeletionRequestedAt1792886400000 } from './1792886400000-add-users-deletion-requested-at.js';
import { CreateCurriculumCourseSchema1792912952302 } from './1792912952302-create-curriculum-course-schema.js';
import { CreateTranscriptRows1793159431000 } from './1793159431000-create-transcript-rows.js';
import { CreateGuides1793872582380 } from './1793872582380-create-guides.js';

// Imported classes, not a glob: globs break between ts (tests) and compiled js
// (dist), and a missing import fails typecheck (ADR 0002).
export const MIGRATIONS = [
  CreateUsersAndSessions1761696000000,
  CreateAiUsage1792800000000,
  AddUsersDeletionRequestedAt1792886400000,
  CreateCurriculumCourseSchema1792912952302,
  CreateTranscriptRows1793159431000,
  CreateGuides1793872582380,
];
