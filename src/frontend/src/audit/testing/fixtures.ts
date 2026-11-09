import type { CourseCoverage, DegreeAudit, GraduationCondition, GroupCoverage } from '../api.js';

// A synthetic degree audit: made-up ZZ codes and names, the group headings of the real APCS tables, and figures
// written by hand as the API would answer them. Nothing here comes from a real transcript.

export const GROUP_A = '00000000-0000-4000-8000-000000000a01';
export const GROUP_C = '00000000-0000-4000-8000-000000000a02';
export const GROUP_MATH = '00000000-0000-4000-8000-000000000a03';
export const COMBINED = '00000000-0000-4000-8000-000000000b01';

const ARTICLE_17_3_B = 'QĐ 1175/QĐ-KHTN Điều 17.3.b';

export function course(code: string, overrides: Partial<CourseCoverage> = {}): CourseCoverage {
  return {
    code,
    nameVi: `Học phần thử ${code}`,
    nameEn: null,
    credits: 4,
    countsTowardTotal: true,
    countsTowardGpa: true,
    status: 'not_taken',
    result: null,
    grade: null,
    countedInGroupId: null,
    ...overrides,
  };
}

export function group(id: string, name: string, overrides: Partial<GroupCoverage> = {}): GroupCoverage {
  return {
    id,
    name,
    kind: 'compulsory',
    requiredCredits: 8,
    passedCredits: 0,
    inProgressCredits: 0,
    overflowInCredits: 0,
    overflowOutCredits: 0,
    overflowToGroupId: null,
    remainingCredits: 8,
    met: false,
    courses: [],
    ...overrides,
  };
}

const condition = (id: string, description: string, status: GraduationCondition['status'], citation = ARTICLE_17_3_B): GraduationCondition => ({
  id,
  description,
  citation,
  status,
});

const NOT_CHECKED: GraduationCondition[] = [
  condition('foreign_language_standard', "The school's foreign-language standard", 'not_checked', 'QĐ 1175/QĐ-KHTN Điều 17.3.d'),
  condition('study_time_limit', 'Finishing within the maximum study time', 'not_checked', 'QĐ 1175/QĐ-KHTN Điều 2.7'),
];

