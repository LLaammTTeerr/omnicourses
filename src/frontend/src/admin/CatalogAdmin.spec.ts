import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView } from 'vue-router';
import type { CourseDetail } from '../curriculum/api.js';
import { useLocale } from '../locale.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import type { UserGrants } from './api.js';
import { useAdminAccess } from './store.js';
import { AFFECTED_2024, AFFECTED_2025, CATALOG_MAINTAINER, catalogCourse, NO_GRANTS, SHARED_COURSE } from './testing/fixtures.js';

const NOT_FOUND = status(404, { statusCode: 404, message: 'No course has this code', error: 'Not Found' });
const lost = () => {
  throw new TypeError('Failed to fetch');
};
const impact = (code: 'impact_confirmation_required' | 'impact_changed', affectedCurricula: unknown[], reviewVersion: string) =>
  Response.json({ statusCode: 409, code, message: 'x', affectedCurricula, reviewVersion }, { status: 409 });

let wrapper: VueWrapper | undefined;
let saved: Record<string, CourseDetail>;
let own: UserGrants;
const read = (code: string) => [`GET /courses/${code}`, () => (saved[code] ? Response.json(saved[code]) : NOT_FOUND())] as const;

async function render(routes: Record<string, unknown> = {}) {
  const fetch = mockApi({ 'GET /admin/grants': () => Response.json(own), ...Object.fromEntries(['ZZ101', 'ZZ200', 'ZZ999'].map(read)), ...routes });
  const app = await setup('/admin/catalog');
  wrapper = mount(RouterView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch, ...app };
}

type Scope = Pick<DOMWrapper<Element>, 'get'>;
const get = (w: Scope, test: string) => w.get(`[data-test="${test}"]`);
const has = (w: VueWrapper, test: string) => w.find(`[data-test="${test}"]`).exists();
const value = (w: Scope, test: string) => (get(w, test).element as HTMLInputElement).value;
const problem = (w: VueWrapper) => w.get('dialog[open] [data-test="admin-problem"]');
const calls = (fetch: ReturnType<typeof mockApi>, method: string) => fetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);
const writes = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') !== 'GET');
const pathOf = (call: readonly unknown[]) => String(call[0]).split('/api')[1];

async function find(w: VueWrapper, code: string) {
  await get(w, 'catalog-code').setValue(code);
  await w.get('.admin-tools form').trigger('submit');
  await flushPromises();
}
async function open(w: VueWrapper, test: string) {
  const button = get(w, test);
  (button.element as HTMLElement).focus();
  await button.trigger('click');
  await flushPromises();
  return w.get('dialog[open]');
}
const submit = async (w: VueWrapper) => {
  await w.get('dialog[open] form').trigger('submit');
  await flushPromises();
};
const press = async (w: VueWrapper, test: string) => {
  await get(w.get('dialog[open]'), test).trigger('click');
  await flushPromises();
};

