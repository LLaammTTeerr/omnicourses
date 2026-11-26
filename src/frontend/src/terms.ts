import type { Lang } from './locale.js';

export const TERM_NUMBERS = [1, 2, 3] as const;

export interface Term {
  year: number;
  number: (typeof TERM_NUMBERS)[number];
}

const TERM_2_FIRST_MONTH = 1;
const TERM_3_FIRST_MONTH = 6;
const TERM_1_FIRST_MONTH = 9;

export const GOAL_YEARS_AHEAD = 8;

const VIETNAM_UTC_PLUS_7_MS = 7 * 3_600_000;

export function vietnamDate(now: Date): string {
  return new Date(now.getTime() + VIETNAM_UTC_PLUS_7_MS).toISOString().slice(0, 10);
}

export function currentTerm(vietnamDay: string): Term {
  const [year, month] = vietnamDay.split('-').map(Number) as [number, number];
  if (month >= TERM_1_FIRST_MONTH) return { year, number: 1 };
  if (month >= TERM_3_FIRST_MONTH) return { year: year - 1, number: 3 };
  if (month >= TERM_2_FIRST_MONTH) return { year: year - 1, number: 2 };
  throw new RangeError(`Not a date: ${vietnamDay}`);
}

export const currentTermNow = (): Term => currentTerm(vietnamDate(new Date()));

export const sameTerm = (a: Term | null, b: Term | null): boolean => a !== null && b !== null && a.year === b.year && a.number === b.number;

export function goalTerms(now: Date = new Date()): Term[] {
  const first = currentTerm(vietnamDate(now));
  const terms: Term[] = [];
  for (let year = first.year; year <= first.year + GOAL_YEARS_AHEAD; year++) {
    for (const number of TERM_NUMBERS) if (year > first.year || number >= first.number) terms.push({ year, number });
  }
  return terms;
}

export const termKey = (term: Term): string => `${term.year}-${term.number}`;
export function parseTermKey(key: string): Term | null {
  const match = /^(\d{4})-([123])$/.exec(key);
  return match ? { year: Number(match[1]), number: Number(match[2]) as Term['number'] } : null;
}

export function termName(term: Term, lang: Lang): string {
  return `${lang === 'vi' ? 'HK' : 'Term '}${term.number} ${term.year}–${term.year + 1}`;
}
