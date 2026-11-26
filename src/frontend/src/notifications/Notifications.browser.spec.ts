import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import '../styles.css';
import { setup } from '../testing/signed-in.js';
import NotificationsView from './NotificationsView.vue';
import { list, REGISTRATION_EVENT, SOON, TERM, TRANSCRIPT } from './testing/fixtures.js';

const PHONE = 360;
const DESKTOP = 1280;
const HEIGHT = 800;

const LONG = {
  ...SOON,
  id: 'zz-long',
  event: { ...REGISTRATION_EVENT, title: 'Đăng ký học phần học kỳ 2 năm học 2026–2027 dành cho sinh viên chương trình Cử nhân tài năng và chương trình tiên tiến' },
};

describe('NotificationsView layout in a real browser', () => {
  let host: HTMLDivElement;
  let wrapper: VueWrapper | undefined;

  beforeEach(() => {
    host = document.createElement('div');
    document.body.append(host);
  });
  afterEach(async () => {
    await page.viewport(DESKTOP, HEIGHT);
    wrapper?.unmount();
    wrapper = undefined;
    host.remove();
    vi.restoreAllMocks();
  });

  async function render(width: number) {
    await page.viewport(width, HEIGHT);
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(list([LONG, TERM, TRANSCRIPT])));
    const app = await setup('/notifications');
    wrapper = mount(NotificationsView, { attachTo: host, global: { plugins: [app.pinia, app.router] } });
    await vi.waitFor(() => expect(wrapper!.findAll('[data-test="notification"]')).toHaveLength(3));
    return wrapper;
  }

  const box = (el: Element) => el.getBoundingClientRect();

  it.each([PHONE, DESKTOP])('fits %i px with no sideways scroll, every action inside its notification', async (width) => {
    const w = await render(width);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    for (const item of w.findAll('[data-test="notification"]')) {
      const outer = box(item.element);
      for (const action of item.findAll('a, button')) {
        const inner = box(action.element);
        expect(inner.left).toBeGreaterThanOrEqual(outer.left);
        expect(inner.right).toBeLessThanOrEqual(outer.right);
      }
    }
  });

  it('puts the time beside the text on a desktop, and above the title on a phone', async () => {
    const desk = await render(DESKTOP);
    const deskItem = desk.findAll('[data-test="notification"]')[0]!;
    expect(box(deskItem.get('time').element).left).toBeGreaterThanOrEqual(box(deskItem.get('.note-body').element).right);
    desk.unmount();

    const phone = await render(PHONE);
    const phoneItem = phone.findAll('[data-test="notification"]')[0]!;
    expect(box(phoneItem.get('time').element).bottom).toBeLessThanOrEqual(box(phoneItem.get('h2').element).top);
  });
});
