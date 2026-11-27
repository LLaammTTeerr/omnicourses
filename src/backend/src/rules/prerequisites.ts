import { compareTerms, type Term } from '../terms/term.js';
import { type CourseRecord, isCompleted, recordBefore } from './attempts.js';

type PrerequisiteCheck =
  | { status: 'not_recorded' }
  | { status: 'none' }
  | { status: 'met' }
  | { status: 'not_met'; missing: string[] };

export function checkPrerequisites(prerequisites: readonly string[] | null, passedCodes: ReadonlySet<string>): PrerequisiteCheck {
  if (prerequisites === null) return { status: 'not_recorded' };
  if (prerequisites.length === 0) return { status: 'none' };
  const missing = [...new Set(prerequisites)].filter((code) => !passedCodes.has(code)).sort();
  return missing.length ? { status: 'not_met', missing } : { status: 'met' };
}

export function passedOnly(records: ReadonlyMap<string, CourseRecord>): Set<string> {
  const passed = new Set<string>();
  for (const record of records.values()) {
    if (record.passed) passed.add(record.code);
  }
  return passed;
}

export function passedOrAssumedBefore(records: ReadonlyMap<string, CourseRecord>, plannedEarlier: ReadonlyMap<string, Term>, term: Term): Set<string> {
  const passed = new Set<string>();
  for (const [code, placedIn] of plannedEarlier) {
    const recorded = (records.get(code)?.attempts ?? []).some((a) => isCompleted(a) && compareTerms(a.term, placedIn) >= 0 && compareTerms(a.term, term) < 0);
    if (!recorded) passed.add(code);
  }
  for (const record of records.values()) {
    const standing = recordBefore(record, term);
    if (standing && (standing.passed || standing.inProgress)) passed.add(record.code);
  }
  return passed;
}

type OfferingTermCheck = { status: 'not_recorded' } | { status: 'offered' } | { status: 'not_offered'; offeredTermNumbers: Term['number'][] };

export function checkOfferingTerm(offeredTermNumbers: readonly Term['number'][] | null, term: Term): OfferingTermCheck {
  if (offeredTermNumbers === null) return { status: 'not_recorded' };
  if (offeredTermNumbers.includes(term.number)) return { status: 'offered' };
  return { status: 'not_offered', offeredTermNumbers: [...new Set(offeredTermNumbers)].sort((a, b) => a - b) };
}
