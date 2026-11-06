import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createMemoryHistory } from 'vue-router';
import { useLocale } from '../locale.js';
import { createAppRouter } from '../router.js';
import { fetchGuides, type GuideListItem, type GuideListText } from './api.js';
import GuidesView from './GuidesView.vue';
import { listText } from './testing/guide-fixtures.js';

vi.mock('./api.js', async (importOriginal) => ({ ...(await importOriginal<typeof import('./api.js')>()), fetchGuides: vi.fn() }));

const PORTAL = { name: 'Cổng thử', url: 'https://example.com/portal?x=1', account: 'Tài khoản thử' };
const text = (title: string, keywords: string[], extra: Partial<GuideListText> = {}) => listText({ title, keywords, portal: PORTAL, ...extra });

const LIST: GuideListItem[] = [
  { id: 'pay-tuition', group: 'tuition-and-fees', texts: { vi: text('Đóng học phí', ['hoc phi']), en: text('Pay tuition', ['tuition']) } },
  { id: 'register-courses', group: 'registration', texts: { vi: text('Đăng ký học phần', ['dkhp']), en: text('Register for courses', ['register']) } },
  { id: 'zz-vi-only', group: 'registration', texts: { vi: text('Hướng dẫn thử zz-vi-only', ['zz-vi-only'], { outOfDate: true }) } },
];

let wrapper: VueWrapper | undefined;

async function render() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const router = createAppRouter(createMemoryHistory());
  await router.push('/guides');
  await router.isReady();
  wrapper = mount(GuidesView, { global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

const headings = (w: VueWrapper) => w.findAll('h2').map((h) => h.text());
const titles = (w: VueWrapper) => w.findAll('[data-test="title"]').map((a) => a.text());

describe('GuidesView (UC-10 steps 1–3)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(fetchGuides).mockResolvedValue(LIST);
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('lists the guides under their task groups, in the order of the guides plan', async () => {
    const w = await render();
    expect(headings(w)).toEqual(['Đăng ký học phần', 'Học phí và lệ phí']);
    expect(titles(w)).toEqual(['Đăng ký học phần', 'Hướng dẫn thử zz-vi-only', 'Đóng học phí']);
  });

  it('shows the portal, the account and a direct link that opens in a new tab (A1)', async () => {
    const w = await render();
    const entry = w.get('[data-test="guide-register-courses"]');
    expect(entry.text()).toContain('Cổng thử · Tài khoản: Tài khoản thử');
    const link = entry.get('[data-test="portal"]');
    expect(link.attributes('href')).toBe('https://example.com/portal?x=1');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toContain('noopener');
    expect(entry.get('[data-test="title"]').attributes('href')).toBe('/guides/register-courses');
  });

  it('narrows the list as the student types, in either language', async () => {
    const w = await render();
    await w.get('input[type="search"]').setValue('tuition');
    expect(titles(w)).toEqual(['Đóng học phí']);
    await w.get('input[type="search"]').setValue('dang ky');
    expect(titles(w)).toEqual(['Đăng ký học phần']);
  });

  it('says no guide covers the query and offers the task groups to browse (A2)', async () => {
    const w = await render();
    await w.get('input[type="search"]').setValue('xyzzy');
    const empty = w.get('[data-test="no-match"]');
    expect(empty.text()).toContain('Chưa có hướng dẫn cho việc này.');
    expect(empty.findAll('button').map((b) => b.text())).toEqual(['Đăng ký học phần', 'Học phí và lệ phí']);
    // B1: no Suggest a guide and no advisor link (UC-10 A2, B3).
    expect(empty.findAll('a')).toHaveLength(0);

    await empty.findAll('button')[1].trigger('click');
    await flushPromises();
    expect((w.get('input[type="search"]').element as HTMLInputElement).value).toBe('');
    expect(titles(w)).toHaveLength(3);
    expect(document.activeElement?.tagName).toBe('H2');
    expect(document.activeElement?.textContent).toBe('Học phí và lệ phí');
  });

  it('marks an out-of-date guide, and a guide written in one language only', async () => {
    const w = await render();
    expect(w.get('[data-test="guide-zz-vi-only"]').text()).toContain('Có thể đã cũ');
    expect(w.get('[data-test="guide-register-courses"]').text()).toContain('Kiểm tra ngày 01/11/2026');

    useLocale().set('en');
    await nextTick();
    const viOnly = w.get('[data-test="guide-zz-vi-only"]');
    expect(viOnly.text()).toContain('Vietnamese only');
    expect(viOnly.text()).toContain('May be out of date');
    expect(viOnly.get('[data-test="title"]').attributes('lang')).toBe('vi');
    expect(w.get('[data-test="guide-register-courses"]').text()).toContain('Checked on 1 Nov 2026');
  });

  it('switches every label to English', async () => {
    const w = await render();
    useLocale().set('en');
    await nextTick();
    expect(w.get('h1').text()).toBe('School task guides');
    expect(w.get('label').text()).toBe('What do you need to do?');
    expect(headings(w)).toEqual(['Registration', 'Tuition and fees']);
    expect(titles(w)).toEqual(['Hướng dẫn thử zz-vi-only', 'Register for courses', 'Pay tuition']);
    expect(document.title).toBe('School task guides · OmniCourse');
  });

  it('shows a load error in plain words with a way to try again, and keeps the details in the console', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('GET /guides failed: 503');
    vi.mocked(fetchGuides).mockRejectedValueOnce(failure);
    const w = await render();
    expect(w.get('[role="alert"]').text()).toContain('Chưa tải được hướng dẫn. Hãy thử lại sau ít phút.');
    expect(w.get('[role="alert"]').text()).not.toContain('503');
    expect(consoleError).toHaveBeenCalledWith('Loading the guides failed:', failure);
    await w.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(titles(w)).toHaveLength(3);
  });

  it('says when no guide is published yet', async () => {
    vi.mocked(fetchGuides).mockResolvedValue([]);
    const w = await render();
    expect(w.text()).toContain('Chưa có hướng dẫn nào được đăng.');
  });
});
