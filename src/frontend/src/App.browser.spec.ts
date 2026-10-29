import { afterEach, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vue';
import type { Router } from 'vue-router';
import indexHtml from '../index.html?raw';

const originalUrl = window.location.href;
const originalHistoryState = window.history.state;
let host: HTMLDivElement | null = null;
let router: Router | undefined;

afterEach(() => {
  if (host) {
    render(null, host);
    host.remove();
  }
  router?.options.history.destroy();
  window.history.replaceState(originalHistoryState, '', originalUrl);
  vi.restoreAllMocks();
});

it('boots the app entry and renders the home route inside the app shell', async () => {
  const html = new DOMParser().parseFromString(indexHtml, 'text/html');
  expect(html.querySelector('script[type="module"]')?.getAttribute('src')).toBe('/src/main.ts');
  host = html.querySelector<HTMLDivElement>('div#app');
  expect(host, 'index.html supplies the app mount point').not.toBeNull();
  document.body.append(host!);
  window.history.replaceState(null, '', '/');
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
    Response.json({ status: 'ok', database: 'up', postgresVersion: '18.6' }),
  );

  ({ router } = await import('./router.js'));
  await import('./main.js');
  await router.push('/');
  await router.isReady();

  await expect.element(page.getByRole('banner')).toHaveTextContent('OmniCourse');
  const main = page.getByRole('main');
  await expect.element(main.getByRole('heading', { name: 'OmniCourse', exact: true })).toBeVisible();
  await expect.element(main.getByText('API ok · database up (PostgreSQL 18.6)')).toBeVisible();
});
