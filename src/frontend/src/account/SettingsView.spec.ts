import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import type { Router } from 'vue-router';
import { useAuth } from '../auth/store.js';
import { session } from '../auth/testing/fixtures.js';
import { useLocale } from '../locale.js';
import { useTheme } from '../shell/theme.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import SettingsView from './SettingsView.vue';

const PHONE = session({
  id: '00000000-0000-4000-8000-0000000000b2',
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  createdAt: '2026-11-02T08:00:00.000Z',
});
const OLD = session({ id: '00000000-0000-4000-8000-0000000000b3', userAgent: null, createdAt: '2026-10-30T08:00:00.000Z' });
const HERE = session({ id: '00000000-0000-4000-8000-0000000000b1', current: true, createdAt: '2026-11-01T08:00:00.000Z' });

let wrapper: VueWrapper | undefined;
let router: Router;

async function render(routes: Record<string, unknown> = {}) {
  const fetch = mockApi({ 'GET /auth/sessions': [OLD, PHONE, HERE], 'GET /programs': { programs: [] }, ...routes });
  const app = await setup('/settings');
  router = app.router;
  wrapper = mount(SettingsView, { global: { plugins: [app.pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch };
}

const rows = (w: VueWrapper) => w.findAll('[data-test="sessions"] tbody tr');

describe('SettingsView', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('shows the profile the API knows', async () => {
    const { w } = await render();
    expect(w.get('h1').text()).toBe('Cài đặt');
    expect(w.get('[data-test="display-name"]').text()).toBe('Sinh viên thử');
    expect(w.text()).toContain('zz-student@example.com');
  });

  it('lists the sessions, this device first, then the newest, each named after its browser (ADR 0002)', async () => {
    const { w } = await render();
    expect(rows(w).map((row) => row.get('td').text())).toEqual(['Chrome · Linux Thiết bị này', 'Safari · iPhone', 'Thiết bị không rõ']);
    expect(rows(w)[0]!.find('button').exists()).toBe(false);
    expect(rows(w)[1]!.get('button').attributes('aria-label')).toBe('Thu hồi phiên Safari · iPhone');
  });

  it('revokes another session after asking, then lists the sessions again', async () => {
    let listed = 0;
    const { w, fetch } = await render({
      'GET /auth/sessions': () => Response.json(listed++ === 0 ? [OLD, PHONE, HERE] : [HERE]),
      [`DELETE /auth/sessions/${PHONE.id}`]: status(204),
    });
    await rows(w)[1]!.get('button').trigger('click');
    await flushPromises();
    const dialog = w.get('dialog[open]');
    expect(dialog.attributes('role')).toBe('alertdialog');
    expect(dialog.text()).toContain('Safari · iPhone bị đăng xuất ngay và phải đăng nhập lại.');
    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining(PHONE.id), expect.anything());

    await dialog.findAll('button').find((b) => b.text() === 'Thu hồi')!.trigger('click');
    await flushPromises();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(`/auth/sessions/${PHONE.id}`), expect.objectContaining({ method: 'DELETE' }));
    expect(rows(w)).toHaveLength(1);
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(useToast().message).toBe('Đã thu hồi phiên.');
  });

  it('keeps the session when the student cancels', async () => {
    const { w, fetch } = await render();
    await rows(w)[1]!.get('button').trigger('click');
    await flushPromises();
    await w.get('dialog[open]').findAll('button').find((b) => b.text() === 'Hủy')!.trigger('click');
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(fetch.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toEqual([]);
  });

  it('downloads the export as a file (ADR 0004)', async () => {
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:zz'), revokeObjectURL: vi.fn() });
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(this.download);
    });
    const { w, fetch } = await render({ 'GET /users/me/export': { exportedAt: '2026-11-09T00:00:00.000Z', user: {}, tables: {} } });
    await w.findAll('button').find((b) => b.text().includes('Xuất dữ liệu'))!.trigger('click');
    await flushPromises();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/users/me/export'), expect.objectContaining({ headers: { Authorization: 'Bearer zz-token' } }));
    // The file holds what the API sent. (Node's Blob and jsdom's differ, so check the content, not the class.)
    const saved = vi.mocked(URL.createObjectURL).mock.calls[0]![0] as Blob;
    expect(JSON.parse(await saved.text())).toEqual({ exportedAt: '2026-11-09T00:00:00.000Z', user: {}, tables: {} });
    expect(downloads).toEqual(['omnicourse-account.json']);
    expect(useToast().message).toBe('Đã tải về omnicourse-account.json.');
  });

  it('says when the export failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ 'GET /users/me/export': status(500) });
    await w.findAll('button').find((b) => b.text().includes('Xuất dữ liệu'))!.trigger('click');
    await flushPromises();
    expect(w.get('#data [role="alert"]').text()).toBe('Chưa xuất được dữ liệu. Thử lại sau ít phút.');
  });

  async function openDeletion(w: VueWrapper) {
    await w.findAll('#data button').find((b) => b.text().includes('Xóa tài khoản'))!.trigger('click');
    await flushPromises();
    return w.get('dialog[open]');
  }

  it('explains the 30-day grace period and asks for the password before deleting (ADR 0004)', async () => {
    const { w } = await render();
    const dialog = await openDeletion(w);
    expect(dialog.text()).toContain('Mọi phiên đăng nhập bị thu hồi ngay.');
    expect(dialog.text()).toContain('xóa vĩnh viễn sau 30 ngày');
    expect(dialog.text()).toContain('Đăng nhập lại trước hạn đó sẽ hủy việc xóa.');
    const go = dialog.findAll('button').find((b) => b.text().includes('Xóa tài khoản'))!;
    expect(go.attributes('disabled')).toBeDefined();
    await dialog.get('#delete-password').setValue('zz-password-1');
    expect(go.attributes('disabled')).toBeUndefined();
  });

  it('keeps the student signed in on a wrong password (403)', async () => {
    const { w } = await render({ 'DELETE /users/me': status(403, { message: 'Wrong password' }) });
    const dialog = await openDeletion(w);
    await dialog.get('#delete-password').setValue('zz-wrong-password');
    await dialog.get('form').trigger('submit');
    await flushPromises();
    expect(dialog.get('[role="alert"]').text()).toBe('Mật khẩu không đúng.');
    expect(dialog.get('#delete-password').attributes('aria-invalid')).toBe('true');
    expect(useAuth().signedIn).toBe(true);
    expect(router.currentRoute.value.name).toBe('settings');
  });

  it('keeps the dialog open while the deletion is out, and says a wrong password there', async () => {
    let answer!: (response: Response) => void;
    const { w } = await render({ 'DELETE /users/me': () => new Promise<Response>((resolve) => (answer = resolve)) });
    const dialog = await openDeletion(w);
    await dialog.get('#delete-password').setValue('zz-wrong-password');
    await dialog.get('form').trigger('submit');
    await flushPromises();
    expect(dialog.findAll('button').find((b) => b.text() === 'Giữ lại')!.attributes('disabled')).toBeDefined();
    // Escape reaches the dialog as a cancel event; a browser without `closedby` may then close it anyway.
    await dialog.trigger('cancel');
    dialog.element.removeAttribute('open');
    dialog.element.dispatchEvent(new Event('close'));
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(true);

    answer(status(403, { message: 'Wrong password' })());
    await flushPromises();
    expect(w.get('dialog[open] [role="alert"]').text()).toBe('Mật khẩu không đúng.');
    expect(useAuth().signedIn).toBe(true);
  });

  it('signs out here and says when the deletion completes', async () => {
    const { w, fetch } = await render({ 'DELETE /users/me': () => Response.json({ purgeAfter: '2026-12-09T08:00:00.000Z' }, { status: 202 }) });
    const dialog = await openDeletion(w);
    await dialog.get('#delete-password').setValue('zz-password-1');
    await dialog.get('form').trigger('submit');
    await flushPromises();
    expect(sentBody(fetch.mock.calls.at(-1)![1])).toEqual({ password: 'zz-password-1' });
    expect(useAuth().signedIn).toBe(false);
    expect(router.currentRoute.value.name).toBe('home');
    expect(useToast().message).toMatch(/^Tài khoản sẽ bị xóa vĩnh viễn sau \d\d:\d\d 09\/12\/2026\. Đăng nhập lại trước đó để hủy\.$/);
  });

  it('signs out on the server and goes to the home page', async () => {
    const { w, fetch } = await render({ 'POST /auth/sign-out': status(204) });
    await w.get('button.sign-out').trigger('click');
    await flushPromises();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/auth/sign-out'), expect.objectContaining({ method: 'POST' }));
    expect(useAuth().signedIn).toBe(false);
    expect(router.currentRoute.value.name).toBe('home');
    expect(useToast().message).toBe('Đã đăng xuất.');
  });

  it('switches the theme and the language', async () => {
    const { w } = await render();
    await w.findAll('#look .seg button').find((b) => b.text() === 'Tối')!.trigger('click');
    expect(useTheme().theme).toBe('dark');
    await w.findAll('#profile .seg button').find((b) => b.text() === 'English')!.trigger('click');
    await nextTick();
    expect(useLocale().lang).toBe('en');
    expect(w.get('h1').text()).toBe('Settings');
    expect(w.get('#look .seg button[aria-pressed="true"]').text()).toBe('Dark');
  });

  it('shows the requirement group colours with their glyphs', async () => {
    const { w } = await render();
    const chips = w.findAll('#look .chips li');
    expect(chips).toHaveLength(8);
    expect(chips[0]!.text()).toBe('</>Cốt lõi');
  });

  it('says when the sessions cannot be loaded, with a way to try again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let calls = 0;
    const { w } = await render({ 'GET /auth/sessions': () => (calls++ === 0 ? new Response(null, { status: 500 }) : Response.json([HERE])) });
    expect(w.get('#security [role="alert"]').text()).toContain('Chưa tải được danh sách phiên.');
    await w.get('#security [role="alert"] button').trigger('click');
    await flushPromises();
    expect(rows(w)).toHaveLength(1);
  });
});
