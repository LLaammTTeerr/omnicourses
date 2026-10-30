// Shared term types (ADR 0009), not a Nest module: the transcript, plans, offering terms
// and the planner all import Term from here, so none of them depends on another for it.

/** A term (ADR 0009): `year` 2026 is the academic year 2026–2027; 1 and 2 are main terms, 3 is summer. */
export interface Term {
  year: number;
  number: 1 | 2 | 3;
}
