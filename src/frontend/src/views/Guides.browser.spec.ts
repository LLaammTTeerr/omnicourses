import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { afterEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import type { Component } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';
import type { Guide, GuideListItem, GuideText } from '../guides-api.js';
import { routes } from '../router.js';
import GuidesView from './GuidesView.vue';
import GuideView from './GuideView.vue';

// Long words and addresses: the content most likely to push a narrow page sideways (A11Y-01c).
const LONG = 'Đăng-ký-học-phần-trong-thời-gian-mở-cổng-theo-thông-báo-của-Phòng-Đào-tạo';
const URL_LONG = 'https://portal.example.com/sinh-vien/dang-ky-hoc-phan/chon-lop-hoc-phan?hoc-ky=2&nam-hoc=2026-2027';

const text: GuideText = {
  title: LONG,
  keywords: [],
  portal: { name: LONG, url: URL_LONG, account: LONG },
  version: 1,
  lastCheckedOn: '2026-05-01',
  outOfDate: true,
  changeNote: LONG,
  lastCheckedBy: 'Test team',
  summary: LONG,
  when: { text: LONG, announcement: { label: URL_LONG, url: URL_LONG } },
  appliesTo: LONG,
  prepare: [{ text: LONG }],
  steps: [{ text: LONG, link: { label: URL_LONG, url: URL_LONG } }],
  notes: [{ text: LONG, source: { kind: 'team' } }],
  citations: [{ document: LONG, clause: 'Điều 7', url: URL_LONG }],
  ifPortalDown: LONG,
  related: [],
  portals: [{ name: LONG, url: URL_LONG, account: LONG, purpose: LONG }],
};
const LIST: GuideListItem[] = [{ id: 'zz-long', group: 'registration', texts: { vi: text } }];
const GUIDE: Guide = { id: 'zz-long', group: 'registration', texts: { vi: text } };

let wrapper: VueWrapper | undefined;
afterEach(() => {
  wrapper?.unmount();
  wrapper = undefined;
});

async function expectNoSidewaysScroll(component: Component, props: Record<string, unknown>) {
  const router = createRouter({ history: createMemoryHistory(), routes });
  await router.push('/guides/zz-long');
  wrapper = mount(component, { props, global: { plugins: [createPinia(), router] }, attachTo: document.body });
  await flushPromises();
  expect(document.body.textContent).toContain(LONG);
  expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  wrapper.unmount();
  wrapper = undefined;
}

describe('guide pages in a real browser', () => {
  it.each([360, 768, 1280])('never scroll sideways at %i px', async (width) => {
    await page.viewport(width, 800);
    await expectNoSidewaysScroll(GuidesView, { load: async () => LIST });
    await expectNoSidewaysScroll(GuideView, { id: 'zz-long', load: async () => GUIDE });
  });
});
