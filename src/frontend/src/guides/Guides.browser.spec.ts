import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { App as VueApp } from 'vue';
import { createMemoryHistory } from 'vue-router';
import { createOmniCourseApp } from '../app.js';
import { createAppRouter } from '../router.js';
import type { Guide, GuideListItem } from './api.js';
import { guideText } from './testing/guide-fixtures.js';

// Long words and addresses with no break opportunity (no space, hyphen or slash inside):
// the content most likely to push a narrow page sideways (A11Y-01c).
const LONG = 'ĐăngkýhọcphầntrongthờigianmởcổngtheothôngbáocủaPhòngĐàotạo';
const URL_LONG = `https://portal.example.com/${'DangKyHocPhan'.repeat(6)}`;

const text = guideText({
  title: LONG,
  portal: { name: LONG, url: URL_LONG, account: LONG },
  lastCheckedOn: '2026-05-01',
  outOfDate: true,
  changeNote: LONG,
  summary: LONG,
  when: { text: LONG, announcement: { label: URL_LONG, url: URL_LONG } },
  appliesTo: LONG,
  prepare: [{ text: LONG }],
  steps: [{ text: LONG, link: { label: URL_LONG, url: URL_LONG } }],
  notes: [{ text: LONG, source: { kind: 'team' } }],
  citations: [{ document: LONG, clause: 'Điều 7', url: URL_LONG }],
  ifPortalDown: LONG,
  portals: [{ name: LONG, url: URL_LONG, account: LONG, purpose: LONG }],
});
const LIST: GuideListItem[] = [{ id: 'zz-long', group: 'registration', texts: { vi: text } }];
const GUIDE: Guide = { id: 'zz-long', group: 'registration', texts: { vi: text } };

let app: VueApp | undefined;
let host: HTMLDivElement | undefined;
afterEach(() => {
  app?.unmount();
  host?.remove();
  vi.restoreAllMocks();
});

// The whole app, header and padding included, so the width is the one a student gets.
async function expectNoSidewaysScroll(path: string) {
  const router = createAppRouter(createMemoryHistory());
  await router.push(path);
  host = document.createElement('div');
  document.body.append(host);
  app = createOmniCourseApp(router);
  app.mount(host);
  await expect.poll(() => document.body.textContent).toContain(LONG);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  app.unmount();
  host.remove();
  app = host = undefined;
}

describe('guide pages in a real browser', () => {
  it.each([360, 768, 1280])('never scroll sideways at %i px', async (width) => {
    await page.viewport(width, 800);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => Response.json(String(input).endsWith('/guides/zz-long') ? GUIDE : { guides: LIST }));
    await expectNoSidewaysScroll('/guides');
    await expectNoSidewaysScroll('/guides/zz-long');
  });
});
