import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Router } from 'vue-router';
import { useAdminAccess } from '../admin/store.js';
import { PROGRAM_ADMIN } from '../admin/testing/fixtures.js';
import { useLocale } from '../locale.js';
import { setup } from '../testing/signed-in.js';
import { useUnread } from '../notifications/store.js';
import MobileBars from './MobileBars.vue';

let wrapper: VueWrapper | undefined;
let router: Router;

async function render(path: string, part: 'top' | 'tabs' = 'tabs') {
  const app = await setup(path);
  router = app.router;
  wrapper = mount(MobileBars, { props: { part }, global: { plugins: [app.pinia, router] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

const tabs = (w: VueWrapper) => w.findAll('.tabbar > *').map((tab) => tab.text());
const more = (w: VueWrapper) => w.get('[data-test="more"]');
const sheet = (w: VueWrapper) => w.get('dialog#more-sheet');

describe('the phone tab bar', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('shows four pages, then More, in both languages', async () => {
    const w = await render('/dashboard');
    expect(tabs(w)).toEqual(['Tổng quan', 'Lộ trình', 'Tốt nghiệp', 'Chương trình', 'Thêm']);
    expect(w.findAll('.tabbar a').map((a) => a.attributes('href'))).toEqual(['/dashboard', '/plans', '/audit', '/explorer']);
    useLocale().set('en');
    await flushPromises();
    expect(tabs(w)).toEqual(['Dashboard', 'Plans', 'Audit', 'Curriculum', 'More']);
  });

  it('opens More as a dialog with the other pages, and says whether it is open', async () => {
    const w = await render('/dashboard');
    expect(more(w).element.tagName).toBe('BUTTON');
    expect(more(w).attributes('aria-haspopup')).toBe('dialog');
    expect(more(w).attributes('aria-controls')).toBe('more-sheet');
    expect(more(w).attributes('aria-expanded')).toBe('false');
    expect(sheet(w).attributes('open')).toBeUndefined();

    await more(w).trigger('click');
    await flushPromises();
    expect(more(w).attributes('aria-expanded')).toBe('true');
    expect(sheet(w).attributes('open')).toBeDefined();
    expect(sheet(w).attributes('aria-labelledby')).toBe('more-title');
    expect(sheet(w).get('#more-title').text()).toBe('Thêm');
    const links = sheet(w).findAll('a');
    expect(links.map((a) => a.text())).toEqual(['Lịch', 'Thông báo', 'Bảng điểm', 'Hướng dẫn', 'Cài đặt']);
    expect(links.map((a) => a.attributes('href'))).toEqual(['/calendar', '/notifications', '/transcript', '/guides', '/settings']);
  });

  it('adds Administration under More for a user who holds a grant, and marks More on that page (ADR 0011)', async () => {
    const w = await render('/admin');
    await more(w).trigger('click');
    await flushPromises();
    expect(sheet(w).findAll('a').map((a) => a.text())).toEqual(['Lịch', 'Thông báo', 'Bảng điểm', 'Hướng dẫn', 'Cài đặt']);
    expect(more(w).attributes('aria-current')).toBeUndefined();
    useAdminAccess().seed(PROGRAM_ADMIN.userId, PROGRAM_ADMIN);
    await flushPromises();
    const links = sheet(w).findAll('a');
    expect(links.map((a) => a.text())).toEqual(['Lịch', 'Thông báo', 'Bảng điểm', 'Hướng dẫn', 'Cài đặt', 'Quản trị']);
    expect(links.at(-1)!.attributes('href')).toBe('/admin');
    expect(more(w).attributes('aria-current')).toBe('page');
  });

  it('closes on Escape, on the close button and on the backdrop', async () => {
    const w = await render('/dashboard');
    const open = async () => {
      await more(w).trigger('click');
      await flushPromises();
      expect(sheet(w).attributes('open')).toBeDefined();
    };
    const closed = () => {
      expect(sheet(w).attributes('open')).toBeUndefined();
      expect(more(w).attributes('aria-expanded')).toBe('false');
    };

    await open();
    await sheet(w).trigger('cancel');
    await flushPromises();
    closed();

    await open();
    await sheet(w).get('button[aria-label="Đóng"]').trigger('click');
    await flushPromises();
    closed();

    await open();
    await sheet(w).get('#more-title').trigger('mousedown');
    await sheet(w).get('#more-title').trigger('click');
    await flushPromises();
    expect(sheet(w).attributes('open')).toBeDefined();
    await sheet(w).trigger('mousedown');
    await sheet(w).trigger('click');
    await flushPromises();
    closed();
  });

  it('stays open after a drag that starts inside the sheet and ends on the backdrop', async () => {
    const w = await render('/dashboard');
    await more(w).trigger('click');
    await flushPromises();
    await sheet(w).get('.more-list').trigger('mousedown');
    await sheet(w).trigger('click');
    await flushPromises();
    expect(sheet(w).attributes('open')).toBeDefined();
  });

  it('fills the sheet with its content, so a tap in its margin lands inside it', async () => {
    const w = await render('/dashboard');
    await more(w).trigger('click');
    await flushPromises();
    const children = sheet(w).element.children;
    expect(children).toHaveLength(1);
    expect(children[0]!.classList.contains('more-body')).toBe(true);
  });

  it('closes when the student follows a link in it', async () => {
    const w = await render('/dashboard');
    await more(w).trigger('click');
    await flushPromises();
    await sheet(w).findAll('a').find((a) => a.text() === 'Hướng dẫn')!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('guides');
    expect(sheet(w).attributes('open')).toBeUndefined();
    expect(more(w).attributes('aria-expanded')).toBe('false');
  });

  it.each(['/transcript', '/guides', '/settings'])('marks More as the current tab on %s', async (path) => {
    const w = await render(path);
    expect(more(w).classes()).toContain('router-link-active');
    expect(more(w).attributes('aria-current')).toBe('page');
    expect(w.findAll('.tabbar a.router-link-active')).toHaveLength(0);
  });

  it.each(['/dashboard', '/plans', '/audit', '/explorer'])('leaves More unmarked on %s', async (path) => {
    const w = await render(path);
    expect(more(w).classes()).not.toContain('router-link-active');
    expect(more(w).attributes('aria-current')).toBeUndefined();
    expect(w.findAll('.tabbar a.router-link-active')).toHaveLength(1);
  });
});

describe('the phone top bar', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it('has a bell that opens the inbox and says how many are unread', async () => {
    const w = await render('/dashboard', 'top');
    const bell = w.get('[data-test="bell"]');
    expect(bell.attributes('href')).toBe('/notifications');
    expect(bell.attributes('aria-label')).toBe('Thông báo');
    expect(bell.find('[data-test="unread-badge"]').exists()).toBe(false);
    useUnread().set(2);
    useLocale().set('en');
    await flushPromises();
    expect(bell.attributes('aria-label')).toBe('Notifications, 2 unread');
    expect(bell.get('[data-test="unread-badge"]').attributes('aria-hidden')).toBe('true');
  });

  it('shows the count on Notifications under More', async () => {
    const w = await render('/dashboard');
    useUnread().set(4);
    await more(w).trigger('click');
    await flushPromises();
    expect(sheet(w).get('[data-test="more-notifications"] [data-test="unread-badge"]').text()).toBe('44 chưa đọc');
  });
});
