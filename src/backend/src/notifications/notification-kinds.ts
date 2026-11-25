import type { CalendarEventKind } from '../academic-calendar/academic-calendar-event.entity.js';
import { addDays } from '../config/time.js';

// What the inbox tells a student in B2 (ADR 0018; decided by Dũng, owner of F10, 25 November 2026).
// A notification is a kind and data, never a sentence: the screen words it in both languages.

/** The notifications that announce a school date. */
export const CALENDAR_NOTIFICATION_KINDS = ['registration_soon', 'registration_open', 'term_start'] as const;
export type CalendarNotificationKind = (typeof CALENDAR_NOTIFICATION_KINDS)[number];

/**
 * registration_soon: a registration window opens in seven days. registration_open: it opens
 * today. term_start: a term starts today. transcript_changed: the student saved a transcript
 * that differs from the one saved before.
 */
export const NOTIFICATION_KINDS = [...CALENDAR_NOTIFICATION_KINDS, 'transcript_changed'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** How many days before a registration window opens the first notification is made. */
export const REGISTRATION_SOON_DAYS = 7;

/** The kinds of school date (ADR 0017) that make a notification. `add_drop` makes none in B2. */
export const NOTIFYING_EVENT_KINDS = ['registration', 'term_start'] as const satisfies readonly CalendarEventKind[];

/** The first days a school date must have to make a notification on `day`. */
export const startDaysDueOn = (day: string): string[] => [day, addDays(day, REGISTRATION_SOON_DAYS)];

/**
 * The notifications a school date makes on `day` (a Vietnam date, YYYY-MM-DD). Strict: the
 * seven-day notification only on the day seven days before the first day, the two others only
 * on the first day. A day that has passed makes nothing, so a date entered late sends what is
 * due today and skips the rest (Dũng's rule 6).
 */
export function notificationsDue(event: { kind: CalendarEventKind; startsOn: string }, day: string): CalendarNotificationKind[] {
  if (event.kind === 'registration') {
    if (event.startsOn === addDays(day, REGISTRATION_SOON_DAYS)) return ['registration_soon'];
    if (event.startsOn === day) return ['registration_open'];
  }
  if (event.kind === 'term_start' && event.startsOn === day) return ['term_start'];
  return [];
}

/**
 * Where a notification can send the student: a stable key the screen maps to its own route,
 * never a URL someone typed. The first one is the main action.
 */
export const NOTIFICATION_LINKS = ['calendar', 'planner', 'audit'] as const;
export type NotificationLink = (typeof NOTIFICATION_LINKS)[number];

export const LINKS_OF: Record<NotificationKind, readonly NotificationLink[]> = {
  registration_soon: ['calendar', 'planner'],
  registration_open: ['calendar', 'planner'],
  term_start: ['calendar'],
  transcript_changed: ['audit'],
};
