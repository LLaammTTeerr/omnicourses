import type { TrainingType } from '../curriculum/curriculum-rules.js';
import type { Term } from '../terms/term.js';
import { CITATIONS } from './types.js';

export const TERM_KINDS = ['main', 'summer'] as const;
export type TermKind = (typeof TERM_KINDS)[number];

const STANDARD_SUMMER_TERM_NUMBER = 3;

export function termKind(trainingType: TrainingType | null, number: Term['number']): TermKind | null {
  if (trainingType === null) return null;
  return trainingType === 'standard' && number === STANDARD_SUMMER_TERM_NUMBER ? 'summer' : 'main';
}

export interface CreditCaps {
  min: number | null;
  max: number;
}

const THREE_MAIN_TERM_CAPS: CreditCaps = { min: 10, max: 22 };
const STANDARD_MAIN_TERM_CAPS: CreditCaps = { min: 14, max: 25 };
const STANDARD_SUMMER_TERM_CAPS: CreditCaps = { min: null, max: 12 };

export function creditCaps(trainingType: TrainingType, kind: TermKind): CreditCaps {
  if (trainingType !== 'standard') return { ...THREE_MAIN_TERM_CAPS };
  return kind === 'main' ? { ...STANDARD_MAIN_TERM_CAPS } : { ...STANDARD_SUMMER_TERM_CAPS };
}

export interface LoadCourse {
  credits: number;
  excludedFromMinimum?: boolean;
}

export const CAP_RULES = ['below_minimum', 'above_maximum'] as const;
export type CapRule = (typeof CAP_RULES)[number];

export const PETITION_NOTE = `Allowed by a petition that the faculty supports and the Rector approves (${CITATIONS.capPetition}).`;

export interface CapViolation {
  rule: CapRule;
  credits: number;
  limit: number;
  citation: string;
  petition: string;
}

export interface TermLoadCheck {
  kind: TermKind | null;
  credits: number;
  caps: CreditCaps | null;
  violations: CapViolation[];
}

const sumCredits = (courses: readonly LoadCourse[]): number => courses.reduce((sum, c) => sum + c.credits, 0);

const capViolation = (rule: CapRule, credits: number, limit: number): CapViolation => ({
  rule,
  credits,
  limit,
  citation: CITATIONS.creditCaps,
  petition: PETITION_NOTE,
});

export function checkTermLoad(trainingType: TrainingType | null, number: Term['number'], courses: readonly LoadCourse[]): TermLoadCheck {
  const credits = sumCredits(courses);
  const kind = termKind(trainingType, number);
  if (trainingType === null || kind === null) return { kind, credits, caps: null, violations: [] };
  const caps = creditCaps(trainingType, kind);
  const violations: CapViolation[] = [];
  const towardMinimum = trainingType === 'standard' ? sumCredits(courses.filter((c) => !c.excludedFromMinimum)) : credits;
  if (caps.min !== null && towardMinimum < caps.min) violations.push(capViolation('below_minimum', towardMinimum, caps.min));
  if (credits > caps.max) violations.push(capViolation('above_maximum', credits, caps.max));
  return { kind, credits, caps, violations };
}
