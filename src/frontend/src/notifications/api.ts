import { requestAsUser } from '../auth/store.js';

export const NOTIFICATION_KINDS = ['registration_soon', 'registration_open', 'term_start', 'transcript_changed'] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_LINKS = ['calendar', 'planner', 'audit'] as const;
export type NotificationLink = (typeof NOTIFICATION_LINKS)[number];

export interface NotificationEvent {
  id: string;
  programCode: string;
  academicYear: number;
  term: 1 | 2 | 3 | null;
  startsOn: string;
  endsOn: string;
  title: string;
  titleEn: string | null;
}

export interface Notification {
  id: string;
  kind: NotificationKind;
  createdAt: string;
  readAt: string | null;
  event: NotificationEvent | null;
  links: NotificationLink[];
}

export interface NotificationList {
  notifications: Notification[];
  nextBefore: string | null;
}

export interface UnreadCount {
  unread: number;
}

export function fetchNotifications(limit: number, before: string | null = null): Promise<NotificationList> {
  const query = new URLSearchParams({ limit: String(limit), ...(before && { before }) });
  return requestAsUser<NotificationList>('GET', `/notifications?${query}`);
}

export const fetchUnreadCount = () => requestAsUser<UnreadCount>('GET', '/notifications/unread-count');

export const markRead = (id: string) => requestAsUser<Notification>('POST', `/notifications/${encodeURIComponent(id)}/read`);

export const markAllRead = () => requestAsUser<UnreadCount>('POST', '/notifications/read-all');
