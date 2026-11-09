import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView, type Router } from 'vue-router';
import { useAuth } from '../auth/store.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import type { TranscriptRow } from './api.js';

// Synthetic rows only (AGENTS.md hard rule 3).
const SAVED: TranscriptRow[] = [
  { courseCode: 'ZZ101', courseName: 'Môn thử một', credits: 4, result: 'graded', grade: 8.5, term: { year: 2024, number: 1 } },
  { courseCode: 'ZZ102', courseName: 'Môn thử hai', credits: 3, result: 'in_progress', grade: null, term: { year: 2025, number: 1 } },
];

let wrapper: VueWrapper | undefined;
let router: Router;

async function render(routes: Record<string, unknown> = {}) {
  const fetch = mockApi({ 'GET /users/me/transcript': { rows: SAVED }, ...routes });
  const app = await setup('/transcript');
  router = app.router;
  // Through RouterView, as the app shows it, so the page's leave guard is registered.
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
    expect(row(w, 1).text()).toContain('Không có điểm');
    expect(row(w, 0).get('[data-test="check"]').text()).toBe('Hợp lệ');
    expect(summary(w)).toBe('2 dòng · chưa có thay đổi');
    expect(saveButton(w).attributes('disabled')).toBeDefined();
  });

  it('blocks the save on an incomplete row and says what to fix in words (A2)', async () => {
    const { w } = await render();
    await w.get('#add-row').trigger('click');
    await flushPromises();
    expect(document.activeElement).toBe(row(w, 2).get('input.code-input').element);
    expect(summary(w)).toBe('3 dòng · 1 dòng cần sửa');
    expect(row(w, 2).classes()).toContain('err');
    expect(row(w, 2).get('[data-test="check"]').text()).toBe('Cần sửa');
    expect(w.get('[data-test="problems-2"]').text()).toBe('Cần sửa: mã môn (2–20 chữ hoặc số), tên môn, số TC (0–30), kết quả');
    const code = row(w, 2).get('input.code-input');
    expect(code.attributes('aria-invalid')).toBe('true');
    // The words under the row describe each field it names, so a screen reader hears what to fix.
    expect(document.getElementById(code.attributes('aria-describedby')!)?.textContent?.trim()).toBe(w.get('[data-test="problems-2"]').text());
    expect(row(w, 2).find('select').attributes('aria-describedby')).toBeUndefined();
    expect(saveButton(w).attributes('disabled')).toBeDefined();

    await row(w, 2).get('input.code-input').setValue('zz103');
    await row(w, 2).findAll('input')[1]!.setValue('Môn thử ba');
    await row(w, 2).get('input[inputmode="numeric"]').setValue('2');
    await row(w, 2).findAll('select')[1]!.setValue('graded');
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
    await row(w, 1).findAll('select')[1]!.setValue('pass');
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
    const term = row(w, 0).get('select');
    expect(term.attributes('aria-label')).toBe('Học kỳ, dòng 1 (ZZ101)');
    expect((term.element as HTMLSelectElement).selectedOptions[0]!.text).toBe('HK1 2024–2025');
    await term.setValue('2023-3');
    // Term 3 is a main term in APCS, not summer (ADR 0009, amended 9 November 2026).
    expect((term.element as HTMLSelectElement).selectedOptions[0]!.text).toBe('HK3 2023–2024');
    await saveButton(w).trigger('click');
    await flushPromises();
    const put = fetch.mock.calls.find(([, init]) => init?.method === 'PUT')!;
    expect((sentBody(put[1]) as { rows: TranscriptRow[] }).rows[0]!.term).toEqual({ year: 2023, number: 3 });
  });

  it('removes a row from the draft only', async () => {
    const { w, fetch } = await render();
    await row(w, 0).get('button[aria-label="Xóa dòng 1 (ZZ101)"]').trigger('click');
    await flushPromises();
    expect(w.findAll('tbody tr')).toHaveLength(1);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(useToast().message).toBe('Đã bỏ dòng 1 (ZZ101) khỏi bảng. Bảng điểm đã lưu chỉ đổi khi bạn bấm lưu.');
    expect(document.activeElement?.id).toBe('add-row');
    expect(saveButton(w).attributes('disabled')).toBeUndefined();
  });

  it('says nothing was saved when the API refuses a row (400), and keeps the rows', async () => {
    const { w } = await render({ 'PUT /users/me/transcript': status(400, { message: ['rows.0.courseCode must be 2–20 letters or digits'] }) });
    await row(w, 0).findAll('input')[1]!.setValue('Môn thử một (sửa)');
    await saveButton(w).trigger('click');
    await flushPromises();
    expect(w.get('[data-test="save-error"]').text()).toBe('Máy chủ từ chối một dòng chưa hợp lệ. Chưa lưu gì; hãy kiểm tra lại bảng.');
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
    expect(w.text()).toContain('Chưa có môn nào. Thêm dòng đầu tiên để bắt đầu.');
    expect(summary(w)).toBe('0 dòng · chưa có thay đổi');
  });

  it('says plainly that no PDF reader exists yet, so rows are entered by hand', async () => {
    const { w } = await render();
    expect(w.text()).toContain('Chưa đọc được file PDF.');
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
});
