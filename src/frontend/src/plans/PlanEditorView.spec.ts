import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView } from 'vue-router';
import { useAuth } from '../auth/store.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { chooseOption } from '../testing/select.js';
import { setup } from '../testing/signed-in.js';
import type { PlanIssues, PlanTerm } from './api.js';
import { course, CURRICULUM, ELECTIVE_GROUP, issue, OTHER_ID, plan, PLAN_ID, report, summary } from './testing/fixtures.js';

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
  /** What POST /issues/drops (the drag preview) answers for each target's board; by default a report with no issue. */
  previews?: (terms: PlanTerm[]) => PlanIssues | number;
}

async function render({ routes = {}, reports = [REPORT], previews = () => report() }: Options = {}) {
  const sent: PlanTerm[][] = [];
  const previewed: PlanTerm[][] = [];
  let previewRequests = 0;
  let checks = 0;
  const fetch = mockApi({
    [`GET /plans/${PLAN_ID}`]: plan(SAVED),
    'GET /programs/APCS/curricula/2024': CURRICULUM,
    'GET /users/me/transcript': { rows: [{ courseCode: 'ZZ414', courseName: 'Học máy thử', credits: 4, result: 'graded', grade: 8, term: { year: 2025, number: 1 } }] },
    'GET /plans': { plans: [summary(), summary({ id: OTHER_ID, name: 'Kế hoạch khác' })] },
    // No audit by default: no "Taken" strip, nothing locked in the current term.
    'GET /users/me/audit': status(409, { statusCode: 409, code: 'onboarding_required', message: 'Onboarding first' }),
    [`PUT /plans/${PLAN_ID}/placements`]: (init: RequestInit) => {
      const { terms } = sentBody(init) as { terms: PlanTerm[] };
      sent.push(terms);
      return Response.json(plan(terms));
    },
    // The drag preview: one request per drag, a board per target (the placement at the end of that term).
    [`POST /plans/${PLAN_ID}/issues/drops`]: (init: RequestInit) => {
      const { terms, placement, targets } = sentBody(init) as { terms: PlanTerm[]; placement: PlanTerm['placements'][number]; targets: PlanTerm['term'][] };
      previewRequests++;
      const reports = [];
      for (const target of targets) {
        const same = (t: PlanTerm) => t.term.year === target.year && t.term.number === target.number;
        const board = terms.some(same) ? terms.map((t) => (same(t) ? { term: t.term, placements: [...t.placements, placement] } : t)) : [...terms, { term: target, placements: [placement] }];
        previewed.push(board);
        const answer = previews(board);
        if (typeof answer === 'number') return new Response(null, { status: answer });
        reports.push({ term: target, issues: answer });
      }
      return Response.json({ reports });
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
  return { w: wrapper, fetch, sent, previewed, previewRequests: () => previewRequests, checks: () => checks, router: app.router };
}

/** A request the test answers when it chooses: `answer` resolves the oldest call still open. */
function held() {
  const open: ((response: Response) => void)[] = [];
  return {
    respond: () => new Promise<Response>((resolve) => open.push(resolve)),
    answer(response: Response) {
      open.shift()!(response);
    },
  };
}

const rowCodes = (w: VueWrapper) =>
  w.findAll('.trow').map((row) => `${row.get('h3').text()}: ${row.findAll('.ptile .k').map((k) => k.text()).join(' ')}`.trim());
const row = (w: VueWrapper, key: string) => w.get(`[data-test="term-${key}"]`);
const tile = (w: VueWrapper, code: string) => w.get(`[data-test="tile-${code}"]`);

// The pointer drag (drag.ts): press, move over a target, release. jsdom lays nothing out, so `elementFromPoint`
// answers with the element the test points at.
let under: Element | null = null;
Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: () => under });
const pointer = (type: string, x: number) => new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 300, button: 0 });
async function press(from: { element: Element }): Promise<void> {
  under = null;
  from.element.dispatchEvent(pointer('pointerdown', 10));
  await flushPromises();
}
async function hover(target: { element: Element } | null): Promise<void> {
  under = target?.element ?? null;
  window.dispatchEvent(pointer('pointermove', 60));
  await flushPromises();
}
async function release(): Promise<void> {
  window.dispatchEvent(pointer('pointerup', 60));
  await flushPromises();
}

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
    expect(term.get('[data-test="load"]').text()).toBe('8 / 22 TC · 10–22 TC');
    expect(term.get('[data-test="when"]').text()).toBe('Tháng 9 – 12/2026');
    // The bar shows a load under the minimum: the chip is for screen readers only.
    expect(term.get('[data-test="row-issue-flag"]').classes()).toContain('sr-only');
    expect(term.get('[data-test="row-issue-flag"]').text()).toContain('8 TC, dưới mức tối thiểu 10 TC. Được phép nếu có đơn được duyệt. QĐ 1175/QĐ-KHTN Điều 7.2.a');

    const panel = w.get('.issues-panel');
    // The list holds the issues about a term or a course, each with a short title; the group still short is counted
    // under the coverage and shown in the status strip.
    expect(panel.get('[data-test="issue-counts"]').text()).toBe('1 vi phạm1 cần xem lại1 chưa ghi nhận');
    const card = panel.get('[data-test="issue-violation"]');
    expect(panel.findAll('[data-test="issue-violation"]')).toHaveLength(1);
    expect(card.get('b').text()).toBe('Vi phạm: Thiếu môn tiên quyết');
    expect(card.get('[data-test="issue-text"]').text()).toBe('ZZ102 cần học xong ZZ101 ở một học kỳ trước.');
    expect(card.get('.vfoot .chip').text()).toBe('HK1 2026–2027');
    // The source: a link to the regulation, labelled by its clause, the whole citation in its title and for readers.
    const source = card.get('[data-test="citation"]');
    expect(source.attributes('href')).toContain('Quy-che-dao-tao');
    expect(source.attributes('title')).toBe('Mở quy chế: QĐ 1175/QĐ-KHTN Điều 3.1.c');
    expect(source.text()).toBe('Nguồn: QĐ 1175/QĐ-KHTN Điều 3.1.cĐiều 3.1.c');
    expect(card.get('[data-test="go-to"]').text()).toBe('Đến môn');
    expect(panel.get('[data-test="groups-short"]').text()).toBe('1 nhóm còn thiếu');
    const strip = w.get('[data-test="status-strip"]');
    expect(strip.get('[data-test="estimate"]').text()).toBe('Chưa hợp lệ · 1 vi phạmChưa đủ để tốt nghiệp');
    expect(strip.findAll('[data-test="strip-group"]').map((g) => [g.attributes('title'), g.classes()])).toEqual([
      ['Tự chọn thử: 0/4 tín chỉ', ['g-elec', 'miss']],
    ]);
    expect(panel.get('[data-test="unknowns"] summary').text()).toBe('Chưa ghi nhận (1)');
    expect(panel.get('[data-test="unknowns"]').text()).toContain('không phải đạt, cũng không phải trượt');
    expect(panel.get('[data-test="coverage"] summary').text()).toBe('Khi hoàn thành kế hoạch · 8/20 TC1 nhóm còn thiếu');
    expect(panel.get('[data-test="coverage"]').text()).toContain('Chưa đủ để tốt nghiệp');
    expect(panel.get('[data-test="coverage"]').text()).toContain('Thiếu 4 TC');
  });

  it('shows a load with a course of unknown credits as a lower bound, and a course placed again while in progress as a flag', async () => {
    const t1 = { year: 2026, number: 1 } as const;
    const { w } = await render({
      reports: [
        report({
          terms: [{ term: t1, kind: 'main', credits: 4, caps: { min: 10, max: 22 } }],
          issues: [
            issue({ code: 'load_not_checked', kind: 'unknown', term: t1, credits: 4, citation: 'QĐ 1175/QĐ-KHTN Điều 7.2' }),
            issue({ code: 'already_in_progress', kind: 'flag', term: t1, position: 0, courseCode: 'ZZ101', citation: 'QĐ 1175/QĐ-KHTN Điều 14.2' }),
            issue({ code: 'credits_not_recorded', kind: 'unknown', term: t1, position: 1, courseCode: 'ZZ102' }),
          ],
        }),
      ],
    });
    const term = row(w, '2026-1');
    expect(term.get('[data-test="load"]').text()).toBe('Ít nhất 4 / 22 TC · 10–22 TC');
    expect(term.get('[data-test="row-issue-unknown"] .sr-only').text()).toBe(
      'Chưa ghi nhận: Có môn chưa rõ số tín chỉ, nên học kỳ này có ít nhất 4 TC; chưa kiểm tra giới hạn tín chỉ. QĐ 1175/QĐ-KHTN Điều 7.2',
    );
    expect(tile(w, 'ZZ101').get('[data-test="tile-issue-flag"]').text()).toContain(
      'ZZ101 đang học ở học kỳ trước và kế hoạch coi như sẽ đạt: học lại để cải thiện điểm, hoặc học lại nếu trượt.',
    );
  });

  it('shows no load, cap or issue the rule engine did not report', async () => {
    const { w } = await render({ reports: [report()] });
    expect(w.find('[data-test="load"]').exists()).toBe(false);
    expect(w.find('.tmeter').exists()).toBe(false);
    expect(w.findAll('.has-violation, .has-flag')).toHaveLength(0);
    expect(w.get('[data-test="no-issues"]').text()).toBe('Không có vi phạmRule engine không thấy vấn đề nào.');
  });

  it('never says "no problem" while a group is short or a rule could not be checked', async () => {
    const shortGroup = { id: 'g-elec', name: 'Tự chọn thử', kind: 'elective' as const, requiredCredits: 4, credits: 0, remainingCredits: 4, met: false };
    const { w } = await render({ reports: [report({ coverage: { ...REPORT.coverage, groups: [shortGroup] } })] });
    expect(w.get('[data-test="no-issues"]').text()).toBe('Không có vi phạm trong các học kỳNhưng còn 1 nhóm thiếu tín chỉ, xem bên dưới.');
    wrapper!.unmount();
    const unknown = issue({ code: 'offering_terms_not_recorded', kind: 'unknown', term: { year: 2026, number: 1 }, position: 0, courseCode: 'ZZ101' });
    const again = await render({ reports: [report({ issues: [unknown] })] });
    expect(again.w.get('[data-test="no-issues"]').text()).toBe('Không có vi phạmCòn 1 mục chưa kiểm tra được, xem bên dưới.');
  });

  it('adds a course found by search to the chosen term, saves the board and checks it again', async () => {
    const { w, sent, checks } = await render();
    expect(w.findAll('.pcourse:not(.slot) .k').map((k) => k.text())).toEqual(['ZZ201', 'ZZ414']);
    // A neutral mark for a course of the transcript; the planner never says it is passed.
    expect(w.get('[data-test="pool-ZZ414"] [data-test="in-transcript"]').text()).toBe('Trong bảng điểm');
    expect(w.findAll('[data-test="in-transcript"]')).toHaveLength(1);
    await w.get('#course-search').setValue('giai thuat');
    expect(w.findAll('.pcourse:not(.slot) .k').map((k) => k.text())).toEqual(['ZZ201']);
    await chooseOption(w.get('[data-test="add-to"]'), 'HK2 2026–2027');
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
    expect(w.findAll('.pcourse:not(.slot) .k').map((k) => k.text())).toContain('ZZ101');
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
    await press(w.get('[data-test="pool-ZZ414"]'));
    await hover(row(w, '2027-1'));
    // The course left behind fades; the row under the pointer shows where it would land.
    expect(w.get('[data-test="pool-ZZ414"]').classes()).toContain('dragging-src');
    expect(row(w, '2027-1').get('[data-test="placeholder"]').text()).toBe('ZZ414+4 TC');
    // A course from the list has nowhere to go back to: no bin.
    expect(w.find('[data-test="drop-bin"]').exists()).toBe(false);
    await release();
    expect(rowCodes(w)[3]).toBe('HK1 2027–2028: ZZ414');
    await press(tile(w, 'ZZ414'));
    await hover(null);
    await hover(w.get('[data-test="tray"]'));
    await release();
    expect(rowCodes(w)[3]).toBe('HK1 2027–2028:');
    expect(sent).toHaveLength(2);
    expect(document.querySelector('.ghost-tile')).toBeNull();
  });

  it('sends a placed course back to the list when it is dropped on the bin that shows while it is held', async () => {
    const { w, sent } = await render();
    await press(tile(w, 'ZZ102'));
    expect(w.find('[data-test="drop-bin"]').exists()).toBe(false);
    await hover(null);
    await hover(w.get('[data-test="drop-bin"]'));
    expect(w.get('[data-test="drop-bin"]').classes()).toContain('over');
    await release();
    expect(rowCodes(w)[0]).toBe('HK1 2026–2027: ZZ101');
    expect(w.findAll('.pcourse:not(.slot) .k').map((k) => k.text())).toContain('ZZ102');
    expect(w.find('[data-test="drop-bin"]').exists()).toBe(false);
    expect(sent).toHaveLength(1);
  });

  it('puts a course back where it was when it is released over nothing', async () => {
    const { w, sent } = await render();
    await press(tile(w, 'ZZ101'));
    await hover(null);
    await release();
    expect(rowCodes(w)[0]).toBe('HK1 2026–2027: ZZ101 ZZ102');
    expect(sent).toHaveLength(0);
    expect(document.body.classList.contains('dragging')).toBe(false);
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
    expect(w.get('[data-test="save-state"]').text()).toBe('Chưa lưu');
  });

  it('keeps the board and sends it again when a save is rate limited (429), never putting the change back', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });
    vi.setSystemTime(NOW);
    let puts = 0;
    const { w, sent } = await render({
      routes: {
        [`PUT /plans/${PLAN_ID}/placements`]: (init: RequestInit) => {
          const { terms } = sentBody(init) as { terms: PlanTerm[] };
          sent.push(terms);
          return ++puts <= 2 ? new Response(null, { status: 429 }) : Response.json(plan(terms));
        },
      },
    });
    await tile(w, 'ZZ101').get('[data-test="later"]').trigger('click');
    await flushPromises();
    expect(sent).toHaveLength(1);
    expect(rowCodes(w).slice(0, 2)).toEqual(['HK1 2026–2027: ZZ102', 'HK2 2026–2027: ZZ101']);
    expect(w.get('[data-test="save-state"]').text()).not.toBe('Chưa lưu');
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(5000);
    await flushPromises();
    expect(sent).toHaveLength(3);
    expect(sent[2]).toEqual(sent[0]);
    expect(rowCodes(w).slice(0, 2)).toEqual(['HK1 2026–2027: ZZ102', 'HK2 2026–2027: ZZ101']);
    expect(w.find('[data-test="save-error"]').exists()).toBe(false);
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

  it('scrolls the page by the height of a term it adds, so the button stays under the pointer', async () => {
    const { w } = await render();
    const button = w.get('[data-test="add-row"]');
    const tops = [500, 620];
    button.element.getBoundingClientRect = () => ({ top: tops.shift() ?? 620 }) as DOMRect;
    const scroll = vi.spyOn(window, 'scrollBy').mockImplementation(() => {});
    await button.trigger('click');
    await flushPromises();
    expect(scroll).toHaveBeenCalledWith(expect.objectContaining({ top: 120 }));
  });

  it('takes the student from an issue to its course, which glows and takes the focus', async () => {
    const { w } = await render();
    await w.get('[data-test="issue-violation"] [data-test="go-to"]').trigger('click');
    await flushPromises();
    const zz102 = tile(w, 'ZZ102');
    expect(document.activeElement).toBe(zz102.element);
    expect(zz102.classes()).toContain('flash');
  });

  it('never writes this plan’s board into another plan opened in the same editor', async () => {
    const puts = held();
    const other: PlanTerm[][] = [];
    const otherLoad = held();
    const { w, router, sent } = await render({
      routes: {
        [`PUT /plans/${PLAN_ID}/placements`]: (init: RequestInit) => {
          sent.push((sentBody(init) as { terms: PlanTerm[] }).terms);
          return puts.respond();
        },
        [`GET /plans/${OTHER_ID}`]: otherLoad.respond,
        [`GET /plans/${OTHER_ID}/issues`]: () => Response.json(report()),
        [`PUT /plans/${OTHER_ID}/placements`]: (init: RequestInit) => {
          const { terms } = sentBody(init) as { terms: PlanTerm[] };
          other.push(terms);
          return Response.json(plan(terms, { id: OTHER_ID, name: 'Nhẹ tải thử' }));
        },
      },
    });
    await tile(w, 'ZZ101').get('[data-test="later"]').trigger('click');
    await flushPromises();
    await tile(w, 'ZZ102').get('[data-test="later"]').trigger('click');
    await flushPromises();
    // The student opens another plan while the first change is still being saved.
    await router.push(`/plans/${OTHER_ID}`);
    await flushPromises();
    puts.answer(Response.json(plan(sent[0]!)));
    await flushPromises();
    otherLoad.answer(Response.json(plan([{ term: { year: 2026, number: 1 }, placements: [course('ZZ201')] }], { id: OTHER_ID, name: 'Nhẹ tải thử' })));
    await flushPromises();
    expect(other).toEqual([]);
    expect(w.get('h1').text()).toBe('Nhẹ tải thử');
    expect(rowCodes(w)[0]).toBe('HK1 2026–2027: ZZ201');
    // An edit of the plan now open is saved to it.
    await tile(w, 'ZZ201').get('[data-test="later"]').trigger('click');
    await flushPromises();
    expect(other).toEqual([[{ term: { year: 2026, number: 2 }, placements: [course('ZZ201')] }]]);
    expect(sent).toHaveLength(1);
  });

  it('shows the plan opened last when the load of an earlier one answers late', async () => {
    const first = held();
    const other: PlanTerm[][] = [];
    const { w, router } = await render({
      routes: {
        [`GET /plans/${PLAN_ID}`]: first.respond,
        [`GET /plans/${OTHER_ID}`]: plan([{ term: { year: 2026, number: 1 }, placements: [course('ZZ201')] }], { id: OTHER_ID, name: 'Nhẹ tải thử' }),
        [`GET /plans/${OTHER_ID}/issues`]: () => Response.json(report()),
        [`PUT /plans/${OTHER_ID}/placements`]: (init: RequestInit) => {
          const { terms } = sentBody(init) as { terms: PlanTerm[] };
          other.push(terms);
          return Response.json(plan(terms, { id: OTHER_ID, name: 'Nhẹ tải thử' }));
        },
      },
    });
    await router.push(`/plans/${OTHER_ID}`);
    await flushPromises();
    first.answer(Response.json(plan(SAVED)));
    await flushPromises();
    expect(w.get('h1').text()).toBe('Nhẹ tải thử');
    expect(rowCodes(w)[0]).toBe('HK1 2026–2027: ZZ201');
    await tile(w, 'ZZ201').get('[data-test="later"]').trigger('click');
    await flushPromises();
    expect(other).toEqual([[{ term: { year: 2026, number: 2 }, placements: [course('ZZ201')] }]]);
  });

  it('checks the saved board again when a save fails after an earlier one went through', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const puts = held();
    const { w, sent, checks } = await render({
      routes: {
        [`PUT /plans/${PLAN_ID}/placements`]: (init: RequestInit) => {
          sent.push((sentBody(init) as { terms: PlanTerm[] }).terms);
          return puts.respond();
        },
      },
    });
    await tile(w, 'ZZ101').get('[data-test="later"]').trigger('click');
    await flushPromises();
    await tile(w, 'ZZ102').get('[data-test="later"]').trigger('click');
    await flushPromises();
    puts.answer(Response.json(plan(sent[0]!)));
    await flushPromises();
    puts.answer(new Response(null, { status: 503 }));
    await flushPromises();
    // Back to the first change, which the API holds, and checked again.
    expect(rowCodes(w).slice(0, 2)).toEqual(['HK1 2026–2027: ZZ102', 'HK2 2026–2027: ZZ101']);
    expect(checks()).toBe(2);
    expect(w.find('[data-test="checking"]').exists()).toBe(false);
    expect(w.findAll('.trow.stale')).toHaveLength(0);
  });

  it('settles the issues when a term is added while a check is in flight', async () => {
    const issues = held();
    const { w } = await render({ routes: { [`GET /plans/${PLAN_ID}/issues`]: issues.respond } });
    await w.get('[data-test="add-row"]').trigger('click');
    issues.answer(Response.json(REPORT));
    await flushPromises();
    expect(tile(w, 'ZZ102').classes()).toContain('has-violation');
    expect(w.find('[data-test="checking"]').exists()).toBe(false);
    expect(w.findAll('.trow.stale')).toHaveLength(0);
    expect(w.get('.issues-panel').attributes('aria-busy')).toBe('false');
  });

  it('does not say it is checking once a re-check has failed', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ reports: [REPORT, 503] });
    await tile(w, 'ZZ101').get('[data-test="later"]').trigger('click');
    await flushPromises();
    expect(w.get('[data-test="issues-failed"]').text()).toContain('Chưa kiểm tra được kế hoạch.');
    expect(w.find('[data-test="checking"]').exists()).toBe(false);
    expect(w.get('.issues-panel').attributes('aria-busy')).toBe('false');
  });

  it('drops a report asked for before a save went out', async () => {
    const issues = held();
    const puts = held();
    const { w, sent } = await render({
      routes: {
        [`GET /plans/${PLAN_ID}/issues`]: issues.respond,
        [`PUT /plans/${PLAN_ID}/placements`]: (init: RequestInit) => {
          sent.push((sentBody(init) as { terms: PlanTerm[] }).terms);
          return puts.respond();
        },
      },
    });
    await tile(w, 'ZZ101').get('[data-test="remove"]').trigger('click');
    await flushPromises();
    // The server may read the placements after the PUT commits: this report is about ZZ102 alone, at position 0.
    const afterRemoval = report({
      issues: [issue({ code: 'prerequisite_not_met', kind: 'violation', term: { year: 2026, number: 1 }, position: 0, courseCode: 'ZZ102', missingCourseCodes: ['ZZ101'] })],
    });
    issues.answer(Response.json(afterRemoval));
    await flushPromises();
    expect(w.find('[data-test="issue-violation"]').exists()).toBe(false);
    puts.answer(Response.json(plan(sent[0]!)));
    await flushPromises();
    issues.answer(Response.json(afterRemoval));
    await flushPromises();
    expect(tile(w, 'ZZ102').classes()).toContain('has-violation');
    expect(w.findAll('[data-test="issue-violation"]')).toHaveLength(1);
  });

  it('leaves a retried check to the save in flight, which checks when it ends', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const puts = held();
    const { w, sent, checks } = await render({
      reports: [503, REPORT],
      routes: {
        [`PUT /plans/${PLAN_ID}/placements`]: (init: RequestInit) => {
          sent.push((sentBody(init) as { terms: PlanTerm[] }).terms);
          return puts.respond();
        },
      },
    });
    await tile(w, 'ZZ101').get('[data-test="later"]').trigger('click');
    await flushPromises();
    // A GET sent now could be answered about the board being saved and pinned to the one before it.
    await w.get('[data-test="issues-failed"] button').trigger('click');
    await flushPromises();
    expect(checks()).toBe(1);
    puts.answer(Response.json(plan(sent[0]!)));
    await flushPromises();
    expect(checks()).toBe(2);
    expect(w.find('[data-test="issues-failed"]').exists()).toBe(false);
  });

  it('drops a keyboard lift when a failed save puts the board back', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const puts = held();
    const { w, sent } = await render({
      routes: {
        [`PUT /plans/${PLAN_ID}/placements`]: (init: RequestInit) => {
          sent.push((sentBody(init) as { terms: PlanTerm[] }).terms);
          return puts.respond();
        },
      },
    });
    await tile(w, 'ZZ102').get('[data-test="later"]').trigger('click');
    await flushPromises();
    await w.get('[data-test="add-row"]').trigger('click');
    const zz101 = tile(w, 'ZZ101');
    await zz101.trigger('keydown', { key: ' ' });
    for (let i = 0; i < 5; i++) await zz101.trigger('keydown', { key: 'ArrowDown' });
    expect(row(w, '2027-3').classes()).toContain('drop-target');
    puts.answer(new Response(null, { status: 503 }));
    await flushPromises();
    expect(tile(w, 'ZZ101').classes()).not.toContain('lifted');
    expect(w.findAll('.trow.drop-target')).toHaveLength(0);
    await tile(w, 'ZZ101').trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(sent).toHaveLength(1);
  });

  it('keeps the add-term button out of the list of terms', async () => {
    const { w } = await render();
    const list = w.get('[role="list"]');
    expect([...list.element.children].every((child) => child.getAttribute('role') === 'listitem')).toBe(true);
    expect(w.find('[data-test="add-row"]').exists()).toBe(true);
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
  describe('the prototype gaps (#89)', () => {
    it('counts only the groups still short, not a cohort total still short', async () => {
      // Every group met, the cohort total 12 credits short: the total shows beside the coverage, and no group is short.
      const totalShort = report({
        issues: [issue({ code: 'requirement_not_covered', kind: 'violation', credits: 8, limit: 20, citation: 'QĐ 1175/QĐ-KHTN Điều 17.3.b' })],
        coverage: { ...REPORT.coverage, groups: [{ ...REPORT.coverage.groups[0]!, credits: 4, remainingCredits: 0, met: true }] },
      });
      const { w } = await render({ reports: [totalShort] });
      expect(w.find('[data-test="groups-short"]').exists()).toBe(false);
    });

    const t1 = { year: 2026, number: 1 } as const;
    const t2 = { year: 2026, number: 2 } as const;
    const termOf = (terms: PlanTerm[], code: string) => terms.find((t) => t.placements.some((p) => p.courseCode === code))?.term;

    it('shows the plans as tabs, and copies the plan open into a new one, opened at once', async () => {
      const copy = plan(SAVED, { id: OTHER_ID, name: 'What-if: Kế hoạch thử' });
      let body: unknown;
      const { w, router } = await render({
        routes: {
          [`POST /plans/${PLAN_ID}/duplicate`]: (init: RequestInit) => ((body = sentBody(init)), Response.json(copy)),
          [`GET /plans/${OTHER_ID}`]: copy,
          [`GET /plans/${OTHER_ID}/issues`]: report(),
        },
      });
      const tabs = w.findAll('[data-test="plan-tab"]');
      expect(tabs.map((t) => [t.text(), t.attributes('aria-current') ?? null])).toEqual([
        ['Kế hoạch thử', 'page'],
        ['Kế hoạch khác', null],
      ]);
      await w.get('[data-test="what-if"]').trigger('click');
      await flushPromises();
      expect(body).toEqual({ name: 'What-if: Kế hoạch thử' });
      expect(router.currentRoute.value.params.id).toBe(OTHER_ID);
    });

    it('undoes the last change with the button or Ctrl+Z, and saves the board it puts back', async () => {
      const { w, sent } = await render();
      const undo = w.get('[data-test="undo"]');
      expect(undo.attributes('disabled')).toBeDefined();
      await tile(w, 'ZZ101').get('[data-test="later"]').trigger('click');
      await flushPromises();
      expect(rowCodes(w).slice(0, 2)).toEqual(['HK1 2026–2027: ZZ102', 'HK2 2026–2027: ZZ101']);

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
      await flushPromises();
      expect(rowCodes(w).slice(0, 2)).toEqual(['HK1 2026–2027: ZZ101 ZZ102', 'HK2 2026–2027:']);
      expect(sent.at(-1)).toEqual(SAVED);
      expect(w.get('[data-test="announcer"]').text()).toBe('Đã hoàn tác: Đã chuyển ZZ101 tới HK2 2026–2027.');
      expect(w.get('[data-test="undo"]').attributes('disabled')).toBeDefined();

      // Ctrl+Z in a text box is the box's own undo.
      await tile(w, 'ZZ101').get('[data-test="later"]').trigger('click');
      await flushPromises();
      const search = w.get('#course-search');
      search.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
      await flushPromises();
      expect(rowCodes(w)[1]).toBe('HK2 2026–2027: ZZ101');
      await w.get('[data-test="undo"]').trigger('click');
      await flushPromises();
      expect(rowCodes(w)[1]).toBe('HK2 2026–2027:');
    });

    it('shows the engine’s graduation status as it reports it, guesses no graduation term, and never calls an unknown a pass', async () => {
      const { w } = await render({
        reports: [
          report({
            terms: [{ term: t1, kind: 'main', credits: 8, caps: { min: 10, max: 22 } }],
            issues: [issue({ code: 'offering_terms_not_recorded', kind: 'unknown', term: t1, position: 0, courseCode: 'ZZ101' })],
            coverage: { groups: [{ id: 'g-core', name: 'Kiến thức Computer Science (A): bắt buộc', kind: 'compulsory', requiredCredits: 8, credits: 8, remainingCredits: 0, met: true }], combinedMinimums: [], totalRequired: 8, totalCredits: 8, totalRemaining: 0, graduation: 'done' },
          }),
        ],
      });
      const strip = w.get('[data-test="status-strip"]');
      expect(strip.get('[data-test="estimate"]').text()).toBe('Không thấy vi phạm · 1 mục chưa kiểm tra đượcĐủ các yêu cầu kiểm tra được');
      expect(strip.get('[data-test="strip-group"]').text()).toBe('</>Kiến thức Computer Science (A): bắt buộc: 8/8 tín chỉ8/8');
      expect(strip.get('[data-test="strip-group"]').classes()).toEqual(['g-core']);
      expect(strip.get('[data-test="save-state"]').text()).toBe('Đã lưu');
      // Its colour follows the engine's status alone.
      expect(strip.get('[data-test="estimate"]').classes()).not.toContain('bad');
    });

    it('copies the plan for a what-if even when the list of plans could not be loaded', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      const copy = plan(SAVED, { id: OTHER_ID, name: 'What-if: Kế hoạch thử' });
      let body: unknown;
      const { w, router } = await render({
        routes: {
          'GET /plans': status(500),
          [`POST /plans/${PLAN_ID}/duplicate`]: (init: RequestInit) => ((body = sentBody(init)), Response.json(copy)),
          [`GET /plans/${OTHER_ID}`]: copy,
          [`GET /plans/${OTHER_ID}/issues`]: report(),
        },
      });
      expect(w.findAll('[data-test="plan-tab"]')).toHaveLength(0);
      await w.get('[data-test="what-if"]').trigger('click');
      await flushPromises();
      expect(body).toEqual({ name: 'What-if: Kế hoạch thử' });
      expect(router.currentRoute.value.params.id).toBe(OTHER_ID);
    });

    it('says every checkable requirement is met when the engine says so and nothing is placed', async () => {
      const { w } = await render({
        routes: { [`GET /plans/${PLAN_ID}`]: plan([]) },
        reports: [report({ coverage: { groups: [], combinedMinimums: [], totalRequired: 20, totalCredits: 20, totalRemaining: 0, graduation: 'done' } })],
      });
      expect(w.get('[data-test="estimate"]').text()).toBe('Không thấy vi phạmĐủ các yêu cầu kiểm tra được');
      expect(w.get('[data-test="estimate"]').classes()).not.toContain('bad');
    });

    it('leaves Ctrl+Z to an editable element that has the focus', async () => {
      const { w } = await render();
      await tile(w, 'ZZ101').get('[data-test="later"]').trigger('click');
      await flushPromises();
      const editable = document.createElement('div');
      editable.setAttribute('contenteditable', 'true');
      document.body.append(editable);
      const event = new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true });
      editable.dispatchEvent(event);
      await flushPromises();
      expect(event.defaultPrevented).toBe(false);
      expect(rowCodes(w)[1]).toBe('HK2 2026–2027: ZZ101');
      editable.remove();
    });

    it('forgets a change that could not be saved, so Undo goes back to a change that was kept', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      let fail = false;
      const { w, sent } = await render({
        routes: {
          [`PUT /plans/${PLAN_ID}/placements`]: (init: RequestInit) => {
            const { terms } = sentBody(init) as { terms: PlanTerm[] };
            if (fail) return new Response(null, { status: 503 });
            sent.push(terms);
            return Response.json(plan(terms));
          },
        },
      });
      await tile(w, 'ZZ101').get('[data-test="later"]').trigger('click');
      await flushPromises();
      fail = true;
      await tile(w, 'ZZ102').get('[data-test="later"]').trigger('click');
      await flushPromises();
      expect(rowCodes(w).slice(0, 2)).toEqual(['HK1 2026–2027: ZZ102', 'HK2 2026–2027: ZZ101']);

      fail = false;
      await w.get('[data-test="undo"]').trigger('click');
      await flushPromises();
      expect(w.get('[data-test="announcer"]').text()).toBe('Đã hoàn tác: Đã chuyển ZZ101 tới HK2 2026–2027.');
      expect(sent.at(-1)).toEqual(SAVED);
      expect(w.get('[data-test="undo"]').attributes('disabled')).toBeDefined();
    });

    it('collapses the issues panel, and keeps it collapsed on the next visit', async () => {
      const first = await render();
      const toggle = first.w.get('[data-test="issues-toggle"]');
      expect(toggle.attributes('aria-expanded')).toBe('true');
      await toggle.trigger('click');
      expect(toggle.attributes('aria-expanded')).toBe('false');
      expect(toggle.attributes('aria-label')).toBe('Mở bảng kiểm tra');
      expect((first.w.get('#issues-body').element as HTMLElement).style.display).toBe('none');
      expect(first.w.get('[data-test="issues-mini-count"]').text()).toBe('1');
      expect(localStorage.getItem('oc-planner-rail')).toBe('mini');
      first.w.unmount();

      const again = await render();
      expect(again.w.get('[data-test="issues-toggle"]').attributes('aria-expanded')).toBe('false');
      await again.w.get('[data-test="issues-toggle"]').trigger('click');
      expect(localStorage.getItem('oc-planner-rail')).toBe('open');
    });

    it('asks the engine about each row when a course is dragged, and colours each row by its answer before the drop', async () => {
      const { w, previewed, previewRequests, sent } = await render({
        // The engine says ZZ201 is not taught in term 2, and ZZ102 still misses its prerequisite.
        previews: (terms) => {
          const at = termOf(terms, 'ZZ201')!;
          const placed = terms.find((t) => t.term.year === at.year && t.term.number === at.number)!;
          const credits = placed.placements.length === 1 ? 3 : 11;
          return report({
            terms: terms.map((t) => ({ term: t.term, kind: 'main', credits: t === placed ? credits : 8, caps: { min: 10, max: 22 } })),
            issues: [
              issue({ code: 'prerequisite_not_met', kind: 'violation', term: t1, position: 1, courseCode: 'ZZ102', missingCourseCodes: ['ZZ101'] }),
              ...(at.number === 2
                ? [issue({ code: 'not_offered', kind: 'violation', term: at, position: placed.placements.length - 1, courseCode: 'ZZ201', offeredTermNumbers: [1, 3], citation: 'QĐ 1175/QĐ-KHTN Điều 6.5' })]
                : []),
            ],
          });
        },
      });
      await press(w.get('[data-test="pool-ZZ201"]'));
      await hover(null);
      // One request for the whole drag (the rate limit counts requests), a check per row in it, none saved.
      expect(previewRequests()).toBe(1);
      expect(previewed.map((terms) => `${termOf(terms, 'ZZ201')!.year}-${termOf(terms, 'ZZ201')!.number}`)).toEqual(['2026-1', '2026-2', '2026-3', '2027-1', '2027-2']);
      expect(sent).toHaveLength(0);

      expect(row(w, '2026-2').classes()).toContain('bad-drop');
      expect(row(w, '2026-2').get('[data-test="drop-reason"]').text()).toBe('ZZ201 không mở ở HK2; chỉ mở HK1, 3.');
      expect(row(w, '2027-2').classes()).toContain('bad-drop');
      expect(row(w, '2026-1').classes()).toContain('ok-drop');
      // A drop that breaks no rule needs no words: the bar shows the new load.
      expect(row(w, '2026-1').classes()).toContain('ok-drop');
      expect(row(w, '2026-1').find('[data-test="drop-reason"]').exists()).toBe(false);

      // Over a row: every row shows the load of the board with the drop made, and the panel previews the change.
      await hover(row(w, '2026-2'));
      expect(row(w, '2026-2').get('[data-test="load-delta"]').text()).toBe('+3');
      expect(w.get('[data-test="issues-preview"]').text()).toBe('Xem trước: ZZ201 → HK2 2026–2027 · thêm 1 vi phạm' + 'Không mở ở học kỳ nàyZZ201 không mở ở HK2; chỉ mở HK1, 3.');

      // The drop is still the student's choice: a rule broken is reported, never refused (ADR 0012).
      await release();
      expect(rowCodes(w)[1]).toBe('HK2 2026–2027: ZZ201');
      // It lands, then shakes once: the rule it breaks is in the panel.
      await new Promise((resolve) => setTimeout(resolve, 450));
      expect(tile(w, 'ZZ201').classes()).toContain('shake');
      expect(w.find('.bad-drop').exists()).toBe(false);
      expect(w.find('[data-test="issues-preview"]').exists()).toBe(false);
    });

    it('previews the row a lifted tile would drop on, and says nothing about its own row', async () => {
      const { w, previewed } = await render({ previews: () => report({ issues: [issue({ code: 'prerequisite_not_met', kind: 'violation', term: t2, position: 0, courseCode: 'ZZ102', missingCourseCodes: ['ZZ101'] })] }) });
      const zz102 = tile(w, 'ZZ102');
      await zz102.trigger('keydown', { key: ' ' });
      await flushPromises();
      // Lifting asks about every other row at once; its own row is not asked about.
      expect(previewed).toHaveLength(4);
      expect(previewed[0]).toEqual([{ term: t1, placements: [course('ZZ101')] }, { term: t2, placements: [course('ZZ102')] }]);
      expect(row(w, '2026-1').find('[data-test="drop-reason"]').exists()).toBe(false);
      await zz102.trigger('keydown', { key: 'ArrowDown' });
      await flushPromises();
      expect(previewed).toHaveLength(4);
      expect(row(w, '2026-2').get('[data-test="drop-reason"]').text()).toBe('ZZ102 cần học xong ZZ101 ở một học kỳ trước.');
      await zz102.trigger('keydown', { key: 'Escape' });
      expect(w.find('[data-test="drop-reason"]').exists()).toBe(false);
    });

    it('calls an unknown "not checked", names a new violation in another term, and draws the load the drop would make', async () => {
      const t3 = { year: 2026, number: 3 };
      const { w } = await render({
        previews: (terms) => {
          const at = termOf(terms, 'ZZ201')!;
          const loads = terms.map((t) => ({ term: t.term, kind: 'main' as const, credits: t.term.number === at.number && t.term.year === at.year ? (at.number === 1 ? 11 : 3) : 8, caps: { min: 10, max: 22 } }));
          // Term 2: the engine cannot tell whether ZZ201 is taught then. Term 3: ZZ201 there breaks a rule on ZZ101 in term 1.
          if (at.number === 2) return report({ terms: loads, issues: [issue({ code: 'offering_terms_not_recorded', kind: 'unknown', term: at, position: 0, courseCode: 'ZZ201' })] });
          if (at.number === 3) return report({ terms: loads, issues: [issue({ code: 'prerequisite_not_met', kind: 'violation', term: t1, position: 0, courseCode: 'ZZ101', missingCourseCodes: ['ZZ100'] })] });
          return report({ terms: loads });
        },
      });
      await press(w.get('[data-test="pool-ZZ201"]'));
      await hover(null);
      // Unknown is neither a pass nor a fail: its own tone and words.
      expect(row(w, '2026-2').classes()).toContain('unknown-drop');
      expect(row(w, '2026-2').classes()).not.toContain('ok-drop');
      expect(row(w, '2026-2').get('[data-test="drop-reason"]').text()).toBe('Chưa kiểm tra được: ZZ201: chưa ghi nhận học kỳ mở môn.');
      // A drop that breaks a rule elsewhere on the board is a bad drop, and says which.
      expect(row(w, `${t3.year}-${t3.number}`).classes()).toContain('bad-drop');
      expect(row(w, '2026-3').get('[data-test="drop-reason"]').text()).toBe('ZZ101 cần học xong ZZ100 ở một học kỳ trước.');

      // Over term 1: the load goes 8 → 11 of a 22 cap; the meter (28 wide: the cap plus 6) fills to 8 and pulses to 11.
      await hover(row(w, '2026-1'));
      expect(row(w, '2026-1').get('[data-test="load-delta"]').text()).toBe('+3');
      const cap = row(w, '2026-1').get('.cap');
      expect(cap.classes()).toContain('preview');
      expect(parseFloat(cap.get('.fill').attributes('style')!.match(/width: ([\d.]+)%/)![1]!)).toBeCloseTo((8 / 28) * 100, 3);
      const pre = cap.get('.pre').attributes('style')!;
      expect(parseFloat(pre.match(/left: ([\d.]+)%/)![1]!)).toBeCloseTo((8 / 28) * 100, 3);
      expect(parseFloat(pre.match(/width: ([\d.]+)%/)![1]!)).toBeCloseTo((3 / 28) * 100, 3);

      // Over term 3: the panel counts the change and lists the new violation for a screen reader.
      await hover(row(w, '2026-3'));
      expect(w.findAll('[data-test="preview-new"]').map((n) => n.text())).toEqual(['Thiếu môn tiên quyếtZZ101 cần học xong ZZ100 ở một học kỳ trước.']);
      await release();
    });

    it('ignores a drag preview that answers after the drag it was for has ended', async () => {
      const answers = held();
      const { w } = await render({ routes: { [`POST /plans/${PLAN_ID}/issues/drops`]: () => answers.respond() } });
      await press(w.get('[data-test="pool-ZZ201"]'));
      await hover(null);
      expect(row(w, '2026-2').classes()).toContain('checking');
      await release();
      // A new drag of another course starts before the first answer arrives.
      await press(w.get('[data-test="pool-ZZ414"]'));
      await hover(null);
      answers.answer(Response.json({ reports: [{ term: t2, issues: report({ issues: [issue({ code: 'not_offered', kind: 'violation', term: t2, position: 0, courseCode: 'ZZ201', offeredTermNumbers: [1] })] }) }] }));
      await flushPromises();
      // The rows still wait for the answer about ZZ414; nothing about ZZ201 is painted on them.
      expect(w.find('.bad-drop').exists()).toBe(false);
      expect(row(w, '2026-2').classes()).toContain('checking');
      expect(w.findAll('[data-test="drop-reason"]').some((r) => r.text().includes('ZZ201'))).toBe(false);
      await release();
    });

    it('shows the terms taken, the courses in progress now (locked), and keeps passed courses in the tray, marked', async () => {
      const audit = {
        credits: { accumulated: 9, towardTotal: 8, inProgressTowardTotal: 4, totalRequired: 20, remaining: 12, yearLevel: 1 },
        terms: [
          { term: { year: 2025, number: 1 }, inProgressCourseCodes: [] },
          { term: { year: 2025, number: 2 }, inProgressCourseCodes: [] },
          { term: t1, inProgressCourseCodes: ['ZZ201'] },
        ],
        groups: [
          {
            courses: [
              { code: 'ZZ414', nameVi: 'Học máy thử', nameEn: null, credits: 4, status: 'passed', grade: 4.6 },
              { code: 'ZZ201', nameVi: 'Giải thuật thử', nameEn: null, credits: 3, status: 'in_progress', grade: null },
              { code: 'ZZ102', nameVi: 'Cấu trúc thử', nameEn: null, credits: 4, status: 'failed', grade: 3.5 },
            ],
          },
        ],
      };
      const { w } = await render({ routes: { 'GET /users/me/audit': audit } });
      const past = w.get('[data-test="past"]');
      expect(past.text()).toBe('Đã học2 học kỳ · HK1 2025–2026 → HK2 2025–20269 tín chỉ tích lũyZZ414');
      expect(row(w, '2026-1').get('[data-test="now"]').text()).toBe('Đang học');
      expect(row(w, '2026-1').get('[data-test="now-ZZ201"]').text()).toBe('ZZ2013 TCGiải thuật thửĐang học, không đổi được');
      expect(row(w, '2026-1').find('[data-test="now-ZZ201"]').attributes('draggable')).toBeUndefined();
      expect(row(w, '2026-2').find('[data-test="now"]').exists()).toBe(false);
      // A passed course (ZZ414) stays in the tray, marked: the engine allows a retake (already_passed is a flag).
      // The course in progress (ZZ201) is not offered; the course failed before shows its grade.
      expect(w.findAll('.pcourse:not(.slot) .k').map((k) => k.text())).toEqual(['ZZ414']);
      expect(w.get('[data-test="pool-ZZ414"] [data-test="passed"]').text()).toBe('Đã đạt');
      expect(tile(w, 'ZZ102').get('[data-test="tile-taken"]').text()).toBe('Đã học trước · điểm 3,5');
      // Each course taken is a tag that opens it in the curriculum explorer.
      await past.get('[data-test="past-ZZ414"]').trigger('click');
      await flushPromises();
      expect(w.vm.$router.currentRoute.value).toMatchObject({ name: 'explorer', query: { course: 'ZZ414' } });
    });

    it('labels each tile with its group, badges one with a violation, and filters the tray by group', async () => {
      const { w } = await render();
      expect(tile(w, 'ZZ102').get('[data-test="tile-group"]').text()).toBe('Cốt lõi');
      expect(tile(w, 'ZZ102').find('.flag-badge').exists()).toBe(true);
      expect(tile(w, 'ZZ101').find('.flag-badge').exists()).toBe(false);
      expect(w.findAll('.pcourse:not(.slot) .k').map((k) => k.text())).toEqual(['ZZ201', 'ZZ414']);
      await w.get('[data-test="pool-group-elec"]').trigger('click');
      expect(w.findAll('.pcourse:not(.slot) .k').map((k) => k.text())).toEqual(['ZZ414']);
      await w.get('[data-test="pool-group-all"]').trigger('click');
      expect(w.findAll('.pcourse:not(.slot) .k').map((k) => k.text())).toEqual(['ZZ201', 'ZZ414']);
    });

    it('holds a slot for an elective group at the credits most of its courses carry', async () => {
      const { w, sent } = await render();
      expect(w.findAll('[data-test="slot-offer"]').map((s) => s.text())).toEqual(['Tự chọn4 TCTự chọn Computer Science (C)Chưa chọn môn']);
      await w.get('[data-test="add-slot"]').trigger('click');
      await flushPromises();
      expect(sent[0]![0]).toEqual({ term: t1, placements: [course('ZZ101'), course('ZZ102'), { kind: 'slot', courseCode: null, requirementGroupId: ELECTIVE_GROUP, credits: 4 }] });
      expect(tile(w, 'slot').text()).toContain('Chưa chọn môn');
    });
  });

  describe('lock, plans tabs and the page staying put (UC-05 A6)', () => {
    beforeEach(() => localStorage.clear());

    it('locks the plan against changes, for this plan, until it is unlocked', async () => {
      const { w, sent } = await render();
      const lock = w.get('[data-test="lock"]');
      await lock.trigger('click');
      expect(lock.attributes('aria-pressed')).toBe('true');
      expect(w.get('[data-test="locked-note"]').text()).toContain('Kế hoạch đang khóa');
      // No drag, no Delete key, no undo, no new term.
      await press(tile(w, 'ZZ101'));
      await hover(row(w, '2026-2'));
      await release();
      await tile(w, 'ZZ101').trigger('keydown', { key: 'Delete' });
      await w.get('[data-test="add-row"]').trigger('click');
      await flushPromises();
      expect(rowCodes(w)[0]).toBe('HK1 2026–2027: ZZ101 ZZ102');
      expect(rowCodes(w)).toHaveLength(5);
      expect(sent).toHaveLength(0);
      expect(w.get('[data-test="undo"]').attributes('disabled')).toBeDefined();
      // Kept for this plan: a reload opens it locked.
      wrapper!.unmount();
      const again = await render();
      expect(again.w.get('[data-test="lock"]').attributes('aria-pressed')).toBe('true');
      await again.w.get('[data-test="lock"]').trigger('click');
      await tile(again.w, 'ZZ101').trigger('keydown', { key: 'Delete' });
      await flushPromises();
      expect(rowCodes(again.w)[0]).toBe('HK1 2026–2027: ZZ102');
    });

    it('keeps the page where it is when a course is removed: focus goes to the course beside it, without scrolling', async () => {
      const { w } = await render();
      const focus = vi.spyOn(HTMLElement.prototype, 'focus');
      await tile(w, 'ZZ101').get('[data-test="remove"]').trigger('click');
      await flushPromises();
      expect(document.activeElement).toBe(tile(w, 'ZZ102').element);
      expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    });

    it('asks again for a row whose preview failed when the pointer comes over it', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      let busy = true;
      const { w, previewed } = await render({ previews: () => (busy ? 429 : report()) });
      await press(w.get('[data-test="pool-ZZ201"]'));
      await hover(null);
      // No colour would read as "no problem": the row says its preview is missing.
      expect(row(w, '2026-2').classes()).toContain('failed-drop');
      expect(row(w, '2026-2').get('[data-test="drop-reason"]').text()).toBe('Không xem trước được. Trỏ vào hàng này để thử lại.');
      const first = previewed.length;
      busy = false;
      await hover(row(w, '2026-2'));
      await flushPromises();
      expect(previewed.length).toBe(first + 1);
      expect(row(w, '2026-2').classes()).toContain('ok-drop');
      await release();
    });

    it('makes a new plan from the tabs, named in a dialog, on the curriculum of the plan open', async () => {
      const made = plan([], { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'Thử nhẹ' });
      let body: unknown;
      const { w, router } = await render({
        routes: {
          'POST /plans': (init: RequestInit) => ((body = sentBody(init)), Response.json(made, { status: 201 })),
          [`GET /plans/${made.id}`]: made,
          [`GET /plans/${made.id}/issues`]: report(),
        },
      });
      await w.get('[data-test="new-plan"]').trigger('click');
      await flushPromises();
      const dialog = w.get('dialog[open]');
      await dialog.get('input').setValue('Thử nhẹ');
      await dialog.get('form').trigger('submit');
      await flushPromises();
      expect(body).toEqual({ name: 'Thử nhẹ', programCode: 'APCS', cohortYear: 2024 });
      expect(router.currentRoute.value.params.id).toBe(made.id);
    });

    it('deletes the plan open from the trash button beside its tab, after asking, then opens another', async () => {
      let deleted = false;
      const other = plan([], { id: OTHER_ID, name: 'Kế hoạch khác' });
      const { w, router } = await render({
        routes: {
          [`DELETE /plans/${PLAN_ID}`]: () => ((deleted = true), new Response(null, { status: 204 })),
          [`GET /plans/${OTHER_ID}`]: other,
          [`GET /plans/${OTHER_ID}/issues`]: report(),
        },
      });
      expect(w.findAll('[data-test="delete-plan"]')).toHaveLength(1);
      await w.get('[data-test="delete-plan"]').trigger('click');
      await flushPromises();
      expect(w.get('dialog[open] [data-test="delete-name"]').text()).toBe('Kế hoạch thử');
      expect(deleted).toBe(false);
      await w.get('[data-test="confirm-delete"]').trigger('click');
      await flushPromises();
      expect(deleted).toBe(true);
      expect(router.currentRoute.value.params.id).toBe(OTHER_ID);
      expect(w.get('[data-test="back-to-list"]').attributes('href')).toBe('/plans/all');
    });
  });
});