describe('CatalogAdmin (F12, UC-11 A8): the shared course catalog of a catalog maintainer', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    saved = { ZZ101: SHARED_COURSE, ZZ200: catalogCourse('ZZ200') };
    own = CATALOG_MAINTAINER;
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('opens a course by its exact code, written as the catalog stores codes, with the curricula that use it', async () => {
    const { w, fetch } = await render();
    expect(w.get('[data-test="admin-tabs"]').findAll('a').map((a) => a.text())).toEqual(['Danh mục học phần', 'Nhập CSV']);
    expect(w.get('#catalog-admin-title').text()).toBe('Danh mục học phần dùng chung');
    expect(get(w, 'catalog-find').attributes('disabled')).toBeDefined();
    await find(w, ' zz101 ');
    expect(fetch.mock.calls.map(pathOf)).toEqual(['/admin/grants', '/courses/ZZ101']);
    const course = get(w, 'catalog-course');
    expect(course.attributes('data-course')).toBe('ZZ101');
    expect(get(course, 'catalog-name').text()).toBe('Học phần thử ZZ101');
    expect(get(course, 'catalog-name-en').text()).toBe('Test course ZZ101');
    expect(course.findAll('.catalog-facts > div').map((fact) => fact.text())).toEqual(['Tín chỉ4', 'Tiết lý thuyết (LT)45', 'Tiết thực hành (TH)30', 'Tiết bài tập (BT)Để trống', 'Tiết đồ án (ĐT)0']);
    expect(course.findAll('[data-test="catalog-membership"]').map((li) => li.text())).toEqual(['ZZPROG · Khóa 2024 · Kiến thức cơ sở thử', 'ZZPROG · Khóa 2025 · Nhóm thử khóa 2025']);
    await find(w, 'ZZ200');
    expect(get(w, 'catalog-unused').text()).toBe('Chưa có chương trình đào tạo nào dùng học phần này.');
  });

  it('says when the catalog has no course with the code, and starts a new course from it', async () => {
    const { w } = await render();
    await find(w, 'zz999');
    expect(get(w, 'catalog-not-found').text()).toBe('Danh mục không có học phần mang mã ZZ999. Bấm “Thêm học phần” để tạo học phần mới với mã này.');
    expect(has(w, 'catalog-course')).toBe(false);
    const dialog = await open(w, 'catalog-add');
    expect(dialog.get('h2').text()).toBe('Học phần mới');
    expect(value(dialog, 'course-code')).toBe('ZZ999');
    expect(get(dialog, 'course-code').attributes('readonly')).toBeUndefined();
  });

  it('creates a course with what was typed, and shows the course the API created', async () => {
    const created = catalogCourse('ZZ300', { nameVi: 'Môn thử mới', nameEn: null, credits: 3, theoryPeriods: 30, labPeriods: 0, exercisePeriods: 0, projectPeriods: 0 });
    const { w, fetch } = await render({
      'POST /admin/catalog/courses': () => {
        saved.ZZ300 = created;
        const { memberships: _memberships, ...body } = created;
        return Response.json(body, { status: 201 });
      },
      ...Object.fromEntries([read('ZZ300')]),
    });
    const dialog = await open(w, 'catalog-add');
    await get(dialog, 'course-code').setValue(' zz300 ');
    await get(dialog, 'course-nameVi').setValue(' Môn thử mới ');
    await get(dialog, 'course-credits').setValue('3');
    await get(dialog, 'course-theoryPeriods').setValue('30');
    await submit(w);
    expect(sentBody(calls(fetch, 'POST')[0]![1])).toEqual({ code: ' zz300 ', nameVi: ' Môn thử mới ', nameEn: null, credits: 3, theoryPeriods: 30 });
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(useToast().message).toBe('Đã thêm học phần ZZ300 vào danh mục.');
    expect(get(w, 'catalog-course').attributes('data-course')).toBe('ZZ300');
    expect(get(w, 'catalog-name').text()).toBe('Môn thử mới');
    expect(value(w, 'catalog-code')).toBe('ZZ300');
  });

  it('sends a value it cannot read as a number as the text typed, and shows the API\'s refusal under each field (UC-11 A3)', async () => {
    const { w, fetch } = await render({
      'POST /admin/catalog/courses': status(400, {
        statusCode: 400,
        code: 'validation_failed',
        message: ['code: "Z" is not a course code (letters A-Z and digits, 2 to 20)', 'nameVi should not be empty', 'credits must not be less than 1', 'credits must be an integer number', 'labPeriods must be an integer number'],
      }),
    });
    const dialog = await open(w, 'catalog-add');
    await get(dialog, 'course-code').setValue('Z');
    await get(dialog, 'course-credits').setValue('ba');
    await get(dialog, 'course-labPeriods').setValue('1.5');
    await submit(w);
    expect(sentBody(calls(fetch, 'POST')[0]![1])).toEqual({ code: 'Z', nameVi: '', nameEn: null, credits: 'ba', labPeriods: 1.5 });
    expect(problem(w).attributes('data-code')).toBe('validation_failed');
    expect(problem(w).findAll('li')).toHaveLength(0);
    expect(dialog.findAll('[data-test="field-error"]').map((error) => [error.attributes('id'), error.findAll('span').map((line) => line.text())])).toEqual([
      ['course-code-error', ['code: "Z" is not a course code (letters A-Z and digits, 2 to 20)']],
      ['course-nameVi-error', ['nameVi should not be empty']],
      ['course-credits-error', ['credits must not be less than 1', 'credits must be an integer number']],
      ['course-labPeriods-error', ['labPeriods must be an integer number']],
    ]);
    expect(get(dialog, 'course-credits').attributes('aria-invalid')).toBe('true');
    expect(get(dialog, 'course-credits').attributes('aria-describedby')).toBe('course-credits-error');
    expect(get(dialog, 'course-labPeriods').attributes('aria-describedby')).toBe('course-periods-hint course-labPeriods-error');
    expect(value(dialog, 'course-credits')).toBe('ba');
  });

  it('says a duplicate code and a missing catalog permission in words', async () => {
    let answer = status(409, { statusCode: 409, code: 'duplicate_code', message: 'The catalog already has ZZ101' });
    const { w } = await render({ 'POST /admin/catalog/courses': () => answer() });
    await open(w, 'catalog-add');
    await submit(w);
    expect(problem(w).attributes('data-code')).toBe('duplicate_code');
    expect(problem(w).text()).toBe('Danh mục đã có học phần mang mã này. Chưa lưu gì.');
    answer = status(403, { statusCode: 403, code: 'permission_required', permission: 'catalog_maintainer', message: 'This needs the catalog_maintainer permission' });
    await submit(w);
    expect(problem(w).attributes('data-code')).toBe('permission_required');
    expect(problem(w).text()).toBe('Thao tác này cần quyền “Quản lý danh mục học phần”. Tài khoản của bạn không có quyền đó. Chưa lưu gì.');
  });

  it('corrects a course no curriculum links at once, sending only what changed', async () => {
    const { w, fetch } = await render({
      'PATCH /admin/catalog/courses/ZZ200': (init: RequestInit) => {
        saved.ZZ200 = { ...saved.ZZ200!, ...(sentBody(init) as object) };
        const { memberships: _memberships, ...body } = saved.ZZ200;
        return Response.json(body);
      },
    });
    await find(w, 'ZZ200');
    const dialog = await open(w, 'catalog-edit');
    expect(dialog.get('h2').text()).toBe('Sửa học phần ZZ200');
    expect(has(w, 'shared-warning')).toBe(false);
    expect(get(dialog, 'course-code').attributes('readonly')).toBeDefined();
    expect([value(dialog, 'course-nameVi'), value(dialog, 'course-credits'), value(dialog, 'course-exercisePeriods'), value(dialog, 'course-projectPeriods')]).toEqual(['Học phần thử ZZ200', '4', '', '0']);
    await get(dialog, 'course-credits').setValue('3');
    await get(dialog, 'course-nameEn').setValue('Test course ZZ200');
    await submit(w);
    expect(sentBody(calls(fetch, 'PATCH')[0]![1])).toEqual({ nameEn: 'Test course ZZ200', credits: 3 });
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(useToast().message).toBe('Đã lưu học phần ZZ200.');
    expect(get(w, 'catalog-credits').text()).toBe('Tín chỉ3');
    expect(document.activeElement).toBe(get(w, 'catalog-edit').element);
  });

  it('never turns a typing mistake into an emptied value: only an emptied box sends null', async () => {
    const { w, fetch } = await render({ 'PATCH /admin/catalog/courses/ZZ200': status(400, { statusCode: 400, code: 'validation_failed', message: ['theoryPeriods must be an integer number'] }) });
    await find(w, 'ZZ200');
    const dialog = await open(w, 'catalog-edit');
    await get(dialog, 'course-theoryPeriods').setValue('4o');
    await get(dialog, 'course-labPeriods').setValue('');
    await submit(w);
    expect(sentBody(calls(fetch, 'PATCH')[0]![1])).toEqual({ theoryPeriods: '4o', labPeriods: null });
    expect(dialog.get('#course-theoryPeriods-error').text()).toBe('theoryPeriods must be an integer number');
  });

  it('sends nothing when the form is saved unchanged, and nothing on Cancel (UC-11 A6)', async () => {
    const { w, fetch } = await render();
    await find(w, 'ZZ200');
    await open(w, 'catalog-edit');
    await submit(w);
    expect(useToast().message).toBe('Không có gì thay đổi, nên chưa gửi gì.');
    const dialog = await open(w, 'catalog-edit');
    await get(dialog, 'course-credits').setValue('9');
    await press(w, 'dialog-cancel');
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(writes(fetch)).toEqual([]);
    expect(get(w, 'catalog-credits').text()).toBe('Tín chỉ4');
    expect(value(await open(w, 'catalog-edit'), 'course-credits')).toBe('4');
  });

  describe('the shared-impact review of a course that curricula link', () => {
    const PATCH = 'PATCH /admin/catalog/courses/ZZ101';
    const startEdit = async (w: VueWrapper) => {
      await find(w, 'ZZ101');
      const dialog = await open(w, 'catalog-edit');
      await get(dialog, 'course-credits').setValue('3');
      await get(dialog, 'course-nameVi').setValue('Học phần thử ZZ101 (sửa)');
      await submit(w);
      return dialog;
    };

    it('warns in the form, then shows the affected curricula and the values before anything is saved, and saves once confirmed', async () => {
      const { w, fetch } = await render({
        [PATCH]: (init: RequestInit) => {
          const body = sentBody(init) as Record<string, unknown>;
          if (body.confirmImpact !== 'zz-review-1') return impact('impact_confirmation_required', [AFFECTED_2024, AFFECTED_2025], 'zz-review-1');
          saved.ZZ101 = { ...SHARED_COURSE, credits: 3, nameVi: 'Học phần thử ZZ101 (sửa)' };
          return Response.json({ ...saved.ZZ101, memberships: undefined });
        },
      });
      await find(w, 'ZZ101');
      let dialog = await open(w, 'catalog-edit');
      expect(get(dialog, 'shared-warning').text()).toContain('Sửa ở đây đổi mọi chương trình đào tạo dùng học phần này');
      expect(get(dialog, 'shared-warning').text()).toContain('Đang dùng: ZZPROG2024, ZZPROG2025.');
      await press(w, 'dialog-cancel');

      dialog = await startEdit(w);
      expect(sentBody(calls(fetch, 'PATCH')[0]![1])).toEqual({ nameVi: 'Học phần thử ZZ101 (sửa)', credits: 3 });
      const review = get(dialog, 'impact-review');
      expect(dialog.get('h2').text()).toBe('Xem lại ảnh hưởng trước khi lưu');
      expect(review.text()).toContain('sẽ đọc giá trị mới');
      expect(review.findAll('[data-test="impact-change"]').map((row) => row.findAll('th, td').map((cell) => cell.text()))).toEqual([
        ['Tên tiếng Việt', 'Học phần thử ZZ101', 'Học phần thử ZZ101 (sửa)'],
        ['Tín chỉ', '4', '3'],
      ]);
      expect(get(review, 'impact-count').text()).toBe('2 chương trình đào tạo bị ảnh hưởng');
      expect(review.findAll('[data-test="impact-curriculum"]').map((li) => li.text())).toEqual(['ZZPROG · Khóa 2024 (ZZPROG2024)', 'ZZPROG · Khóa 2025 (ZZPROG2025)']);
      expect(w.find('dialog[open] [data-test="impact-changed"]').exists()).toBe(false);
      expect(get(w, 'catalog-credits').text()).toBe('Tín chỉ4');
      expect(useToast().message).toBe('');

      await press(w, 'impact-confirm');
      expect(sentBody(calls(fetch, 'PATCH')[1]![1])).toEqual({ nameVi: 'Học phần thử ZZ101 (sửa)', credits: 3, confirmImpact: 'zz-review-1' });
      expect(w.find('dialog[open]').exists()).toBe(false);
      expect(useToast().message).toBe('Đã lưu học phần ZZ101.');
      expect(get(w, 'catalog-credits').text()).toBe('Tín chỉ3');
      expect(get(w, 'catalog-name').text()).toBe('Học phần thử ZZ101 (sửa)');
    });

    it('shows the new list and asks again when the impact changed during the review (409 impact_changed)', async () => {
      const { w, fetch } = await render({
        [PATCH]: (init: RequestInit) => {
          const body = sentBody(init) as Record<string, unknown>;
          if (body.confirmImpact === undefined) return impact('impact_confirmation_required', [AFFECTED_2024, AFFECTED_2025], 'zz-review-1');
          if (body.confirmImpact === 'zz-review-1') {
            saved.ZZ101 = { ...SHARED_COURSE, nameEn: 'Test course ZZ101 (new)', memberships: [SHARED_COURSE.memberships[0]!] };
            return impact('impact_changed', [AFFECTED_2024], 'zz-review-2');
          }
          saved.ZZ101 = { ...saved.ZZ101!, credits: 3, nameVi: 'Học phần thử ZZ101 (sửa)' };
          return Response.json({ ...saved.ZZ101, memberships: undefined });
        },
      });
      const dialog = await startEdit(w);
      const reads = calls(fetch, 'GET').length;
      await press(w, 'impact-confirm');

      expect(get(dialog, 'impact-changed').text()).toBe(
        'Giá trị của học phần, hoặc danh sách chương trình đào tạo dùng nó, đã đổi từ lúc bạn xem. Chưa lưu gì. Xem lại danh sách mới rồi xác nhận lần nữa.',
      );
      expect(get(dialog, 'impact-changed').attributes('role')).toBe('alert');
      expect(get(dialog, 'impact-count').text()).toBe('1 chương trình đào tạo bị ảnh hưởng');
      expect(dialog.findAll('[data-test="impact-curriculum"]').map((li) => li.attributes('data-curriculum'))).toEqual(['ZZPROG2024']);
      expect(calls(fetch, 'GET').length).toBe(reads + 1);
      expect(get(w, 'catalog-name-en').text()).toBe('Test course ZZ101 (new)');
      expect(get(w, 'catalog-credits').text()).toBe('Tín chỉ4');
      expect(useToast().message).toBe('');

      await press(w, 'impact-confirm');
      expect(calls(fetch, 'PATCH').map(([, init]) => (sentBody(init) as Record<string, unknown>).confirmImpact)).toEqual([undefined, 'zz-review-1', 'zz-review-2']);
      expect(calls(fetch, 'PATCH').map(([, init]) => ({ ...(sentBody(init) as object), confirmImpact: undefined }))).toEqual(Array(3).fill({ nameVi: 'Học phần thử ZZ101 (sửa)', credits: 3 }));
      expect(w.find('dialog[open]').exists()).toBe(false);
      expect(get(w, 'catalog-credits').text()).toBe('Tín chỉ3');
    });

    it('moves the focus to the review when it opens, and back into the form on "Back", so it is announced', async () => {
      const { w } = await render({ [PATCH]: () => impact('impact_confirmation_required', [AFFECTED_2024, AFFECTED_2025], 'zz-review-1') });
      const dialog = await startEdit(w);
      expect(document.activeElement).toBe(dialog.get('#course-dialog-title').element);
      expect(dialog.get('#course-dialog-title').attributes('tabindex')).toBe('-1');
      expect(document.activeElement?.textContent).toBe('Xem lại ảnh hưởng trước khi lưu');
      await press(w, 'impact-back');
      expect(document.activeElement).toBe(get(dialog, 'course-nameVi').element);
    });

    it('brings the form up to date after the course changed during the review, so "Back" and Save do not undo the other change', async () => {
      const { w, fetch } = await render({
        [PATCH]: (init: RequestInit) => {
          const body = sentBody(init) as Record<string, unknown>;
          if (body.confirmImpact === undefined) return impact('impact_confirmation_required', [AFFECTED_2024, AFFECTED_2025], 'zz-review-' + calls(fetch, 'PATCH').length);
          if (body.confirmImpact === 'zz-review-1') {
            saved.ZZ101 = { ...SHARED_COURSE, nameEn: 'Test course ZZ101 (new)', labPeriods: 15 };
            return impact('impact_changed', [AFFECTED_2024, AFFECTED_2025], 'zz-review-changed');
          }
          return impact('impact_changed', [AFFECTED_2024, AFFECTED_2025], 'zz-review-changed');
        },
      });
      const dialog = await startEdit(w);
      expect(dialog.find('[data-test="course-rebased"]').exists()).toBe(false);
      await press(w, 'impact-confirm');
      expect(dialog.find('[data-test="impact-changed"]').exists()).toBe(true);
      await press(w, 'impact-back');
      expect([value(dialog, 'course-nameEn'), value(dialog, 'course-labPeriods')]).toEqual(['Test course ZZ101 (new)', '15']);
      expect([value(dialog, 'course-nameVi'), value(dialog, 'course-credits')]).toEqual(['Học phần thử ZZ101 (sửa)', '3']);
      expect(get(dialog, 'course-rebased').text()).toBe('Học phần này đã được sửa ở nơi khác trong lúc bạn xem lại. Các ô bạn chưa sửa đã được cập nhật theo giá trị hiện tại.');
      await submit(w);
      expect(sentBody(calls(fetch, 'PATCH').at(-1)![1])).toEqual({ nameVi: 'Học phần thử ZZ101 (sửa)', credits: 3 });
    });

    it('confirms nothing on Cancel, and goes back to the form with what was typed', async () => {
      const { w, fetch } = await render({ [PATCH]: () => impact('impact_confirmation_required', [AFFECTED_2024, AFFECTED_2025], 'zz-review-1') });
      const dialog = await startEdit(w);
      await press(w, 'impact-back');
      expect(dialog.find('[data-test="impact-review"]').exists()).toBe(false);
      expect([value(dialog, 'course-nameVi'), value(dialog, 'course-credits')]).toEqual(['Học phần thử ZZ101 (sửa)', '3']);
      await submit(w);
      expect(dialog.find('[data-test="impact-review"]').exists()).toBe(true);
      await press(w, 'dialog-cancel');
      expect(w.find('dialog[open]').exists()).toBe(false);
      expect(calls(fetch, 'PATCH').every(([, init]) => (sentBody(init) as Record<string, unknown>).confirmImpact === undefined)).toBe(true);
      expect(get(w, 'catalog-credits').text()).toBe('Tín chỉ4');
      expect(useToast().message).toBe('');
    });

    it('settles a confirmation whose answer is lost from the saved course (UC-11 A7)', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      let commit = false;
      const { w, fetch } = await render({
        [PATCH]: (init: RequestInit) => {
          if ((sentBody(init) as Record<string, unknown>).confirmImpact === undefined) return impact('impact_confirmation_required', [AFFECTED_2024, AFFECTED_2025], 'zz-review-1');
          if (commit) saved.ZZ101 = { ...SHARED_COURSE, credits: 3, nameVi: 'Học phần thử ZZ101 (sửa)' };
          return lost();
        },
      });
      await startEdit(w);
      await press(w, 'impact-confirm');
      expect(problem(w).attributes('data-code')).toBe('not_applied');
      expect(w.find('dialog[open] [data-test="impact-review"]').exists()).toBe(true);
      expect(useToast().message).toBe('');

      commit = true;
      await press(w, 'impact-confirm');
      expect(calls(fetch, 'PATCH')).toHaveLength(3);
      expect(w.find('dialog[open]').exists()).toBe(false);
      expect(get(w, 'admin-notice').text()).toBe('Máy chủ không trả lời yêu cầu lưu, nên OmniCourse đã tải lại dữ liệu đã lưu. Dữ liệu đã lưu có thay đổi này.');
      expect(useToast().message).toBe('');
      expect(get(w, 'catalog-credits').text()).toBe('Tín chỉ3');
    });
  });

  it('deletes a course after asking, and says what still uses it when the API refuses (UC-11 A5)', async () => {
    const { w, fetch } = await render({
      'DELETE /admin/catalog/courses/ZZ101': status(409, {
        statusCode: 409,
        code: 'referenced_item',
        message: 'ZZ101 is still referenced',
        references: ['linked in ZZPROG2024', 'linked in ZZPROG2025', '1 curricula record its prerequisites', '2 courses require it', '3 offering-term rows name it', '4 transcript rows name it', '1 saved plans place it'],
      }),
      'DELETE /admin/catalog/courses/ZZ200': () => {
        delete saved.ZZ200;
        return new Response(null, { status: 204 });
      },
    });
    await find(w, 'ZZ101');
    const dialog = await open(w, 'catalog-delete');
    expect(dialog.attributes('role')).toBe('alertdialog');
    expect(dialog.get('h2').text()).toBe('Xóa học phần ZZ101?');
    expect(writes(fetch)).toEqual([]);
    await press(w, 'confirm-yes');
    expect(problem(w).attributes('data-code')).toBe('referenced_item');
    expect(problem(w).findAll('li').map((li) => li.text())).toEqual([
      'chương trình đào tạo ZZPROG2024 còn dùng học phần này',
      'chương trình đào tạo ZZPROG2025 còn dùng học phần này',
      '1 chương trình đào tạo đã ghi nhận tiên quyết của học phần này',
      '2 học phần cần học phần này làm tiên quyết',
      '3 dòng kỳ mở ghi học phần này',
      '4 dòng bảng điểm ghi học phần này',
      '1 vị trí trong lộ trình đã lưu đặt học phần này',
    ]);
    await press(w, 'confirm-no');
    expect(has(w, 'catalog-course')).toBe(true);

    await find(w, 'ZZ200');
    await open(w, 'catalog-delete');
    await press(w, 'confirm-yes');
    expect(calls(fetch, 'DELETE').map(pathOf)).toEqual(['/admin/catalog/courses/ZZ101', '/admin/catalog/courses/ZZ200']);
    expect(has(w, 'catalog-course')).toBe(false);
    expect(useToast().message).toBe('Đã xóa học phần ZZ200 khỏi danh mục.');
    expect(document.activeElement?.id).toBe('catalog-code');
  });

  it('never says a course is added or deleted on a lost answer before it has read the catalog again (UC-11 A7)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let offline = false;
    const { w, fetch } = await render({
      'POST /admin/catalog/courses': lost,
      'GET /courses/ZZ300': () => (offline ? lost() : saved.ZZ300 ? Response.json(saved.ZZ300) : NOT_FOUND()),
      'DELETE /admin/catalog/courses/ZZ200': () => {
        delete saved.ZZ200;
        return lost();
      },
    });
    await find(w, 'ZZ200');
    const dialog = await open(w, 'catalog-add');
    await get(dialog, 'course-code').setValue('ZZ300');
    await get(dialog, 'course-nameVi').setValue('Môn thử mới');
    await get(dialog, 'course-credits').setValue('3');
    await submit(w);
    expect(problem(w).attributes('data-code')).toBe('not_applied');
    expect(calls(fetch, 'POST')).toHaveLength(1);

    offline = true;
    await submit(w);
    expect(problem(w).attributes('data-code')).toBe('unknown');
    expect(problem(w).text()).toContain('Chưa rõ thay đổi đã được lưu hay chưa.');
    expect(useToast().message).toBe('');

    offline = false;
    await press(w, 'admin-reload');
    expect(calls(fetch, 'GET').map(pathOf).at(-1)).toBe('/courses/ZZ300');
    expect(problem(w).attributes('data-code')).toBe('not_applied');
    expect(calls(fetch, 'POST')).toHaveLength(2);

    offline = true;
    await submit(w);
    expect(problem(w).attributes('data-code')).toBe('unknown');
    saved.ZZ300 = catalogCourse('ZZ300', { nameVi: 'Môn thử mới', credits: 3 });
    offline = false;
    await press(w, 'admin-reload');
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(get(w, 'admin-notice').text()).toContain('Dữ liệu đã lưu có thay đổi này.');
    expect(get(w, 'catalog-course').attributes('data-course')).toBe('ZZ300');
    expect(value(w, 'catalog-code')).toBe('ZZ300');
    expect(calls(fetch, 'POST')).toHaveLength(3);
    expect(useToast().message).toBe('');

    await find(w, 'ZZ200');
    await open(w, 'catalog-delete');
    await press(w, 'confirm-yes');
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(get(w, 'admin-notice').text()).toContain('Dữ liệu đã lưu có thay đổi này.');
    expect(has(w, 'catalog-course')).toBe(false);
    expect(useToast().message).toBe('');
  });

  it('keeps the new-course form, its draft and the refusal on screen when the catalog permission was revoked meanwhile (UC-11 A4)', async () => {
    const { w, pinia } = await render({
      'POST /admin/catalog/courses': () => {
        own = NO_GRANTS;
        return Response.json({ statusCode: 403, code: 'permission_required', permission: 'catalog_maintainer', message: 'x' }, { status: 403 });
      },
    });
    const dialog = await open(w, 'catalog-add');
    await get(dialog, 'course-code').setValue('ZZ300');
    await get(dialog, 'course-nameVi').setValue('Môn đang nhập dở');
    await submit(w);
    await flushPromises();
    expect(useAdminAccess(pinia).any).toBe(false);
    expect(problem(w).text()).toBe('Thao tác này cần quyền “Quản lý danh mục học phần”. Tài khoản của bạn không có quyền đó. Chưa lưu gì.');
    expect(value(w.get('dialog[open]'), 'course-nameVi')).toBe('Môn đang nhập dở');
    expect(has(w, 'admin-no-permission')).toBe(false);
    await press(w, 'dialog-cancel');
    expect(get(w, 'admin-refused').text()).toContain('“Quản lý danh mục học phần”');
    expect(has(w, 'catalog-add')).toBe(true);
  });

  it('warns after Cancel on an unknown outcome, and reads the course of that write before another write', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let offline = false;
    const { w, fetch } = await render({
      'POST /admin/catalog/courses': () => {
        saved.ZZ300 = catalogCourse('ZZ300', { nameVi: 'Môn thử mới', credits: 3 });
        offline = true;
        return lost();
      },
      'GET /courses/ZZ300': () => (offline ? lost() : Response.json(saved.ZZ300)),
    });
    await find(w, 'ZZ200');
    const dialog = await open(w, 'catalog-add');
    await get(dialog, 'course-code').setValue('ZZ300');
    await get(dialog, 'course-nameVi').setValue('Môn thử mới');
    await get(dialog, 'course-credits').setValue('3');
    await submit(w);
    expect(problem(w).attributes('data-code')).toBe('unknown');
    expect(get(dialog, 'dialog-save').attributes('disabled')).toBeDefined();
    await press(w, 'dialog-cancel');
    expect(get(w, 'catalog-stale').text()).toContain('Những gì đang hiện có thể đã cũ.');
    for (const control of ['catalog-add', 'catalog-edit', 'catalog-delete']) expect(get(w, control).attributes('disabled'), control).toBeDefined();

    offline = false;
    await get(w, 'catalog-reload').trigger('click');
    await flushPromises();
    expect(calls(fetch, 'GET').map(pathOf).at(-1)).toBe('/courses/ZZ300');
    expect(has(w, 'catalog-stale')).toBe(false);
    expect(get(w, 'catalog-course').attributes('data-course')).toBe('ZZ300');
    expect(get(w, 'catalog-add').attributes('disabled')).toBeUndefined();
    expect(calls(fetch, 'POST')).toHaveLength(1);
  });

  it('stays on the page while a write is out', async () => {
    let answer!: (response: Response) => void;
    const { w, router } = await render({ 'DELETE /admin/catalog/courses/ZZ200': () => new Promise<Response>((resolve) => (answer = resolve)) });
    await find(w, 'ZZ200');
    await open(w, 'catalog-delete');
    await press(w, 'confirm-yes');
    await router.push('/admin/access').catch(() => {});
    expect(router.currentRoute.value.name).toBe('admin-catalog');
    answer(new Response(null, { status: 204 }));
    await flushPromises();
    expect(useToast().message).toBe('Đã xóa học phần ZZ200 khỏi danh mục.');
    await router.push('/admin/access');
    expect(router.currentRoute.value.name).toBe('admin-access');
  });

  it('says when a course cannot be loaded, and tries again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let down = true;
    const { w } = await render({ 'GET /courses/ZZ200': () => (down ? new Response(null, { status: 503 }) : Response.json(saved.ZZ200)) });
    await find(w, 'ZZ200');
    expect(get(w, 'catalog-failed').text()).toContain('Chưa tải được học phần.');
    expect(has(w, 'catalog-not-found')).toBe(false);
    down = false;
    await get(w, 'catalog-failed').get('button').trigger('click');
    await flushPromises();
    expect(get(w, 'catalog-course').attributes('data-course')).toBe('ZZ200');
  });

  it('reads in English', async () => {
    const { w } = await render({ 'PATCH /admin/catalog/courses/ZZ101': () => impact('impact_confirmation_required', [AFFECTED_2024], 'zz-review-1') });
    useLocale().set('en');
    await find(w, 'ZZ101');
    expect(get(w, 'catalog-find').text()).toBe('Find');
    expect(get(w, 'catalog-course').findAll('.catalog-facts dt').map((dt) => dt.text())).toEqual(['Credits', 'Theory periods (LT)', 'Lab periods (TH)', 'Exercise periods (BT)', 'Project periods (ĐT)']);
    expect(get(w, 'catalog-exercisePeriods').text()).toBe('Exercise periods (BT)Blank');
    expect(w.findAll('[data-test="catalog-membership"]')[0]!.text()).toBe('ZZPROG · Cohort 2024 · Kiến thức cơ sở thử');
    const dialog = await open(w, 'catalog-edit');
    expect(get(dialog, 'shared-warning').text()).toContain('An edit here changes every curriculum that uses this course');
    await get(dialog, 'course-exercisePeriods').setValue('15');
    await submit(w);
    expect(dialog.get('h2').text()).toBe('Review the impact before saving');
    expect(get(dialog, 'impact-change').findAll('th, td').map((cell) => cell.text())).toEqual(['Exercise periods (BT)', 'Blank', '15']);
    expect(get(dialog, 'impact-count').text()).toBe('1 curriculum affected');
    expect(get(dialog, 'impact-confirm').text()).toBe('Confirm and save');
  });

  it('still saves, and says what the API answers, when the course was reloaded as missing while its dialog is open (#160)', async () => {
    let patches = 0;
    const { w, fetch } = await render({
      'PATCH /admin/catalog/courses/ZZ200': () => {
        patches++;
        if (patches === 1) {
          delete saved.ZZ200;
          throw new TypeError('Failed to fetch');
        }
        return Response.json({ statusCode: 404, code: 'not_found', message: 'No course has this code' }, { status: 404 });
      },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await find(w, 'ZZ200');
    const dialog = await open(w, 'catalog-edit');
    await get(dialog, 'course-nameVi').setValue('Tên thử mới');
    await submit(w);
    expect(problem(w).attributes('data-code')).toBe('not_applied');
    expect(w.get('dialog[open] h2').text()).toBe('Sửa học phần ZZ200');
    await submit(w);
    expect(calls(fetch, 'PATCH')).toHaveLength(2);
    expect(problem(w).attributes('data-code')).toBe('not_found');
  });

  it('offers to create a missing course only when its code has the format the API accepts (#160)', async () => {
    const { w } = await render({ 'GET /courses/..%20': NOT_FOUND, 'GET /courses/ZZ-1': NOT_FOUND });
    for (const typed of ['..', 'zz-1']) {
      await find(w, typed);
      const note = get(w, 'catalog-not-found').text();
      expect(note).not.toContain('Thêm học phần');
      expect(note).toContain('Mã học phần gồm 2 đến 20 chữ cái A–Z hoặc chữ số');
      const dialog = await open(w, 'catalog-add');
      expect(value(dialog, 'course-code')).toBe('');
      await press(w, 'dialog-cancel');
    }
    await find(w, 'zz999');
    expect(get(w, 'catalog-not-found').text()).toContain('Bấm “Thêm học phần”');
  });

  it('keeps a typed code of only dots one path segment, so the lookup reaches the course route (#160)', async () => {
    const { w, fetch } = await render({ 'GET /courses/..%20': NOT_FOUND });
    await find(w, '..');
    expect(fetch.mock.calls.map(pathOf)).toEqual(['/admin/grants', '/courses/..%20']);
  });

});
