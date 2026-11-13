// Terms and credit caps (QĐ 1175/QĐ-KHTN Điều 6.4 and 7.2, ADR 0009 and ADR 0012). Pure functions.
import type { TrainingType } from '../curriculum/curriculum-types.js';
import type { Term } from '../terms/term.js';

export const TERM_KINDS = ['main', 'summer'] as const;
export type TermKind = (typeof TERM_KINDS)[number];

/**
 * Điều 6.4: a đại trà (standard) program has two main terms and may add a summer term, numbered 3
 * (ADR 0009); Tiên tiến, Liên kết and Chất lượng cao programs have three main terms. Null when the
 * program's training type is not recorded.
 */
export function termKind(trainingType: TrainingType | null, number: Term['number']): TermKind | null {
  if (trainingType === null) return null;
  return trainingType === 'standard' && number === 3 ? 'summer' : 'main';
}

export interface CreditCaps {
  /** Null: no minimum (a đại trà summer term, ADR 0012). */
  min: number | null;
  max: number;
}

/**
 * Điều 7.2.a–b, ADR 0012: Tiên tiến, Liên kết and Chất lượng cao take 10–22 credits in every term;
 * đại trà 14–25 in a main term and at most 12 in a summer term, with no minimum in summer.
 */
export function creditCaps(trainingType: TrainingType, kind: TermKind): CreditCaps {
  if (trainingType !== 'standard') return { min: 10, max: 22 };
  return kind === 'main' ? { min: 14, max: 25 } : { min: null, max: 12 };
}

/** One course in a term's load. Điều 7.1.b: new courses, retakes and grade improvements all count. */
export interface LoadCourse {
  credits: number;
  /**
   * Left out of the đại trà minimum: Giáo dục quốc phòng, Giáo dục thể chất and general foreign
   * language (Điều 7.2.a). Ignored for every other training type.
   */
  excludedFromMinimum?: boolean;
}

export const CAP_RULES = ['below_minimum', 'above_maximum'] as const;
export type CapRule = (typeof CAP_RULES)[number];

export const CAP_CITATION = 'QĐ 1175/QĐ-KHTN Điều 7.2';
export const PETITION_NOTE =
  'Allowed by a petition that the faculty supports and the Rector approves (QĐ 1175/QĐ-KHTN Điều 7.2.b).';

/** A load outside the caps. It never blocks a plan (ADR 0012): the regulation allows it by petition. */
export interface CapViolation {
  rule: CapRule;
  /** The credits compared with the limit. */
  credits: number;
  limit: number;
  citation: string;
  petition: string;
}

export interface TermLoadCheck {
  kind: TermKind | null;
  credits: number;
  /** Null when the training type is not recorded: no cap is checked. */
  caps: CreditCaps | null;
  violations: CapViolation[];
}

export function checkTermLoad(trainingType: TrainingType | null, number: Term['number'], courses: readonly LoadCourse[]): TermLoadCheck {
  const credits = courses.reduce((sum, c) => sum + c.credits, 0);
  const kind = termKind(trainingType, number);
  if (trainingType === null || kind === null) return { kind, credits, caps: null, violations: [] };
  const caps = creditCaps(trainingType, kind);
  const violations: CapViolation[] = [];
  const towardMinimum =
    trainingType === 'standard' ? courses.filter((c) => !c.excludedFromMinimum).reduce((sum, c) => sum + c.credits, 0) : credits;
  const violation = (rule: CapRule, counted: number, limit: number): CapViolation => ({
    rule,
    credits: counted,
    limit,
    citation: CAP_CITATION,
    petition: PETITION_NOTE,
  });
  if (caps.min !== null && towardMinimum < caps.min) violations.push(violation('below_minimum', towardMinimum, caps.min));
  if (credits > caps.max) violations.push(violation('above_maximum', credits, caps.max));
  return { kind, credits, caps, violations };
}
