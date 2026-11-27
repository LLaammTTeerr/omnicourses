import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView, type Router } from 'vue-router';
import { useAuth } from '../auth/store.js';
import type { Curriculum, CurriculumCourse } from '../curriculum/api.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { chooseOption } from '../testing/select.js';
import { setup } from '../testing/signed-in.js';
import type { TranscriptRow } from './api.js';
import { TRANSCRIPT_MESSAGES } from './messages.js';

const SAVED: TranscriptRow[] = [
  { courseCode: 'ZZ101', courseName: 'Môn thử một', credits: 4, result: 'graded', grade: 8.5, term: { year: 2024, number: 1 } },
  { courseCode: 'ZZ102', courseName: 'Môn thử hai', credits: 3, result: 'in_progress', grade: null, term: { year: 2025, number: 1 } },
];

const catalogCourse = (code: string, nameVi: string, credits: number): CurriculumCourse => ({
  code,
  nameVi,
  nameEn: null,
  credits,
  theoryPeriods: 45,
  labPeriods: 30,
  exercisePeriods: null,
  projectPeriods: null,
  prerequisites: null,
  offeringTerms: null,
});

const CURRICULUM: Curriculum = {
  id: '00000000-0000-4000-8000-0000000000c1',
  code: 'APCS2024',
  program: { code: 'APCS', nameVi: 'Chương trình Tiên tiến thử', nameEn: null, faculty: null, trainingType: 'advanced' },
  cohortYear: 2024,
  nameVi: 'CTĐT thử khóa 2024',
  nameEn: null,
  language: 'en',
  totalCreditsMin: 140,
  requirementGroups: [
    {
      id: '00000000-0000-4000-8000-000000000a01',
      name: 'Nhóm bắt buộc thử',
      kind: 'compulsory',
      creditsTotal: 11,
      creditsTotalMin: null,
      officialNotes: null,
      courses: [catalogCourse('ZZ101', 'Môn thử một', 4), catalogCourse('ZZ102', 'Môn thử hai', 3), catalogCourse('ZZ104', 'Môn tự động điền', 4)],
    },
  ],
};

let wrapper: VueWrapper | undefined;
let router: Router;

