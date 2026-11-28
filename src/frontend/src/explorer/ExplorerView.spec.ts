import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CourseDetail, Curriculum, CurriculumCourse, Program, RequirementGroup } from '../curriculum/api.js';
import { useLocale } from '../locale.js';
import { mockApi, status } from '../testing/fetch.js';
import { chooseOption } from '../testing/select.js';
import { setup } from '../testing/signed-in.js';
import ExplorerView from './ExplorerView.vue';
import { EXPLORER_MESSAGES } from './messages.js';

const course = (code: string, nameVi: string, credits = 4, nameEn: string | null = null): CurriculumCourse => ({
  code,
  nameVi,
  nameEn,
  credits,
  theoryPeriods: 45,
  labPeriods: 30,
  exercisePeriods: null,
  projectPeriods: 0,
  prerequisites: null,
  offeringTerms: null,
});
const group = (id: string, name: string, kind: RequirementGroup['kind'], courses: CurriculumCourse[], extra: Partial<RequirementGroup> = {}): RequirementGroup => ({
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
  program: { code: 'APCS', nameVi: 'Chương trình Tiên tiến thử', nameEn: null, faculty: null, trainingType: 'advanced' },
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
    group('0a03', 'Kiến thức Computer Science (A): bắt buộc', 'compulsory', [{ ...course('ZZ201', 'Lập trình thử'), prerequisites: [] }]),
  ],
};
const PROGRAMS: Program[] = [{ code: 'APCS', nameVi: 'Chương trình Tiên tiến thử', nameEn: null, faculty: null, trainingType: 'advanced', cohortYears: [2024, 2025] }];
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

async function render(routes: Record<string, unknown> = {}, path = '/explorer') {
  const fetch = mockApi({
    'GET /programs': { programs: PROGRAMS },
    'GET /programs/APCS/curricula/2024': CURRICULUM,
    'GET /programs/APCS/curricula/2024/standing': {
      courses: [
        { code: 'ZZ101', transcriptStatus: 'failed', readiness: null, missingPrerequisites: [] },
        { code: 'ZZ102', transcriptStatus: null, readiness: null, missingPrerequisites: [] },
        { code: 'ZZ201', transcriptStatus: null, readiness: 'available', missingPrerequisites: [] },
        { code: 'ZZ414', transcriptStatus: null, readiness: null, missingPrerequisites: [] },
      ],
    },
    'GET /programs/APCS/curricula/2025/standing': {
      courses: [
        { code: 'ZZ101', transcriptStatus: 'failed', readiness: null, missingPrerequisites: [] },
        { code: 'ZZ102', transcriptStatus: null, readiness: null, missingPrerequisites: [] },
        { code: 'ZZ201', transcriptStatus: null, readiness: 'available', missingPrerequisites: [] },
        { code: 'ZZ414', transcriptStatus: null, readiness: null, missingPrerequisites: [] },
      ],
    },
    'GET /courses/ZZ414': DETAIL,
    ...routes,
  });
  const app = await setup(path);
  wrapper = mount(ExplorerView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch, router: app.router };
}

