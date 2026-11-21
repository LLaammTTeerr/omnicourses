import { goalTerms, parseTermKey, sameTerm, termKey, type Term } from '../terms.js';
import { NO_INTERNSHIP, type Onboarding } from './api.js';

// The onboarding answers as a form edits them: every select holds a string, "" meaning not answered. Shared by the
// wizard and the settings section, which save the same object (UC-01 A9).

/** The goal fields of the form: a term key ("2026-1") or "", the credits as typed, and a term key, "none" or "". */
export interface GoalDraft {
  graduation: string;
  credits: string;
  internship: string;
}

export function goalDraft(answers: Onboarding): GoalDraft {
  const internship = answers.internshipTerm;
  return {
    graduation: answers.targetGraduationTerm ? termKey(answers.targetGraduationTerm) : '',
    credits: answers.creditsPerTerm === null ? '' : String(answers.creditsPerTerm),
    internship: internship === null ? '' : internship === NO_INTERNSHIP ? NO_INTERNSHIP : termKey(internship),
  };
}

// The column the API stores credits in is a 32-bit integer.
const MAX_STORED_CREDITS = 2_147_483_647;

export type CreditsProblem = 'whole' | 'tooLarge';

/** Credits per term: empty means not set; otherwise a whole number of 1 or more, with no upper limit (UC-01 §7). */
export function creditsProblem(text: string): CreditsProblem | null {
  const typed = text.trim();
  if (typed === '') return null;
  if (!/^\d+$/.test(typed) || Number(typed) < 1) return 'whole';
  return Number(typed) > MAX_STORED_CREDITS ? 'tooLarge' : null;
}

/** The goal answers to send. Call only once creditsProblem is null. */
export function goalAnswers(draft: GoalDraft): Pick<Onboarding, 'targetGraduationTerm' | 'creditsPerTerm' | 'internshipTerm'> {
  const credits = draft.credits.trim();
  return {
    targetGraduationTerm: parseTermKey(draft.graduation),
    creditsPerTerm: credits === '' ? null : Number(credits),
    internshipTerm: draft.internship === NO_INTERNSHIP ? NO_INTERNSHIP : parseTermKey(draft.internship),
  };
}

/** The terms a goal may name, plus a saved one the window has since passed, so the select still shows it. */
export function goalTermChoices(saved: (Term | null)[], now: Date = new Date()): Term[] {
  const terms = goalTerms(now);
  const old = saved.filter((term): term is Term => term !== null && !terms.some((t) => sameTerm(t, term)));
  return [...old, ...terms];
}

/** The step onboarding resumes at (UC-01 A8): the program, the cohort, then the goal, which is optional. */
export function resumeStep(answers: Onboarding): number {
  if (answers.program === null) return 0;
  if (answers.cohort === null) return 1;
  return 2;
}

export type AnswerField = 'program' | 'cohort' | 'targetGraduationTerm' | 'creditsPerTerm' | 'internshipTerm' | 'finished';

/** The API's 400 messages by the answer they name ("creditsPerTerm must be …"), so each shows under its field. */
export function errorsByField(details: readonly string[]): Partial<Record<AnswerField, string[]>> {
  const errors: Partial<Record<AnswerField, string[]>> = {};
  for (const detail of details) {
    const field = /^(program|cohort|targetGraduationTerm|creditsPerTerm|internshipTerm|finished)\b/.exec(detail)?.[1] as AnswerField | undefined;
    if (field) (errors[field] ??= []).push(detail);
  }
  return errors;
}
