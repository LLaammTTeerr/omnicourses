import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocale } from '../locale.js';
import { useToast } from '../shell/toast.js';
import { hang, mockApi, restoreMocksAfterCheckingCalls, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import NotificationsView from './NotificationsView.vue';
import { useUnread } from './store.js';
import { list, notification, SOON, TERM, TRANSCRIPT } from './testing/fixtures.js';

let wrapper: VueWrapper | undefined;

async function render(routes: Record<string, unknown>) {
  const fetch = mockApi({ 'GET /notifications/unread-count': { unread: 2 }, ...routes });
  const app = await setup('/notifications');
  await useUnread().refresh();
  wrapper = mount(NotificationsView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch, ...app };
}

const items = (w: VueWrapper) => w.findAll('[data-test="notification"]');
const calls = (fetch: ReturnType<typeof mockApi>, method: string, path: string) =>
  fetch.mock.calls.filter(([url, init]) => String(url).includes(path) && (init?.method ?? 'GET') === method);

describe('NotificationsView (F10, UC-12)', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    restoreMocksAfterCheckingCalls();
  });

  it('words each kind in Vietnamese, with the date it announces, and marks the unread ones', async () => {
    const { w } = await render({ 'GET /notifications': list() });
    const [soon, term, transcript] = items(w);
    expect(soon!.get('h2').text()).toBe('Chưa đọc: Sắp mở đăng ký học phần');
    expect(soon!.get('.note-detail').text()).toBe('Đăng ký học phần học kỳ 2 · 09/12/2026 – 20/12/2026');
    expect(soon!.classes()).toContain('unread');
    expect(term!.get('h2').text()).toBe('Hôm nay bắt đầu học kỳ');
    expect(term!.get('.note-detail').text()).toBe('Bắt đầu học kỳ 2 · 04/01/2027');
    expect(term!.classes()).not.toContain('unread');
    expect(transcript!.get('h2').text()).toBe('Chưa đọc: Bảng điểm đã thay đổi');
    expect(transcript!.get('.note-detail').text()).toBe('Bảng điểm bạn vừa lưu khác bản trước. Xem lại kết quả xét tốt nghiệp.');
    expect(soon!.get('time').attributes('datetime')).toBe(SOON.createdAt);
    expect(w.get('[data-test="subtitle"]').text()).toBe('2 thông báo chưa đọc.');
  });

  it('words each kind in English, with the English title when the date has one', async () => {
    useLocale().set('en');
    const { w } = await render({ 'GET /notifications': list([SOON, TERM, notification({ id: 'zz-open', kind: 'registration_open', event: SOON.event }), TRANSCRIPT]) });
    expect(items(w).map((item) => item.get('h2').text())).toEqual([
      'Unread: Course registration opens soon',
      'The term starts today',
      'Unread: Course registration opens today',
      'Unread: Your transcript changed',
    ]);
    expect(items(w)[0]!.get('.note-detail').text()).toBe('Term 2 course registration · 9 Dec 2026 – 20 Dec 2026');
    expect(items(w)[1]!.get('.note-detail').text()).toBe('Bắt đầu học kỳ 2 · 4 Jan 2027');
  });

  it('links each notification to its pages by key, the first as the main action', async () => {
    const { w } = await render({ 'GET /notifications': list() });
    const links = (i: number) => items(w)[i]!.findAll('a').map((a) => [a.text(), a.attributes('href'), a.classes().includes('primary')]);
    expect(links(0)).toEqual([
      ['Xem lịch', '/calendar', true],
      ['Mở lộ trình', '/plans', false],
    ]);
    expect(links(1)).toEqual([['Xem lịch', '/calendar', true]]);
    expect(links(2)).toEqual([['Xem xét tốt nghiệp', '/audit', true]]);
  });

  it('marks one notification read with its own button, and updates the bell', async () => {
    const { w, fetch } = await render({
      'GET /notifications': list(),
      [`POST /notifications/${SOON.id}/read`]: { ...SOON, readAt: '2026-12-02T04:00:00.000Z' },
    });
    const button = items(w)[0]!.get('[data-test="mark-read"]');
    expect(button.attributes('aria-label')).toBe('Đánh dấu đã đọc: Sắp mở đăng ký học phần');
    expect(items(w)[1]!.find('[data-test="mark-read"]').exists()).toBe(false);
    await button.trigger('click');
    await flushPromises();
    expect(calls(fetch, 'POST', `/notifications/${SOON.id}/read`)).toHaveLength(1);
    expect(items(w)[0]!.classes()).not.toContain('unread');
    expect(items(w)[0]!.find('[data-test="mark-read"]').exists()).toBe(false);
    expect(calls(fetch, 'GET', '/notifications/unread-count')).toHaveLength(2);
    expect(document.activeElement).toBe(items(w)[0]!.get('[data-test="link-calendar"]').element);
  });

  it('marks an unread notification read before following its link, and not a read one', async () => {
    const { w, fetch, router } = await render({
      'GET /notifications': list(),
      'GET /academic-calendar': { program: null, events: [] },
      [`POST /notifications/${TRANSCRIPT.id}/read`]: { ...TRANSCRIPT, readAt: '2026-12-02T04:00:00.000Z' },
    });
    await items(w)[1]!.get('[data-test="link-calendar"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('calendar');
    expect(calls(fetch, 'POST', '/read')).toHaveLength(0);
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    items(w)[2]!.get('[data-test="link-audit"]').element.dispatchEvent(click);
    await flushPromises();
    expect(click.defaultPrevented).toBe(true);
    expect(calls(fetch, 'POST', `/notifications/${TRANSCRIPT.id}/read`)).toHaveLength(1);
    expect(router.currentRoute.value.name).toBe('audit');
    expect(calls(fetch, 'GET', '/notifications/unread-count')).toHaveLength(1);
  });

  it('follows the link even when marking it read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w, router } = await render({
      'GET /notifications': list(),
      'GET /academic-calendar': { program: null, events: [] },
      [`POST /notifications/${SOON.id}/read`]: status(500),
    });
    await items(w)[0]!.get('[data-test="link-calendar"]').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('calendar');
  });

  it('leaves a modified click to the browser, and still marks the notification read and counts again', async () => {
    const { w, fetch, router } = await render({
      'GET /notifications': list(),
      [`POST /notifications/${SOON.id}/read`]: { ...SOON, readAt: '2026-12-02T04:00:00.000Z' },
    });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true, ctrlKey: true });
    items(w)[0]!.get('[data-test="link-calendar"]').element.dispatchEvent(click);
    await flushPromises();
    expect(click.defaultPrevented).toBe(false);
    expect(router.currentRoute.value.name).toBe('notifications');
    expect(calls(fetch, 'POST', `/notifications/${SOON.id}/read`)).toHaveLength(1);
    expect(calls(fetch, 'GET', '/notifications/unread-count')).toHaveLength(2);
  });

  it('leaves a Shift click and a middle-button click to the browser', async () => {
    const { w, router } = await render({
      'GET /notifications': list(),
      [`POST /notifications/${SOON.id}/read`]: { ...SOON, readAt: '2026-12-02T04:00:00.000Z' },
    });
    const shift = new MouseEvent('click', { bubbles: true, cancelable: true, shiftKey: true });
    const middle = new MouseEvent('click', { bubbles: true, cancelable: true, button: 1 });
    for (const click of [shift, middle]) items(w)[0]!.get('[data-test="link-calendar"]').element.dispatchEvent(click);
    await flushPromises();
    expect([shift.defaultPrevented, middle.defaultPrevented]).toEqual([false, false]);
    expect(router.currentRoute.value.name).toBe('notifications');
  });

  it('waits for the notification to be marked read before it follows the link', async () => {
    let answer: () => void = () => {};
    const { w, router } = await render({
      'GET /notifications': list(),
      [`POST /notifications/${TRANSCRIPT.id}/read`]: () =>
        new Promise<Response>((resolve) => (answer = () => resolve(Response.json({ ...TRANSCRIPT, readAt: '2026-12-02T04:00:00.000Z' })))),
    });
    const push = vi.spyOn(router, 'push');
    await items(w)[2]!.get('[data-test="link-audit"]').trigger('click');
    await flushPromises();
    expect(push).not.toHaveBeenCalled();
    expect(router.currentRoute.value.name).toBe('notifications');
    answer();
    await flushPromises();
    expect(push).toHaveBeenCalledTimes(1);
    expect(router.currentRoute.value.name).toBe('audit');
  });

  it('tells the student when marking one read fails, and keeps it unread', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ 'GET /notifications': list(), [`POST /notifications/${SOON.id}/read`]: status(500) });
    await items(w)[0]!.get('[data-test="mark-read"]').trigger('click');
    await flushPromises();
    expect(useToast().message).toBe('Không đánh dấu được. Hãy thử lại.');
    expect(items(w)[0]!.classes()).toContain('unread');
    expect(document.activeElement).not.toBe(items(w)[0]!.get('[data-test="link-calendar"]').element);
  });

  it('marks every notification read, sets the bell to the answer and says so', async () => {
    const { w, fetch } = await render({ 'GET /notifications': list(), 'POST /notifications/read-all': { unread: 0 } });
    await w.get('[data-test="read-all"]').trigger('click');
    await flushPromises();
    expect(calls(fetch, 'POST', '/notifications/read-all')).toHaveLength(1);
    expect(w.findAll('.note.unread')).toHaveLength(0);
    expect(useUnread().count).toBe(0);
    expect(useToast().message).toBe('Đã đánh dấu đã đọc hết.');
    expect(w.get('[data-test="subtitle"]').text()).toBe('Bạn đã đọc hết thông báo.');
    expect(w.get('[data-test="read-all"]').attributes('disabled')).toBeDefined();
    expect(document.activeElement).toBe(w.get('h1').element);
  });

  it('sends one request when mark all is clicked twice', async () => {
    let answer: (r: Response) => void = () => {};
    const { w, fetch } = await render({
      'GET /notifications': list(),
      'POST /notifications/read-all': () => new Promise<Response>((resolve) => (answer = resolve)),
    });
    const button = w.get('[data-test="read-all"]');
    await button.trigger('click');
    expect(button.attributes('disabled')).toBeDefined();
    (button.element as HTMLButtonElement).disabled = false;
    await button.trigger('click');
    answer(Response.json({ unread: 0 }));
    await flushPromises();
    expect(calls(fetch, 'POST', '/notifications/read-all')).toHaveLength(1);
  });

  it('offers mark all while the bell counts unread ones beyond this page', async () => {
    const { w } = await render({ 'GET /notifications': list([TERM], TERM.id) });
    expect(w.findAll('.note.unread')).toHaveLength(0);
    expect(w.get('[data-test="subtitle"]').text()).toBe('2 thông báo chưa đọc.');
    expect(w.get('[data-test="read-all"]').attributes('disabled')).toBeUndefined();
  });

  it('says one unread notification in the singular in English', async () => {
    useLocale().set('en');
    const { w } = await render({ 'GET /notifications': list(), 'GET /notifications/unread-count': { unread: 1 } });
    expect(w.get('[data-test="subtitle"]').text()).toBe('1 unread notification.');
  });

  it('puts new notifications on top when the bell count rises', async () => {
    const NEW = notification({ id: 'zz-new', kind: 'registration_open', event: SOON.event });
    const pages = [list([SOON, TERM, TRANSCRIPT]), list([NEW, SOON, TERM])];
    const { w } = await render({ 'GET /notifications': () => Response.json(pages.shift()) });
    useUnread().set(3);
    await flushPromises();
    expect(items(w).map((item) => item.get('h2').attributes('id'))).toEqual([NEW, SOON, TERM, TRANSCRIPT].map((n) => `notification-${n.id}`));
  });

  it('fetches nothing when the count rises only to what the page already shows', async () => {
    const { w, fetch } = await render({ 'GET /notifications': list() });
    useUnread().set(0);
    await flushPromises();
    useUnread().set(2);
    await flushPromises();
    expect(calls(fetch, 'GET', '/notifications?')).toHaveLength(1);
    expect(items(w)).toHaveLength(3);
  });

  it('puts new notifications on top when the bell count goes down and then up again', async () => {
    const NEW = notification({ id: 'zz-new', kind: 'registration_open', event: SOON.event });
    const pages = [list([SOON, TERM, TRANSCRIPT]), list([NEW, SOON, TERM])];
    const { w, fetch } = await render({ 'GET /notifications': () => Response.json(pages.shift()), 'GET /notifications/unread-count': { unread: 5 } });
    useUnread().set(4);
    await flushPromises();
    expect(calls(fetch, 'GET', '/notifications?')).toHaveLength(1);
    useUnread().set(1);
    await flushPromises();
    useUnread().set(3);
    await flushPromises();
    expect(items(w).map((item) => item.get('h2').attributes('id'))).toEqual([NEW, SOON, TERM, TRANSCRIPT].map((n) => `notification-${n.id}`));
  });

  it('fetches no new notifications when the count rises before the page has loaded', async () => {
    let answer: () => void = () => {};
    const { w, fetch } = await render({
      'GET /notifications': () => new Promise<Response>((resolve) => (answer = () => resolve(Response.json(list())))),
    });
    useUnread().set(5);
    await flushPromises();
    answer();
    await flushPromises();
    expect(calls(fetch, 'GET', '/notifications?')).toHaveLength(1);
    expect(items(w)).toHaveLength(3);
  });

  it('keeps the notifications unread when marking all read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ 'GET /notifications': list(), 'POST /notifications/read-all': status(500) });
    await w.get('[data-test="read-all"]').trigger('click');
    await flushPromises();
    expect(w.findAll('.note.unread')).toHaveLength(2);
    expect(useToast().message).toBe('Không đánh dấu được. Hãy thử lại.');
    expect(w.get('[data-test="read-all"]').attributes('disabled')).toBeUndefined();
  });

  it('shows older notifications after the last one of the page, until there are none', async () => {
    const pages = [list([SOON, TERM], TERM.id), list([TRANSCRIPT])];
    const { w, fetch } = await render({ 'GET /notifications': () => Response.json(pages.shift()) });
    expect(items(w)).toHaveLength(2);
    await w.get('[data-test="older"]').trigger('click');
    await flushPromises();
    expect(String(fetch.mock.calls.at(-1)![0])).toContain(`before=${TERM.id}`);
    expect(items(w)).toHaveLength(3);
    expect(w.find('[data-test="older"]').exists()).toBe(false);
  });

  it('loads the older page once when Older is clicked twice', async () => {
    let answer: () => void = () => {};
    const answers = [
      () => Response.json(list([SOON, TERM], TERM.id)),
      () => new Promise<Response>((resolve) => (answer = () => resolve(Response.json(list([TRANSCRIPT]))))),
    ];
    const { w, fetch } = await render({ 'GET /notifications': () => answers.shift()!() });
    const older = w.get('[data-test="older"]');
    await older.trigger('click');
    expect(older.attributes('disabled')).toBeDefined();
    (older.element as HTMLButtonElement).disabled = false;
    await older.trigger('click');
    answer();
    await flushPromises();
    expect(calls(fetch, 'GET', 'before=')).toHaveLength(1);
    expect(items(w)).toHaveLength(3);
  });

  it('says when the older page cannot be read, and keeps the list and the button', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const answers = [() => Response.json(list([SOON, TERM], TERM.id)), status(503)];
    const { w } = await render({ 'GET /notifications': () => answers.shift()!() });
    expect(w.find('[role="alert"]').exists()).toBe(false);
    await w.get('[data-test="older"]').trigger('click');
    await flushPromises();
    expect(w.get('[role="alert"]').text()).toBe('Không tải được thông báo cũ hơn.');
    expect(items(w)).toHaveLength(2);
    expect(w.get('[data-test="older"]').attributes('disabled')).toBeUndefined();
  });

  it('says when there is nothing yet, with nothing to mark', async () => {
    const { w } = await render({ 'GET /notifications': list([]), 'GET /notifications/unread-count': { unread: 0 } });
    expect(w.get('[data-test="empty"]').text()).toContain('Chưa có thông báo');
    expect(w.get('[data-test="read-all"]').attributes('disabled')).toBeDefined();
  });

  it('says it is loading, and offers a retry when the list cannot be read', async () => {
    hang();
    const app = await setup('/notifications');
    wrapper = mount(NotificationsView, { global: { plugins: [app.pinia, app.router] } });
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toBe('Đang tải thông báo…');
    wrapper.unmount();
    vi.restoreAllMocks();

    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = true;
    const { w } = await render({ 'GET /notifications': () => (fail ? status(503)() : Response.json(list())) });
    expect(w.get('[role="alert"]').text()).toContain('Không tải được thông báo.');
    expect(w.find('[data-test="read-all"]').exists()).toBe(false);
    fail = false;
    await w.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(items(w)).toHaveLength(3);
  });

  it('focuses the notification heading when marking a linkless notification read unmounts its button', async () => {
    const LINKLESS = notification({ id: 'zz-linkless', kind: 'transcript_changed', event: null, links: [] });
    const { w } = await render({
      'GET /notifications': list([LINKLESS]),
      'POST /notifications/zz-linkless/read': { ...LINKLESS, readAt: '2026-12-02T04:00:00.000Z' },
    });
    const button = items(w)[0]!.get('[data-test="mark-read"]');
    (button.element as HTMLElement).focus();
    await button.trigger('click');
    await flushPromises();
    expect(items(w)[0]!.find('[data-test="mark-read"]').exists()).toBe(false);
    expect(document.activeElement).toBe(items(w)[0]!.get('h2').element);
  });

  it('neither logs nor shows markFailed toast on 401 from readOne or readAll', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const one = await render({ 'GET /notifications': list(), [`POST /notifications/${SOON.id}/read`]: status(401) });
    useToast().message = '';
    await items(one.w)[0]!.get('[data-test="mark-read"]').trigger('click');
    await flushPromises();
    expect(consoleError).not.toHaveBeenCalled();
    expect(useToast().message).toBe('');
    one.w.unmount();

    const all = await render({ 'GET /notifications': list(), 'POST /notifications/read-all': status(401) });
    useToast().message = '';
    await all.w.get('[data-test="read-all"]').trigger('click');
    await flushPromises();
    expect(consoleError).not.toHaveBeenCalled();
    expect(useToast().message).toBe('');
  });
});
