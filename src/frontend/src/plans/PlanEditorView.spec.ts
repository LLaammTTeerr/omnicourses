import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView } from 'vue-router';
import { useAuth } from '../auth/store.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import type { PlanIssues, PlanTerm } from './api.js';
import { course, CURRICULUM, issue, plan, PLAN_ID, report } from './testing/fixtures.js';

// 1 October 2026 in Vietnam: term 1 of 2026–2027. The synthetic student's target is term 2 of 2027–2028, so the
// editor draws five rows: 2026-1 to 2027-2.
const NOW = new Date('2026-10-01T03:00:00Z');

const SAVED: PlanTerm[] = [{ term: { year: 2026, number: 1 }, placements: [course('ZZ101'), course('ZZ102')] }];

// What the rule engine says about SAVED: ZZ102 misses a prerequisite, ZZ101's offering terms are not recorded, the
// term is under the minimum, and the elective group is short.
const REPORT: PlanIssues = report({
  terms: [{ term: { year: 2026, number: 1 }, kind: 'main', credits: 8, caps: { min: 10, max: 22 } }],
  issues: [
    issue({ code: 'load_below_minimum', kind: 'flag', term: { year: 2026, number: 1 }, credits: 8, limit: 10, citation: 'QĐ 1175/QĐ-KHTN Điều 7.2.a' }),
    issue({ code: 'offering_terms_not_recorded', kind: 'unknown', term: { year: 2026, number: 1 }, position: 0, courseCode: 'ZZ101' }),
    issue({ code: 'prerequisite_not_met', kind: 'violation', term: { year: 2026, number: 1 }, position: 1, courseCode: 'ZZ102', missingCourseCodes: ['ZZ101'], citation: 'QĐ 1175/QĐ-KHTN Điều 3.1.c' }),
    issue({ code: 'requirement_not_covered', kind: 'violation', requirementGroupId: 'g-elec', credits: 0, limit: 4, citation: 'QĐ 1175/QĐ-KHTN Điều 17.3.b' }),
  ],
  coverage: {
    groups: [{ id: 'g-elec', name: 'Tự chọn thử', kind: 'elective', requiredCredits: 4, credits: 0, remainingCredits: 4, met: false }],
    combinedMinimums: [],
    totalRequired: 20,
    totalCredits: 8,
    totalRemaining: 12,
    graduation: 'not_yet',
  },
});

let wrapper: VueWrapper | undefined;

interface Options {
  routes?: Record<string, unknown>;
  /** The reports GET /issues answers, one per call; the last one repeats. */
  reports?: (PlanIssues | number)[];
}

async function render({ routes = {}, reports = [REPORT] }: Options = {}) {
  const sent: PlanTerm[][] = [];
  let checks = 0;
  const fetch = mockApi({
    [`GET /plans/${PLAN_ID}`]: plan(SAVED),
    'GET /programs/APCS/curricula/2024': CURRICULUM,
    'GET /users/me/transcript': { rows: [{ courseCode: 'ZZ414', courseName: 'Học máy thử', credits: 4, result: 'graded', grade: 8, term: { year: 2025, number: 1 } }] },
    [`PUT /plans/${PLAN_ID}/placements`]: (init: RequestInit) => {
      const { terms } = sentBody(init) as { terms: PlanTerm[] };
      sent.push(terms);
      return Response.json(plan(terms));
    },
    [`GET /plans/${PLAN_ID}/issues`]: () => {
      const answer = reports[Math.min(checks++, reports.length - 1)]!;
      return typeof answer === 'number' ? new Response(null, { status: answer }) : Response.json(answer);
    },
    ...routes,
  });
  const app = await setup(`/plans/${PLAN_ID}`);
  wrapper = mount(RouterView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch, sent, checks: () => checks };
}

const rowCodes = (w: VueWrapper) =>
  w.findAll('.trow').map((row) => `${row.get('h3').text()}: ${row.findAll('.ptile .k').map((k) => k.text()).join(' ')}`.trim());
const row = (w: VueWrapper, key: string) => w.get(`[data-test="term-${key}"]`);
const tile = (w: VueWrapper, code: string) => w.get(`[data-test="tile-${code}"]`);

