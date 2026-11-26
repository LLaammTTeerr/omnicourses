import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CurriculumRulesReader } from '../curriculum/curriculum-rules.reader.js';
import type { CurriculumService } from '../curriculum/curriculum.service.js';
import type { OnboardingService, StudentCohort } from '../onboarding/onboarding.service.js';
import type { PlanDto } from '../plans/plans.dto.js';
import type { TranscriptService } from '../transcript/transcript.service.js';
import { RulesService } from './rules.service.js';
import { zzCurriculum, zzGraduatingTranscript } from './testing/fixtures.js';

const ANSWERS: StudentCohort = { programCode: 'ZZPROG', cohortYear: 2024 };

const curriculumId = (programCode: string, cohortYear: number) => `${programCode}-${cohortYear}`;

function service(cohort: StudentCohort | null, curricula: Record<string, ReturnType<typeof zzCurriculum>> = { 'ZZPROG-2024': zzCurriculum({ prerequisites: new Map([['ZZB1', ['ZZX9']]]) }) }) {
  const reads: string[] = [];
  const transcriptReads: string[] = [];
  const reader = { rulesFor: async (id: string) => (reads.push(`rules:${id}`), curricula[id] ?? null) } as unknown as CurriculumRulesReader;
  const transcript = { rowsFor: async (userId: string) => (transcriptReads.push(userId), zzGraduatingTranscript()) } as unknown as TranscriptService;
  const onboarding = { cohortOf: async () => cohort } as unknown as OnboardingService;
  const catalog = {
    findCurriculumId: async (p: string, c: number) => (reads.push(`${p}/${c}`), curricula[curriculumId(p, c)] ? curriculumId(p, c) : null),
    catalogCourses: async (codes: string[]) => (reads.push(`catalog:${codes.join(',')}`), new Map([['ZZX9', { nameVi: 'Học phần ZZX9', nameEn: null, credits: 3 }]])),
  } as unknown as CurriculumService;
  return { rules: new RulesService(reader, transcript, onboarding, catalog), reads, transcriptReads };
}

describe('RulesService.auditFor', () => {
  it('audits the transcript against the onboarding program and cohort', async () => {
    const { rules, reads } = service(ANSWERS);
    const outcome = await rules.auditFor('user-1');
    expect(reads).toEqual(['ZZPROG/2024', 'rules:ZZPROG-2024']);
    expect(outcome.status).toBe('ok');
    expect(outcome.status === 'ok' && outcome.audit.graduation.status).toBe('done');
  });

  it('asks for onboarding while onboarding names no program and cohort', async () => {
    expect(await service(null).rules.auditFor('u')).toEqual({ status: 'onboarding_required' });
  });

  it('says when the program and cohort have no curriculum', async () => {
    expect(await service({ ...ANSWERS, cohortYear: 2030 }).rules.auditFor('u')).toEqual({ status: 'curriculum_not_found', programCode: 'ZZPROG', cohortYear: 2030 });
  });
});

const plan = (programCode: string, cohortYear: number): PlanDto => ({
  id: 'plan-1',
  name: 'Main plan',
  curriculum: { id: curriculumId(programCode, cohortYear), code: `${programCode}${cohortYear}`, programCode, cohortYear },
  createdAt: new Date(0),
  updatedAt: new Date(0),
  terms: [{ term: { year: 2026, number: 1 }, placements: [{ kind: 'course', courseCode: 'ZZB1', requirementGroupId: null, credits: null }, { kind: 'course', courseCode: 'ZZX9', requirementGroupId: null, credits: null }] }],
});

describe('RulesService.issuesFor', () => {
  it("checks the plan against the plan's own curriculum, not the onboarding one, with the student's transcript", async () => {
    const { rules, reads } = service({ programCode: 'OTHER', cohortYear: 2030 });
    const report = await rules.issuesFor(plan('ZZPROG', 2024), 'user-1');
    expect(reads.sort()).toEqual(['catalog:ZZB1,ZZX9', 'rules:ZZPROG-2024']);
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
    await expect(service(ANSWERS).rules.issuesFor(plan('ZZPROG', 2031), 'user-1')).rejects.toThrow('The curriculum of plan plan-1 is missing');
  });
});

