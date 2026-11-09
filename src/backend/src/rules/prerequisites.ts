// Prerequisites and offering terms. Neither the database nor the APCS PDFs record them yet
// (ADR 0011, "Prerequisites, offering terms and implementation gates"): the checks take the data
// as input, null meaning "not recorded", and never invent it. Pure functions.
import type { Term } from '../terms/term.js';

export type PrerequisiteCheck =
  /** No prerequisite data for the course: the check cannot be made. Not the same as "none". */
  | { status: 'not_recorded' }
  /** The course is recorded as having no prerequisite. */
  | { status: 'none' }
  | { status: 'met' }
  | { status: 'not_met'; missing: string[] };

/**
 * QĐ 1175/QĐ-KHTN Điều 3.1.c: a prerequisite (học phần tiên quyết) of A must be passed before A
 * may be taken. `prerequisites` is the course's prerequisite codes, or null when not recorded.
 */
export function checkPrerequisites(prerequisites: readonly string[] | null, passedCodes: ReadonlySet<string>): PrerequisiteCheck {
  if (prerequisites === null) return { status: 'not_recorded' };
  if (prerequisites.length === 0) return { status: 'none' };
  const missing = [...new Set(prerequisites)].filter((code) => !passedCodes.has(code)).sort();
  return missing.length ? { status: 'not_met', missing } : { status: 'met' };
}

export type OfferingTermCheck = { status: 'not_recorded' } | { status: 'offered' } | { status: 'not_offered'; offeredTermNumbers: Term['number'][] };

/** Whether a course is taught in a term of this number. `offeredTermNumbers` null: not recorded. */
export function checkOfferingTerm(offeredTermNumbers: readonly Term['number'][] | null, term: Term): OfferingTermCheck {
  if (offeredTermNumbers === null) return { status: 'not_recorded' };
  if (offeredTermNumbers.includes(term.number)) return { status: 'offered' };
  return { status: 'not_offered', offeredTermNumbers: [...new Set(offeredTermNumbers)].sort((a, b) => a - b) };
}
