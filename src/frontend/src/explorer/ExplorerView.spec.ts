import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Course, CourseDetail, Curriculum, Program, RequirementGroup } from '../curriculum/api.js';
import { mockApi, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import ExplorerView from './ExplorerView.vue';

// A synthetic curriculum: made-up codes and names, the group headings of the real APCS tables.
const course = (code: string, nameVi: string, credits = 4, nameEn: string | null = null): Course => ({
  code,
  nameVi,
  nameEn,
  credits,
  theoryPeriods: 45,
  labPeriods: 30,
  exercisePeriods: null,
  projectPeriods: 0,
});
const group = (id: string, name: string, kind: RequirementGroup['kind'], courses: Course[], extra: Partial<RequirementGroup> = {}): RequirementGroup => ({
  id: `00000000-0000-4000-8000-00000000${id}`,
  name,
  kind,
  creditsTotal: kind === 'compulsory' ? 8 : null,
  creditsTotalMin: kind === 'elective' ? 12 : null,
  officialNotes: null,
  courses,
  ...extra,
});
const ML = course('ZZ414', 'Học máy thử', 4, 'Machine learning (test)');
const CURRICULUM: Curriculum = {
  id: '00000000-0000-4000-8000-0000000000c1',
  code: 'APCS2024',
  program: { code: 'APCS', nameVi: 'Chương trình Tiên tiến thử', nameEn: null, faculty: null },
  cohortYear: 2024,
  nameVi: 'CTĐT thử khóa 2024',
  nameEn: null,
  language: 'en',
  totalCreditsMin: 163,
  requirementGroups: [
    group('0a01', 'Tự chọn Computer Science (C)', 'elective', [ML]),
    group('0a02', 'Kiến thức Math', 'compulsory', [course('ZZ101', 'Giải tích thử'), course('ZZ102', 'Đại số thử', 3)], {
      officialNotes: 'Ghi chú thử của nhóm.',
    }),
    group('0a03', 'Kiến thức Computer Science (A): bắt buộc', 'compulsory', [course('ZZ201', 'Lập trình thử')]),
  ],
};
const PROGRAMS: Program[] = [{ code: 'APCS', nameVi: 'Chương trình Tiên tiến thử', nameEn: null, faculty: null, cohortYears: [2024, 2025] }];
const DETAIL: CourseDetail = {
  ...ML,
  memberships: [
    {
      programCode: 'APCS',
      cohortYear: 2024,
      curriculumCode: 'APCS2024',
      requirementGroupId: '00000000-0000-4000-8000-000000000a01',
      requirementGroupName: 'Tự chọn Computer Science (C)',
      kind: 'elective',
    },
  ],
};

let wrapper: VueWrapper | undefined;

async function render(routes: Record<string, unknown> = {}) {
  const fetch = mockApi({
    'GET /programs': { programs: PROGRAMS },
    'GET /programs/APCS/curricula/2024': CURRICULUM,
    'GET /users/me/transcript': {
      rows: [{ courseCode: 'ZZ101', courseName: 'Giải tích thử', credits: 4, result: 'fail', grade: 3, term: { year: 2024, number: 1 } }],
    },
    'GET /courses/ZZ414': DETAIL,
    ...routes,
  });
  const app = await setup('/explorer');
  wrapper = mount(ExplorerView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch };
}

const headings = (w: VueWrapper) => w.findAll('[data-test="group"] h2').map((h) => h.text());
const codes = (w: VueWrapper) => w.findAll('.tile .k').map((k) => k.text());

describe('ExplorerView (F4)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('opens the curriculum of the student’s program and cohort, groups in colour order', async () => {
    const { w, fetch } = await render();
    expect(fetch.mock.calls.map(([url]) => String(url))).toContainEqual(expect.stringContaining('/programs/APCS/curricula/2024'));
    expect(w.get('[data-test="summary"]').text()).toBe('CTĐT thử khóa 2024 · 4 học phần · 163 TC để tốt nghiệp');
    expect(headings(w)).toEqual(['Kiến thức Computer Science (A): bắt buộc', 'Kiến thức Math', 'Tự chọn Computer Science (C)']);
    const [core, math, elective] = w.findAll('[data-test="group"]');
    expect(core!.classes()).toContain('g-core');
    expect(core!.get('.glyph').text()).toBe('</>');
    expect(math!.text()).toContain('Bắt buộc · 8 TC · 2 học phần');
    expect(math!.text()).toContain('Ghi chú thử của nhóm.');
    expect(elective!.classes()).toContain('g-elec');
    expect(elective!.text()).toContain('Tự chọn · tối thiểu 12 TC');
    expect(w.get('[data-test="course-ZZ102"]').text()).toContain('3 TC');
  });

  it('finds courses typed without diacritics, by name, English name or code', async () => {
    const { w } = await render();
    const search = w.get('input[type="search"]');
    await search.setValue('hoc may');
    expect(codes(w)).toEqual(['ZZ414']);
    await search.setValue('machine');
    expect(codes(w)).toEqual(['ZZ414']);
    await search.setValue('zz10');
    expect(codes(w)).toEqual(['ZZ101', 'ZZ102']);
    await search.setValue('khong co mon nay');
    expect(w.get('[role="status"]').text()).toContain('Không có học phần nào khớp.');
  });

  it('filters by group colour, with a way back to all', async () => {
    const { w } = await render();
    const chips = w.findAll('.chips button');
    expect(chips.map((c) => c.text())).toEqual(['Tất cả', '</> Cốt lõi', '∑ Toán', '★ Tự chọn']);
    await chips[2]!.trigger('click');
    expect(chips[2]!.attributes('aria-pressed')).toBe('true');
    expect(headings(w)).toEqual(['Kiến thức Math']);
    await chips[0]!.trigger('click');
    expect(headings(w)).toHaveLength(3);
  });

  it('marks a course of the student’s transcript, and never says passed, failed, open or locked', async () => {
    const { w } = await render();
    expect(w.findAll('[data-test="in-transcript"]')).toHaveLength(1);
    expect(w.get('[data-test="course-ZZ101"]').text()).toContain('Trong bảng điểm');
    expect(w.text()).not.toMatch(/Đã đạt|Không đạt|Có thể học|Chưa mở khóa|Đang học/);
  });

  it('shows no marks, and no error, when the transcript cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ 'GET /users/me/transcript': status(500) });
    expect(w.findAll('[data-test="in-transcript"]')).toHaveLength(0);
    expect(w.find('[role="alert"]').exists()).toBe(false);
  });

  it('opens a course in a drawer, with its groups and a plain note that prerequisites are not recorded', async () => {
    const { w } = await render();
    await w.get('[data-test="course-ZZ414"]').trigger('click');
    await flushPromises();
    const drawer = w.get('dialog[open]');
    expect(drawer.get('h2').text()).toBe('Học máy thử');
    expect(drawer.text()).toContain('Machine learning (test)');
    expect(drawer.text()).toContain('LT 45 · TH 30');
    expect(drawer.get('[data-test="memberships"]').text()).toContain('APCS2024 Tự chọn Computer Science (C)');
    expect(drawer.get('[data-test="no-prerequisites"]').text()).toBe('Chưa ghi nhận môn tiên quyết và học kỳ mở môn.');
    expect(drawer.find('[data-test="transcript-note"]').exists()).toBe(false);
    await drawer.get('button[aria-label="Đóng"]').trigger('click');
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);
  });

  it('switches to another cohort of the program', async () => {
    const { w, fetch } = await render({ 'GET /programs/APCS/curricula/2025': { ...CURRICULUM, cohortYear: 2025, nameVi: 'CTĐT thử khóa 2025' } });
    await w.findAll('.head-actions select')[1]!.setValue('2025');
    await flushPromises();
    expect(fetch.mock.calls.map(([url]) => String(url))).toContainEqual(expect.stringContaining('/programs/APCS/curricula/2025'));
    expect(w.get('[data-test="summary"]').text()).toContain('CTĐT thử khóa 2025');
  });

  it('says so when the cohort has no curriculum (404)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ 'GET /programs/APCS/curricula/2024': status(404) });
    expect(w.get('[role="alert"]').text()).toContain('Chưa có chương trình đào tạo cho khóa này.');
  });
});
