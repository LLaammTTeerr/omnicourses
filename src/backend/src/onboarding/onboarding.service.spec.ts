import type { DataSource, Repository } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { OnboardingAnswers } from './onboarding-answers.entity.js';
import { OnboardingDto } from './onboarding.dto.js';
import { OnboardingService, toColumns, toOnboarding } from './onboarding.service.js';

const row = (columns: Partial<OnboardingAnswers>): OnboardingAnswers =>
  ({ userId: '00000000-0000-4000-8000-000000000000', finishedAt: null, createdAt: new Date(), updatedAt: new Date(), ...columns }) as OnboardingAnswers;

const asRow = (dto: OnboardingDto, finishedAt: Date | null) => row({ ...toColumns(dto), finishedAt });

describe('onboarding answers and their columns', () => {
  it('reads every answer as null and finished false before the first save (USER-01c)', () => {
    expect(toOnboarding(null)).toEqual({ program: null, cohort: null, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: false });
  });

  it('reads back every answer it stores (USER-01d)', () => {
    const dto: OnboardingDto = {
      program: 'APCS',
      cohort: 2024,
      targetGraduationTerm: { year: 2027, number: 2 },
      creditsPerTerm: 18,
      internshipTerm: { year: 2027, number: 1 },
      finished: true,
    };
    expect(toOnboarding(asRow(dto, new Date()))).toEqual(dto);
  });

  it('stores "none planned" apart from not set (USER-01h)', () => {
    const base: OnboardingDto = { program: 'APCS', cohort: 2025, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: 'none', finished: true };
    expect(toColumns(base)).toMatchObject({ internshipTermYear: null, internshipTermNumber: null, noInternshipPlanned: true });
    expect(toOnboarding(asRow(base, new Date())).internshipTerm).toBe('none');

    const unset = { ...base, internshipTerm: null };
    expect(toColumns(unset)).toMatchObject({ internshipTermYear: null, internshipTermNumber: null, noInternshipPlanned: false });
    expect(toOnboarding(asRow(unset, new Date())).internshipTerm).toBeNull();
  });

  it('reads finished from finished_at (USER-01l)', () => {
    const dto: OnboardingDto = { program: 'APCS', cohort: 2024, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: false };
    expect(toOnboarding(asRow(dto, null)).finished).toBe(false);
  });
});

describe('OnboardingService.offers', () => {
  // The answer the plans API asks for (Project Lead, 25 November 2026): exactly onboarding's own offer.
  it('offers the cohorts onboarding offers, and no other cohort or program', () => {
    const onboarding = new OnboardingService({} as DataSource, {} as Repository<OnboardingAnswers>);
    expect([onboarding.offers('APCS', 2024), onboarding.offers('APCS', 2025)]).toEqual([true, true]);
    for (const [program, cohort] of [['APCS', 2023], ['APCS', 2026], ['CLC', 2024], ['apcs', 2024], ['toString', 2024]] as const) {
      expect(onboarding.offers(program, cohort)).toBe(false);
    }
  });
});
