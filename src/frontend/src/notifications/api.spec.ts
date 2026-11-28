import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import { contractEnum, contractNullable, contractShape, nullableKeys, type Shape } from '../testing/contract.js';
import { signedInPinia } from '../testing/signed-in.js';
import {
  fetchNotifications,
  fetchUnreadCount,
  markAllRead,
  markRead,
  NOTIFICATION_KINDS,
  NOTIFICATION_LINKS,
  type Notification,
  type NotificationEvent,
  type NotificationList,
  type UnreadCount,
} from './api.js';
import { SOON } from './testing/fixtures.js';
import { restoreMocksAfterCheckingCalls } from '../testing/fetch.js';

const NULLABLE: Record<string, string[]> = {
  NotificationListDto: nullableKeys<NotificationList>({ nextBefore: true }),
  NotificationDto: nullableKeys<Notification>({ event: true, readAt: true }),
  NotificationEventDto: nullableKeys<NotificationEvent>({ term: true, titleEn: true }),
};

describe('notification types against the contract (ADR 0018)', () => {
  it.each([
    ['NotificationListDto', { notifications: 'required', nextBefore: 'required' } satisfies Shape<NotificationList>],
    ['NotificationDto', { id: 'required', kind: 'required', createdAt: 'required', readAt: 'required', event: 'required', links: 'required' } satisfies Shape<Notification>],
    [
      'NotificationEventDto',
      {
        id: 'required',
        programCode: 'required',
        academicYear: 'required',
        term: 'required',
        startsOn: 'required',
        endsOn: 'required',
        title: 'required',
        titleEn: 'required',
      } satisfies Shape<NotificationEvent>,
    ],
    ['UnreadCountDto', { unread: 'required' } satisfies Shape<UnreadCount>],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
    expect(contractNullable(schema)).toEqual(NULLABLE[schema] ?? []);
  });

  it('has the kinds and link keys of the contract', () => {
    expect([...NOTIFICATION_KINDS].sort()).toEqual(contractEnum('NotificationDto', 'kind'));
    expect([...NOTIFICATION_LINKS].sort()).toEqual(contractEnum('NotificationDto', 'links'));
  });
});

describe('the notification calls', () => {
  beforeEach(() => signedInPinia());
  afterEach(() => restoreMocksAfterCheckingCalls());

  const answering = (body: unknown) => vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(body));
  const asStudent = (method: string) => expect.objectContaining({ method, headers: { Authorization: 'Bearer zz-token' } });

  it('reads a page of notifications, and the page after a given one', async () => {
    const fetch = answering({ notifications: [], nextBefore: null });
    await fetchNotifications(50);
    expect(fetch).toHaveBeenLastCalledWith(`${API_URL}/notifications?limit=50`, asStudent('GET'));
    await fetchNotifications(50, SOON.id);
    expect(fetch).toHaveBeenLastCalledWith(`${API_URL}/notifications?limit=50&before=${SOON.id}`, asStudent('GET'));
  });

  it('reads the unread count, marks one notification read and marks all read', async () => {
    const fetch = answering({ unread: 2 });
    await expect(fetchUnreadCount()).resolves.toEqual({ unread: 2 });
    expect(fetch).toHaveBeenLastCalledWith(`${API_URL}/notifications/unread-count`, asStudent('GET'));
    await markRead(SOON.id);
    expect(fetch).toHaveBeenLastCalledWith(`${API_URL}/notifications/${SOON.id}/read`, asStudent('POST'));
    await markAllRead();
    expect(fetch).toHaveBeenLastCalledWith(`${API_URL}/notifications/read-all`, asStudent('POST'));
  });
});
