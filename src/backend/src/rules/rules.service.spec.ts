import { describe, expect, it } from 'vitest';
import type { CatalogLookup } from '../curriculum/catalog-lookup.js';
import type { CourseRulesService } from '../curriculum/course-rules.service.js';
import type { CurriculumRulesReader } from '../curriculum/curriculum-rules.reader.js';
import type { OnboardedProgram, OnboardingService } from '../onboarding/onboarding.service.js';
import type { TranscriptService } from '../transcript/transcript.service.js';
import { creditCaps, termKind } from './credit-caps.js';
import type { BoardTerm } from './inputs.js';
import { checkPrerequisites } from './prerequisites.js';
import { RulesService } from './rules.service.js';
import { zzCurriculum, zzGraduatingTranscript } from './testing/fixtures.js';

const PROGRAM: OnboardedProgram = { programCode: 'ZZPROG', cohortYear: 2024 };

function service(program: OnboardedProgram | null, curricula: Record<string, ReturnType<typeof zzCurriculum>> = { 'ZZPROG/2024': zzCurriculum(), 'curriculum-1': zzCurriculum() }) {
  const reads: string[] = [];
  const reader = {
    rulesFor: async (p: string, c: number) => (reads.push(`${p}/${c}`), curricula[`${p}/${c}`] ?? null),
    rulesForId: async (id: string) => (reads.push(`id:${id}`), curricula[id] ?? null),
  } as unknown as CurriculumRulesReader;
  const transcript = { rowsFor: async () => zzGraduatingTranscript() } as unknown as TranscriptService;
  const onboarding = { programFor: async () => program } as unknown as OnboardingService;
  const courseRules = {
    rulesFor: async (id: string) => (reads.push(`course-rules:${id}`), { prerequisites: new Map([['ZZB1', ['ZZX9']]]), offeringTerms: new Map() }),
  } as unknown as CourseRulesService;
  const catalog = { courseCredits: async (codes: string[]) => (reads.push(`credits:${codes.join(',')}`), new Map([['ZZX9', 3]])) } as unknown as CatalogLookup;
  return { rules: new RulesService(reader, transcript, onboarding, courseRules, catalog), reads };
}

describe('RulesService.auditFor', () => {
  it('audits the transcript against the onboarding program and cohort', async () => {
    const { rules, reads } = service(PROGRAM);
    const outcome = await rules.auditFor('user-1');
    expect(reads).toEqual(['ZZPROG/2024']);
    expect(outcome.status).toBe('ok');
    expect(outcome.status === 'ok' && outcome.audit.graduation.status).toBe('done');
  });

  it('asks for onboarding while onboarding names no program and cohort (see toProgram for when)', async () => {
    const { rules, reads } = service(null);
    expect(await rules.auditFor('u')).toEqual({ status: 'onboarding_required' });
    expect(reads).toEqual([]);
  });

  it('says when the program and cohort have no curriculum', async () => {
    expect(await service({ ...PROGRAM, cohortYear: 2030 }).rules.auditFor('u')).toEqual({ status: 'curriculum_not_found', programCode: 'ZZPROG', cohortYear: 2030 });
  });
});

describe('the pure rules other modules import', () => {
  it('are plain functions of the rules folder, with no service in between', () => {
    expect(termKind('standard', 3)).toBe('summer');
    expect(creditCaps('advanced', 'main')).toEqual({ min: 10, max: 22 });
    expect(checkPrerequisites(null, new Set())).toEqual({ status: 'not_recorded' });
  });
});

const PLAN = { planId: 'plan-1', curriculumId: 'curriculum-1' };
const BOARD: BoardTerm[] = [
  {
    term: { year: 2026, number: 1 },
    placements: [
      { kind: 'course', courseCode: 'ZZB1', requirementGroupId: null, credits: null },
      { kind: 'course', courseCode: 'ZZX9', requirementGroupId: null, credits: null },
    ],
  },
];

describe('RulesService.issuesFor', () => {
  it("checks the plan against the plan's own curriculum, not the onboarding one, with the student's transcript", async () => {
    const { rules, reads } = service({ programCode: 'OTHER', cohortYear: 2030 });
    const report = await rules.issuesFor('user-1', PLAN, BOARD);
    expect(reads.sort()).toEqual(['course-rules:curriculum-1', 'credits:ZZB1,ZZX9', 'id:curriculum-1']);
    expect(report.planId).toBe('plan-1');
    expect(report.terms).toEqual([{ term: { year: 2026, number: 1 }, kind: 'main', credits: 7, caps: { min: 10, max: 22 } }]);
    // The graduating transcript passed ZZB1 in 2024 and never took ZZX9, the prerequisite recorded for it.
    expect(report.issues.map((i) => `${i.code}:${i.courseCode}`)).toEqual([
      'load_below_minimum:null',
      'already_passed:ZZB1',
      'prerequisite_not_met:ZZB1',
      'offering_terms_not_recorded:ZZB1',
      'not_in_curriculum:ZZX9',
      'prerequisites_not_recorded:ZZX9',
      'offering_terms_not_recorded:ZZX9',
    ]);
    expect(report.coverage.graduation).toBe('done');
  });

  it('fails loudly when the plan’s curriculum is gone, which ON DELETE RESTRICT forbids', async () => {
    await expect(service(PROGRAM).rules.issuesFor('user-1', { ...PLAN, curriculumId: 'curriculum-9' }, BOARD)).rejects.toThrow('The curriculum of plan plan-1 is missing');
  });
});
