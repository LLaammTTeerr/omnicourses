import { request } from '../api.js';

// The school dates of F10 (ADR 0016), written by hand; api.spec.ts checks them against src/backend/openapi.json.
// An administrator of the program enters them from the school's announcements; the calendar page only reads them.

export const CALENDAR_EVENT_KINDS = ['term_start', 'term_end', 'registration', 'add_drop', 'exam_period', 'holiday', 'other'] as const;
export type CalendarEventKind = (typeof CALENDAR_EVENT_KINDS)[number];

export interface CalendarProgram {
  id: string;
  code: string;
  nameVi: string;
  nameEn: string | null;
}

export interface CalendarEvent {
  id: string;
  /** ADR 0009: 2026 is the academic year 2026–2027. */
  academicYear: number;
  /** null: the whole academic year. */
  term: 1 | 2 | 3 | null;
  kind: CalendarEventKind;
  /** YYYY-MM-DD, whole days, both ends included. */
  startsOn: string;
  endsOn: string;
  title: string;
  /** null: show `title`. */
  titleEn: string | null;
  sourceUrl: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface AcademicCalendar {
  /** null: the student has not finished onboarding. */
  program: CalendarProgram | null;
  /** By start date, then end date, then title. */
  events: CalendarEvent[];
}

/** The signed-in student's program's school dates, every year: a few dozen rows, loaded once per visit. */
export const fetchAcademicCalendar = (token: string) => request<AcademicCalendar>('GET', '/academic-calendar', { token });
