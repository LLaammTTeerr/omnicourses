import type { Lang } from './locale.js';

// Terms as the API encodes them (ADR 0009), and the term calendar: the client's only copy of either. The transcript,
// onboarding, the planner and the calendar all read terms from here.

export const TERM_NUMBERS = [1, 2, 3] as const;

/** ADR 0009: `year` 2026 is the academic year 2026–2027, with terms 1, 2 and 3. */
export interface Term {
  year: number;
  number: (typeof TERM_NUMBERS)[number];
}

// The same calendar as the API (src/backend/src/terms/current-term.ts): term 1 from September, term 2 from
// January, term 3 from June. The API decides; these only build the choices it will accept.
const TERM_2_FIRST_MONTH = 1;
const TERM_3_FIRST_MONTH = 6;
const TERM_1_FIRST_MONTH = 9;

/** How far ahead a goal term may be (B1 test cases §6 item 4), as the API checks it. */
export const GOAL_YEARS_AHEAD = 8;

// Vietnam is UTC+7 all year.
const VIETNAM_OFFSET_MS = 7 * 3_600_000;

/** The date in Vietnam at this instant, as YYYY-MM-DD: the API counts terms by it. */
export function vietnamDate(now: Date): string {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10);
}

/** The current term on a Vietnam date (YYYY-MM-DD). */
export function currentTerm(vietnamDay: string): Term {
  const [year, month] = vietnamDay.split('-').map(Number) as [number, number];
  if (month >= TERM_1_FIRST_MONTH) return { year, number: 1 };
  if (month >= TERM_3_FIRST_MONTH) return { year: year - 1, number: 3 };
  if (month >= TERM_2_FIRST_MONTH) return { year: year - 1, number: 2 };
  throw new RangeError(`Not a date: ${vietnamDay}`);
}

export const sameTerm = (a: Term | null, b: Term | null): boolean => a !== null && b !== null && a.year === b.year && a.number === b.number;

/** Earlier terms first: negative when `a` comes before `b`, 0 for the same term. */
export const compareTerms = (a: Term, b: Term): number => a.year - b.year || a.number - b.number;

export function nextTerm(term: Term): Term {
  const i = TERM_NUMBERS.indexOf(term.number);
  return i === TERM_NUMBERS.length - 1 ? { year: term.year + 1, number: TERM_NUMBERS[0] } : { year: term.year, number: TERM_NUMBERS[i + 1]! };
}

/** Every term from `first` to `last`, both included, all three numbers of each year (ADR 0009). */
export function termsBetween(first: Term, last: Term): Term[] {
  const terms: Term[] = [];
  for (let term = first; compareTerms(term, last) <= 0; term = nextTerm(term)) terms.push(term);
  return terms;
}

/** The months a term runs, 1 to 12, in the calendar year `year` (term 1 in the academic year's first, 2 and 3 in its second). */
export interface TermMonths {
  first: number;
  last: number;
  year: number;
}

const FIRST_MONTHS: Record<Term['number'], number> = { 1: TERM_1_FIRST_MONTH, 2: TERM_2_FIRST_MONTH, 3: TERM_3_FIRST_MONTH };

/** When a term runs on the calendar above: it ends the month before the next term starts. */
export function termMonths(term: Term): TermMonths {
  const first = FIRST_MONTHS[term.number];
  const next = FIRST_MONTHS[nextTerm(term).number];
  return { first, last: next === 1 ? 12 : next - 1, year: first >= TERM_1_FIRST_MONTH ? term.year : term.year + 1 };
}

/** The academic year (ADR 0009) at this instant, counted on the date in Vietnam like the API. */
export const academicYearAt = (now: Date): number => currentTerm(vietnamDate(now)).year;

/** The terms a goal may name, earliest first: the current term up to term 3 of the academic year 8 years on. */
export function goalTerms(now: Date = new Date()): Term[] {
  const first = currentTerm(vietnamDate(now));
  const terms: Term[] = [];
  for (let year = first.year; year <= first.year + GOAL_YEARS_AHEAD; year++) {
    for (const number of TERM_NUMBERS) if (year > first.year || number >= first.number) terms.push({ year, number });
  }
  return terms;
}

/** A term as a form value, "2026-1", and back. */
export const termKey = (term: Term): string => `${term.year}-${term.number}`;
export function parseTermKey(key: string): Term | null {
  const match = /^(\d{4})-([123])$/.exec(key);
  return match ? { year: Number(match[1]), number: Number(match[2]) as Term['number'] } : null;
}

/**
 * "HK3 2026–2027" or "Term 3 2026–2027". Term 3 is a main term in APCS and a summer term only in đại trà programs
 * (ADR 0009, amended), so no name here calls it summer.
 */
export function termName(term: Term, lang: Lang): string {
  return `${lang === 'vi' ? 'HK' : 'Term '}${term.number} ${term.year}–${term.year + 1}`;
}
