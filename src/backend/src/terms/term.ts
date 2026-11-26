export const TERM_NUMBERS = [1, 2, 3] as const;
export type TermNumber = (typeof TERM_NUMBERS)[number];
export const LAST_TERM_NUMBER: TermNumber = TERM_NUMBERS[TERM_NUMBERS.length - 1];

export const MIN_ACADEMIC_YEAR = 2000;
export const MAX_ACADEMIC_YEAR = 2100;

export interface Term {
  year: number;
  number: (typeof TERM_NUMBERS)[number];
}

const TERM_2_FIRST_MONTH = 1;
const TERM_3_FIRST_MONTH = 6;
const TERM_1_FIRST_MONTH = 9;

export function currentTerm(vietnamDay: string): Term {
  const [year, month] = vietnamDay.split('-').map(Number);
  if (month >= TERM_1_FIRST_MONTH) return { year, number: 1 };
  if (month >= TERM_3_FIRST_MONTH) return { year: year - 1, number: 3 };
  if (month >= TERM_2_FIRST_MONTH) return { year: year - 1, number: 2 };
  throw new RangeError(`Not a date: ${vietnamDay}`);
}

export function compareTerms(a: Term, b: Term): number {
  return a.year - b.year || a.number - b.number;
}

export function termLabel(term: Term): string {
  return `${term.year}–${term.year + 1} term ${term.number}`;
}

export const termKey = (term: Term): string => `${term.year}-${term.number}`;

export const copyTerm = (term: Term): Term => ({ year: term.year, number: term.number });

export const asTermNumber = (number: number): Term['number'] => number as Term['number'];

export const toTerm = (year: number, number: number): Term => ({ year, number: asTermNumber(number) });
