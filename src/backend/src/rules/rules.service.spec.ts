import { describe, expect, it } from 'vitest';
import type { CatalogLookup } from '../curriculum/catalog-lookup.js';
import type { CourseRulesService } from '../curriculum/course-rules.service.js';
import type { CurriculumRulesReader } from '../curriculum/curriculum-rules.reader.js';
import type { OnboardedProgram, OnboardingService } from '../onboarding/onboarding.service.js';
import type { TranscriptService } from '../transcript/transcript.service.js';
import type { BoardTerm } from './inputs.js';
import { RulesService } from './rules.service.js';
import { zzCurriculum, zzGraduatingTranscript } from './testing/fixtures.js';

const PROGRAM: OnboardedProgram = { programCode: 'ZZPROG', cohortYear: 2024 };

// Each fake answers only for the key it is asked about, so reading the wrong curriculum, user or
// course shows in the result.
function service(program: OnboardedProgram | null) {
  const reader = {
    rulesFor: async (p: string, c: number) => (p === 'ZZPROG' && c === 2024 ? zzCurriculum() : null),
    rulesForId: async (id: string) => (id === 'curriculum-1' ? zzCurriculum() : null),
  } as unknown as CurriculumRulesReader;
  const transcript = { rowsFor: async (userId: string) => (userId === 'user-1' ? zzGraduatingTranscript() : []) } as unknown as TranscriptService;
  const onboarding = { programFor: async () => program } as unknown as OnboardingService;
  const courseRules = {
    rulesFor: async (id: string) => ({ prerequisites: new Map(id === 'curriculum-1' ? [['ZZB1', ['ZZX9']]] : []), offeringTerms: new Map() }),
  } as unknown as CourseRulesService;
  const catalog = { courseCredits: async (codes: string[]) => new Map(codes.includes('ZZX9') ? [['ZZX9', 3]] : []) } as unknown as CatalogLookup;
  return new RulesService(reader, transcript, onboarding, courseRules, catalog);
}

describe('RulesService.auditFor', () => {
  it('audits the transcript against the onboarding program and cohort', async () => {
    const outcome = await service(PROGRAM).auditFor('user-1');
    expect(outcome.status).toBe('ok');
    expect(outcome.status === 'ok' && outcome.audit.graduation.status).toBe('done');
  });

  it('asks for onboarding while onboarding names no program and cohort (see toProgram for when)', async () => {
    expect(await service(null).auditFor('user-1')).toEqual({ status: 'onboarding_required' });
  });

  it('says when the program and cohort have no curriculum', async () => {
    expect(await service({ ...PROGRAM, cohortYear: 2030 }).auditFor('user-1')).toEqual({ status: 'curriculum_not_found', programCode: 'ZZPROG', cohortYear: 2030 });
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
    const report = await service({ programCode: 'OTHER', cohortYear: 2030 }).issuesFor('user-1', PLAN, BOARD);
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
    await expect(service(PROGRAM).issuesFor('user-1', { ...PLAN, curriculumId: 'curriculum-9' }, BOARD)).rejects.toThrow('The curriculum of plan plan-1 is missing');
  });
});
