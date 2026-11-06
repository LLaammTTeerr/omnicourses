import { createPinia } from 'pinia';
import { afterEach, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { createApp, type App as VueApp } from 'vue';
import { createRouter, createWebHistory, type Router } from 'vue-router';
import App from './App.vue';
import type { Guide, GuideListItem, GuideListText } from './guides/api.js';
import { routes, scrollBehavior } from './router.js';

const listText = (n: string): GuideListText => ({
  title: `Hướng dẫn thử ${n}`,
  keywords: [],
  portal: { name: 'Cổng thử', url: 'https://example.com/portal', account: 'Tài khoản thử' },
  version: 1,
  lastCheckedOn: '2026-11-01',
  outOfDate: false,
});
// Enough guides that the list scrolls on a phone.
const LIST: GuideListItem[] = Array.from({ length: 20 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return { id: `zz-guide-${n}`, group: 'registration', texts: { vi: listText(n) } };
});
const guide = (id: string): Guide => ({
  id,
  group: 'registration',
  texts: {
    vi: {
      ...listText(id.slice(-2)),
      changeNote: 'Bản thử.',
      lastCheckedBy: 'Test team',
      summary: 'Hướng dẫn giả lập để kiểm thử.',
      when: { text: 'Khi chạy kiểm thử.' },
      appliesTo: 'Tài khoản kiểm thử',
      prepare: [],
      steps: [{ text: 'Mở cổng thử.' }],
      notes: [],
      citations: [],
      ifPortalDown: null,
      related: [],
      portals: [],
    },
  },
});

const originalUrl = window.location.href;
const originalHistoryState = window.history.state;
let app: VueApp | undefined;
let host: HTMLDivElement | undefined;
let router: Router | undefined;

afterEach(() => {
  app?.unmount();
  host?.remove();
  router?.options.history.destroy();
  window.history.replaceState(originalHistoryState, '', originalUrl);
  window.scrollTo(0, 0);
  localStorage.removeItem('omnicourse.lang');
  vi.restoreAllMocks();
});

it('goes back to the same place in the guide list after reading a guide', async () => {
  await page.viewport(360, 500);
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const id = String(input).match(/\/guides\/([^/]+)$/)?.[1];
    return Response.json(id ? guide(decodeURIComponent(id)) : { guides: LIST });
  });
  window.history.replaceState(null, '', '/guides');
  router = createRouter({ history: createWebHistory(), routes, scrollBehavior });
  host = document.createElement('div');
  document.body.append(host);
  app = createApp(App).use(createPinia()).use(router);
  app.mount(host);
  await router.isReady();

  const last = page.getByRole('link', { name: 'Hướng dẫn thử 20', exact: true });
  await expect.element(last).toBeInTheDocument();
  last.element().scrollIntoView();
  const before = window.scrollY;
  expect(before).toBeGreaterThan(0);

  await last.click();
  await expect.element(page.getByRole('heading', { level: 1, name: 'Hướng dẫn thử 20' })).toBeVisible();
  await expect.poll(() => window.scrollY).toBe(0);
  // The list, kept alive out of sight, leaves the title of the guide on screen alone.
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect.element(page.getByRole('link', { name: 'Guides', exact: true }).first()).toBeVisible();
  expect(document.title).toBe('Hướng dẫn thử 20 · OmniCourse');

  window.history.back();
  await expect.element(last).toBeInTheDocument();
  await expect.poll(() => window.scrollY).toBe(before);
  expect(document.title).toBe('School task guides · OmniCourse');
});

it('names the tab after the home page when the reader goes home from a guide', async () => {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const id = String(input).match(/\/guides\/([^/]+)$/)?.[1];
    if (id) return Response.json(guide(decodeURIComponent(id)));
    return Response.json(String(input).endsWith('/health') ? { status: 'ok', database: 'up', postgresVersion: '18.6' } : { guides: LIST });
  });
  window.history.replaceState(null, '', '/guides/zz-guide-07');
  router = createRouter({ history: createWebHistory(), routes, scrollBehavior });
  host = document.createElement('div');
  document.body.append(host);
  app = createApp(App).use(createPinia()).use(router);
  app.mount(host);
  await expect.element(page.getByRole('heading', { level: 1, name: 'Hướng dẫn thử 07' })).toBeVisible();
  expect(document.title).toBe('Hướng dẫn thử 07 · OmniCourse');

  await page.getByRole('banner').getByRole('link', { name: 'OmniCourse', exact: true }).click();
  await expect.element(page.getByRole('heading', { level: 1, name: 'OmniCourse', exact: true })).toBeVisible();
  expect(document.title).toBe('OmniCourse');
});
