import type { Curriculum, CurriculumCourse, RequirementGroup } from '../../curriculum/api.js';
import type { Plan, PlanIssue, PlanIssues, PlanListItem, PlanSummary, PlanTerm } from '../api.js';

// Synthetic plans, curricula and reports: made-up codes (ZZ…) and names, never a real student's data.

export const PLAN_ID = '00000000-0000-4000-8000-0000000000a1';
export const OTHER_ID = '00000000-0000-4000-8000-0000000000a2';
export const CORE_GROUP = '00000000-0000-4000-8000-000000000b01';
export const ELECTIVE_GROUP = '00000000-0000-4000-8000-000000000b02';

const CURRICULUM_REF = { id: '00000000-0000-4000-8000-0000000000c1', code: 'APCS2024', programCode: 'APCS', cohortYear: 2024 };

export function summary(overrides: Partial<PlanSummary> = {}): PlanSummary {
  return { id: PLAN_ID, name: 'Kế hoạch thử', curriculum: CURRICULUM_REF, createdAt: '2026-11-01T03:00:00.000Z', updatedAt: '2026-11-02T03:00:00.000Z', ...overrides };
}

/** A plan as the list shows it: two courses and a slot over HK1 → HK3 2026–2027 by default. */
export function listItem(overrides: Partial<PlanListItem> = {}): PlanListItem {
  const preview = { termCount: 2, courseCount: 2, slotCount: 1, firstTerm: { year: 2026, number: 1 as const }, lastTerm: { year: 2026, number: 3 as const } };
  return { ...summary(), preview, ...overrides };
}

export const course = (code: string) => ({ kind: 'course' as const, courseCode: code, requirementGroupId: null, credits: null });

export function plan(terms: PlanTerm[] = [], overrides: Partial<Plan> = {}): Plan {
  return { ...summary(), terms, ...overrides };
}

const curriculumCourse = (code: string, nameVi: string, credits = 4): CurriculumCourse => ({
  code,
  nameVi,
  nameEn: null,
  credits,
  theoryPeriods: null,
  labPeriods: null,
  exercisePeriods: null,
  projectPeriods: null,
  prerequisites: null,
  offeringTerms: null,
});

const group = (id: string, name: string, kind: RequirementGroup['kind'], courses: CurriculumCourse[]): RequirementGroup => ({
  id,
  name,
  kind,
  creditsTotal: null,
  creditsTotalMin: null,
  officialNotes: null,
  courses,
});

export const CURRICULUM: Curriculum = {
  id: CURRICULUM_REF.id,
  code: 'APCS2024',
  program: { code: 'APCS', nameVi: 'Chương trình thử', nameEn: null, faculty: null, trainingType: 'advanced' },
  cohortYear: 2024,
  nameVi: 'CTĐT thử',
  nameEn: null,
  language: null,
  totalCreditsMin: 20,
  requirementGroups: [
    group(CORE_GROUP, 'Kiến thức Computer Science (A): bắt buộc', 'compulsory', [
      curriculumCourse('ZZ101', 'Nhập môn thử'),
      curriculumCourse('ZZ102', 'Cấu trúc thử'),
      curriculumCourse('ZZ201', 'Giải thuật thử', 3),
    ]),
    group(ELECTIVE_GROUP, 'Tự chọn Computer Science (C)', 'elective', [curriculumCourse('ZZ414', 'Học máy thử')]),
  ],
};

export function issue(overrides: Partial<PlanIssue> & Pick<PlanIssue, 'code' | 'kind'>): PlanIssue {
  return {
    term: null,
    position: null,
    courseCode: null,
    requirementGroupId: null,
    combinedMinimumId: null,
    missingCourseCodes: [],
    offeredTermNumbers: [],
    credits: null,
    limit: null,
    citation: 'QĐ thử Điều 1',
    message: 'An English sentence.',
    ...overrides,
  };
}

export function report(overrides: Partial<PlanIssues> = {}): PlanIssues {
  return {
    planId: PLAN_ID,
    trainingType: 'advanced',
    terms: [],
    issues: [],
    coverage: { groups: [], combinedMinimums: [], totalRequired: 20, totalCredits: 0, totalRemaining: 20, graduation: 'not_yet' },
    ...overrides,
  };
}
