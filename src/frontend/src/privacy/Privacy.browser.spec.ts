import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { App as VueApp } from 'vue';
import { createMemoryHistory } from 'vue-router';
import { createOmniCourseApp } from '../app.js';
import { createAppRouter } from '../router.js';
import { THEME_STORAGE_KEY } from '../shell/theme.js';
import { HEALTHY } from '../testing/health.js';

let app: VueApp | undefined;
let host: HTMLDivElement | undefined;
afterEach(() => {
  app?.unmount();
  host?.remove();
  app = host = undefined;
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('privacy notice in a real browser (A11Y-01c)', () => {
  it.each([
    [360, 'light'],
    [360, 'dark'],
    [768, 'light'],
    [1280, 'dark'],
    [1920, 'light'],
  ])('never scrolls sideways at %i px in the %s theme', async (width, theme) => {
    await page.viewport(width, 800);
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    // The public header checks the API's health; the notice itself calls nothing.
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(HEALTHY));
    const router = createAppRouter(createMemoryHistory());
    await router.push('/privacy');
    host = document.createElement('div');
    document.body.append(host);
    app = createOmniCourseApp(router);
    app.mount(host);
    await expect.poll(() => document.querySelector('h1')?.textContent).toBe('Quyền riêng tư');
    expect(document.documentElement.dataset.theme).toBe(theme);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });
});