const headings = (w: VueWrapper) => w.findAll('[data-test="group"] h2').map((h) => h.text());
const drawerNote = (w: VueWrapper) => w.get('dialog[open] [data-test="no-prerequisites"]').text();
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

  it('opens the curriculum of the student’s program and cohort, groups in colour order, without wrapping SelectMenu in label', async () => {
    const { w, fetch } = await render();
    expect(fetch.mock.calls.map(([url]) => String(url))).toContainEqual(expect.stringContaining('/programs/APCS/curricula/2024'));
    expect(w.get('[data-test="summary"]').text()).toBe('CTĐT thử khóa 2024 · 4 học phần · 163 TC để tốt nghiệp');
    expect(headings(w)).toEqual(['Kiến thức Computer Science (A): bắt buộc', 'Kiến thức Math', 'Tự chọn Computer Science (C)']);
    for (const combo of w.findAll('.head-actions [role="combobox"]')) {
      expect(combo.element.closest('label')).toBeNull();
    }
    const [core, math, elective] = w.findAll('[data-test="group"]');
    expect(core!.classes()).toContain('g-core');
    expect(core!.get('.glyph').text()).toBe('</>');
    expect(math!.text()).toContain('Bắt buộc · 8 TC · 2 học phần');
    expect(math!.text()).toContain('Ghi chú thử của nhóm.');
    expect(elective!.classes()).toContain('g-elec');
    expect(elective!.text()).toContain('Tự chọn · tối thiểu 12 TC');
    expect(w.get('[data-test="course-ZZ102"]').text()).toContain('3 TC');
  });

  it('brings the course named by ?course= into view, focused and glowing (the planner’s Taken tags link here)', async () => {
    const { w } = await render({}, '/explorer?course=ZZ102');
    const tile = w.get('[data-test="course-ZZ102"]');
    expect(document.activeElement).toBe(tile.element);
    expect(tile.classes()).toContain('flash');
  });

  it('shows the linked course once: a later cohort switch keeps the student’s own search, and resets shownCourse so a linked course highlights in the switched cohort', async () => {
    const { w } = await render({ 'GET /programs/APCS/curricula/2025': { ...CURRICULUM, cohortYear: 2025 } }, '/explorer?course=ZZ102');
    await w.get('input[type="search"]').setValue('zz101');
    await chooseOption(w.findAll('.head-actions [role="combobox"]')[1]!, 'Khóa 2025');
    await flushPromises();
    expect((w.get('input[type="search"]').element as HTMLInputElement).value).toBe('zz101');

    await w.get('input[type="search"]').setValue('');
    await chooseOption(w.findAll('.head-actions [role="combobox"]')[1]!, 'Khóa 2024');
    await flushPromises();
    const tile = w.get('[data-test="course-ZZ102"]');
    expect(document.activeElement).toBe(tile.element);
    expect(tile.classes()).toContain('flash');
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
    expect(w.get('[role="status"]').text()).toContain(EXPLORER_MESSAGES.vi.noMatch);
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

  it('renders failed, in_progress, passed, and available badges returned by the backend rule engine without client-side rule math', async () => {
    const { w } = await render({
      'GET /programs/APCS/curricula/2024/standing': {
        courses: [
          { code: 'ZZ101', transcriptStatus: 'failed', readiness: null, missingPrerequisites: [] },
          { code: 'ZZ102', transcriptStatus: 'passed', readiness: null, missingPrerequisites: [] },
          { code: 'ZZ201', transcriptStatus: null, readiness: 'available', missingPrerequisites: [] },
          { code: 'ZZ414', transcriptStatus: 'in_progress', readiness: null, missingPrerequisites: [] },
        ],
      },
    });
    expect(w.get('[data-test="course-ZZ101"] [data-test="transcript-status"]').attributes('data-status')).toBe('failed');
    expect(w.get('[data-test="course-ZZ101"]').text()).toContain('Chưa đạt');
    expect(w.find('[data-test="course-ZZ101"] [data-test="course-readiness"]').exists()).toBe(false);

    expect(w.get('[data-test="course-ZZ102"] [data-test="transcript-status"]').attributes('data-status')).toBe('passed');
    expect(w.get('[data-test="course-ZZ102"]').text()).toContain('Đã đạt');

    expect(w.get('[data-test="course-ZZ414"] [data-test="transcript-status"]').attributes('data-status')).toBe('in_progress');
    expect(w.get('[data-test="course-ZZ414"]').text()).toContain('Đang học');

    expect(w.get('[data-test="course-ZZ201"] [data-test="course-readiness"]').attributes('data-readiness')).toBe('available');
    expect(w.get('[data-test="course-ZZ201"]').text()).toContain('Có thể học');

    useLocale().set('en');
    await flushPromises();
    expect(w.get('[data-test="course-ZZ101"]').text()).toContain('Failed');
    expect(w.get('[data-test="course-ZZ102"]').text()).toContain('Passed');
    expect(w.get('[data-test="course-ZZ414"]').text()).toContain('In progress');
    expect(w.get('[data-test="course-ZZ201"]').text()).toContain('Available');
  });

  it('displays backend-computed locked vs available readiness and Unlocks downstream courses for CS469 -> CS470, with a link to the planner', async () => {
    const cs469: CurriculumCourse = { ...course('CS469', 'Đề cương khóa luận thử', 2, 'Thesis proposal (test)'), prerequisites: [] };
    const cs470: CurriculumCourse = { ...course('CS470', 'Khóa luận tốt nghiệp thử', 10, 'Graduation thesis (test)'), prerequisites: ['CS469'] };
    const thesisCurriculum: Curriculum = {
      ...CURRICULUM,
      requirementGroups: [group('0a09', 'Tốt nghiệp', 'compulsory', [cs469, cs470])],
    };

    const lockedRun = await render({
      'GET /programs/APCS/curricula/2024': thesisCurriculum,
      'GET /programs/APCS/curricula/2024/standing': {
        courses: [
          { code: 'CS469', transcriptStatus: 'failed', readiness: 'available', missingPrerequisites: [] },
          { code: 'CS470', transcriptStatus: null, readiness: 'locked', missingPrerequisites: ['CS469'] },
        ],
      },
      'GET /courses/CS469': { ...DETAIL, ...cs469 },
      'GET /courses/CS470': { ...DETAIL, ...cs470 },
    });
    expect(lockedRun.w.get('[data-test="course-CS469"] [data-test="transcript-status"]').attributes('data-status')).toBe('failed');
    expect(lockedRun.w.get('[data-test="course-CS470"] [data-test="course-readiness"]').attributes('data-readiness')).toBe('locked');
    expect(lockedRun.w.get('[data-test="course-CS470"]').text()).toContain('Chưa đủ tiên quyết');

    await lockedRun.w.get('[data-test="course-CS469"]').trigger('click');
    await flushPromises();
    const drawer469 = lockedRun.w.get('dialog[open]');
    expect(drawer469.get('[data-test="transcript-note"]').text()).toContain('Chưa đạt');
    expect(drawer469.get('[data-test="unlocks"]').text()).toContain('CS470 Khóa luận tốt nghiệp thử');
    expect(drawer469.get('[data-test="open-planner"]').attributes('href')).toBe('/plans');
    await drawer469.get('button[aria-label="Đóng"]').trigger('click');
    await flushPromises();

    await lockedRun.w.get('[data-test="course-CS470"]').trigger('click');
    await flushPromises();
    expect(lockedRun.w.get('dialog[open] [data-test="readiness-note"]').text()).toContain('Cần đạt trước: CS469.');
    expect(lockedRun.w.find('dialog[open] [data-test="unlocks"]').exists()).toBe(false);
    await lockedRun.w.get('dialog[open] [data-test="open-planner"]').trigger('click');
    await flushPromises();
    expect(lockedRun.router.currentRoute.value.name).toBe('plans');
    lockedRun.w.unmount();

    const unlockedRun = await render({
      'GET /programs/APCS/curricula/2024': thesisCurriculum,
      'GET /programs/APCS/curricula/2024/standing': {
        courses: [
          { code: 'CS469', transcriptStatus: 'passed', readiness: null, missingPrerequisites: [] },
          { code: 'CS470', transcriptStatus: null, readiness: 'available', missingPrerequisites: [] },
        ],
      },
    });
    expect(unlockedRun.w.get('[data-test="course-CS469"] [data-test="transcript-status"]').attributes('data-status')).toBe('passed');
    expect(unlockedRun.w.get('[data-test="course-CS470"] [data-test="course-readiness"]').attributes('data-readiness')).toBe('available');
    expect(unlockedRun.w.get('[data-test="course-CS470"]').text()).toContain('Có thể học');
  });

  it('shows no marks, and no error, when the curriculum standing cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ 'GET /programs/APCS/curricula/2024/standing': status(500) });
    expect(w.findAll('[data-test="transcript-status"]')).toHaveLength(0);
    expect(w.findAll('[data-test="course-readiness"]')).toHaveLength(0);
    expect(w.find('[role="alert"]').exists()).toBe(false);
  });

  it('says a course recorded as having no prerequisite has none, in both languages, and still that its offering terms are not recorded', async () => {
    const { w } = await render({ 'GET /courses/ZZ201': { ...DETAIL, code: 'ZZ201' } });
    await w.get('[data-test="course-ZZ201"]').trigger('click');
    await flushPromises();
    expect(drawerNote(w)).toBe(`${EXPLORER_MESSAGES.vi.prerequisitesNone} ${EXPLORER_MESSAGES.vi.termsUnknown}`);
    useLocale().set('en');
    await flushPromises();
    expect(drawerNote(w)).toBe(`${EXPLORER_MESSAGES.en.prerequisitesNone} ${EXPLORER_MESSAGES.en.termsUnknown}`);
  });

  it.each([
    [null, 'Chưa ghi nhận môn tiên quyết. Học kỳ mở môn: HK1, HK3.', 'Prerequisites are not recorded yet. Offering terms: term 1, term 3.'],
    [[], 'Không có môn tiên quyết. Học kỳ mở môn: HK1, HK3.', 'No prerequisite. Offering terms: term 1, term 3.'],
    [['ZZ201'], 'Môn tiên quyết: ZZ201. Học kỳ mở môn: HK1, HK3.', 'Prerequisites: ZZ201. Offering terms: term 1, term 3.'],
  ])('lists the recorded offering terms of a course whose prerequisites are %j, in both languages', async (prerequisites, vi, en) => {
    const withTerms: Curriculum = {
      ...CURRICULUM,
      requirementGroups: CURRICULUM.requirementGroups.map((g) =>
        g.name === 'Kiến thức Computer Science (A): bắt buộc' ? { ...g, courses: [...g.courses, { ...course('ZZ203', 'Môn có kỳ mở thử'), prerequisites, offeringTerms: [1, 3] }] } : g,
      ),
    };
    const { w } = await render({ 'GET /programs/APCS/curricula/2024': withTerms, 'GET /courses/ZZ203': { ...DETAIL, code: 'ZZ203' } });
    await w.get('[data-test="course-ZZ203"]').trigger('click');
    await flushPromises();
    expect(w.get('dialog[open] [data-test="no-prerequisites"]').text()).toBe(vi);
    useLocale().set('en');
    await flushPromises();
    expect(w.get('dialog[open] [data-test="no-prerequisites"]').text()).toBe(en);
  });

  it('lists the recorded prerequisites of a course, as the seed records CS469 for CS470, in both languages', async () => {
    const withPrerequisite: Curriculum = {
      ...CURRICULUM,
      requirementGroups: CURRICULUM.requirementGroups.map((g) =>
        g.name === 'Kiến thức Computer Science (A): bắt buộc' ? { ...g, courses: [...g.courses, { ...course('ZZ202', 'Đồ án thử'), prerequisites: ['ZZ201'] }] } : g,
      ),
    };
    const { w } = await render({ 'GET /programs/APCS/curricula/2024': withPrerequisite, 'GET /courses/ZZ202': { ...DETAIL, code: 'ZZ202' } });
    await w.get('[data-test="course-ZZ202"]').trigger('click');
    await flushPromises();
    expect(drawerNote(w)).toBe('Môn tiên quyết: ZZ201. Chưa ghi nhận học kỳ mở môn.');
    useLocale().set('en');
    await flushPromises();
    expect(drawerNote(w)).toBe('Prerequisites: ZZ201. Offering terms are not recorded yet.');
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
    expect(drawerNote(w)).toBe(`${EXPLORER_MESSAGES.vi.noPrerequisites} ${EXPLORER_MESSAGES.vi.termsUnknown}`);
    expect(drawer.find('[data-test="transcript-note"]').exists()).toBe(false);
    await drawer.get('button[aria-label="Đóng"]').trigger('click');
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);
  });

  it('switches to another cohort of the program', async () => {
    const { w, fetch } = await render({ 'GET /programs/APCS/curricula/2025': { ...CURRICULUM, cohortYear: 2025, nameVi: 'CTĐT thử khóa 2025' } });
    await chooseOption(w.findAll('.head-actions [role="combobox"]')[1]!, 'Khóa 2025');
    await flushPromises();
    expect(fetch.mock.calls.map(([url]) => String(url))).toContainEqual(expect.stringContaining('/programs/APCS/curricula/2025'));
    expect(w.get('[data-test="summary"]').text()).toContain('CTĐT thử khóa 2025');
  });

  it('says so when the cohort has no curriculum (404)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ 'GET /programs/APCS/curricula/2024': status(404) });
    expect(w.get('[role="alert"]').text()).toContain(EXPLORER_MESSAGES.vi.noCurriculum);
  });
});
