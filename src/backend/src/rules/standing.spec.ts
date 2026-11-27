import { describe, expect, it } from 'vitest';
import type { CurriculumRules } from '../curriculum/curriculum-rules.reader.js';
import type { TranscriptEntry } from '../transcript/transcript-entry.js';
import { curriculumStanding } from './standing.js';

const makeRules = (overrides: Partial<CurriculumRules> = {}): CurriculumRules => ({
  programCode: 'APCS',
  trainingType: 'advanced',
  cohortYear: 2024,
  curriculumCode: 'APCS2024',
  totalCreditsMin: 163,
  groups: [
    {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Core',
      kind: 'compulsory',
      creditsTotal: 20,
      creditsTotalMin: null,
      overflowToGroupId: null,
      courses: [
        { code: 'CS160', nameVi: 'Nhập môn', nameEn: null, credits: 4, countsTowardTotal: true, countsTowardGpa: true },
        { code: 'CS469', nameVi: 'Đề cương', nameEn: null, credits: 2, countsTowardTotal: true, countsTowardGpa: true },
        { code: 'CS470', nameVi: 'Khóa luận', nameEn: null, credits: 10, countsTowardTotal: true, countsTowardGpa: true },
        { code: 'ZZ999', nameVi: 'Chưa rõ tiên quyết', nameEn: null, credits: 4, countsTowardTotal: true, countsTowardGpa: true },
      ],
    },
  ],
  combinedMinimums: [],
  prerequisites: new Map([
    ['CS160', []],
    ['CS469', []],
    ['CS470', ['CS469']],
  ]),
  offeringTerms: new Map(),
  ...overrides,
});

const entry = (courseCode: string, result: TranscriptEntry['result'], grade: number | null, year = 2024, number: 1 | 2 | 3 = 1): TranscriptEntry => ({
  courseCode,
  courseName: courseCode,
  credits: 4,
  result,
  grade,
  term: { year, number },
});

describe('curriculumStanding (F4, ADR 0013)', () => {
  it('computes passed, in_progress, failed, available, locked, and unrecorded prerequisite states from the rule engine', () => {
    const rules = makeRules();
    expect(curriculumStanding(rules, [entry('CS160', 'graded', 8.5), entry('CS469', 'graded', 4.9)])).toEqual([
      { code: 'CS160', transcriptStatus: 'passed', readiness: null, missingPrerequisites: [] },
      { code: 'CS469', transcriptStatus: 'failed', readiness: 'available', missingPrerequisites: [] },
      { code: 'CS470', transcriptStatus: null, readiness: 'locked', missingPrerequisites: ['CS469'] },
      { code: 'ZZ999', transcriptStatus: null, readiness: null, missingPrerequisites: [] },
    ]);
  });

  it('counts an in-progress prerequisite as available, and marks the dependent course locked if the prerequisite later fails (even when the dependent course is in progress)', () => {
    const rules = makeRules();
    const withInProgress = curriculumStanding(rules, [
      entry('CS469', 'graded', 3.0, 2024, 1),
      entry('CS469', 'in_progress', null, 2024, 2),
    ]);
    expect(withInProgress).toContainEqual({ code: 'CS469', transcriptStatus: 'in_progress', readiness: null, missingPrerequisites: [] });
    expect(withInProgress).toContainEqual({ code: 'CS470', transcriptStatus: null, readiness: 'available', missingPrerequisites: [] });

    const bothInProgress = curriculumStanding(rules, [
      entry('CS469', 'in_progress', null, 2024, 2),
      entry('CS470', 'in_progress', null, 2025, 1),
    ]);
    expect(bothInProgress).toContainEqual({ code: 'CS470', transcriptStatus: 'in_progress', readiness: null, missingPrerequisites: [] });

    const afterPrerequisiteFails = curriculumStanding(rules, [
      entry('CS469', 'graded', 4.0, 2024, 2),
      entry('CS470', 'in_progress', null, 2025, 1),
    ]);
    expect(afterPrerequisiteFails).toContainEqual({ code: 'CS469', transcriptStatus: 'failed', readiness: 'available', missingPrerequisites: [] });
    expect(afterPrerequisiteFails).toContainEqual({ code: 'CS470', transcriptStatus: 'in_progress', readiness: 'locked', missingPrerequisites: ['CS469'] });

    const withFailedRetake = curriculumStanding(rules, [
      entry('CS469', 'graded', 7.5, 2024, 1),
      entry('CS469', 'graded', 4.0, 2024, 2),
    ]);
    expect(withFailedRetake).toContainEqual({ code: 'CS469', transcriptStatus: 'failed', readiness: 'available', missingPrerequisites: [] });
    expect(withFailedRetake).toContainEqual({ code: 'CS470', transcriptStatus: null, readiness: 'locked', missingPrerequisites: ['CS469'] });
  });
});
