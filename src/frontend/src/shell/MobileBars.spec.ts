import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Router } from 'vue-router';
import { useLocale } from '../locale.js';
import { setup } from '../testing/signed-in.js';
import MobileBars from './MobileBars.vue';

let wrapper: VueWrapper | undefined;
let router: Router;

async function render(path: string) {
  const app = await setup(path);
  router = app.router;
  wrapper = mount(MobileBars, { props: { part: 'tabs' }, global: { plugins: [app.pinia, router] }, attachTo: document.body });
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
    // The audit is "Xét tốt nghiệp / Degree audit" in the sidebar (GLOSSARY); its tab is shorter, to fit one line.
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
    expect(links.map((a) => a.text())).toEqual(['Lịch', 'Bảng điểm', 'Hướng dẫn', 'Cài đặt']);
    expect(links.map((a) => a.attributes('href'))).toEqual(['/calendar', '/transcript', '/guides', '/settings']);
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
    // Escape reaches the dialog as a cancel event.
    await sheet(w).trigger('cancel');
    await flushPromises();
    closed();

    await open();
    await sheet(w).get('button[aria-label="Đóng"]').trigger('click');
    await flushPromises();
    closed();

    await open();
    // A click inside the sheet keeps it open; one that starts and ends on the dialog itself (the backdrop) closes it.
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
    // The browser sends the click to the dialog, the common ancestor of where the press began and ended.
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
    // Screen readers hear the current page too, as they did when every page was a tab.
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
