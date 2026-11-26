import type { Term } from '../terms/term.js';

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

type OfferingTermCheck = { status: 'not_recorded' } | { status: 'offered' } | { status: 'not_offered'; offeredTermNumbers: Term['number'][] };

export function checkOfferingTerm(offeredTermNumbers: readonly Term['number'][] | null, term: Term): OfferingTermCheck {
  if (offeredTermNumbers === null) return { status: 'not_recorded' };
  if (offeredTermNumbers.includes(term.number)) return { status: 'offered' };
  return { status: 'not_offered', offeredTermNumbers: [...new Set(offeredTermNumbers)].sort((a, b) => a - b) };
}
