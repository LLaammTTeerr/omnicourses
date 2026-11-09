import { describe, expect, it } from 'vitest';
import type { CourseRulesService } from '../curriculum/course-rules.service.js';
import type { CurriculumRulesReader } from '../curriculum/curriculum-rules.reader.js';
import type { CurriculumService } from '../curriculum/curriculum.service.js';
import type { OnboardingDto } from '../onboarding/onboarding.dto.js';
import type { OnboardingService } from '../onboarding/onboarding.service.js';
import type { PlanDto } from '../plans/plans.dto.js';
import type { TranscriptService } from '../transcript/transcript.service.js';
import { RulesService } from './rules.service.js';
import { zzCurriculum, zzGraduatingTranscript } from './testing/fixtures.js';

const ANSWERS: OnboardingDto = { program: 'ZZPROG', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true };

function service(answers: OnboardingDto, curricula: Record<string, ReturnType<typeof zzCurriculum>> = { 'ZZPROG/2024': zzCurriculum() }) {
  const reads: string[] = [];
  const reader = { rulesFor: async (p: string, c: number) => (reads.push(`${p}/${c}`), curricula[`${p}/${c}`] ?? null) } as unknown as CurriculumRulesReader;
  const transcript = { rowsFor: async () => zzGraduatingTranscript() } as unknown as TranscriptService;
  const onboarding = { answersFor: async () => answers } as unknown as OnboardingService;
  const courseRules = {
    rulesFor: async (id: string) => (reads.push(`course-rules:${id}`), { prerequisites: new Map([['ZZB1', ['ZZX9']]]), offeringTerms: new Map<string, number[]>() }),
  } as unknown as CourseRulesService;
  const catalog = { courseCredits: async (codes: string[]) => (reads.push(`credits:${codes.join(',')}`), new Map([['ZZX9', 3]])) } as unknown as CurriculumService;
  return { rules: new RulesService(reader, transcript, onboarding, courseRules, catalog), reads };
}

describe('RulesService.auditFor', () => {
  it('audits the transcript against the onboarding program and cohort', async () => {
    const { rules, reads } = service(ANSWERS);
    const outcome = await rules.auditFor('user-1');
    expect(reads).toEqual(['ZZPROG/2024']);
    expect(outcome.status).toBe('ok');
    expect(outcome.status === 'ok' && outcome.audit.graduation.status).toBe('done');
  });

  it('asks for onboarding while it is not finished, even with a program saved', async () => {
    expect(await service({ ...ANSWERS, finished: false }).rules.auditFor('u')).toEqual({ status: 'onboarding_required' });
    expect(await service({ ...ANSWERS, program: null, cohort: null }).rules.auditFor('u')).toEqual({ status: 'onboarding_required' });
  });

  it('says when the program and cohort have no curriculum', async () => {
    expect(await service({ ...ANSWERS, cohort: 2030 }).rules.auditFor('u')).toEqual({ status: 'curriculum_not_found', programCode: 'ZZPROG', cohortYear: 2030 });
  });

  it('exposes the pure rules to other modules', () => {
    const { rules } = service(ANSWERS);
    expect(rules.termKind('standard', 3)).toBe('summer');
    expect(rules.creditCaps('advanced', 'main')).toEqual({ min: 10, max: 22 });
    expect(rules.checkPrerequisites(null, new Set())).toEqual({ status: 'not_recorded' });
  });
});

const plan = (programCode: string, cohortYear: number): PlanDto => ({
  id: 'plan-1',
  name: 'Main plan',
  curriculum: { id: 'curriculum-1', code: `${programCode}${cohortYear}`, programCode, cohortYear },
  createdAt: new Date(0),
  updatedAt: new Date(0),
  terms: [{ term: { year: 2026, number: 1 }, placements: [{ kind: 'course', courseCode: 'ZZB1', requirementGroupId: null, credits: null }, { kind: 'course', courseCode: 'ZZX9', requirementGroupId: null, credits: null }] }],
});

describe('RulesService.issuesFor', () => {
  it("checks the plan against the plan's own curriculum, not the onboarding one, with the student's transcript", async () => {
    const { rules, reads } = service({ ...ANSWERS, program: 'OTHER', cohort: 2030 });
    const report = await rules.issuesFor('user-1', plan('ZZPROG', 2024));
    expect(reads.sort()).toEqual(['ZZPROG/2024', 'course-rules:curriculum-1', 'credits:ZZB1,ZZX9']);
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
    await expect(service(ANSWERS).rules.issuesFor('user-1', plan('ZZPROG', 2031))).rejects.toThrow('The curriculum of plan plan-1 is missing');
  });
});
