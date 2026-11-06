import { mount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import type { Component } from 'vue';
import { createMemoryHistory } from 'vue-router';
import { createAppRouter } from '../router.js';
import type { Guide, GuideListItem } from './api.js';
import GuidesView from './GuidesView.vue';
import GuideView from './GuideView.vue';
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

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
  vi.restoreAllMocks();
});

async function expectNoSidewaysScroll(component: Component, props: Record<string, unknown> = {}) {
  const router = createAppRouter(createMemoryHistory());
  await router.push('/guides/zz-long');
  wrapper = mount(component, { props, global: { plugins: [createPinia(), router] }, attachTo: document.body });
  await expect.poll(() => document.body.textContent).toContain(LONG);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  wrapper.unmount();
  wrapper = undefined;
}

describe('guide pages in a real browser', () => {
  it.each([360, 768, 1280])('never scroll sideways at %i px', async (width) => {
    await page.viewport(width, 800);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => Response.json(String(input).endsWith('/guides/zz-long') ? GUIDE : { guides: LIST }));
    await expectNoSidewaysScroll(GuidesView);
    await expectNoSidewaysScroll(GuideView, { id: 'zz-long' });
  });
});
