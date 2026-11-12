import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useLocale } from '../locale.js';
import { mockApi, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import CalendarView from './CalendarView.vue';
import { calendar, event, EXAMS, HOLIDAY, PROGRAM, REGISTRATION, TERM_END, TERM_START } from './testing/fixtures.js';

let wrapper: VueWrapper | undefined;

async function render(answer: unknown = calendar()) {
  const fetch = mockApi({ 'GET /academic-calendar': answer });
  const app = await setup('/calendar');
  wrapper = mount(CalendarView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch, ...app };
}

const text = (w: VueWrapper, test: string) => w.get(`[data-test="${test}"]`).text();
const cell = (w: VueWrapper, day: string) => w.get(`[data-day="${day}"]`);

describe('CalendarView (F10 school dates)', () => {
  beforeEach(() => {
    localStorage.clear();
    // Thursday 12 November 2026, 10:00 in Vietnam.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-12T03:00:00Z'));
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens on this week with its term week, and puts each school date on the days it covers', async () => {
    const { w, fetch } = await render();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(text(w, 'range')).toBe('9/11 – 15/11');
    expect(text(w, 'subtitle')).toBe('HK1 2026–2027 · Tuần 10');
    expect(w.get('[data-test="today"]').attributes('disabled')).toBeDefined();
    expect(cell(w, '2026-11-09').findAll('[data-test="event"]')).toHaveLength(0);
    // The first day shows the whole card; the days after it a short line.
    const first = cell(w, '2026-11-10').get('[data-test="event"]');
    expect(first.text()).toContain('Đăng ký học phần');
    expect(first.get('.room').text()).toBe('10/11 – 20/11 · HK2');
    expect(first.text()).toContain('Đăng ký học phần học kỳ 2');
    
    expect(first.classes()).toContain('g-elec');
    const next = cell(w, '2026-11-11').get('[data-test="event"]');
    expect(next.classes()).toContain('cont');
    expect(next.text()).toBe('Đăng ký học phần học kỳ 2');
    expect(cell(w, '2026-11-12').classes()).toContain('today');
    expect(cell(w, '2026-11-15').findAll('[data-test="event"]')).toHaveLength(1);
  });

  it('moves between weeks and months without asking the API again', async () => {
    const { w, fetch } = await render();
    await w.get('[data-test="next"]').trigger('click');
    expect(text(w, 'range')).toBe('16/11 – 22/11');
    expect(text(w, 'subtitle')).toBe('HK1 2026–2027 · Tuần 11');
    // A week that starts mid-event shows the whole card on its Monday.
    expect(cell(w, '2026-11-16').get('[data-test="event"]').classes()).not.toContain('cont');
    expect(cell(w, '2026-11-20').findAll('[data-test="event"]').map((e) => e.text())).toEqual(['Đăng ký học phần học kỳ 2', expect.stringContaining('Nghỉ ngày Nhà giáo Việt Nam')]);
    await w.get('[data-test="tab-month"]').trigger('click');
    expect(text(w, 'range')).toBe('Tháng 11, 2026');
    expect(text(w, 'subtitle')).toBe('Năm học 2026–2027');
    await w.get('[data-test="next"]').trigger('click');
    await w.get('[data-test="next"]').trigger('click');
    expect(text(w, 'range')).toBe('Tháng 1, 2027');
    expect(cell(w, '2027-01-01').text()).toContain('Thi cuối kỳ HK1');
    await w.get('[data-test="today"]').trigger('click');
    expect(text(w, 'range')).toBe('Tháng 11, 2026');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('shows at most three dates a day in the month, and opens that week from the day', async () => {
    const extra = ['a', 'b', 'c'].map((id) => event({ id, kind: 'other', startsOn: '2026-11-20', title: `Mốc ${id}` }));
    const { w } = await render(calendar([REGISTRATION, HOLIDAY, ...extra]));
    await w.get('[data-test="tab-month"]').trigger('click');
    const day = cell(w, '2026-11-20');
    expect(day.findAll('[data-test="event"]')).toHaveLength(3);
    expect(day.get('.more').text()).toBe('+2');
    await day.get('.n').trigger('click');
    expect(w.find('[data-test="week"]').exists()).toBe(true);
    expect(text(w, 'range')).toBe('16/11 – 22/11');
  });

  it('lists what is still to come, the date now on first, and opens one in the detail card', async () => {
    const { w } = await render();
    const items = w.findAll('[data-test="upcoming-item"]');
    expect(items.map((i) => i.get('.t b').text())).toEqual([REGISTRATION.title, HOLIDAY.title, EXAMS.title, TERM_END.title]);
    expect(items[0]!.text()).toContain('Đang diễn ra');
    expect(items[0]!.get('.d').text()).toBe('12Th11');

    await items[0]!.trigger('click');
    const detail = w.get('[data-test="detail"]');
    expect(detail.text()).toContain('Đăng ký học phần học kỳ 2');
    expect(detail.text()).toContain('Term 2 course registration');
    expect(detail.text()).toContain('T3, 10/11/2026 – T6, 20/11/2026');
    expect(detail.text()).toContain('11 ngày · Đang diễn ra');
    expect(detail.text()).toContain('Học kỳ 2, 2026–2027');
    expect(detail.get('.notes').text()).toBe('Đăng ký trên cổng.\nKiểm tra lịch thi trước.');
    const source = detail.get('a');
    expect(source.attributes('href')).toBe(REGISTRATION.sourceUrl);
    expect(source.attributes('rel')).toBe('noopener noreferrer');
    expect(cell(w, '2026-11-10').get('[data-test="event"]').classes()).toContain('on');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(w.find('[data-test="detail"]').exists()).toBe(false);
  });

  it('jumps the week view to a date picked from the list that is not on screen', async () => {
    const { w } = await render();
    await w.findAll('[data-test="upcoming-item"]')[2]!.trigger('click');
    expect(text(w, 'range')).toBe('21/12 – 27/12');
    expect(text(w, 'subtitle')).toBe('HK1 2026–2027 · Tuần 16');
  });

  it('uses the English title in English, and the Vietnamese one when there is none', async () => {
    const { w, pinia } = await render();
    useLocale(pinia).set('en');
    await flushPromises();
    expect(cell(w, '2026-11-10').text()).toContain('Term 2 course registration');
    expect(cell(w, '2026-11-10').text()).toContain('T2');
    expect(text(w, 'subtitle')).toBe('Term 1 2026–2027 · Week 10');
    await w.findAll('[data-test="upcoming-item"]')[1]!.trigger('click');
    expect(text(w, 'detail')).toContain(HOLIDAY.title);
    expect(text(w, 'detail')).toContain('Whole year 2026–2027');
  });

  it('shows no week number when no term start is entered', async () => {
    const { w } = await render(calendar([REGISTRATION]));
    expect(text(w, 'subtitle')).toBe('Năm học 2026–2027');
    await w.get('[data-test="range"]').trigger('click');
    const options = w.findAll('[role="option"]');
    expect(options[0]!.text()).toContain('26/10');
    expect(options.some((o) => o.text().includes('Tuần'))).toBe(false);
  });

  it('picks a week of the month from the range button, numbered when the term is known', async () => {
    const { w } = await render();
    await w.get('[data-test="range"]').trigger('click');
    const options = w.findAll('[role="option"]');
    expect(options.map((o) => o.get('b').text())).toEqual(['Tuần 8', 'Tuần 9', 'Tuần 10', 'Tuần 11', 'Tuần 12', 'Tuần 13']);
    expect(options[2]!.attributes('aria-selected')).toBe('true');
    expect(options[2]!.text()).toContain('nay');
    await options[4]!.trigger('click');
    expect(text(w, 'range')).toBe('23/11 – 29/11');
    expect(w.find('[role="listbox"]').exists()).toBe(false);
  });

  it('says there are no school dates yet, with no made-up ones', async () => {
    const { w } = await render(calendar([]));
    expect(text(w, 'no-dates')).toContain('Chưa có lịch của trường');
    expect(w.findAll('[data-test="event"]')).toHaveLength(0);
    expect(w.text()).toContain(`quản trị chương trình ${PROGRAM.code}`);
  });

  it('says there are no school dates yet while the API has no calendar route (404), not that loading failed', async () => {
    const { w } = await render(status(404, { message: 'Cannot GET /api/academic-calendar', statusCode: 404 }));
    expect(w.find('[role="alert"]').exists()).toBe(false);
    expect(text(w, 'no-dates')).toContain('Chưa có lịch của trường');
    expect(w.find('[data-test="no-program"]').exists()).toBe(false);
    expect(w.findAll('[data-test="event"]')).toHaveLength(0);
  });

  it('sends a student with no program to pick one', async () => {
    const { w } = await render({ program: null, events: [] });
    expect(text(w, 'no-program')).toContain('Bạn chưa chọn chương trình');
    expect(w.get('[data-test="no-program"] a').attributes('href')).toBe('/onboarding');
  });

  it('says when the dates could not be loaded, and tries again', async () => {
    const fetch = mockApi({ 'GET /academic-calendar': status(500) });
    const app = await setup('/calendar');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    wrapper = mount(CalendarView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('Không tải được lịch.');
    fetch.mockImplementation(async () => Response.json(calendar([TERM_START])));
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(text(wrapper, 'subtitle')).toBe('HK1 2026–2027 · Tuần 10');
  });
});