async function render(routes: Record<string, unknown> = {}) {
  const fetch = mockApi({
    'GET /users/me/transcript': { rows: SAVED },
    'GET /programs/APCS/curricula/2024': CURRICULUM,
    ...routes,
  });
  const app = await setup('/transcript');
  router = app.router;
  wrapper = mount(RouterView, { global: { plugins: [app.pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch };
}

const summary = (w: VueWrapper) => w.get('[data-test="summary"] b').text();
const saveButton = (w: VueWrapper) => w.findAll('button').find((b) => b.text().includes('Lưu bảng điểm'))!;
const row = (w: VueWrapper, i: number) => w.get(`[data-test="row-${i}"]`);

describe('TranscriptView (F2, UC-02)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('shows the saved rows for review, and nothing to save until something changes', async () => {
    const { w } = await render();
    expect(w.findAll('tbody tr')).toHaveLength(2);
    expect((row(w, 0).get('input.code-input').element as HTMLInputElement).value).toBe('ZZ101');
    expect((row(w, 0).get('input[inputmode="decimal"]').element as HTMLInputElement).value).toBe('8.5');
    expect(row(w, 1).text()).toContain(TRANSCRIPT_MESSAGES.vi.noGrade);
    expect(row(w, 0).get('[data-test="check"]').text()).toBe(TRANSCRIPT_MESSAGES.vi.ok);
    expect(summary(w)).toBe('2 dòng · chưa có thay đổi');
    expect(saveButton(w).attributes('disabled')).toBeDefined();
  });

  it('lets a course name be typed past 255 UTF-16 units, since the API counts characters (#179)', async () => {
    const { w } = await render();
    const name = row(w, 0).get(`input[aria-label^="Tên môn"]`);
    expect(name.attributes('maxlength')).toBeUndefined();
    await name.setValue('😀'.repeat(255));
    await flushPromises();
    expect(row(w, 0).get('[data-test="check"]').text()).toBe(TRANSCRIPT_MESSAGES.vi.ok);
  });

  it('blocks the save on an incomplete row and says what to fix in words (A2)', async () => {
    const { w } = await render();
    await w.get('#add-row').trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(row(w, 2).get('input.code-input').element);
    expect(summary(w)).toBe('3 dòng · 1 dòng cần sửa');
    expect(row(w, 2).classes()).toContain('err');
    expect(row(w, 2).get('[data-test="check"]').text()).toBe(TRANSCRIPT_MESSAGES.vi.needsFixShort);
    expect(w.get('[data-test="problems-2"]').text()).toBe('Cần sửa: mã môn (2–20 chữ hoặc số), tên môn (tối đa 255 ký tự), số TC (0–30), kết quả');
    const code = row(w, 2).get('input.code-input');
    expect(code.attributes('aria-invalid')).toBe('true');
    expect(document.getElementById(code.attributes('aria-describedby')!)?.textContent?.trim()).toBe(w.get('[data-test="problems-2"]').text());
    expect(row(w, 2).find('[role="combobox"]').attributes('aria-describedby')).toBeUndefined();
    expect(saveButton(w).attributes('disabled')).toBeDefined();

    await row(w, 2).get('input.code-input').setValue('zz103');
    await row(w, 2).findAll('input')[1]!.setValue('Môn thử ba');
    await row(w, 2).get('input[inputmode="numeric"]').setValue('2');
    await chooseOption(row(w, 2).findAll('[role="combobox"]')[1]!, 'Có điểm');
    expect(w.get('[data-test="problems-2"]').text()).toBe('Cần sửa: điểm (0–10, một chữ số thập phân)');
    await row(w, 2).get('input[inputmode="decimal"]').setValue('7,5');
    expect(summary(w)).toBe('3 dòng · sẵn sàng lưu');
    expect(w.find('[data-test="problems-2"]').exists()).toBe(false);
    expect(saveButton(w).attributes('disabled')).toBeUndefined();
  });

  it('saves the whole set, as the API stores it, and shows what was saved (step 7, A5)', async () => {
    const { w, fetch } = await render({
      'PUT /users/me/transcript': (init: RequestInit) => Response.json(sentBody(init)),
    });
    await chooseOption(row(w, 1).findAll('[role="combobox"]')[1]!, 'Đạt');
    await row(w, 0).get('input.code-input').setValue(' zz101 ');
    await saveButton(w).trigger('click');
    await flushPromises();
    const put = fetch.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    expect(sentBody(put[1])).toEqual({
      rows: [
        { ...SAVED[0], courseCode: 'ZZ101' },
        { ...SAVED[1], result: 'pass', grade: null },
      ],
    });
    expect(useToast().message).toBe('Đã lưu 2 dòng.');
    expect(summary(w)).toBe('2 dòng · chưa có thay đổi');
  });

  it('picks the term and academic year in one choice', async () => {
    const { w, fetch } = await render({ 'PUT /users/me/transcript': (init: RequestInit) => Response.json(sentBody(init)) });
    const term = row(w, 0).get('[role="combobox"]');
    expect(term.attributes('aria-label')).toBe('Học kỳ, dòng 1 (ZZ101)');
    expect(term.text()).toBe('HK1 2024–2025');
    await chooseOption(term, 'HK3 2023–2024');
    expect(term.text()).toBe('HK3 2023–2024');
    await saveButton(w).trigger('click');
    await flushPromises();
    const put = fetch.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    expect((sentBody(put[1]) as { rows: TranscriptRow[] }).rows[0]!.term).toEqual({ year: 2023, number: 3 });
  });

  it('removes a row from the draft only', async () => {
    const { w, fetch } = await render();
    const initialCalls = fetch.mock.calls.length;
    await row(w, 0).get('button[aria-label="Xóa dòng 1 (ZZ101)"]').trigger('click');
    await flushPromises();
    expect(w.findAll('tbody tr')).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(initialCalls);
    expect(fetch).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ method: 'PUT' }));
    expect(useToast().message).toBe('Đã bỏ dòng 1 (ZZ101) khỏi bảng. Bảng điểm đã lưu chỉ đổi khi bạn bấm lưu.');
    expect(document.activeElement?.id).toBe('add-row');
    expect(saveButton(w).attributes('disabled')).toBeUndefined();
  });

  it('says nothing was saved when the API refuses a row (400), and keeps the rows', async () => {
    const { w } = await render({ 'PUT /users/me/transcript': status(400, { message: ['rows.0.courseCode must be 2–20 letters or digits'] }) });
    await row(w, 0).findAll('input')[1]!.setValue('Môn thử một (sửa)');
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(w.get('[data-test="save-error"]').text()).toBe(TRANSCRIPT_MESSAGES.vi.saveRefused);
    expect(w.findAll('tbody tr')).toHaveLength(2);
  });

  it('keeps the rows when saving fails for another reason', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ 'PUT /users/me/transcript': status(503) });
    await row(w, 0).findAll('input')[1]!.setValue('Môn thử một (sửa)');
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(w.get('[data-test="save-error"]').text()).toContain('Các dòng vẫn còn ở đây');
    expect((row(w, 0).findAll('input')[1]!.element as HTMLInputElement).value).toBe('Môn thử một (sửa)');
  });

  it('starts empty with a way to add the first row', async () => {
    const { w } = await render({ 'GET /users/me/transcript': { rows: [] } });
    expect(w.text()).toContain(TRANSCRIPT_MESSAGES.vi.empty);
    expect(summary(w)).toBe('0 dòng · chưa có thay đổi');
    expect(w.find('[data-test="diff-summary"]').exists()).toBe(false);
  });

  it('says plainly that no PDF reader exists yet, so rows are entered by hand', async () => {
    const { w } = await render();
    expect(w.text()).toContain(TRANSCRIPT_MESSAGES.vi.pdfTitle);
    expect(w.find('input[type="file"]').exists()).toBe(false);
  });

  it('shows a load error with a way to try again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let calls = 0;
    const { w } = await render({ 'GET /users/me/transcript': () => (calls++ === 0 ? new Response(null, { status: 500 }) : Response.json({ rows: SAVED })) });
    expect(w.get('[role="alert"]').text()).toContain('Chưa tải được bảng điểm.');
    await w.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(w.findAll('tbody tr')).toHaveLength(2);
  });

  it('asks before leaving with unsaved rows', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const { w } = await render();
    await w.get('#add-row').trigger('click');
    await router.push('/settings').catch(() => {});
    expect(confirm).toHaveBeenCalledWith('Bảng điểm có thay đổi chưa lưu. Rời trang và bỏ các thay đổi?');
    expect(router.currentRoute.value.name).toBe('transcript');
    await router.push('/settings');
    expect(router.currentRoute.value.name).toBe('settings');
  });

  it('lets a student whose session ended leave without asking', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    const { w } = await render();
    await w.get('#add-row').trigger('click');
    useAuth().clear();
    await router.push('/sign-in');
    expect(confirm).not.toHaveBeenCalled();
  });

  it('pastes a grades table with live preview and per-line error checking, loading rows into draft review only until saved', async () => {
    const { w, fetch } = await render({
      'PUT /users/me/transcript': (init: RequestInit) => Response.json(sentBody(init)),
    });
    await w.get('[data-test="open-paste"]').trigger('click');
    await flushPromises();

    const dialog = w.get('[data-test="paste-dialog"]');
    const input = dialog.get('[data-test="paste-input"]');

    await input.setValue(['Học kỳ\tMã MH\tTên môn\tTín chỉ\tĐiểm', '2024-2\tZZ104\tMôn tự động điền\t4\t9,0', 'bad-line'].join('\n'));
    await flushPromises();
    expect(dialog.findAll('[data-test="paste-preview-row"]')).toHaveLength(1);
    expect(dialog.findAll('[data-test="paste-error"]')).toHaveLength(1);
    expect(dialog.get('[data-test="paste-error"]').text()).toContain('Dòng 3');
    expect(dialog.get('[data-test="paste-append"]').attributes('disabled')).toBeDefined();
    expect(dialog.get('[data-test="paste-replace"]').attributes('disabled')).toBeDefined();

    await input.setValue(['Học kỳ\tMã MH\tTên môn\tTín chỉ\tĐiểm', '2024-2\tZZ104\tMôn tự động điền\t4\t9,0', '2025-2\tZZ105\tMôn miễn thử\t2\tMiễn'].join('\n'));
    await flushPromises();
    expect(dialog.find('[data-test="paste-errors"]').exists()).toBe(false);
    expect(dialog.findAll('[data-test="paste-preview-row"]')).toHaveLength(2);

    await dialog.get('[data-test="paste-append"]').trigger('click');
    await flushPromises();
    expect(w.findAll('tbody tr')).toHaveLength(4);
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
    expect(w.get('[data-test="diff-summary"]').text()).toBe('+2 thêm / ~0 sửa / -0 xóa');

    await w.get('[data-test="open-paste"]').trigger('click');
    await flushPromises();
    await w.get('[data-test="paste-input"]').setValue('2025-1\tZZ102\tMôn thử hai\t3\t8,0\n2025-2\tZZ104\tMôn tự động điền\t4\tĐang học');
    await flushPromises();
    await w.get('[data-test="paste-replace"]').trigger('click');
    await flushPromises();

    expect(w.findAll('tbody tr')).toHaveLength(2);
    expect(w.get('[data-test="diff-summary"]').text()).toBe('+1 thêm / ~1 sửa / -1 xóa');
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);

    await saveButton(w).trigger('click');
    await flushPromises();
    const put = fetch.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    expect(sentBody(put[1])).toEqual({
      rows: [
        { courseCode: 'ZZ102', courseName: 'Môn thử hai', credits: 3, result: 'graded', grade: 8, term: { year: 2025, number: 1 } },
        { courseCode: 'ZZ104', courseName: 'Môn tự động điền', credits: 4, result: 'in_progress', grade: null, term: { year: 2025, number: 2 } },
      ],
    });
    expect(w.find('[data-test="diff-summary"]').exists()).toBe(false);
  });

  it('cancels unsaved edits and restores the last saved snapshot (UC-02, TC-B2-TRN-01)', async () => {
    const { w } = await render();
    expect(w.find('[data-test="cancel-edits"]').exists()).toBe(false);

    await row(w, 0).get('button[aria-label="Xóa dòng 1 (ZZ101)"]').trigger('click');
    await w.get('#add-row').trigger('click');
    await flushPromises();
    expect(summary(w)).toBe('2 dòng · 1 dòng cần sửa');
    expect(w.get('[data-test="diff-summary"]').text()).toBe('+1 thêm / ~0 sửa / -1 xóa');

    await w.get('[data-test="cancel-edits"]').trigger('click');
    await flushPromises();
    expect(w.findAll('tbody tr')).toHaveLength(2);
    expect((row(w, 0).get('input.code-input').element as HTMLInputElement).value).toBe('ZZ101');
    expect((row(w, 1).get('input.code-input').element as HTMLInputElement).value).toBe('ZZ102');
    expect(summary(w)).toBe('2 dòng · chưa có thay đổi');
    expect(w.find('[data-test="cancel-edits"]').exists()).toBe(false);
    expect(w.find('[data-test="diff-summary"]').exists()).toBe(false);
    expect(saveButton(w).attributes('disabled')).toBeDefined();
  });

  it('auto-fills course name and credits on a blank row and flags valid codes outside the curriculum without blocking save (UC-02 step 5, A4)', async () => {
    const { w } = await render();
    expect(row(w, 0).find('[data-test="not-in-curriculum"]').exists()).toBe(false);

    await w.get('#add-row').trigger('click');
    await flushPromises();
    const added = row(w, 2);
    await added.get('input.code-input').setValue('zz104');
    await flushPromises();

    expect((added.get(`input[aria-label^="Tên môn"]`).element as HTMLInputElement).value).toBe('Môn tự động điền');
    expect((added.get('input[inputmode="numeric"]').element as HTMLInputElement).value).toBe('4');
    expect(added.find('[data-test="not-in-curriculum"]').exists()).toBe(false);

    await added.get('input.code-input').setValue('ZZ999');
    await added.get(`input[aria-label^="Tên môn"]`).setValue('Môn tự do ngoài CTĐT');
    await added.get('input[inputmode="numeric"]').setValue('3');
    await chooseOption(added.findAll('[role="combobox"]')[1]!, 'Đạt');
    await flushPromises();

    expect(added.get('[data-test="not-in-curriculum"]').text()).toBe(TRANSCRIPT_MESSAGES.vi.notInCurriculum);
    expect(added.get('[data-test="check"]').text()).toBe(TRANSCRIPT_MESSAGES.vi.ok);
    expect(saveButton(w).attributes('disabled')).toBeUndefined();
  });

  it('fails silently when the curriculum endpoint is unavailable', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render({ 'GET /programs/APCS/curricula/2024': status(503) });
    expect(consoleError).not.toHaveBeenCalled();
    expect(w.findAll('tbody tr')).toHaveLength(2);
    expect(row(w, 0).find('[data-test="not-in-curriculum"]').exists()).toBe(false);
  });
});
