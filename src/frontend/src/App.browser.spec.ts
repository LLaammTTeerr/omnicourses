import { afterEach, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vue';
import indexHtml from '../index.html?raw';
import { HEALTHY } from './testing/health.js';

const originalUrl = window.location.href;
const originalHistoryState = window.history.state;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (host) {
    render(null, host);
    host.remove();
  }
  window.history.replaceState(originalHistoryState, '', originalUrl);
  localStorage.removeItem('omnicourse.lang');
  vi.restoreAllMocks();
});

it('boots the app entry and renders the home route inside the app shell', async () => {
  const html = new DOMParser().parseFromString(indexHtml, 'text/html');
  expect(html.querySelector('script[type="module"]')?.getAttribute('src')).toBe('/src/main.ts');
  host = html.querySelector<HTMLDivElement>('div#app');
  expect(host, 'index.html supplies the app mount point').not.toBeNull();
  document.body.append(host!);
  window.history.replaceState(null, '', '/');
  vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json(HEALTHY));

  await import('./main.js');

  const banner = page.getByRole('banner');
  await expect.element(banner.getByRole('link', { name: 'OmniCourse', exact: true })).toHaveAttribute('href', '/');
  await expect.element(banner.getByRole('link', { name: 'Hướng dẫn', exact: true })).toHaveAttribute('href', '/guides');
  const main = page.getByRole('main');
  await expect.element(main.getByRole('heading', { name: 'OmniCourse', exact: true })).toBeVisible();
  await expect.element(main.getByText('API ok · database up (PostgreSQL 18.6)')).toBeVisible();

  // The header switches the screen language and <html lang> (Vision §6 Usability).
  expect(document.documentElement.lang).toBe('vi');
  await banner.getByRole('button', { name: 'English', exact: true }).click();
  await expect.element(banner.getByRole('link', { name: 'Guides', exact: true })).toHaveAttribute('href', '/guides');
  await expect.element(banner.getByRole('button', { name: 'Tiếng Việt', exact: true })).toBeVisible();
  expect(document.documentElement.lang).toBe('en');
});