describe('PlanEditorView (F5, UC-05)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('draws a row per term from now to the target term, with the saved courses', async () => {
    const { w } = await render();
    expect(w.get('h1').text()).toBe('Kế hoạch thử');
    expect(rowCodes(w)).toEqual(['HK1 2026–2027: ZZ101 ZZ102', 'HK2 2026–2027:', 'HK3 2026–2027:', 'HK1 2027–2028:', 'HK2 2027–2028:']);
    expect(tile(w, 'ZZ102').text()).toContain('Cấu trúc thử');
    expect(tile(w, 'ZZ102').text()).toContain('4 TC');
    expect(w.get('[data-test="save-state"]').text()).toBe('Đã lưu');
  });

  it('shows each issue on its course and term, with its citation, as the rule engine reported it', async () => {
    const { w } = await render();
    const zz102 = tile(w, 'ZZ102');
    expect(zz102.classes()).toContain('has-violation');
    expect(zz102.get('[data-test="tile-issue-violation"]').text()).toBe('Vi phạm: ZZ102 cần học xong ZZ101 ở một học kỳ trước. QĐ 1175/QĐ-KHTN Điều 3.1.c');
    const zz101 = tile(w, 'ZZ101');
    expect(zz101.classes()).not.toContain('has-violation');
    expect(zz101.get('[data-test="tile-issue-unknown"]').text()).toBe('Chưa ghi nhận học kỳ mở môn');

    const term = row(w, '2026-1');
    expect(term.classes()).toContain('has-flag');
    expect(term.get('[data-test="load"]').text()).toBe('8 TC · 10–22 TC');
    expect(term.get('[data-test="row-issue-flag"]').text()).toContain('8 TC, dưới mức tối thiểu 10 TC. Được phép nếu có đơn được duyệt. QĐ 1175/QĐ-KHTN Điều 7.2.a');

    const panel = w.get('.issues-panel');
    expect(panel.get('[data-test="issue-counts"]').text()).toBe('2 vi phạm1 cần xem lại1 chưa ghi nhận');
    expect(panel.findAll('[data-test="issue-violation"]').map((li) => li.text())).toEqual([
      'Vi phạm: ZZ102 cần học xong ZZ101 ở một học kỳ trước.HK1 2026–2027 · Nguồn: QĐ 1175/QĐ-KHTN Điều 3.1.c',
      'Vi phạm: Tự chọn thử còn thiếu: 0/4 TC.Cả kế hoạch · Nguồn: QĐ 1175/QĐ-KHTN Điều 17.3.b',
    ]);
    expect(panel.get('[data-test="unknowns"] summary').text()).toBe('Chưa ghi nhận (1)');
    expect(panel.get('[data-test="unknowns"]').text()).toContain('không phải đạt, cũng không phải trượt');
    expect(panel.get('[data-test="coverage"]').text()).toContain('8/20 TC · Chưa đủ để tốt nghiệp');
    expect(panel.get('[data-test="coverage"]').text()).toContain('Thiếu 4 TC');
  });

  it('shows no load, cap or issue the rule engine did not report', async () => {
    const { w } = await render({ reports: [report()] });
    expect(w.find('[data-test="load"]').exists()).toBe(false);
    expect(w.find('.tmeter').exists()).toBe(false);
    expect(w.findAll('.has-violation, .has-flag')).toHaveLength(0);
    expect(w.get('[data-test="no-issues"]').text()).toBe('Rule engine không thấy vấn đề nào.');
  });

  it('adds a course found by search to the chosen term, saves the board and checks it again', async () => {
    const { w, sent, checks } = await render();
    expect(w.findAll('.pcourse .k').map((k) => k.text())).toEqual(['ZZ201', 'ZZ414']);
    // A neutral mark for a course of the transcript; the planner never says it is passed.
    expect(w.get('[data-test="pool-ZZ414"] [data-test="in-transcript"]').text()).toBe('Trong bảng điểm');
    expect(w.findAll('[data-test="in-transcript"]')).toHaveLength(1);
    await w.get('#course-search').setValue('giai thuat');
    expect(w.findAll('.pcourse .k').map((k) => k.text())).toEqual(['ZZ201']);
    await w.get('[data-test="add-to"]').setValue('2026-2');
    await w.get('[data-test="add-ZZ201"]').trigger('click');
    await flushPromises();
    expect(sent).toEqual([
      [
        { term: { year: 2026, number: 1 }, placements: [course('ZZ101'), course('ZZ102')] },
        { term: { year: 2026, number: 2 }, placements: [course('ZZ201')] },
      ],
    ]);
    expect(checks()).toBe(2);
    expect(rowCodes(w)[1]).toBe('HK2 2026–2027: ZZ201');
    expect(w.get('[data-test="announcer"]').text()).toBe('Đã thêm ZZ201 vào HK2 2026–2027.');
    expect(w.get('[data-test="tray"] [role="status"]').text()).toBe('Không có môn nào khớp.');
  });

  it('moves a course a term later or earlier and removes one, saving each change', async () => {
    const { w, sent } = await render();
    await tile(w, 'ZZ102').get('[data-test="later"]').trigger('click');
    await flushPromises();
    expect(rowCodes(w).slice(0, 2)).toEqual(['HK1 2026–2027: ZZ101', 'HK2 2026–2027: ZZ102']);
    expect(document.activeElement).toBe(tile(w, 'ZZ102').element);
    await tile(w, 'ZZ102').get('[data-test="earlier"]').trigger('click');
    await flushPromises();
    await tile(w, 'ZZ101').get('[data-test="remove"]').trigger('click');
    await flushPromises();
    expect(sent).toEqual([
      [
        { term: { year: 2026, number: 1 }, placements: [course('ZZ101')] },
        { term: { year: 2026, number: 2 }, placements: [course('ZZ102')] },
      ],
      [{ term: { year: 2026, number: 1 }, placements: [course('ZZ101'), course('ZZ102')] }],
      [{ term: { year: 2026, number: 1 }, placements: [course('ZZ102')] }],
    ]);
    expect(w.findAll('.pcourse .k').map((k) => k.text())).toContain('ZZ101');
    expect(tile(w, 'ZZ102').get('[data-test="earlier"]').attributes('disabled')).toBeDefined();
  });

  it('moves a course with the keyboard: Space lifts, arrows pick a term, Enter drops, Escape cancels (A1)', async () => {
    const { w, sent } = await render();
    const zz101 = tile(w, 'ZZ101');
    await zz101.trigger('keydown', { key: ' ' });
    expect(zz101.classes()).toContain('lifted');
    expect(w.get('[data-test="announcer"]').text()).toContain('Đã nhấc ZZ101 ở HK1 2026–2027.');
    await zz101.trigger('keydown', { key: 'ArrowDown' });
    await zz101.trigger('keydown', { key: 'ArrowDown' });
    expect(row(w, '2026-3').classes()).toContain('drop-target');
    await zz101.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(rowCodes(w).slice(0, 3)).toEqual(['HK1 2026–2027: ZZ102', 'HK2 2026–2027:', 'HK3 2026–2027: ZZ101']);
    expect(sent).toHaveLength(1);

    const zz102 = tile(w, 'ZZ102');
    await zz102.trigger('keydown', { key: ' ' });
    await zz102.trigger('keydown', { key: 'ArrowDown' });
    await zz102.trigger('keydown', { key: 'Escape' });
    await flushPromises();
    expect(sent).toHaveLength(1);
    expect(w.get('[data-test="announcer"]').text()).toBe('Đã hủy chuyển ZZ102.');

    await tile(w, 'ZZ102').trigger('keydown', { key: 'Delete' });
    await flushPromises();
    expect(sent[1]).toEqual([{ term: { year: 2026, number: 3 }, placements: [course('ZZ101')] }]);
  });

  it('places a course dragged from the list, and removes a tile dragged back to it', async () => {
    const { w, sent } = await render();
    await w.get('[data-test="pool-ZZ414"]').trigger('dragstart');
    await row(w, '2027-1').trigger('dragover');
    await row(w, '2027-1').trigger('drop');
    await flushPromises();
    expect(rowCodes(w)[3]).toBe('HK1 2027–2028: ZZ414');
    await tile(w, 'ZZ414').trigger('dragstart');
    await w.get('[data-test="tray"]').trigger('drop');
    await flushPromises();
    expect(rowCodes(w)[3]).toBe('HK1 2027–2028:');
    expect(sent).toHaveLength(2);
  });

  it('marks the issues as being re-checked until the new report arrives', async () => {
    let answer!: (value: Response) => void;
    const { w, fetch } = await render();
    // The next check waits until the test answers it.
    const original = fetch.getMockImplementation()!;
    fetch.mockImplementation(async (input, init) => (String(input).endsWith('/issues') ? new Promise<Response>((resolve) => (answer = resolve)) : original(input, init)));
    await tile(w, 'ZZ102').get('[data-test="later"]').trigger('click');
    await flushPromises();
    expect(w.get('[data-test="checking"]').text()).toBe('Đang kiểm tra…');
    // The old violation stays on its tile, dimmed, while the move is checked.
    expect(tile(w, 'ZZ102').classes()).toContain('has-violation');
    expect(row(w, '2026-2').classes()).toContain('stale');
    answer(Response.json(report()));
    await flushPromises();
    expect(w.find('[data-test="checking"]').exists()).toBe(false);
    expect(tile(w, 'ZZ102').classes()).not.toContain('has-violation');
  });

  it('puts back the saved board and says so when a save fails, never reporting it saved (PLAN-01e)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ routes: { [`PUT /plans/${PLAN_ID}/placements`]: status(503) } });
    await tile(w, 'ZZ101').get('[data-test="later"]').trigger('click');
    await flushPromises();
    expect(rowCodes(w).slice(0, 2)).toEqual(['HK1 2026–2027: ZZ101 ZZ102', 'HK2 2026–2027:']);
    expect(w.get('[data-test="save-error"]').text()).toBe('Chưa lưu được thay đổi. Kế hoạch đã trở về lần lưu gần nhất.');
    expect(w.get('[data-test="save-state"]').text()).not.toBe('Đã lưu');
  });

  it('shows the server’s reason when it refuses a board (400)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ routes: { [`PUT /plans/${PLAN_ID}/placements`]: status(400, { message: ['courseCode is not in the catalog'] }) } });
    await tile(w, 'ZZ101').get('[data-test="remove"]').trigger('click');
    await flushPromises();
    expect(w.get('[data-test="save-error"]').text()).toContain('(courseCode is not in the catalog)');
    expect(rowCodes(w)[0]).toBe('HK1 2026–2027: ZZ101 ZZ102');
  });

  it('offers a retry when the plan cannot be checked', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ reports: [500, REPORT] });
    expect(w.get('[data-test="issues-failed"]').text()).toContain('Chưa kiểm tra được kế hoạch.');
    await w.get('[data-test="issues-failed"] button').trigger('click');
    await flushPromises();
    expect(tile(w, 'ZZ102').classes()).toContain('has-violation');
  });

  it('still edits the plan when its curriculum cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w, sent } = await render({ routes: { 'GET /programs/APCS/curricula/2024': status(500) } });
    expect(w.get('[data-test="tray"] [role="alert"]').text()).toContain('Chưa tải được chương trình đào tạo');
    expect(tile(w, 'ZZ101').text()).toContain('ZZ101');
    await tile(w, 'ZZ101').get('[data-test="later"]').trigger('click');
    await flushPromises();
    expect(sent).toHaveLength(1);
  });

  it('adds a term after the last one without saving anything', async () => {
    const { w, sent } = await render();
    await w.get('[data-test="add-row"]').trigger('click');
    await flushPromises();
    expect(rowCodes(w).at(-1)).toBe('HK3 2027–2028:');
    expect(sent).toHaveLength(0);
    expect(w.find('[data-test="checking"]').exists()).toBe(false);
  });

  it('says when the plan is not the student’s (404)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ routes: { [`GET /plans/${PLAN_ID}`]: status(404) } });
    expect(w.get('[role="alert"]').text()).toContain('Không có kế hoạch này trong các kế hoạch của bạn.');
  });

  it('signs the student out on a 401', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await render({ routes: { [`GET /plans/${PLAN_ID}`]: status(401) } });
    expect(useAuth().signedIn).toBe(false);
  });
});
