import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DegreeAudit } from './api.js';
import { useAuth } from '../auth/store.js';
import { useLocale } from '../locale.js';
import { mockApi, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import AuditView from './AuditView.vue';
import { COMBINED, course, degreeAudit, emptyAudit, group, GROUP_A, GROUP_C, GROUP_MATH } from './testing/fixtures.js';

let wrapper: VueWrapper | undefined;
/** scrollIntoView as jsdom has it (none, so far): the scroll tests put one in and must take it out again. */
const ORIGINAL_SCROLL = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');

async function render(answer: unknown = degreeAudit(), path = '/audit', errorHandler?: (error: unknown) => void) {
  const fetch = mockApi({ 'GET /users/me/audit': answer });
  const app = await setup(path);
  wrapper = mount(AuditView, { global: { plugins: [app.pinia, app.router], config: errorHandler ? { errorHandler } : {} }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch };
}

const section = (w: VueWrapper, id: string) => w.get(`#group-${id}`);
const rowsOf = (w: VueWrapper, id: string) =>
  section(w, id)
    .findAll('tbody tr')
    .map((tr) => tr.findAll('td').map((td) => td.text().replace(/\s+/g, ' ')));

describe('AuditView (F3, ADR 0013)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('shows every group with its courses, credits and status as the API reports them', async () => {
    const { w } = await render();
    expect(w.findAll('[data-test="group"] h2').map((h) => h.text())).toEqual([
      'Kiến thức Computer Science (A): bắt buộc',
      'Kiến thức Math',
      'Tự chọn Computer Science (C)',
    ]);
    expect(section(w, GROUP_A).text()).toContain('Bắt buộc · 4 / 8 TC');
    expect(section(w, GROUP_A).get('[data-test="group-state"]').text()).toBe('○ Chưa đạt');
    expect(rowsOf(w, GROUP_A)).toEqual([
      ['ZZ201', 'Học phần thử ZZ201', '4', 'Đã đạt', '8'],
      ['ZZ202', 'Học phần thử ZZ202', '4', 'Chưa đạt', '4,5'],
    ]);
    expect(rowsOf(w, GROUP_MATH)).toEqual([
      ['ZZ101', 'Học phần thử ZZ101', '4', 'Đã đạt', 'Miễn'],
      ['ZZ090', 'Học phần thử ZZ090 Ngoài tổng TC Không tính ĐTB', '1', 'Đã đạt', 'Đạt'],
    ]);
    expect(section(w, GROUP_MATH).get('[data-test="group-state"]').text()).toBe('✓ Đã đạt');
  });

  it('says what each group is missing, with the clause it cites', async () => {
    const { w } = await render();
    const missing = section(w, GROUP_A).get('[data-test="missing"]').text();
    expect(missing).toContain('Còn thiếu: 4 TC');
    expect(missing).toContain('Chưa đạt: ZZ202');
    expect(missing).toContain('Căn cứ: QĐ 1175/QĐ-KHTN Điều 17.3.b');
    expect(section(w, GROUP_MATH).get('[data-test="missing"]').text()).toContain('Không còn thiếu gì.');
  });

  it('says when what a group lacks is all in progress, never "0 TC" missing', async () => {
    const groups = [group(GROUP_A, 'Kiến thức Computer Science (A): tự chọn', { kind: 'elective', passedCredits: 4, inProgressCredits: 4, remainingCredits: 0 })];
    const { w } = await render(degreeAudit({ groups }));
    const missing = section(w, GROUP_A).get('[data-test="missing"]').text();
    expect(missing).toContain('Còn thiếu: chờ kết quả 4 TC đang học');
    expect(missing).not.toContain('0 TC');
  });

  it('splits the courses a compulsory group still needs by their status, never calling one in progress "chưa đạt"', async () => {
    const groups = [
      group(GROUP_A, 'Kiến thức Computer Science (A): bắt buộc', {
        passedCredits: 4,
        inProgressCredits: 4,
        remainingCredits: 0,
        courses: [
          course('ZZ201', { status: 'passed', result: 'graded', grade: 8 }),
          course('ZZ202', { status: 'failed', result: 'graded', grade: 4 }),
          course('ZZ203'),
          course('ZZ204', { status: 'in_progress', result: 'in_progress' }),
          course('ZZ205'),
        ],
      }),
    ];
    const { w } = await render(degreeAudit({ groups }));
    const missing = section(w, GROUP_A).get('[data-test="missing"]').text();
    expect(missing).toContain('Còn thiếu: chờ kết quả 4 TC đang học · Chưa học: ZZ203, ZZ205 · Chưa đạt: ZZ202 · Đang học: ZZ204');
    expect(missing).not.toContain('0 TC');
  });

  it('names a course that still blocks the group though it counts in another one', async () => {
    // The API keeps a failed or in-progress course's own status in every group that lists it (ADR 0013).
    const groups = [
      group(GROUP_A, 'Kiến thức Computer Science (A): bắt buộc', {
        passedCredits: 4,
        remainingCredits: 4,
        courses: [course('ZZ201', { status: 'passed', result: 'graded', grade: 8 }), course('ZZ210', { status: 'in_progress', result: 'in_progress', countedInGroupId: GROUP_MATH })],
      }),
      group(GROUP_MATH, 'Kiến thức Math', { courses: [course('ZZ210', { status: 'in_progress', result: 'in_progress' })], inProgressCredits: 4, remainingCredits: 4 }),
    ];
    const { w } = await render(degreeAudit({ groups }));
    expect(section(w, GROUP_A).get('[data-test="missing"]').text()).toContain('Đang học: ZZ210');
    expect(rowsOf(w, GROUP_A)[1]).toEqual(['ZZ210', 'Học phần thử ZZ210', '4', 'Đang học · Tính ở nhóm Kiến thức Math', '–']);
  });

  it('shows a group without a minimum of its own under its combined minimum, never as 0 / 0', async () => {
    const { w } = await render();
    const elective = section(w, GROUP_C);
    expect(elective.text()).toContain('Tự chọn · Không có tối thiểu riêng · tính trong Kiến thức tự chọn · 4 TC đang học');
    expect(elective.text()).not.toMatch(/\/ 0/);
    // The API calls it met and lists no condition for it: the screen shows no ✓ and points to the combined minimum.
    expect(elective.get('[data-test="group-state"]').text()).toBe('Xét theo tối thiểu chung');
    expect(elective.get('[data-test="missing"]').text()).toBe('Còn thiếu: xem Kiến thức tự chọn');
    expect(elective.text()).not.toContain('✓');
    expect(elective.text()).not.toContain('Không còn thiếu gì');
    expect(rowsOf(w, GROUP_C)).toEqual([['ZZ414', 'Học phần thử ZZ414', '4', 'Đang học', '–']]);
    const combined = w.get(`#combined-${COMBINED}`);
    expect(combined.text()).toContain('0 / 12 TC · 4 TC đang học · Còn thiếu: 8 TC');
    expect(combined.text()).toContain('Gồm: Tự chọn Computer Science (C)');
    expect(combined.text()).toContain('Ghi chú thử của khối tự chọn.');
  });

  it('never says a combined minimum not met is missing 0 credits', async () => {
    const base = degreeAudit();
    const combinedMinimums = [{ ...base.combinedMinimums[0]!, credits: 0, inProgressCredits: 12, remainingCredits: 0, met: false }];
    const { w } = await render(degreeAudit({ combinedMinimums }));
    const combined = w.get(`#combined-${COMBINED}`);
    expect(combined.text()).toContain('0 / 12 TC · 12 TC đang học');
    expect(combined.text()).toContain('○ Chưa đạt');
    expect(combined.text()).not.toContain('Còn thiếu');
    expect(combined.text()).toContain('Căn cứ: QĐ 1175/QĐ-KHTN Điều 17.3.b');
  });

  it('names the group a course counts in, and the group surplus credits go to', async () => {
    const base = degreeAudit();
    const groups = [
      group(GROUP_A, 'Kiến thức Computer Science (A): tự chọn', {
        kind: 'elective',
        requiredCredits: 4,
        passedCredits: 8,
        remainingCredits: 0,
        overflowOutCredits: 4,
        overflowToGroupId: GROUP_C,
        met: true,
        courses: [course('ZZ301', { status: 'passed', result: 'graded', grade: 7 }), course('ZZ302', { status: 'passed', result: 'graded', grade: 7 })],
      }),
      group(GROUP_C, 'Tự chọn Computer Science (C)', {
        kind: 'elective',
        requiredCredits: null,
        remainingCredits: null,
        overflowInCredits: 4,
        met: true,
        courses: [course('ZZ301', { status: 'counted_in_other_group', result: 'graded', grade: 7, countedInGroupId: GROUP_A })],
      }),
    ];
    const { w } = await render(degreeAudit({ groups, graduation: { ...base.graduation, unmet: [], met: [] } }));
    expect(section(w, GROUP_A).text()).toContain('4 TC dư tính cho Tự chọn Computer Science (C)');
    expect(section(w, GROUP_C).text()).toContain('+4 TC dư từ nhóm khác');
    expect(rowsOf(w, GROUP_C)[0]).toEqual(['ZZ301', 'Học phần thử ZZ301', '4', 'Tính ở nhóm khác · Tính ở nhóm Kiến thức Computer Science (A): tự chọn', '7']);
  });

  it('lists the graduation conditions with their citations, and the unchecked ones as for the school', async () => {
    const { w } = await render();
    expect(w.get('[data-test="graduation"]').text()).toContain('Chưa đủ điều kiện tốt nghiệp');
    const unmet = w.get('[data-test="conditions-unmet"]').text();
    expect(unmet).toContain('Kiến thức Computer Science (A): bắt buộc');
    expect(unmet).toContain('Tích lũy tối thiểu 20 TC của khóa');
    const notChecked = w.get('[data-test="conditions-not-checked"]');
    expect(notChecked.text()).toContain('Trường sẽ xét');
    expect(notChecked.text()).toContain('? Chuẩn ngoại ngữ của trường QĐ 1175/QĐ-KHTN Điều 17.3.d');
    expect(notChecked.text()).toContain('QĐ 1175/QĐ-KHTN Điều 2.7');
    expect(notChecked.text()).not.toContain('Đã đạt');
  });

  it('falls back on the API’s own words for a condition it does not know', async () => {
    const base = degreeAudit();
    const notChecked = [{ id: 'zz_new_condition', description: 'A synthetic new condition', citation: 'QĐ 1175/QĐ-KHTN Điều 99', status: 'not_checked' as const }];
    const { w } = await render(degreeAudit({ graduation: { ...base.graduation, notChecked } }));
    expect(w.get('[data-test="conditions-not-checked"]').text()).toContain('A synthetic new condition QĐ 1175/QĐ-KHTN Điều 99');
  });

  it('shows each term’s load, averages and cap violations with the citation and the petition route', async () => {
    const { w } = await render();
    const row = w.get('[data-test="terms"] tbody tr');
    expect(row.text()).toContain('HK1 2024–2025');
    expect(row.text()).toContain('Học kỳ chính · 10–22 TC');
    const violation = row.get('[data-test="cap-violation"]').text();
    expect(violation).toContain('9 TC, dưới mức tối thiểu 10 TC');
    expect(violation).toContain('QĐ 1175/QĐ-KHTN Điều 7.2');
    expect(violation).toContain('Allowed by a petition');
  });

  it('lists the courses that count toward nothing, and the warnings', async () => {
    const { w } = await render();
    expect(w.get('[data-test="unmatched"]').text()).toContain('ZZ999 Môn ngoài chương trình thử · 3 TC · 9');
    expect(w.get('[data-test="warnings"]').text()).toContain('ZZ999: không thuộc nhóm nào');
  });

  it('gives both credit figures when the transcript and the curriculum disagree', async () => {
    const warnings: DegreeAudit['warnings'] = [
      { code: 'credits_differ', courseCode: 'ZZ201', message: 'The transcript gives 3 credits and the curriculum 4; the audit counts the smaller number.', transcriptCredits: [3], curriculumCredits: 4 },
    ];
    const { w } = await render(degreeAudit({ warnings }));
    expect(w.get('[data-test="warnings"] li').text()).toBe('ZZ201: bảng điểm ghi 3 TC, chương trình đào tạo ghi 4 TC; số nhỏ hơn được tính.');
    useLocale().set('en');
    await flushPromises();
    expect(w.get('[data-test="warnings"] li').text()).toBe('ZZ201: the transcript gives 3 credits and the curriculum 4; the smaller number counts.');
  });

  it('with no transcript, shows every group at zero and points to the upload', async () => {
    const { w } = await render(emptyAudit());
    expect(w.get('[data-test="no-transcript"] a').attributes('href')).toBe('/transcript');
    expect(w.findAll('[data-test="group"]')).toHaveLength(3);
    expect(section(w, GROUP_A).text()).toContain('0 / 8 TC');
    expect(rowsOf(w, GROUP_A).map((cells) => cells[3])).toEqual(['Chưa học', 'Chưa học']);
    // (C) has nothing passed: no ✓ on it, while the combined minimum it feeds is 0 / 12 and not met.
    expect(section(w, GROUP_C).text()).not.toContain('✓');
    expect(w.find('[data-test="conditions-met"]').exists()).toBe(false);
    expect(w.find('[data-test="terms"]').exists()).toBe(false);
    expect(w.find('[data-test="unmatched"]').exists()).toBe(false);
  });

  it('switches to English, with course names in English where the API has them', async () => {
    const { w } = await render();
    useLocale().set('en');
    await flushPromises();
    expect(w.get('h1').text()).toBe('Degree audit');
    expect(rowsOf(w, GROUP_C)[0]).toEqual(['ZZ414', 'Test elective ZZ414', '4', 'In progress', '–']);
    expect(rowsOf(w, GROUP_A)[1]![4]).toBe('4.5');
  });

  it('writes one credit and one condition in the singular in English', async () => {
    const base = degreeAudit();
    const groups = [group(GROUP_A, 'Kiến thức Computer Science (A): bắt buộc', { requiredCredits: 1, remainingCredits: 1, courses: [course('ZZ201', { credits: 1 })] })];
    const { w } = await render(degreeAudit({ groups, graduation: { ...base.graduation, unmet: base.graduation.unmet.slice(0, 1) } }));
    useLocale().set('en');
    await flushPromises();
    const missing = section(w, GROUP_A).get('[data-test="missing"]').text();
    expect(missing).toContain('Still missing: 1 credit ·');
    expect(section(w, GROUP_A).text()).toContain('0 / 1 credit');
    expect(section(w, GROUP_A).text()).not.toMatch(/\b1 credits\b/);
  });

  describe('the link from the dashboard', () => {
    const scrolled: string[] = [];
    beforeEach(() => {
      scrolled.length = 0;
      Element.prototype.scrollIntoView = function (this: Element) {
        scrolled.push(this.id);
      };
    });
    afterEach(() => {
      if (ORIGINAL_SCROLL) Object.defineProperty(Element.prototype, 'scrollIntoView', ORIGINAL_SCROLL);
      else delete (Element.prototype as Partial<Element>).scrollIntoView;
    });

    it('scrolls to the group the dashboard linked to, once the audit is drawn', async () => {
      await render(degreeAudit(), `/audit#group-${GROUP_A}`);
      expect(scrolled).toEqual([`group-${GROUP_A}`]);
    });

    it('takes the hash as the router decoded it, so a stray % neither throws nor scrolls', async () => {
      const errors = vi.fn();
      // The router's own scroll behaviour warns that "#group-%" is no valid selector; that is not this page's.
      vi.spyOn(console, 'warn').mockImplementation(() => {});
      const { w } = await render(degreeAudit(), '/audit#group-%25', errors);
      expect(errors).not.toHaveBeenCalled();
      expect(scrolled).toEqual([]);
      expect(w.findAll('[data-test="group"]')).toHaveLength(3);
    });
  });

  it('leaves no scrollIntoView behind for later tests', () => {
    expect(Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')).toEqual(ORIGINAL_SCROLL);
  });

  it('sends a student without a program to onboarding', async () => {
    const { w } = await render(status(409, { statusCode: 409, code: 'onboarding_required', message: 'Finish onboarding' }));
    expect(w.get('[data-test="onboarding-required"] a').attributes('href')).toBe('/onboarding');
    expect(w.find('[role="alert"]').exists()).toBe(false);
  });

  it('shows an error with a retry when the audit cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render(status(503));
    expect(w.get('[role="alert"]').text()).toContain('Chưa tải được kết quả xét tốt nghiệp.');
    expect(w.find('[data-test="group"]').exists()).toBe(false);
  });

  it('on a 401 signs the student out and shows no error of its own', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render(status(401));
    expect(useAuth().signedIn).toBe(false);
    expect(w.find('[role="alert"]').exists()).toBe(false);
  });
});
