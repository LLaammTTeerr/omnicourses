import type { Term } from './term.js';

// The calendar: which day it is in Vietnam, and which term that day falls in.

/** A date in Vietnam as YYYY-MM-DD. Only `vietnamDate` makes one, so a term is never read off another time zone's date. */
export type VietnamDay = string & { readonly __brand: 'VietnamDay' };

// Vietnam is UTC+7 all year: no daylight saving.
const VIETNAM_OFFSET_MS = 7 * 3_600_000;

/** The date in Vietnam at this instant. Guides and onboarding count days by it. */
export function vietnamDate(now: Date): VietnamDay {
  return new Date(now.getTime() + VIETNAM_OFFSET_MS).toISOString().slice(0, 10) as VietnamDay;
}

// Which term is current on a Vietnam date (ADR 0009 encoding). Assumed calendar, from the UI
// prototype's term dates (ui-prototypes/assets/data.js): term 1 runs September to December,
// term 2 January to May, term 3 June to August. A term stays current from the first day of its
// first month until the next one starts, so the weeks between two terms count as the earlier one.
// For APCS term 3 is a main term (QĐ 1175/QĐ-KHTN Điều 6.4b), so nothing here calls it summer.
const TERM_2_FIRST_MONTH = 1;
const TERM_3_FIRST_MONTH = 6;
const TERM_1_FIRST_MONTH = 9;

/** The current term on a Vietnam date. */
export function currentTerm(day: VietnamDay): Term {
  const [year, month] = day.split('-').map(Number);
  if (month >= TERM_1_FIRST_MONTH) return { year, number: 1 };
  if (month >= TERM_3_FIRST_MONTH) return { year: year - 1, number: 3 };
  if (month >= TERM_2_FIRST_MONTH) return { year: year - 1, number: 2 };
  throw new RangeError(`Not a date: ${day}`);
}
