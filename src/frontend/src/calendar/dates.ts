import { currentTerm, sameTerm, type Term } from '../terms.js';
import type { CalendarEvent } from './api.js';

// Whole days as YYYY-MM-DD, the API's format: no time and no time zone, so a day never shifts. Weeks start on Monday.

const DAY_MS = 86_400_000;

const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / DAY_MS;
};
const fromNumber = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, 10);

export const addDays = (iso: string, n: number): string => fromNumber(dayNumber(iso) + n);

/** 0 for Monday … 6 for Sunday. */
export const weekday = (iso: string): number => (new Date(dayNumber(iso) * DAY_MS).getUTCDay() + 6) % 7;

export const mondayOf = (iso: string): string => addDays(iso, -weekday(iso));

/** The first day of the month `n` months after the one `iso` is in. */
export function monthStart(iso: string, n = 0): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  const index = y * 12 + (m - 1) + n;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`;
}

export const sameMonth = (a: string, b: string): boolean => a.slice(0, 7) === b.slice(0, 7);

/** The days the month view shows: whole weeks from the Monday on or before the 1st, five or six rows. */
export function monthDays(first: string): string[] {
  const days: string[] = [];
  for (let day = mondayOf(first); days.length < 42; day = addDays(day, 1)) {
    if (days.length % 7 === 0 && days.length > 0 && !sameMonth(day, first)) break;
    days.push(day);
  }
  return days;
}

/** The Mondays of the weeks that hold a day of this month. */
export function monthWeeks(first: string): string[] {
  const weeks: string[] = [];
  for (let monday = mondayOf(first); sameMonth(monday, first) || monday < first; monday = addDays(monday, 7)) weeks.push(monday);
  return weeks;
}

/** ADR 0009: an academic year runs from September to August and is named by its first year. */
export const academicYearOf = (iso: string): number => Number(iso.slice(0, 4)) - (Number(iso.slice(5, 7)) < 9 ? 1 : 0);

/** The 12 months of that academic year, September first. */
export const academicYearMonths = (year: number): string[] => Array.from({ length: 12 }, (_, i) => monthStart(`${year}-09-01`, i));

export interface TermWeek {
  term: Term;
  week: number;
}

/**
 * The term week a day falls in, counted from the Monday of the week the term starts, only when the school dates
 * give that term's start. The term ends on its `term_end`, else before the next term starts, else when the term
 * calendar the API uses (terms.ts) moves on. null: no school date says.
 */
export function termWeek(day: string, events: readonly CalendarEvent[]): TermWeek | null {
  const starts = events.filter((e) => e.kind === 'term_start' && e.term !== null && e.startsOn <= day);
  const start = starts.at(-1);
  if (!start) return null;
  const term: Term = { year: start.academicYear, number: start.term! };
  const end = events.find((e) => e.kind === 'term_end' && e.academicYear === term.year && e.term === term.number && e.endsOn >= start.startsOn);
  if (end ? day > end.endsOn : !sameTerm(currentTerm(day), term)) return null;
  return { term, week: Math.floor((dayNumber(day) - dayNumber(mondayOf(start.startsOn))) / 7) + 1 };
}

/** Each day from `from` to `to` with the events on it, in the API's order. One pass over the events. */
export function eventsByDay(events: readonly CalendarEvent[], from: string, to: string): Map<string, CalendarEvent[]> {
  const days = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    if (event.endsOn < from || event.startsOn > to) continue;
    const last = event.endsOn < to ? event.endsOn : to;
    for (let day = event.startsOn > from ? event.startsOn : from; day <= last; day = addDays(day, 1)) {
      const list = days.get(day);
      if (list) list.push(event);
      else days.set(day, [event]);
    }
  }
  return days;
}
