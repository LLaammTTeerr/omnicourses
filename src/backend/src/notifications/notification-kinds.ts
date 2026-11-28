import type { CalendarEventKind } from '../academic-calendar/academic-calendar-event.entity.js';
import { addDays } from '../config/time.js';

const CALENDAR_NOTIFICATION_KINDS = ['registration_soon', 'registration_open', 'term_start'] as const;
export type CalendarNotificationKind = (typeof CALENDAR_NOTIFICATION_KINDS)[number];

export const NOTIFICATION_KINDS = [...CALENDAR_NOTIFICATION_KINDS, 'transcript_changed'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];
export const NOTIFICATION_KIND_DOC =
  'registration_soon: a registration window opens in seven days; registration_open: it opens today; term_start: a term starts today; transcript_changed: the student saved a transcript that differs from the one saved before';

const REGISTRATION_SOON_DAYS = 7;

export const NOTIFYING_EVENT_KINDS = ['registration', 'term_start'] as const satisfies readonly CalendarEventKind[];

export const startDaysDueOn = (day: string): string[] => [day, addDays(day, REGISTRATION_SOON_DAYS)];

export function notificationsDue(event: { kind: CalendarEventKind; startsOn: string }, day: string): CalendarNotificationKind[] {
  if (event.kind === 'registration') {
    if (event.startsOn === addDays(day, REGISTRATION_SOON_DAYS)) return ['registration_soon'];
    if (event.startsOn === day) return ['registration_open'];
  }
  if (event.kind === 'term_start' && event.startsOn === day) return ['term_start'];
  return [];
}

export const NOTIFICATION_LINKS = ['calendar', 'planner', 'audit'] as const;
export type NotificationLink = (typeof NOTIFICATION_LINKS)[number];

export const LINKS_OF: Record<NotificationKind, readonly NotificationLink[]> = {
  registration_soon: ['calendar', 'planner'],
  registration_open: ['calendar', 'planner'],
  term_start: ['calendar'],
  transcript_changed: ['audit'],
};