// For a shared plan whose owner did not choose to show the transcript's checks (ADR 0010): the
// engine is told no student and reads no transcript, so nothing it does can depend on one.
describe('RulesService.issuesFor without a student', () => {
  const TRANSCRIPT_CODES = ['prerequisite_not_met', 'already_passed', 'already_in_progress', 'requirement_not_covered'];

  it('checks the plan against its own curriculum and never reads a transcript', async () => {
    const { rules, reads, transcriptReads } = service({ programCode: 'OTHER', cohortYear: 2030 });
    const report = await rules.issuesFor(plan('ZZPROG', 2024), null);
    expect(transcriptReads).toEqual([]);
    expect(reads.sort()).toEqual(['catalog:ZZB1,ZZX9', 'rules:ZZPROG-2024']);
    expect(report.planId).toBe('plan-1');
    expect(report.terms).toEqual([{ term: { year: 2026, number: 1 }, kind: 'main', credits: 7, caps: { min: 10, max: 22 } }]);
    // No transcript: ZZB1 is not "already passed", and nothing is covered but what the plan places.
    expect(report.issues.map((i) => i.code)).not.toContain('already_passed');
    expect(report.coverage.graduation).toBe('not_yet');
  });

  // What follows from the plan and its curriculum alone is the same with and without the transcript:
  // the loads, the caps and every issue that is not one of the four the transcript decides.
  it('agrees with the check that reads the transcript on everything the transcript does not decide', async () => {
    const withTranscript = service(ANSWERS);
    const own = await withTranscript.rules.issuesFor(plan('ZZPROG', 2024), 'user-1');
    expect(withTranscript.transcriptReads).toEqual(['user-1']);
    const alone = await service(ANSWERS).rules.issuesFor(plan('ZZPROG', 2024), null);
    const planOnly = (r: typeof own) => r.issues.filter((i) => !TRANSCRIPT_CODES.includes(i.code));
    expect(planOnly(alone)).toEqual(planOnly(own));
    expect(planOnly(own).map((i) => `${i.code}:${i.courseCode}`)).toEqual([
      'load_below_minimum:null',
      'offering_terms_not_recorded:ZZB1',
      'not_in_curriculum:ZZX9',
      'prerequisites_not_recorded:ZZX9',
      'offering_terms_not_recorded:ZZX9',
    ]);
    expect(alone.terms).toEqual(own.terms);
    expect(alone.trainingType).toBe(own.trainingType);
    // The rest does differ, which is why a caller without the transcript must not show it.
    expect(alone.issues).not.toEqual(own.issues);
    expect(alone.coverage).not.toEqual(own.coverage);
  });

  it('fails loudly when the plan’s curriculum is gone', async () => {
    await expect(service(ANSWERS).rules.issuesFor(plan('ZZPROG', 2031), null)).rejects.toThrow('The curriculum of plan plan-1 is missing');
  });
});

describe('the rule engine library', () => {
  const PURE_IMPORTS = ['../common/collections.js', '../terms/term.js', '../transcript/transcript-entry.js'];
  const LOADERS = ['rules.module.ts', 'rules.service.ts'];
  const LOADER_PATHS = LOADERS.map((f) => join(__dirname, f));
  const runtimeImports = (path: string) =>
    [...readFileSync(path, 'utf8').matchAll(/^(?:import|export) (?!type )[^;]*? from '([^']+)';|^import '([^']+)';/gms)].map((m) => (m[1] ?? m[2])!);
  const sourcePath = (from: string, source: string) => resolve(dirname(from), source.replace(/\.js$/, '.ts'));

  it('imports no framework, database or HTTP code at run time', () => {
    const files = readdirSync(__dirname).filter((f) => f.endsWith('.ts') && !f.endsWith('.spec.ts') && !LOADERS.includes(f));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      for (const source of runtimeImports(join(__dirname, f))) {
        const inEngine = source.startsWith('./') && !LOADER_PATHS.includes(sourcePath(join(__dirname, f), source));
        expect(inEngine || PURE_IMPORTS.includes(source), `${f} imports ${source}`).toBe(true);
      }
    }
    const seen = new Set<string>();
    const pending = PURE_IMPORTS.map((source) => sourcePath(join(__dirname, 'index.ts'), source));
    while (pending.length) {
      const path = pending.pop()!;
      if (seen.has(path)) continue;
      seen.add(path);
      for (const source of runtimeImports(path)) {
        const next = sourcePath(path, source);
        expect(source.startsWith('.') && !LOADER_PATHS.includes(next), `${path} imports ${source}`).toBe(true);
        pending.push(next);
      }
    }
  });
});
