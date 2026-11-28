import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/store.js';
import { user } from '../auth/testing/fixtures.js';
import { mockApi, status } from '../testing/fetch.js';
import { signedInPinia } from '../testing/signed-in.js';
import { useUnread } from './store.js';

describe('the unread count', () => {
  beforeEach(() => signedInPinia());
  afterEach(() => vi.restoreAllMocks());

  it('reads the count of the signed-in student', async () => {
    mockApi({ 'GET /notifications/unread-count': { unread: 3 } });
    const unread = useUnread();
    await unread.refresh();
    expect(unread.count).toBe(3);
  });

  it('asks nothing while signed out', async () => {
    const fetch = mockApi({});
    useAuth().user = null;
    await useUnread().refresh();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps the last count when a read fails', async () => {
    mockApi({ 'GET /notifications/unread-count': { unread: 2 } });
    const unread = useUnread();
    await unread.refresh();
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({ 'GET /notifications/unread-count': status(500) });
    await unread.refresh();
    expect(unread.count).toBe(2);
  });

  it('drops the count and a late answer when another student signs in', async () => {
    let answer: (r: Response) => void = () => {};
    mockApi({ 'GET /notifications/unread-count': () => new Promise<Response>((resolve) => (answer = resolve)) });
    const unread = useUnread();
    unread.set(4);
    const late = unread.refresh();
    useAuth().user = user({ id: '00000000-0000-4000-8000-000000000002' });
    expect(unread.count).toBe(0);
    answer(Response.json({ unread: 9 }));
    await late;
    await flushPromises();
    expect(unread.count).toBe(0);
  });

  it('lets a count set after marking all read win over a read still on its way', async () => {
    let answer: (r: Response) => void = () => {};
    mockApi({ 'GET /notifications/unread-count': () => new Promise<Response>((resolve) => (answer = resolve)) });
    const unread = useUnread();
    const late = unread.refresh();
    unread.set(0);
    answer(Response.json({ unread: 5 }));
    await late;
    expect(unread.count).toBe(0);
  });
});
