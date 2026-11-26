import { academicYearStart, currentTerm, sameTerm, type Term } from '../terms.js';
import type { CalendarEvent } from './api.js';

const DAY_MS = 86_400_000;
export const DAYS_IN_WEEK = 7;
const SUNDAY_FIRST_TO_MONDAY_FIRST = DAYS_IN_WEEK - 1;
const SATURDAY = 5;
const THURSDAY = 3;
const MONTHS_IN_YEAR = 12;
const MONTH_VIEW_MAX_WEEKS = 6;
const ISO_MONTH_LENGTH = 'YYYY-MM'.length;
const ISO_DAY_START = 'YYYY-MM-'.length;
const ISO_DATE_LENGTH = 'YYYY-MM-DD'.length;

const dayNumber = (iso: string): number => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / DAY_MS;
};
const fromNumber = (n: number): string => new Date(n * DAY_MS).toISOString().slice(0, ISO_DATE_LENGTH);

export const addDays = (iso: string, n: number): string => fromNumber(dayNumber(iso) + n);
export const dayOfMonth = (iso: string): number => Number(iso.slice(ISO_DAY_START));
export const daysFromTo = (from: string, to: string): number => dayNumber(to) - dayNumber(from) + 1;

export const weekday = (iso: string): number => (new Date(dayNumber(iso) * DAY_MS).getUTCDay() + SUNDAY_FIRST_TO_MONDAY_FIRST) % DAYS_IN_WEEK;
export const isWeekend = (iso: string): boolean => weekday(iso) >= SATURDAY;
export const mondayOf = (iso: string): string => addDays(iso, -weekday(iso));
export const sundayOf = (monday: string): string => addDays(monday, DAYS_IN_WEEK - 1);
export const thursdayOf = (monday: string): string => addDays(monday, THURSDAY);
export const weekDays = (monday: string): string[] => Array.from({ length: DAYS_IN_WEEK }, (_, i) => addDays(monday, i));

export function monthStart(iso: string, n = 0): string {
  const [y, m] = iso.split('-').map(Number) as [number, number];
  const index = y * MONTHS_IN_YEAR + (m - 1) + n;
  return `${Math.floor(index / MONTHS_IN_YEAR)}-${String((index % MONTHS_IN_YEAR) + 1).padStart(2, '0')}-01`;
}

export const sameMonth = (a: string, b: string): boolean => a.slice(0, ISO_MONTH_LENGTH) === b.slice(0, ISO_MONTH_LENGTH);

export function monthDays(first: string): string[] {
  const days: string[] = [];
  for (let day = mondayOf(first); days.length < MONTH_VIEW_MAX_WEEKS * DAYS_IN_WEEK; day = addDays(day, 1)) {
    if (days.length % DAYS_IN_WEEK === 0 && days.length > 0 && !sameMonth(day, first)) break;
    days.push(day);
  }
  return days;
}

export function monthWeeks(first: string): string[] {
  const weeks: string[] = [];
  for (let monday = mondayOf(first); sameMonth(monday, first) || monday < first; monday = addDays(monday, DAYS_IN_WEEK)) weeks.push(monday);
  return weeks;
}

export const academicYearOf = (iso: string): number => currentTerm(iso).year;
export const academicYearMonths = (year: number): string[] => Array.from({ length: MONTHS_IN_YEAR }, (_, i) => monthStart(academicYearStart(year), i));

export interface TermWeek {
  term: Term;
  week: number;
}

export function termWeek(day: string, events: readonly CalendarEvent[]): TermWeek | null {
  const start = events.filter((e) => e.kind === 'term_start' && e.term !== null && e.startsOn <= day).at(-1);
  if (!start) return null;
  const term: Term = { year: start.academicYear, number: start.term! };
  const end = events.find((e) => e.kind === 'term_end' && e.academicYear === term.year && e.term === term.number && e.endsOn >= start.startsOn);
  if (end ? day > end.endsOn : !sameTerm(currentTerm(day), term)) return null;
  return { term, week: Math.floor((dayNumber(day) - dayNumber(mondayOf(start.startsOn))) / DAYS_IN_WEEK) + 1 };
}

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
