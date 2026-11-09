import { describe, expect, it } from 'vitest';
import type { CurriculumRulesReader } from '../curriculum/curriculum-rules.reader.js';
import type { OnboardingDto } from '../onboarding/onboarding.dto.js';
import type { OnboardingService } from '../onboarding/onboarding.service.js';
import type { TranscriptService } from '../transcript/transcript.service.js';
import { RulesService } from './rules.service.js';
import { zzCurriculum, zzGraduatingTranscript } from './testing/fixtures.js';

const ANSWERS: OnboardingDto = { program: 'ZZPROG', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: true };

function service(answers: OnboardingDto, curricula: Record<string, ReturnType<typeof zzCurriculum>> = { 'ZZPROG/2024': zzCurriculum() }) {
  const reads: string[] = [];
  const reader = { rulesFor: async (p: string, c: number) => (reads.push(`${p}/${c}`), curricula[`${p}/${c}`] ?? null) } as unknown as CurriculumRulesReader;
  const transcript = { rowsFor: async () => zzGraduatingTranscript() } as unknown as TranscriptService;
  const onboarding = { answersFor: async () => answers } as unknown as OnboardingService;
  return { rules: new RulesService(reader, transcript, onboarding), reads };
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