/** A student part way through: one group met, one short, one without a minimum of its own, one term saved. */
export function degreeAudit(overrides: Partial<DegreeAudit> = {}): DegreeAudit {
  return {
    programCode: 'APCS',
    trainingType: 'advanced',
    cohortYear: 2024,
    curriculumCode: 'APCS2024',
    credits: { accumulated: 9, towardTotal: 8, inProgressTowardTotal: 4, totalRequired: 20, remaining: 12, yearLevel: 1 },
    gpa: { average: 7.75, accumulatedAverage: 8, accumulatedAverageFourPoint: 3.5, classification: 'very_good', gradedCredits: 4 },
    terms: [
      {
        term: { year: 2024, number: 1 },
        kind: 'main',
        credits: 9,
        passedCredits: 9,
        average: 7.75,
        accumulatedAverage: 8,
        cumulativeAccumulatedAverage: 8,
        failedCourseCodes: [],
        inProgressCourseCodes: [],
        caps: { min: 10, max: 22 },
        capViolations: [
          {
            rule: 'below_minimum',
            credits: 9,
            limit: 10,
            citation: 'QĐ 1175/QĐ-KHTN Điều 7.2',
            petition: 'Allowed by a petition that the faculty supports and the Rector approves (QĐ 1175/QĐ-KHTN Điều 7.2.b).',
          },
        ],
      },
    ],
    groups: [
      group(GROUP_C, 'Tự chọn Computer Science (C)', {
        kind: 'elective',
        requiredCredits: null,
        remainingCredits: null,
        inProgressCredits: 4,
        met: true,
        courses: [course('ZZ414', { status: 'in_progress', result: 'in_progress', nameEn: 'Test elective ZZ414' })],
      }),
      group(GROUP_A, 'Kiến thức Computer Science (A): bắt buộc', {
        passedCredits: 4,
        remainingCredits: 4,
        courses: [course('ZZ201', { status: 'passed', result: 'graded', grade: 8 }), course('ZZ202', { status: 'failed', result: 'graded', grade: 4.5 })],
      }),
      group(GROUP_MATH, 'Kiến thức Math', {
        requiredCredits: 4,
        passedCredits: 4,
        remainingCredits: 0,
        met: true,
        courses: [
          course('ZZ101', { status: 'passed', result: 'exempt' }),
          course('ZZ090', { credits: 1, countsTowardTotal: false, countsTowardGpa: false, status: 'passed', result: 'pass' }),
        ],
      }),
    ],
    combinedMinimums: [
      {
        id: COMBINED,
        name: 'Kiến thức tự chọn',
        creditsMin: 12,
        officialNotes: 'Ghi chú thử của khối tự chọn.',
        groupIds: [GROUP_C],
        credits: 0,
        inProgressCredits: 4,
        remainingCredits: 8,
        met: false,
      },
    ],
    unmatchedCourses: [{ code: 'ZZ999', name: 'Môn ngoài chương trình thử', credits: 3, result: 'graded', grade: 9, passed: true, inProgress: false }],
    graduation: {
      status: 'not_yet',
      met: [condition(`group:${GROUP_C}`, 'Requirement group "Tự chọn Computer Science (C)"', 'met'), condition(`group:${GROUP_MATH}`, 'Requirement group "Kiến thức Math"', 'met')],
      unmet: [
        condition(`group:${GROUP_A}`, 'Requirement group "Kiến thức Computer Science (A): bắt buộc"', 'not_met'),
        condition(`combined:${COMBINED}`, '"Kiến thức tự chọn": at least 12 credits across its groups', 'not_met'),
        condition('total_credits', 'At least 20 credits toward the cohort total', 'not_met'),
      ],
      notChecked: NOT_CHECKED,
    },
    warnings: [
      {
        code: 'not_in_curriculum',
        courseCode: 'ZZ999',
        message: 'No requirement group of the curriculum lists this course, and no course equivalence is recorded, so it counts toward nothing.',
      },
    ],
    ...overrides,
  };
}

/** The audit of a student with no transcript saved: every figure at zero, as the API answers it (ACAD-01a). */
export function emptyAudit(): DegreeAudit {
  const base = degreeAudit();
  return {
    ...base,
    credits: { accumulated: 0, towardTotal: 0, inProgressTowardTotal: 0, totalRequired: 20, remaining: 20, yearLevel: 1 },
    gpa: { average: null, accumulatedAverage: null, accumulatedAverageFourPoint: null, classification: null, gradedCredits: 0 },
    terms: [],
    groups: [
      group(GROUP_C, 'Tự chọn Computer Science (C)', { kind: 'elective', requiredCredits: null, remainingCredits: null, met: true, courses: [course('ZZ414')] }),
      group(GROUP_A, 'Kiến thức Computer Science (A): bắt buộc', { courses: [course('ZZ201'), course('ZZ202')] }),
      group(GROUP_MATH, 'Kiến thức Math', { requiredCredits: 4, remainingCredits: 4, courses: [course('ZZ101')] }),
    ],
    combinedMinimums: [{ ...base.combinedMinimums[0]!, credits: 0, inProgressCredits: 0, remainingCredits: 12 }],
    unmatchedCourses: [],
    graduation: {
      status: 'not_yet',
      met: [condition(`group:${GROUP_C}`, 'Requirement group "Tự chọn Computer Science (C)"', 'met')],
      unmet: [
        condition(`group:${GROUP_A}`, 'Requirement group "Kiến thức Computer Science (A): bắt buộc"', 'not_met'),
        condition(`group:${GROUP_MATH}`, 'Requirement group "Kiến thức Math"', 'not_met'),
        condition(`combined:${COMBINED}`, '"Kiến thức tự chọn": at least 12 credits across its groups', 'not_met'),
        condition('total_credits', 'At least 20 credits toward the cohort total', 'not_met'),
      ],
      notChecked: NOT_CHECKED,
    },
    warnings: [],
  };
}
