import type { Notification, NotificationEvent, NotificationList } from '../api.js';

export const REGISTRATION_EVENT: NotificationEvent = {
  id: '00000000-0000-4000-8000-0000000000e1',
  programCode: 'APCS',
  academicYear: 2026,
  term: 2,
  startsOn: '2026-12-09',
  endsOn: '2026-12-20',
  title: 'Đăng ký học phần học kỳ 2',
  titleEn: 'Term 2 course registration',
};

export const TERM_EVENT: NotificationEvent = { ...REGISTRATION_EVENT, id: '00000000-0000-4000-8000-0000000000e2', startsOn: '2027-01-04', endsOn: '2027-01-04', title: 'Bắt đầu học kỳ 2', titleEn: null };

export const notification = (fields: Partial<Notification> & Pick<Notification, 'id' | 'kind'>): Notification => ({
  createdAt: '2026-12-02T01:00:00.000Z',
  readAt: null,
  event: null,
  links: [],
  ...fields,
});

export const SOON = notification({ id: '00000000-0000-4000-8000-0000000000c1', kind: 'registration_soon', event: REGISTRATION_EVENT, links: ['calendar', 'planner'] });
export const TERM = notification({ id: '00000000-0000-4000-8000-0000000000c2', kind: 'term_start', event: TERM_EVENT, links: ['calendar'], readAt: '2026-12-02T03:00:00.000Z' });
export const TRANSCRIPT = notification({ id: '00000000-0000-4000-8000-0000000000c3', kind: 'transcript_changed', links: ['audit'] });

export const list = (notifications: Notification[] = [SOON, TERM, TRANSCRIPT], nextBefore: string | null = null): NotificationList => ({ notifications, nextBefore });
