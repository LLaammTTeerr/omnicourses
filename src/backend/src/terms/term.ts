// Shared term types (ADR 0009), not a Nest module: the transcript, plans, offering terms
// and the planner all import Term from here, so none of them depends on another for it.

export const TERM_NUMBERS = [1, 2, 3] as const;

/** A term (ADR 0009): `year` 2026 is the academic year 2026–2027; terms 1, 2 and 3. Term 3 is a main term in APCS (QĐ 1175/QĐ-KHTN Điều 6.4b) and can be a summer term in other programs. */
export interface Term {
  year: number;
  number: (typeof TERM_NUMBERS)[number];
}
