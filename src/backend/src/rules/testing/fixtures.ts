// Synthetic curricula and transcripts for the rule engine's unit tests (AGENTS.md hard rule 3).
// Course codes start with ZZ; nothing here is a real student record.
import type { Term } from '../../terms/term.js';
import type { TranscriptEntry, TranscriptResult } from '../../transcript/transcript-entry.js';
import type { CurriculumRuleCourse, CurriculumRuleGroup, CurriculumRules } from '../inputs.js';

export function course(code: string, credits: number, flags: Partial<Pick<CurriculumRuleCourse, 'countsTowardTotal' | 'countsTowardGpa'>> = {}): CurriculumRuleCourse {
  return { code, nameVi: `Học phần ${code}`, nameEn: null, credits, countsTowardTotal: true, countsTowardGpa: true, ...flags };
}

export function group(
  id: string,
  kind: CurriculumRuleGroup['kind'],
  required: number | null,
  courses: CurriculumRuleCourse[],
  overflowToGroupId: string | null = null,
): CurriculumRuleGroup {
  return {
    id,
    name: `Group ${id}`,
    kind,
    creditsTotal: kind === 'compulsory' ? required : null,
    creditsTotalMin: kind === 'elective' ? required : null,
    overflowToGroupId,
    courses,
  };
}

/**
 * An APCS-shaped curriculum, small: a compulsory group, an elective group whose excess overflows
 * into C, a compulsory group with a course outside the total and the GPA (like Thể dục), elective
 * B with a minimum, elective C without one, B + C ≥ 12 together, and a 10-credit graduation group.
 * Total: 8 + 4 + 4 + 12 + 10 = 38.
 */
export function zzCurriculum(overrides: Partial<CurriculumRules> = {}): CurriculumRules {
  return {
    programCode: 'ZZPROG',
    trainingType: 'advanced',
    cohortYear: 2024,
    curriculumCode: 'ZZPROG2024',
    totalCreditsMin: 38,
    groups: [
      group('a-bb', 'compulsory', 8, [course('ZZA1', 4), course('ZZA2', 4)]),
      group('a-tc', 'elective', 4, [course('ZZAT1', 4), course('ZZAT2', 4), course('ZZAT3', 4)], 'c'),
      group('b', 'elective', 4, [course('ZZB1', 4), course('ZZB2', 4)]),
      group('c', 'elective', null, [course('ZZC1', 4), course('ZZC2', 4), course('ZZC3', 4)]),
      group('non', 'compulsory', 4, [course('ZZN1', 4), course('ZZPE1', 2, { countsTowardTotal: false, countsTowardGpa: false })]),
      group('tn', 'elective', 10, [course('ZZT1', 10), course('ZZT2', 5), course('ZZT3', 5)]),
    ],
    combinedMinimums: [{ id: 'bc', name: 'B + C', creditsMin: 12, officialNotes: null, groupIds: ['b', 'c'] }],
    ...overrides,
  };
}

export function term(year: number, number: Term['number']): Term {
  return { year, number };
}

/** A graded attempt. */
export function graded(code: string, credits: number, grade: number, at: Term = term(2024, 1)): TranscriptEntry {
  return { courseCode: code, courseName: `Course ${code}`, credits, result: 'graded', grade, term: at };
}

/** An attempt without a grade: in progress, exempt, pass or fail. */
export function ungraded(code: string, credits: number, result: Exclude<TranscriptResult, 'graded'>, at: Term = term(2024, 1)): TranscriptEntry {
  return { courseCode: code, courseName: `Course ${code}`, credits, result, grade: null, term: at };
}

/** Every requirement of zzCurriculum met: 38 credits toward the total, B + C = 12. */
export function zzGraduatingTranscript(): TranscriptEntry[] {
  return [
    graded('ZZA1', 4, 8, term(2024, 1)),
    graded('ZZA2', 4, 7, term(2024, 1)),
    graded('ZZN1', 4, 9, term(2024, 1)),
    ungraded('ZZPE1', 2, 'pass', term(2024, 2)),
    graded('ZZAT1', 4, 6, term(2024, 2)),
    graded('ZZB1', 4, 7.5, term(2024, 2)),
    graded('ZZC1', 4, 8.5, term(2024, 3)),
    graded('ZZC2', 4, 5, term(2024, 3)),
    graded('ZZT1', 10, 9, term(2025, 1)),
  ];
}
