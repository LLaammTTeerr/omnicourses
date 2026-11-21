import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '../styles.css';
import { setup } from '../testing/signed-in.js';
import CalendarView from './CalendarView.vue';
import { calendar, event, REGISTRATION } from './testing/fixtures.js';

const LONG = event({
  id: 'zz-long',
  kind: 'other',
  startsOn: '2026-11-11',
  title: 'Hội thảo hướng nghiệp khoa Công nghệ Thông tin dành cho sinh viên năm ba và năm tư cùng các doanh nghiệp đối tác',
});

describe('CalendarView layout in a real browser', () => {
  let host: HTMLDivElement;
  let wrapper: VueWrapper | undefined;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-12T03:00:00Z'));
    host = document.createElement('div');
    document.body.append(host);
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    host.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  async function render(width: number) {
    host.style.width = `${width}px`;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(calendar([REGISTRATION, LONG])));
    const app = await setup('/calendar');
    wrapper = mount(CalendarView, { attachTo: host, global: { plugins: [app.pinia, app.router] } });
    // A real Response body resolves after a browser task, not a microtask, so wait for the week to draw.
    await vi.waitFor(() => expect(wrapper!.find('[data-test="week"]').exists()).toBe(true));
    return wrapper;
  }

  it('cuts a long title to three lines in the week view, with the whole title on hover', async () => {
    const w = await render(560);
    const card = w.get('[data-day="2026-11-11"] [data-test="event"]:not(.cont)');
    const title = card.get('b').element as HTMLElement;
    const line = parseFloat(getComputedStyle(title).lineHeight);
    expect(title.clientHeight).toBeLessThanOrEqual(Math.ceil(line * 3) + 1);
    expect(title.scrollHeight).toBeGreaterThan(title.clientHeight);
    expect(card.attributes('title')).toBe(LONG.title);
  });

  it('scrolls the week to today on a phone, where the seven days do not fit', async () => {
    vi.setSystemTime(new Date('2026-11-15T03:00:00Z')); // Sunday, the last column.
    const w = await render(360);
    const scroll = w.get('[data-test="week"]').element.parentElement!;
    expect(scroll.scrollWidth).toBeGreaterThan(scroll.clientWidth);
    await vi.waitFor(() => {
      const box = scroll.getBoundingClientRect();
      const today = w.get('[data-day="2026-11-15"]').element.getBoundingClientRect();
      expect(today.left).toBeGreaterThanOrEqual(box.left);
      expect(today.right).toBeLessThanOrEqual(box.right + 1);
    });
  });

  it('keeps the focus ring on the pressed Week button', async () => {
    const w = await render(560);
    const week = w.get('[data-test="tab-week"]').element as HTMLButtonElement;
    expect(week.getAttribute('aria-pressed')).toBe('true');
    week.focus();
    expect(week.matches(':focus-visible')).toBe(true);
    const style = getComputedStyle(week);
    expect(style.outlineWidth).toBe('2px');
    expect(style.outlineStyle).toBe('solid');
  });

  it('fits the month grid in a 560px content area without scrolling sideways', async () => {
    const w = await render(560);
    await w.get('[data-test="tab-month"]').trigger('click');
    const scroll = w.get('[data-test="month"]').element.parentElement!;
    expect(scroll.scrollWidth).toBeLessThanOrEqual(scroll.clientWidth);
  });
});
