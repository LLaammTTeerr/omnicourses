import { describe, expect, it } from 'vitest';
import contract from '../../../backend/openapi.json';
import { contractEnum } from '../testing/contract.js';
import type { Program } from './api.js';
import { OFFERED_COHORTS, programChoices, programName } from './programs.js';

const onboardingDto = contract.components.schemas.OnboardingDto;
const program = (code: string, cohortYears: number[]): Program => ({ code, nameVi: `Chương trình ${code}`, nameEn: null, faculty: null, trainingType: null, cohortYears });

describe('the offered programs against the contract', () => {
  it('offers the programs and cohorts the API accepts (B1 §6 item 1)', () => {
    expect(contractEnum('OnboardingDto', 'program').filter((program) => program !== null)).toEqual(Object.keys(OFFERED_COHORTS).sort());
    const offered = /Offered: (.+?)\. /.exec(onboardingDto.properties.cohort.description)?.[1];
    expect(offered).toBe(Object.entries(OFFERED_COHORTS).map(([program, cohorts]) => `${program} ${cohorts.join(', ')}`).join('; '));
  });
});

describe('programChoices', () => {
  it('offers APCS with the offered cohorts that have a curriculum, and lists the rest as not offered (A7)', () => {
    const choices = programChoices([program('CLCZZ', [2025]), program('APCS', [2023, 2024, 2025])]);
    expect(choices.map(({ code, cohorts, offered }) => ({ code, cohorts, offered }))).toEqual([
      { code: 'APCS', cohorts: [2024, 2025], offered: true },
      { code: 'CLCZZ', cohorts: [], offered: false },
    ]);
  });

  it('still offers APCS when the program list could not say more', () => {
    expect(programChoices([])).toEqual([{ code: 'APCS', program: null, cohorts: [2024, 2025], offered: true }]);
  });
});

describe('programName', () => {
  it('names a program in the language on screen, in Vietnamese without an English name, by code before the list loads', () => {
    const [apcs] = programChoices([{ ...program('APCS', [2024]), nameEn: 'Advanced Program' }]);
    expect(programName(apcs!, 'en')).toBe('Advanced Program');
    expect(programName(apcs!, 'vi')).toBe('Chương trình APCS');
    expect(programName(programChoices([])[0]!, 'en')).toBe('APCS');
  });
});
