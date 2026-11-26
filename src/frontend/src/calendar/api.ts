import { requestAsUser } from '../auth/store.js';

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
  academicYear: number;
  term: 1 | 2 | 3 | null;
  kind: CalendarEventKind;
  startsOn: string;
  endsOn: string;
  title: string;
  titleEn: string | null;
  sourceUrl: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface AcademicCalendar {
  program: CalendarProgram | null;
  events: CalendarEvent[];
}

export const fetchAcademicCalendar = () => requestAsUser<AcademicCalendar>('GET', '/academic-calendar');
