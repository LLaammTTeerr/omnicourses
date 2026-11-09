import { plainToInstance } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { TermDto } from '../terms/term.dto.js';
import { OnboardingDto } from './onboarding.dto.js';

// Validated on a fixed day, 9 November 2026 in Vietnam: the current term is 2026–2027 term 1.
const answers = (overrides: Record<string, unknown> = {}) => ({
  program: 'APCS',
  cohort: 2024,
  targetGraduationTerm: { year: 2027, number: 2 },
  creditsPerTerm: 18,
  internshipTerm: { year: 2027, number: 1 },
  finished: true,
  ...overrides,
});

const flatten = (errors: ValidationError[], path = ''): string[] =>
  errors.flatMap((e) => [...Object.keys(e.constraints ?? {}).map((c) => `${path}${e.property}:${c}`), ...flatten(e.children ?? [], `${path}${e.property}.`)]);

const messages = (errors: ValidationError[]): string[] =>
  errors.flatMap((e) => [...Object.values(e.constraints ?? {}), ...messages(e.children ?? [])]);

const check = async (body: Record<string, unknown>) => validate(plainToInstance(OnboardingDto, body));
const errorsFor = async (body: Record<string, unknown>) => flatten(await check(body));

describe('OnboardingDto validation', () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T03:00:00Z'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('accepts every answer set (USER-01d)', async () => {
    expect(await errorsFor(answers())).toEqual([]);
  });

  it('turns terms into TermDto and keeps "none" as it is', () => {
    expect(plainToInstance(OnboardingDto, answers()).targetGraduationTerm).toBeInstanceOf(TermDto);
    expect(plainToInstance(OnboardingDto, answers({ internshipTerm: 'none' })).internshipTerm).toBe('none');
  });

  it('accepts every goal left unset (USER-01c)', async () => {
    expect(await errorsFor(answers({ targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null }))).toEqual([]);
  });

  it('accepts no internship planned (USER-01h)', async () => {
    expect(await errorsFor(answers({ internshipTerm: 'none' }))).toEqual([]);
  });

  it('accepts program and cohort saved before the goal step, unfinished (USER-01l)', async () => {
    expect(await errorsFor(answers({ targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: false }))).toEqual([]);
  });

  it('accepts nothing chosen yet when the program is not listed (USER-01k)', async () => {
    expect(await errorsFor(answers({ program: null, cohort: null, finished: false }))).toEqual([]);
  });

  it.each([2024, 2025])('accepts APCS %i (USER-01b, USER-01i)', async (cohort) => {
    expect(await errorsFor(answers({ cohort }))).toEqual([]);
  });

  it.each([
    ['a program not offered (CLC)', { program: 'CLC', cohort: 2025 }, ['program:isIn']],
    ['a cohort the curriculum data lacks (USER-01b)', { cohort: 2023 }, ['cohort:isOfferedCohort']],
    ['a cohort sent as text', { cohort: '2024' }, ['cohort:isOfferedCohort']],
    ['a cohort without a program', { program: null, cohort: 2024, finished: false }, ['cohort:isOfferedCohort']],
    ['a program without a cohort', { cohort: null }, ['cohort:isOfferedCohort']],
    ['finished without a program', { program: null, cohort: null }, ['finished:finishedNeedsProgram']],
  ])('refuses %s', async (_, overrides, errors) => {
    expect(await errorsFor(answers(overrides))).toEqual(errors);
  });

  it.each([
    ['0 (USER-01g)', 0],
    ['-1 (USER-01f)', -1],
    ['2.5 (USER-01f)', 2.5],
    ['"abc" (USER-01f)', 'abc'],
    ['"18" as text', '18'],
  ])('refuses credits per term %s, saying what a valid value is and not citing the credit cap', async (_, creditsPerTerm) => {
    const errors = await check(answers({ creditsPerTerm }));
    expect(flatten(errors)).toEqual(['creditsPerTerm:isCreditsPerTerm']);
    expect(messages(errors)).toEqual(['creditsPerTerm must be a whole number of 1 or more']);
  });

  it('refuses credits per term too large for its column, with no 500', async () => {
    expect(messages(await check(answers({ creditsPerTerm: 2_147_483_648 })))).toEqual(['creditsPerTerm is too large to store']);
  });

  it.each([1, 13, 26, 40, 1000])('stores credits per term %i with no upper limit (USER-01e, USER-01g)', async (creditsPerTerm) => {
    expect(await errorsFor(answers({ creditsPerTerm }))).toEqual([]);
  });

  it.each(['targetGraduationTerm', 'internshipTerm'])('%s: accepts the current term and term 3 eight academic years ahead (B1 §6 item 4)', async (field) => {
    expect(await errorsFor(answers({ [field]: { year: 2026, number: 1 } }))).toEqual([]);
    expect(await errorsFor(answers({ [field]: { year: 2034, number: 3 } }))).toEqual([]);
  });

  it.each(['targetGraduationTerm', 'internshipTerm'])('%s: refuses a past term and one more than eight academic years ahead', async (field) => {
    const past = await check(answers({ [field]: { year: 2025, number: 3 } }));
    expect(flatten(past)).toEqual([`${field}:isGoalTerm`]);
    expect(messages(past)).toEqual([`${field} must be from 2026–2027 term 1 (the current term) to 2034–2035 term 3`]);
    expect(await errorsFor(answers({ [field]: { year: 2035, number: 1 } }))).toEqual([`${field}:isGoalTerm`]);
  });

  it.each(['targetGraduationTerm', 'internshipTerm'])('%s: refuses a malformed term with the term rules', async (field) => {
    expect(await errorsFor(answers({ [field]: { year: 2027, number: 4 } }))).toEqual([`${field}.number:isIn`]);
    expect(await errorsFor(answers({ [field]: '2027-1' }))).toContain(`${field}:isObject`);
  });

  it('refuses an internship value other than a term, "none" or null', async () => {
    expect(await errorsFor(answers({ internshipTerm: 'later' }))).toContain('internshipTerm:isObject');
  });

  it('refuses "none" as the target graduation term', async () => {
    expect(await errorsFor(answers({ targetGraduationTerm: 'none' }))).toContain('targetGraduationTerm:isObject');
  });

  it('needs every key: a PUT replaces all answers, so a missing one is refused, not cleared', async () => {
    for (const key of Object.keys(answers())) {
      const rest: Record<string, unknown> = answers();
      delete rest[key];
      expect(await errorsFor(rest), key).not.toEqual([]);
    }
  });
});
