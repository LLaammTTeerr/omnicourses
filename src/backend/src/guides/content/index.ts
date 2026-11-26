import type { GuideFile } from '../guide-file.js';
import accountsAndPortalsEn from './accounts-and-portals.en.js';
import accountsAndPortalsVi from './accounts-and-portals.vi.js';
import gradesAndTranscriptEn from './grades-and-transcript.en.js';
import gradesAndTranscriptVi from './grades-and-transcript.vi.js';
import payTuitionEn from './pay-tuition.en.js';
import payTuitionVi from './pay-tuition.vi.js';
import registerCoursesEn from './register-courses.en.js';
import registerCoursesVi from './register-courses.vi.js';

export const GUIDE_FILES: GuideFile[] = [
  accountsAndPortalsVi,
  accountsAndPortalsEn,
  registerCoursesVi,
  registerCoursesEn,
  payTuitionVi,
  payTuitionEn,
  gradesAndTranscriptVi,
  gradesAndTranscriptEn,
];
