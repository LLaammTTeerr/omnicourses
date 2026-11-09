import { Term } from './term.js';

// Which term is current on a Vietnam date (ADR 0009 encoding). Assumed calendar, from the UI
// prototype's term dates (ui-prototypes/assets/data.js): term 1 runs September to December,
// term 2 January to May, term 3 June to August. A term stays current from the first day of its
// first month until the next one starts, so the weeks between two terms count as the earlier one.
// For APCS term 3 is a main term (QĐ 1175/QĐ-KHTN Điều 6.4b), so nothing here calls it summer.
const TERM_2_FIRST_MONTH = 1;
const TERM_3_FIRST_MONTH = 6;
const TERM_1_FIRST_MONTH = 9;

/** The current term on a Vietnam date (YYYY-MM-DD, see `vietnamDate`). */
export function currentTerm(vietnamDay: string): Term {
  const [year, month] = vietnamDay.split('-').map(Number);
  if (month >= TERM_1_FIRST_MONTH) return { year, number: 1 };
  if (month >= TERM_3_FIRST_MONTH) return { year: year - 1, number: 3 };
  if (month >= TERM_2_FIRST_MONTH) return { year: year - 1, number: 2 };
  throw new RangeError(`Not a date: ${vietnamDay}`);
}

/** Negative when a is earlier than b, 0 when they are the same term, positive when a is later. */
export function compareTerms(a: Term, b: Term): number {
  return a.year - b.year || a.number - b.number;
}

/** "2026–2027 term 1": how an error message names a term. */
export function termLabel(term: Term): string {
  return `${term.year}–${term.year + 1} term ${term.number}`;
}
