// Term identity and order (ADR 0009), not a Nest module: the transcript, plans, offering terms,
// onboarding and the rule engine all take terms from here, so none of them encodes one itself.

export const TERM_NUMBERS = [1, 2, 3] as const;

/** The last term number of an academic year. */
export const LAST_TERM_NUMBER = TERM_NUMBERS[TERM_NUMBERS.length - 1];

/** The academic years a stored term or cohort may name. The CHECKs in the migrations repeat them in SQL. */
export const TERM_YEAR_MIN = 2000;
export const TERM_YEAR_MAX = 2100;

/** A term (ADR 0009): `year` 2026 is the academic year 2026–2027; terms 1, 2 and 3. Term 3 is a main term in APCS (QĐ 1175/QĐ-KHTN Điều 6.4b) and can be a summer term in other programs. */
export interface Term {
  year: number;
  number: (typeof TERM_NUMBERS)[number];
}

/** A value of the shape of a Term: an integer year and a term number. The year's range is TermDto's to check. */
export function isTerm(value: unknown): value is Term {
  if (typeof value !== 'object' || value === null) return false;
  const { year, number } = value as Record<string, unknown>;
  return Number.isInteger(year) && (TERM_NUMBERS as readonly unknown[]).includes(number);
}

/** A stored term number as `Term['number']`; a RangeError for any other value, which the CHECKs forbid. */
export function termNumber(value: number): Term['number'] {
  const found = TERM_NUMBERS.find((n) => n === value);
  if (found === undefined) throw new RangeError(`Not a term number: ${value}`);
  return found;
}

/** A term from its two columns (`term_year`, `term_number`), checked. */
export function termFromColumns(year: number, number: number): Term {
  return { year, number: termNumber(number) };
}

/** Negative when a is earlier than b, 0 when they are the same term, positive when a is later. */
export function compareTerms(a: Term, b: Term): number {
  return a.year - b.year || a.number - b.number;
}

export const sameTerm = (a: Term, b: Term): boolean => compareTerms(a, b) === 0;

/** "2026-1": one string per term, for a Set or a Map key. */
export const termKey = (term: Term): string => `${term.year}-${term.number}`;

/** "2026–2027 term 1": how an error message names a term. */
export function termLabel(term: Term): string {
  return `${term.year}–${term.year + 1} term ${term.number}`;
}
