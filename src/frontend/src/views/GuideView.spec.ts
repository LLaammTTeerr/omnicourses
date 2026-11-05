import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { createMemoryHistory, createRouter, type Router } from 'vue-router';
import { GuideNotFoundError, type Guide, type GuideText } from '../guides-api.js';
import { useLocale } from '../locale.js';
import { routes } from '../router.js';
import GuideView from './GuideView.vue';

const text = (lang: 'vi' | 'en', extra: Partial<GuideText> = {}): GuideText => ({
  title: lang === 'vi' ? 'Hướng dẫn thử' : 'Test guide',
  keywords: ['zz-fresh'],
  portal: { name: lang === 'vi' ? 'Cổng thử' : 'Test portal', url: 'https://example.com/portal/register', account: 'Test account' },
  version: 3,
  lastCheckedOn: '2026-11-01',
  outOfDate: false,
  changeNote: lang === 'vi' ? 'Sửa bước 2.' : 'Fixed step 2.',
  lastCheckedBy: 'Test team',
  summary: lang === 'vi' ? 'Việc này để làm gì.' : 'What the task is for.',
  when: { text: lang === 'vi' ? 'Mỗi học kỳ.' : 'Each term.', announcement: { label: 'Announcement', url: 'https://example.com/news' } },
  appliesTo: lang === 'vi' ? 'Mọi chương trình' : 'All programs',
  prepare: [{ text: 'A test account.', link: { label: 'Your transcript', url: '/transcript' } }],
  steps: [{ text: 'Open the test portal.' }, { text: 'Press “Gửi”.', link: { label: 'Help page', url: 'https://example.com/help' } }],
  notes: [
    { text: 'A regulation note.', source: { kind: 'regulation', document: 'Test regulation', clause: 'Article 1', url: 'https://example.com/reg.pdf' } },
    { text: 'A team note.', source: { kind: 'team' } },
  ],
  citations: [{ document: 'Test regulation', clause: 'Article 2', url: 'https://example.com/reg.pdf' }],
  ifPortalDown: 'Go to the test office.',
  related: [{ label: 'Pay tuition', url: '/guides/pay-tuition' }],
  portals: [],
  ...extra,
});

const GUIDE: Guide = { id: 'zz-fresh', group: 'registration', texts: { vi: text('vi'), en: text('en') } };

let wrapper: VueWrapper | undefined;
let router: Router;

async function render(load: (id: string) => Promise<Guide> = async () => GUIDE, lang: 'vi' | 'en' = 'en') {
  const pinia = createPinia();
  setActivePinia(pinia);
  useLocale().set(lang);
  router = createRouter({ history: createMemoryHistory(), routes });
  await router.push('/guides/zz-fresh');
  await router.isReady();
  wrapper = mount(GuideView, { props: { id: 'zz-fresh', load }, global: { plugins: [pinia, router] }, attachTo: document.body });
  await flushPromises();
  return wrapper;
}

