import { afterEach, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { App as VueApp } from 'vue';
import type { Router } from 'vue-router';
import { createOmniCourseApp } from './app.js';
import type { Guide, GuideListItem } from './guides/api.js';
import { guideText, listText } from './guides/testing/guide-fixtures.js';
import { createAppRouter } from './router.js';
import { HEALTHY } from './testing/health.js';

const title = (n: string) => `Hướng dẫn thử ${n}`;
// Enough guides that the list scrolls on a phone.
const LIST: GuideListItem[] = Array.from({ length: 20 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return { id: `zz-guide-${n}`, group: 'registration', texts: { vi: listText({ title: title(n) }) } };
});
const guide = (id: string): Guide => ({ id, group: 'registration', texts: { vi: guideText({ title: title(id.slice(-2)) }) } });

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

async function openApp(path: string): Promise<Router> {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    const id = url.match(/\/guides\/([^/]+)$/)?.[1];
    if (id) return Response.json(guide(decodeURIComponent(id)));
    return Response.json(url.endsWith('/health') ? HEALTHY : { guides: LIST });
  });
  window.history.replaceState(null, '', path);
  router = createAppRouter();
  host = document.createElement('div');
  document.body.append(host);
  app = createOmniCourseApp(router);
  app.mount(host);
  await router.isReady();
  return router;
}

it('goes back to the same place in the guide list after reading a guide', async () => {
  await page.viewport(360, 500);
  await openApp('/guides');

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

it('moves to the main content from the skip link', async () => {
  await page.viewport(360, 500);
  const router = await openApp('/guides');
  const last = page.getByRole('link', { name: 'Hướng dẫn thử 20', exact: true });
  await expect.element(last).toBeInTheDocument();
  last.element().scrollIntoView();
  const main = document.getElementById('main')!;
  expect(main.offsetTop, 'the header sits above the main content').toBeGreaterThan(0);
  expect(window.scrollY).toBeGreaterThan(main.offsetTop);

  await router.push({ hash: '#main' });
  await expect.poll(() => window.scrollY).toBe(main.offsetTop);
});

it('names the tab after the home page when the reader goes home from a guide', async () => {
  await openApp('/guides/zz-guide-07');
  await expect.element(page.getByRole('heading', { level: 1, name: 'Hướng dẫn thử 07' })).toBeVisible();
  expect(document.title).toBe('Hướng dẫn thử 07 · OmniCourse');

  await page.getByRole('banner').getByRole('link', { name: 'OmniCourse', exact: true }).click();
  await expect.element(page.getByRole('heading', { level: 1, name: 'OmniCourse', exact: true })).toBeVisible();
  expect(document.title).toBe('OmniCourse');
});
