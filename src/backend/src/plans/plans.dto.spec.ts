import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { describe, expect, it } from 'vitest';
import { CreatePlanDto, DuplicatePlanDto, PlanBoardDto, RenamePlanDto } from './plans.dto.js';

// Synthetic codes only (AGENTS.md hard rule 3).
const GROUP = '3f2b8c1e-0d4a-4c6b-9e1f-2a3b4c5d6e7f';
const course = (overrides: Record<string, unknown> = {}) => ({ kind: 'course', courseCode: 'ZZ001', ...overrides });
const slot = (overrides: Record<string, unknown> = {}) => ({ kind: 'slot', requirementGroupId: GROUP, credits: 3, ...overrides });
const term = (placements: unknown[], t: unknown = { year: 2030, number: 1 }) => ({ term: t, placements });

type Errors = Awaited<ReturnType<typeof validate>>;
const flatten = (errors: Errors, path: string): string[] =>
  errors.flatMap((e) => [...Object.keys(e.constraints ?? {}).map((c) => `${path}${e.property}:${c}`), ...flatten(e.children ?? [], `${path}${e.property}.`)]);

async function errorsFor<T extends object>(cls: new () => T, body: unknown): Promise<string[]> {
  return flatten(await validate(plainToInstance(cls, body) as object), '');
}
const boardErrors = (terms: unknown) => errorsFor(PlanBoardDto, { terms });

describe('PlanBoardDto validation', () => {
  it('accepts courses and slots, with the other kind’s fields null or left out', async () => {
    expect(await boardErrors([term([course(), slot(), course({ courseCode: 'ZZ002', requirementGroupId: null, credits: null }), slot({ courseCode: null })])])).toEqual([]);
    expect(await boardErrors([])).toEqual([]);
  });

  it.each([
    ['an unknown kind', course({ kind: 'elective' }), 'terms.0.placements.0.kind:isIn'],
    ['a course without a code', course({ courseCode: undefined }), 'terms.0.placements.0.courseCode:matches'],
    ['a lower-case code (codes are exact, ADR 0007)', course({ courseCode: 'zz001' }), 'terms.0.placements.0.courseCode:matches'],
    ['a course with credits', course({ credits: 4 }), 'terms.0.placements.0.credits:onlyForslot'],
    ['a course with a group', course({ requirementGroupId: GROUP }), 'terms.0.placements.0.requirementGroupId:onlyForslot'],
    ['a slot without a group', slot({ requirementGroupId: undefined }), 'terms.0.placements.0.requirementGroupId:isUuid'],
    ['a slot without credits', slot({ credits: null }), 'terms.0.placements.0.credits:isInt'],
    ['a slot with 0 credits', slot({ credits: 0 }), 'terms.0.placements.0.credits:min'],
    ['a slot with 31 credits', slot({ credits: 31 }), 'terms.0.placements.0.credits:max'],
    ['a slot with a course code', slot({ courseCode: 'ZZ001' }), 'terms.0.placements.0.courseCode:onlyForcourse'],
  ])('refuses %s', async (_, placement, error) => {
    expect(await boardErrors([term([placement])])).toContain(error);
  });

  it('refuses a missing or malformed term and an empty term', async () => {
    expect(await boardErrors([{ placements: [course()] }])).toContain('terms.0.term:isDefined');
    expect(await boardErrors([term([course()], { year: 2030, number: 4 })])).toContain('terms.0.term.number:isIn');
    expect(await boardErrors([term([course()], { year: 1999, number: 1 })])).toContain('terms.0.term.year:min');
    expect(await boardErrors([term([])])).toContain('terms.0.placements:arrayMinSize');
  });

  it('refuses a body without terms and an oversized one', async () => {
    expect(await errorsFor(PlanBoardDto, {})).toContain('terms:isArray');
    expect(await boardErrors(Array.from({ length: 31 }, () => term([course()])))).toContain('terms:arrayMaxSize');
    expect(await boardErrors([term(Array.from({ length: 31 }, () => slot()))])).toContain('terms.0.placements:arrayMaxSize');
  });
});

describe('plan names', () => {
  it('trims the name and refuses an empty or long one', async () => {
    expect(plainToInstance(RenamePlanDto, { name: '  Main plan ' }).name).toBe('Main plan');
    expect(await errorsFor(RenamePlanDto, { name: '   ' })).toEqual(['name:minLength']);
    expect(await errorsFor(RenamePlanDto, { name: 'x'.repeat(101) })).toEqual(['name:maxLength']);
    expect(await errorsFor(RenamePlanDto, {})).toContain('name:isString');
  });

  it('lets a copy keep the original name', async () => {
    expect(await errorsFor(DuplicatePlanDto, {})).toEqual([]);
    expect(await errorsFor(DuplicatePlanDto, { name: '' })).toEqual(['name:minLength']);
  });

  it('needs a program and cohort to create a plan, placements optional', async () => {
    expect(await errorsFor(CreatePlanDto, { name: 'Main plan', programCode: 'ZZ', cohortYear: 2030 })).toEqual([]);
    expect(await errorsFor(CreatePlanDto, { name: 'Main plan', programCode: 'ZZ', cohortYear: 2030, terms: [term([course()])] })).toEqual([]);
    expect(await errorsFor(CreatePlanDto, { name: 'Main plan' })).toEqual(expect.arrayContaining(['programCode:isString', 'cohortYear:isInt']));
  });
});