describe('GuideView (UC-10 steps 4–6)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('shows every part of UC-10 step 5', async () => {
    const w = await render();
    expect(w.get('h1').text()).toBe('Test guide');
    expect(w.text()).toContain('What the task is for.');
    expect(w.text()).toContain('Each term.');
    expect(w.get('a[href="https://example.com/news"]').text()).toContain('Announcement');
    expect(w.text()).toContain('All programs');
    expect(w.text()).toContain('A test account.');
    expect(w.findAll('ol.steps > li').map((li) => li.text())).toEqual(['Open the test portal.', 'Press “Gửi”. Help page (opens in a new tab)']);
    expect(w.text()).toContain('A regulation note.');
    expect(w.get('a[href="https://example.com/reg.pdf"]').text()).toContain('Test regulation, Article 1');
    expect(w.text()).toContain("Source: the OmniCourse team's experience");
    expect(w.text()).toContain('Go to the test office.');
    expect(w.get('[data-test="version"]').text()).toContain('Version 3 · checked on the portal on 1 Nov 2026 by Test team');
    expect(w.get('[data-test="version"]').text()).toContain('What changed: Fixed step 2.');
    expect(document.title).toBe('Test guide · OmniCourse');
  });

  it('opens the portal in a new tab at the address of the content file (step 6)', async () => {
    const w = await render();
    const open = w.get('[data-test="open-portal"]');
    expect(open.text()).toContain('Open Test portal');
    expect(open.attributes('href')).toBe('https://example.com/portal/register');
    expect(open.attributes('target')).toBe('_blank');
    expect(open.attributes('rel')).toContain('noopener');
    expect(w.text()).toContain('Account: Test account');
  });

  it('keeps OmniCourse links in the app', async () => {
    const w = await render();
    expect(w.get('a[href="/guides/pay-tuition"]').attributes('target')).toBeUndefined();
    expect(w.get('a[href="/transcript"]').attributes('target')).toBeUndefined();
  });

  it('warns when the guide is out of date, and stays readable (A5)', async () => {
    const fresh = await render();
    expect(fresh.find('[data-test="out-of-date"]').exists()).toBe(false);
    fresh.unmount();

    const stale = await render(async () => ({ ...GUIDE, texts: { en: text('en', { outOfDate: true, lastCheckedOn: '2026-05-12' }) } }));
    expect(stale.get('[data-test="out-of-date"]').text()).toContain('last checked it on 12 May 2026');
    expect(stale.findAll('ol.steps > li')).toHaveLength(2);
  });

  it('shows the one language a guide has, with a note (A8)', async () => {
    const w = await render(async () => ({ ...GUIDE, texts: { vi: text('vi') } }), 'en');
    expect(w.get('h1').text()).toBe('Hướng dẫn thử');
    expect(w.get('h1').attributes('lang')).toBe('vi');
    expect(w.text()).toContain('This guide is only available in Vietnamese.');
  });

  it('switches language without changing the address', async () => {
    const w = await render();
    useLocale().set('vi');
    await nextTick();
    expect(w.get('h1').text()).toBe('Hướng dẫn thử');
    expect(w.text()).toContain('Phiên bản 3 · kiểm tra trên cổng ngày 01/11/2026 bởi Test team');
    expect(router.currentRoute.value.fullPath).toBe('/guides/zz-fresh');
  });

  it('shows "guide not found" with a link back to Guides', async () => {
    const w = await render(async (id) => {
      throw new GuideNotFoundError(id);
    }, 'vi');
    const notFound = w.get('[data-test="not-found"]');
    expect(notFound.get('h1').text()).toBe('Không tìm thấy hướng dẫn');
    expect(notFound.get('a').attributes('href')).toBe('/guides');
  });

  it('shows a load error in plain words with a way to try again, and keeps the details in the console', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = new Error('GET /guides/zz-fresh failed: 500');
    let calls = 0;
    const w = await render(async () => {
      calls++;
      if (calls === 1) throw failure;
      return GUIDE;
    });
    expect(w.get('[role="alert"]').text()).toContain('Could not load the guides right now. Please try again in a moment.');
    expect(w.get('[role="alert"]').text()).not.toContain('500');
    expect(consoleError).toHaveBeenCalledWith('Loading the guide failed:', failure);
    await w.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(w.get('h1').text()).toBe('Test guide');
  });

  it('shows the portal board of G01', async () => {
    const board = [{ name: 'Board portal', url: 'https://portal.example.com', account: 'Student account', purpose: 'Registration and grades' }];
    const w = await render(async () => ({ ...GUIDE, texts: { en: text('en', { portals: board }) } }));
    const entry = w.get('ul.board > li');
    expect(entry.text()).toContain('Board portal');
    expect(entry.text()).toContain('Registration and grades');
    expect(entry.get('a').attributes('target')).toBe('_blank');
  });
});
