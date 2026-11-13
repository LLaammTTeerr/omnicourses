import { describe, expect, it } from 'vitest';
import { NOT_STARTED } from './api.js';
import { creditsProblem, errorsByField, goalAnswers, goalDraft, goalTermChoices, resumeStep } from './answers.js';
import { onboarding } from './testing/fixtures.js';

describe('creditsProblem (UC-01 §7: 1 or more, no upper limit)', () => {
  it.each(['', '  ', '1', '18', '40', '2147483647'])('accepts %j', (text) => {
    expect(creditsProblem(text)).toBeNull();
  });

  it.each(['0', '-1', '2.5', '1e2', 'abc', '18 TC'])('refuses %j', (text) => {
    expect(creditsProblem(text)).toBe('whole');
  });

  it('refuses a number too large to store', () => {
    expect(creditsProblem('2147483648')).toBe('tooLarge');
  });
});

describe('goalDraft and goalAnswers', () => {
  it('round-trips every kind of answer', () => {
    for (const answers of [
      onboarding(),
      onboarding({ targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null }),
      onboarding({ internshipTerm: { year: 2027, number: 3 }, creditsPerTerm: 40 }),
    ]) {
      const { targetGraduationTerm, creditsPerTerm, internshipTerm } = answers;
      expect(goalAnswers(goalDraft(answers))).toEqual({ targetGraduationTerm, creditsPerTerm, internshipTerm });
    }
  });

  it('keeps "none planned" apart from not answered', () => {
    expect(goalAnswers({ graduation: '', credits: '', internship: 'none' }).internshipTerm).toBe('none');
    expect(goalAnswers({ graduation: '', credits: '', internship: '' }).internshipTerm).toBeNull();
    expect(goalAnswers({ graduation: '', credits: ' 18 ', internship: '' }).creditsPerTerm).toBe(18);
  });
});

describe('goalTermChoices', () => {
  it('keeps a saved term the window has passed, first', () => {
    const now = new Date('2026-11-09T03:00:00Z');
    const choices = goalTermChoices([{ year: 2025, number: 2 }, null], now);
    expect(choices[0]).toEqual({ year: 2025, number: 2 });
    expect(choices[1]).toEqual({ year: 2026, number: 1 });
    expect(goalTermChoices([{ year: 2026, number: 1 }], now)).toHaveLength(goalTermChoices([], now).length);
  });
});

describe('resumeStep (UC-01 A8)', () => {
  it('resumes at the first unanswered step', () => {
    expect(resumeStep(NOT_STARTED)).toBe(0);
    expect(resumeStep({ ...NOT_STARTED, program: 'APCS' })).toBe(1);
    expect(resumeStep(onboarding({ finished: false }))).toBe(2);
  });
});

describe('errorsByField', () => {
  it('files each API message under the answer it names', () => {
    expect(
      errorsByField(['creditsPerTerm must be a whole number of 1 or more', 'targetGraduationTerm must be from 2026–2027 term 1 (the current term) to 2034–2035 term 3', 'something else']),
    ).toEqual({
      creditsPerTerm: ['creditsPerTerm must be a whole number of 1 or more'],
      targetGraduationTerm: ['targetGraduationTerm must be from 2026–2027 term 1 (the current term) to 2034–2035 term 3'],
    });
  });
});
