import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView } from 'vue-router';
import type { Curriculum } from '../curriculum/api.js';
import { useLocale } from '../locale.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { chooseOption, optionsOf } from '../testing/select.js';
import { setup } from '../testing/signed-in.js';
import type { UserGrants } from './api.js';
import { useAdminAccess } from './store.js';
import {
  adminPrograms,
  BASE_GROUP,
  CATALOG_MAINTAINER,
  grants,
  NO_GRANTS,
  OTHER_PROGRAM_ID,
  programGrant,
  course,
  curriculum,
  CURRICULUM_2025_ID,
  CURRICULUM_ID,
  ELECTIVE_GROUP,
  group,
  GROUP_BASE_ID,
  GROUP_ELECTIVE_ID,
  PROGRAM_ADMIN,
  PROGRAM_ID,
} from './testing/fixtures.js';

// Synthetic programs and courses only (AGENTS.md hard rule 3).
const READ = 'GET /programs/ZZPROG/curricula/2024';
const COHORT = `/admin/programs/${PROGRAM_ID}/cohorts/${CURRICULUM_ID}`;
const GROUPS = `${COHORT}/requirement-groups`;
const NEW_GROUP_ID = '00000000-0000-4000-8000-000000000a09';
const lost = () => {
  throw new TypeError('Failed to fetch');
};

/** A grant for each of the two programs the fixture lists. */
const BOTH_PROGRAMS = grants({ programs: [programGrant({ programId: OTHER_PROGRAM_ID, programCode: 'ZZEMPTY' }), programGrant()] });
const ONLY_EMPTY_PROGRAM = grants({ programs: [programGrant({ programId: OTHER_PROGRAM_ID, programCode: 'ZZEMPTY' })] });
const NO_PROGRAM_PERMISSION = status(403, { statusCode: 403, code: 'permission_required', permission: 'program_admin', message: 'This needs the program_admin permission' });

let wrapper: VueWrapper | undefined;
/** What the API has saved: the read route answers it, so a test changes it as a write would. */
let saved: Curriculum;
/** The grants the API answers for the signed-in administrator; a test changes them as a revocation would. */
let own: UserGrants;

async function render(routes: Record<string, unknown> = {}) {
  const fetch = mockApi({ 'GET /admin/grants': () => Response.json(own), 'GET /admin/programs': adminPrograms(), [READ]: () => Response.json(saved), ...routes });
  const app = await setup('/admin/curriculum');
  wrapper = mount(RouterView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  // The fixture lists a program without a cohort first: open the one with cohorts.
  await chooseOption(wrapper.get('[data-test="admin-program"]'), 'ZZPROG · Chương trình thử');
  await flushPromises();
  return { w: wrapper, fetch, ...app };
}

type Scope = Pick<DOMWrapper<Element>, 'get'>;
const get = (w: Scope, test: string) => w.get(`[data-test="${test}"]`);
const has = (w: VueWrapper, test: string) => w.find(`[data-test="${test}"]`).exists();
const groupRow = (w: VueWrapper, name: string) => w.find(`[data-test="group-row"][data-group-name="${name}"]`);
const courseRow = (w: VueWrapper, code: string) => w.find(`[data-test="course-row"][data-course="${code}"]`);
const problem = (w: VueWrapper) => w.get('dialog[open] [data-test="admin-problem"]');
const calls = (fetch: ReturnType<typeof mockApi>, method: string) => fetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') === method);
const writes = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.filter(([, init]) => (init?.method ?? 'GET') !== 'GET');
const pathOf = (call: readonly unknown[]) => String(call[0]).split('/api')[1];
const submit = async (w: VueWrapper) => {
  await w.get('dialog[open] form').trigger('submit');
  await flushPromises();
};

describe('CurriculumAdmin (F12, UC-11): the curriculum editor of a program administrator', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    saved = curriculum();
    own = BOTH_PROGRAMS;
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('offers only the programs and cohorts the API lists for this user, and shows the groups of the chosen cohort', async () => {
    const { w } = await render();
    expect(w.get('[data-test="admin-tabs"]').findAll('a').map((a) => a.text())).toEqual(['Nhóm yêu cầu']);
    expect(optionsOf(get(w, 'admin-program'))).toEqual(['ZZEMPTY · Chương trình thử chưa có khóa', 'ZZPROG · Chương trình thử']);
    expect(optionsOf(get(w, 'admin-cohort'))).toEqual(['Khóa 2024', 'Khóa 2025']);
    expect(get(w, 'curriculum-summary').text()).toContain('CTĐT thử khóa 2024 · ZZPROG2024');
    expect(get(w, 'groups-title').text()).toBe('2 nhóm yêu cầu');
    expect(w.findAll('[data-test="group-row"]').map((row) => row.findAll('th, td').slice(0, 4).map((cell) => cell.text()))).toEqual([
      ['</>Kiến thức cơ sở thử', 'Bắt buộc', '12 TC', '3'],
      ['★Tự chọn thử', 'Tự chọn', 'Tối thiểu 8 TC', '0'],
    ]);
    // A group's printed rule sits on its own line under the row; a group without one has no such line.
    expect(w.findAll('[data-test="group-note"]').map((note) => note.text())).toEqual(['Chọn tối thiểu 8 tín chỉ.']);
    // The first group is open, with its courses.
    expect(get(w, 'group-panel').get('h3').text()).toBe('Kiến thức cơ sở thử · 3 học phần');
    expect(groupRow(w, BASE_GROUP.name).get('[data-test="group-open"]').attributes('aria-expanded')).toBe('true');
    expect(w.findAll('[data-test="course-row"]').map((row) => row.attributes('data-course'))).toEqual(['ZZ101', 'ZZ102', 'ZZ103']);
  });

  it('builds no control for what has no route: no cohort or program creation, no import, no credit-total box', async () => {
    const { w } = await render();
    expect(w.text()).not.toMatch(/Thêm khóa|Thêm chương trình|CSV/);
    expect(w.find('input[type="file"]').exists()).toBe(false);
    await get(w, 'add-group').trigger('click');
    await flushPromises();
    expect(w.get('dialog[open]').findAll('input, textarea').map((field) => field.attributes('id') ?? field.attributes('name'))).toEqual(['group-name', 'group-kind', 'group-kind', 'group-notes']);
    expect(get(w, 'group-totals').text()).toBe('Số tín chỉ yêu cầu của nhóm chỉ để xem: trang này chưa sửa được.');
  });

  it('shows "not recorded" (null) differently from "none" ([]), in words, for prerequisites and offering terms', async () => {
    const { w } = await render();
    const cells = (code: string) => [get(courseRow(w, code), 'prerequisites'), get(courseRow(w, code), 'offering-terms')] as const;
    expect(cells('ZZ101').map((cell) => [cell.attributes('data-state'), cell.text()])).toEqual([
      ['none', 'Không có tiên quyết'],
      ['recorded', 'HK1, HK3'],
    ]);
    expect(cells('ZZ102').map((cell) => [cell.attributes('data-state'), cell.text()])).toEqual([
      ['recorded', 'ZZ101'],
      ['not-recorded', 'Chưa ghi nhận'],
    ]);
    expect(cells('ZZ103').map((cell) => [cell.attributes('data-state'), cell.text()])).toEqual([
      ['not-recorded', 'Chưa ghi nhận'],
      ['not-recorded', 'Chưa ghi nhận'],
    ]);
    useLocale().set('en');
    await flushPromises();
    expect(cells('ZZ101').map((cell) => cell.text())).toEqual(['No prerequisite', 'Term 1, Term 3']);
    expect(cells('ZZ103').map((cell) => cell.text())).toEqual(['Not recorded', 'Not recorded']);
    expect(courseRow(w, 'ZZ101').text()).toContain('Test course ZZ101');
  });

  it('creates a group with what was typed, then shows what the API saved and puts the focus back', async () => {
    const created = group(NEW_GROUP_ID, 'Nhóm thử mới', { kind: 'elective', officialNotes: 'Ghi chú thử' });
    const { w, fetch } = await render({
      [`POST ${GROUPS}`]: () => {
        saved = curriculum([BASE_GROUP, created, ELECTIVE_GROUP]);
        return Response.json({ ...created, curriculumId: CURRICULUM_ID, updatedAt: '2026-11-24T02:00:00.000Z', courses: undefined }, { status: 201 });
      },
    });
    const add = get(w, 'add-group');
    (add.element as HTMLElement).focus();
    await add.trigger('click');
    await flushPromises();
    const dialog = w.get('dialog[open]');
    expect(dialog.get('h2').text()).toBe('Nhóm yêu cầu mới');
    await get(dialog, 'group-name').setValue('  Nhóm thử mới ');
    await get(dialog, 'group-kind-elective').setValue(true);
    await get(dialog, 'group-notes').setValue('Ghi chú thử');
    await submit(w);

    // The name goes as typed: the API trims it.
    expect(sentBody(calls(fetch, 'POST')[0]![1])).toEqual({ name: '  Nhóm thử mới ', kind: 'elective', officialNotes: 'Ghi chú thử' });
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(useToast().message).toBe('Đã thêm nhóm Nhóm thử mới.');
    expect(get(w, 'groups-title').text()).toBe('3 nhóm yêu cầu');
    // The new group is opened, and the focus is back on the button that started it.
    expect(get(w, 'group-panel').attributes('data-group-id')).toBe(NEW_GROUP_ID);
    expect(get(w, 'no-courses').text()).toBe('Nhóm này chưa có học phần nào.');
    expect(document.activeElement).toBe(add.element);
  });

  it('sends a form with nothing chosen as it is, and shows the API\'s field errors under the fields they name (UC-11 A3)', async () => {
    const { w, fetch } = await render({
      [`POST ${GROUPS}`]: status(400, {
        statusCode: 400,
        code: 'validation_failed',
        message: ['name should not be empty', 'kind must be one of the following values: compulsory, elective', 'property creditsTotal should not exist'],
      }),
    });
    await get(w, 'add-group').trigger('click');
    await flushPromises();
    await submit(w);
    expect(sentBody(calls(fetch, 'POST')[0]![1])).toEqual({ name: '', kind: null, officialNotes: null });

    const dialog = w.get('dialog[open]');
    expect(problem(w).attributes('data-code')).toBe('validation_failed');
    expect(problem(w).get('p').text()).toBe('Máy chủ từ chối giá trị đã nhập. Chưa lưu gì.');
    // A message that names no field of the form is listed below, as the API wrote it.
    expect(problem(w).findAll('li').map((li) => [li.text(), li.attributes('lang')])).toEqual([['property creditsTotal should not exist', 'en']]);
    const name = get(dialog, 'group-name');
    expect(name.attributes('aria-invalid')).toBe('true');
    expect(name.attributes('aria-describedby')!.split(' ').map((id) => document.getElementById(id)?.textContent?.trim())).toEqual([
      'Ghi đúng tiêu đề in trong văn bản chính thức. Mỗi nhóm của một khóa có tên riêng.',
      'name should not be empty',
    ]);
    expect(dialog.get('#group-kind-error').text()).toBe('kind must be one of the following values: compulsory, elective');
    expect(get(w, 'groups-title').text()).toBe('2 nhóm yêu cầu');
  });

  it('edits a group by sending only what changed', async () => {
    const { w, fetch } = await render({
      [`PATCH ${GROUPS}/${GROUP_ELECTIVE_ID}`]: () => {
        saved = curriculum([BASE_GROUP, { ...ELECTIVE_GROUP, name: 'Tự chọn thử (sửa)', officialNotes: null }]);
        return Response.json({});
      },
    });
    const edit = get(groupRow(w, ELECTIVE_GROUP.name), 'group-edit');
    expect(edit.attributes('aria-label')).toBe('Sửa nhóm Tự chọn thử');
    (edit.element as HTMLElement).focus();
    await edit.trigger('click');
    await flushPromises();
    const dialog = w.get('dialog[open]');
    // The form opens on the saved values.
    expect((get(dialog, 'group-name').element as HTMLInputElement).value).toBe('Tự chọn thử');
    expect((get(dialog, 'group-kind-elective').element as HTMLInputElement).checked).toBe(true);
    expect((get(dialog, 'group-notes').element as HTMLTextAreaElement).value).toBe('Chọn tối thiểu 8 tín chỉ.');
    await get(dialog, 'group-name').setValue('Tự chọn thử (sửa)');
    await get(dialog, 'group-notes').setValue('   ');
    await submit(w);
    expect(sentBody(calls(fetch, 'PATCH')[0]![1])).toEqual({ name: 'Tự chọn thử (sửa)', officialNotes: null });
    expect(useToast().message).toBe('Đã lưu nhóm Tự chọn thử (sửa).');
    expect(groupRow(w, 'Tự chọn thử (sửa)').exists()).toBe(true);
    // The same row, so the focus is still on its Edit button.
    expect(document.activeElement).toBe(get(groupRow(w, 'Tự chọn thử (sửa)'), 'group-edit').element);
  });

  it('sends nothing when the form is saved unchanged', async () => {
    const { w, fetch } = await render();
    await get(groupRow(w, ELECTIVE_GROUP.name), 'group-edit').trigger('click');
    await flushPromises();
    await submit(w);
    expect(writes(fetch)).toEqual([]);
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(useToast().message).toBe('Không có gì thay đổi, nên chưa gửi gì.');
  });

  it('discards an unsaved edit on Cancel and on Escape, and sends nothing (UC-11 A6)', async () => {
    const { w, fetch } = await render();
    const edit = get(groupRow(w, ELECTIVE_GROUP.name), 'group-edit');
    (edit.element as HTMLElement).focus();
    await edit.trigger('click');
    await flushPromises();
    await get(w.get('dialog[open]'), 'group-name').setValue('Tên chưa lưu');
    await get(w.get('dialog[open]'), 'dialog-cancel').trigger('click');
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(document.activeElement).toBe(edit.element);

    // The draft is gone: the form opens on the saved name again. Escape reaches the dialog as a cancel event.
    await edit.trigger('click');
    await flushPromises();
    expect((get(w.get('dialog[open]'), 'group-name').element as HTMLInputElement).value).toBe('Tự chọn thử');
    await get(w.get('dialog[open]'), 'group-name').setValue('Tên chưa lưu');
    await w.get('dialog[open]').trigger('cancel');
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(writes(fetch)).toEqual([]);
    expect(groupRow(w, 'Tự chọn thử').exists()).toBe(true);
  });

  it('names the missing permission on 403 permission_required, and saves nothing (UC-11 A4)', async () => {
    const { w } = await render({
      [`PATCH ${GROUPS}/${GROUP_ELECTIVE_ID}`]: status(403, { statusCode: 403, code: 'permission_required', permission: 'program_admin', message: 'This needs the program_admin permission' }),
    });
    await get(groupRow(w, ELECTIVE_GROUP.name), 'group-edit').trigger('click');
    await flushPromises();
    await get(w.get('dialog[open]'), 'group-name').setValue('Tên khác');
    await submit(w);
    expect(problem(w).attributes('data-code')).toBe('permission_required');
    expect(problem(w).text()).toBe('Thao tác này cần quyền “Quản trị chương trình”. Tài khoản của bạn không có quyền đó. Chưa lưu gì.');
    expect(groupRow(w, 'Tự chọn thử').exists()).toBe(true);
  });

  it('says a duplicate name in words (409 duplicate_name)', async () => {
    const { w } = await render({ [`POST ${GROUPS}`]: status(409, { statusCode: 409, code: 'duplicate_name', message: 'This cohort already has a requirement group with this name' }) });
    await get(w, 'add-group').trigger('click');
    await flushPromises();
    await get(w.get('dialog[open]'), 'group-name').setValue('Tự chọn thử');
    await get(w.get('dialog[open]'), 'group-kind-elective').setValue(true);
    await submit(w);
    expect(problem(w).attributes('data-code')).toBe('duplicate_name');
    expect(problem(w).text()).toBe('Khóa này đã có một nhóm yêu cầu cùng tên. Chưa lưu gì.');
  });

  it('asks before deleting a group, says what still uses it on a refusal, and deletes an empty one (UC-11 A5)', async () => {
    let refuse = true;
    const { w, fetch } = await render({
      [`DELETE ${GROUPS}/${GROUP_BASE_ID}`]: status(409, { statusCode: 409, code: 'referenced_item', message: 'The group still links courses; remove them from it first', references: ['links ZZ101', 'links ZZ102'] }),
      [`DELETE ${GROUPS}/${GROUP_ELECTIVE_ID}`]: () => {
        if (refuse) return new Response(null, { status: 204 });
        throw new Error('deleted twice');
      },
    });
    await get(groupRow(w, BASE_GROUP.name), 'group-delete').trigger('click');
    await flushPromises();
    const dialog = w.get('dialog[open]');
    expect(dialog.attributes('role')).toBe('alertdialog');
    expect(dialog.text()).toContain('Nhóm “Kiến thức cơ sở thử” sẽ bị xóa khỏi khóa này.');
    // Asking sends nothing.
    expect(writes(fetch)).toEqual([]);
    await get(dialog, 'confirm-yes').trigger('click');
    await flushPromises();
    expect(problem(w).attributes('data-code')).toBe('referenced_item');
    expect(problem(w).get('p').text()).toBe('Chưa gỡ được vì còn chỗ đang dùng mục này. Chưa đổi gì. Gỡ các chỗ sau trước:');
    expect(problem(w).findAll('li').map((li) => li.text())).toEqual(['nhóm còn học phần ZZ101', 'nhóm còn học phần ZZ102']);
    await get(dialog, 'confirm-no').trigger('click');
    await flushPromises();
    expect(groupRow(w, BASE_GROUP.name).exists()).toBe(true);

    saved = curriculum([BASE_GROUP]);
    refuse = true;
    await get(groupRow(w, ELECTIVE_GROUP.name), 'group-delete').trigger('click');
    await flushPromises();
    await get(w.get('dialog[open]'), 'confirm-yes').trigger('click');
    await flushPromises();
    expect(w.find('dialog[open]').exists()).toBe(false);
    expect(useToast().message).toBe('Đã xóa nhóm Tự chọn thử.');
    expect(w.findAll('[data-test="group-row"]')).toHaveLength(1);
    // The row and its buttons are gone: the focus goes to a control that is still there.
    expect(document.activeElement?.id).toBe('add-group');
  });

  it('links a catalog course by its code, sent as typed, and shows it once the API has it', async () => {
    const link = `PUT ${GROUPS}/${GROUP_BASE_ID}/courses/%20zz104%20`;
    const { w, fetch } = await render({
      [link]: () => {
        saved = curriculum([{ ...BASE_GROUP, courses: [...BASE_GROUP.courses, course('ZZ104')] }, ELECTIVE_GROUP]);
        return new Response(null, { status: 204 });
      },
    });
    expect(get(w, 'link-submit').attributes('disabled')).toBeDefined();
    await get(w, 'link-code').setValue(' zz104 ');
    await get(w, 'group-panel').get('form').trigger('submit');
    await flushPromises();
    expect(calls(fetch, 'PUT').map(pathOf)).toEqual([`${GROUPS}/${GROUP_BASE_ID}/courses/%20zz104%20`]);
    expect(calls(fetch, 'PUT')[0]![1]!.body).toBeUndefined();
    expect(courseRow(w, 'ZZ104').exists()).toBe(true);
    expect(useToast().message).toBe('Đã thêm ZZ104 vào nhóm Kiến thức cơ sở thử.');
    expect((get(w, 'link-code').element as HTMLInputElement).value).toBe('');
    expect(document.activeElement?.id).toBe('link-code');
  });

  it('says when the catalog has no such course (404), and shows the API\'s refusal of a malformed code under the box (400)', async () => {
    const { w } = await render({
      [`PUT ${GROUPS}/${GROUP_BASE_ID}/courses/ZZ999`]: status(404, { statusCode: 404, code: 'not_found', message: 'No catalog course has the code ZZ999; a catalog maintainer adds it first' }),
      [`PUT ${GROUPS}/${GROUP_BASE_ID}/courses/zz.1`]: status(400, { statusCode: 400, code: 'validation_failed', message: 'courseCode: "zz.1" is not a course code (letters A-Z and digits, 2 to 20)' }),
    });
    await get(w, 'link-code').setValue('ZZ999');
    await get(w, 'group-panel').get('form').trigger('submit');
    await flushPromises();
    const note = get(w, 'group-panel').get('[data-test="admin-problem"]');
    expect(note.attributes('data-code')).toBe('not_found');
    expect(note.text()).toContain('danh mục không có học phần mang mã này');
    expect((get(w, 'link-code').element as HTMLInputElement).value).toBe('ZZ999');

    await get(w, 'link-code').setValue('zz.1');
    await get(w, 'group-panel').get('form').trigger('submit');
    await flushPromises();
    expect(get(w, 'link-code').attributes('aria-invalid')).toBe('true');
    expect(w.get('#link-error').text()).toBe('courseCode: "zz.1" is not a course code (letters A-Z and digits, 2 to 20)');
    expect(get(w, 'group-panel').get('[data-test="admin-problem"]').get('p').text()).toBe('Máy chủ từ chối giá trị đã nhập. Chưa lưu gì.');
  });

  it('removes a course from a group after asking, and lists the rules that still name it on a refusal', async () => {
    const { w } = await render({
      [`DELETE ${GROUPS}/${GROUP_BASE_ID}/courses/ZZ101`]: status(409, {
        statusCode: 409,
        code: 'referenced_item',
        message: 'ZZ101 would leave the curriculum while its rules still name it; clear them first',
        references: ['prerequisites of ZZ101 are recorded', 'offering terms of ZZ101 are recorded', 'ZZ102 requires ZZ101'],
      }),
      [`DELETE ${GROUPS}/${GROUP_BASE_ID}/courses/ZZ103`]: () => {
        saved = curriculum([{ ...BASE_GROUP, courses: BASE_GROUP.courses.slice(0, 2) }, ELECTIVE_GROUP]);
        return new Response(null, { status: 204 });
      },
    });
    await get(courseRow(w, 'ZZ101'), 'unlink-course').trigger('click');
    await flushPromises();
    expect(w.get('dialog[open]').text()).toContain('ZZ101 sẽ rời nhóm “Kiến thức cơ sở thử”. Học phần vẫn còn trong danh mục và trong các nhóm khác.');
    await get(w.get('dialog[open]'), 'confirm-yes').trigger('click');
    await flushPromises();
    expect(problem(w).findAll('li').map((li) => li.text())).toEqual(['tiên quyết của ZZ101 đã được ghi nhận', 'kỳ mở của ZZ101 đã được ghi nhận', 'ZZ102 cần ZZ101 làm tiên quyết']);
    await get(w.get('dialog[open]'), 'confirm-no').trigger('click');
    await flushPromises();
    expect(courseRow(w, 'ZZ101').exists()).toBe(true);

    await get(courseRow(w, 'ZZ103'), 'unlink-course').trigger('click');
    await flushPromises();
    await get(w.get('dialog[open]'), 'confirm-yes').trigger('click');
    await flushPromises();
    expect(w.find('[data-test="course-row"][data-course="ZZ103"]').exists()).toBe(false);
    expect(useToast().message).toBe('Đã bỏ ZZ103 khỏi nhóm. Học phần vẫn còn trong danh mục.');
    expect(document.activeElement?.id).toBe('link-code');
  });

  describe('prerequisites of a course', () => {
    const RULE = (code: string) => `${COHORT}/courses/${code}/prerequisites`;
    const openFor = async (w: VueWrapper, code: string) => {
      await get(courseRow(w, code), 'edit-prerequisites').trigger('click');
      await flushPromises();
      return w.get('dialog[open]');
    };
    const checked = (dialog: Scope) => ['not_recorded', 'none', 'list'].filter((state) => (get(dialog, `prerequisite-state-${state}`).element as HTMLInputElement).checked);

    it('opens on what is recorded: not recorded, none, or the list', async () => {
      const { w } = await render();
      expect(checked(await openFor(w, 'ZZ103'))).toEqual(['not_recorded']);
      expect(w.find('[data-test="prerequisite-codes"]').exists()).toBe(false);
      await get(w.get('dialog[open]'), 'dialog-cancel').trigger('click');
      expect(checked(await openFor(w, 'ZZ101'))).toEqual(['none']);
      await get(w.get('dialog[open]'), 'dialog-cancel').trigger('click');
      const dialog = await openFor(w, 'ZZ102');
      expect(checked(dialog)).toEqual(['list']);
      expect((get(dialog, 'prerequisite-codes').element as HTMLInputElement).value).toBe('ZZ101');
    });

    it('sets a list as typed, records "none" as an empty list, and clears back to not recorded: three different requests', async () => {
      const { w, fetch } = await render({
        [`PUT ${RULE('ZZ103')}`]: (init: RequestInit) => {
          const { prerequisites } = sentBody(init) as { prerequisites: string[] };
          saved = curriculum([{ ...BASE_GROUP, courses: [BASE_GROUP.courses[0]!, BASE_GROUP.courses[1]!, course('ZZ103', { prerequisites: prerequisites.map((code) => code.trim().toUpperCase()).sort() })] }, ELECTIVE_GROUP]);
          return Response.json({ courseCode: 'ZZ103', prerequisites: saved.requirementGroups[0]!.courses[2]!.prerequisites });
        },
        [`DELETE ${RULE('ZZ103')}`]: () => {
          saved = curriculum();
          return Response.json({ courseCode: 'ZZ103', prerequisites: null });
        },
      });
      const cell = () => get(courseRow(w, 'ZZ103'), 'prerequisites');

      let dialog = await openFor(w, 'ZZ103');
      await get(dialog, 'prerequisite-state-list').setValue(true);
      await get(dialog, 'prerequisite-codes').setValue('zz102, ZZ101');
      await submit(w);
      expect(sentBody(calls(fetch, 'PUT')[0]![1])).toEqual({ prerequisites: ['zz102', 'ZZ101'] });
      expect([cell().attributes('data-state'), cell().text()]).toEqual(['recorded', 'ZZ101ZZ102']);
      expect(useToast().message).toBe('Đã lưu tiên quyết của ZZ103.');

      dialog = await openFor(w, 'ZZ103');
      await get(dialog, 'prerequisite-state-none').setValue(true);
      await submit(w);
      expect(sentBody(calls(fetch, 'PUT')[1]![1])).toEqual({ prerequisites: [] });
      expect([cell().attributes('data-state'), cell().text()]).toEqual(['none', 'Không có tiên quyết']);

      dialog = await openFor(w, 'ZZ103');
      await get(dialog, 'prerequisite-state-not_recorded').setValue(true);
      await submit(w);
      expect(calls(fetch, 'DELETE').map(pathOf)).toEqual([RULE('ZZ103')]);
      expect(calls(fetch, 'PUT')).toHaveLength(2);
      expect([cell().attributes('data-state'), cell().text()]).toEqual(['not-recorded', 'Chưa ghi nhận']);
      expect(useToast().message).toBe('Tiên quyết của ZZ103 trở về “Chưa ghi nhận”.');
    });

    it('never records "none" from an empty box: it asks for a code or for the choice "No prerequisite"', async () => {
      const { w, fetch } = await render();
      const dialog = await openFor(w, 'ZZ103');
      await get(dialog, 'prerequisite-state-list').setValue(true);
      await get(dialog, 'prerequisite-codes').setValue('  ,  ');
      await submit(w);
      expect(get(dialog, 'prerequisite-codes-needed').text()).toBe('Nhập ít nhất một mã, hoặc chọn “Không có tiên quyết”.');
      expect(get(dialog, 'prerequisite-codes').attributes('aria-invalid')).toBe('true');
      expect(writes(fetch)).toEqual([]);
    });

    it('spells out a prerequisite cycle the API refuses, and its refusal of a code outside the cohort', async () => {
      let answer = status(400, { statusCode: 400, code: 'prerequisite_cycle', cycle: ['ZZ101', 'ZZ102', 'ZZ101'], message: 'Prerequisite cycle: ZZ101 → ZZ102 → ZZ101' });
      const { w } = await render({ [`PUT ${RULE('ZZ101')}`]: () => answer() });
      const dialog = await openFor(w, 'ZZ101');
      await get(dialog, 'prerequisite-state-list').setValue(true);
      await get(dialog, 'prerequisite-codes').setValue('ZZ102');
      await submit(w);
      expect(problem(w).attributes('data-code')).toBe('prerequisite_cycle');
      expect(problem(w).text()).toBe('Vòng tiên quyết: ZZ101 → ZZ102 → ZZ101. Mỗi học phần trong vòng cần học phần đứng sau nó, nên không học phần nào học được. Chưa lưu gì.');
      expect(get(courseRow(w, 'ZZ101'), 'prerequisites').attributes('data-state')).toBe('none');

      answer = status(400, { statusCode: 400, code: 'validation_failed', message: 'prerequisites: ZZ900 not a course of this curriculum; link it to a group first' });
      await get(dialog, 'prerequisite-codes').setValue('ZZ900');
      await submit(w);
      expect(problem(w).attributes('data-code')).toBe('validation_failed');
      expect(dialog.get('#prerequisite-codes-error').text()).toBe('prerequisites: ZZ900 not a course of this curriculum; link it to a group first');
      expect(get(dialog, 'prerequisite-codes').attributes('aria-describedby')).toBe('prerequisite-codes-hint prerequisite-codes-error');
    });
  });

  describe('offering terms of a course', () => {
    const RULE = (code: string) => `${COHORT}/courses/${code}/offering-terms`;
    const openFor = async (w: VueWrapper, code: string) => {
      await get(courseRow(w, code), 'edit-terms').trigger('click');
      await flushPromises();
      return w.get('dialog[open]');
    };
    const ticked = (dialog: Scope) => [1, 2, 3].filter((term) => (get(dialog, `term-${term}`).element as HTMLInputElement).checked);

    it('opens on what is recorded, with nothing ticked for a course with nothing recorded', async () => {
      const { w, fetch } = await render();
      expect(ticked(await openFor(w, 'ZZ103'))).toEqual([]);
      await get(w.get('dialog[open]'), 'dialog-cancel').trigger('click');
      expect(ticked(await openFor(w, 'ZZ101'))).toEqual([1, 3]);
      await get(w.get('dialog[open]'), 'dialog-cancel').trigger('click');
      expect(writes(fetch)).toEqual([]);
    });

    it('sets the ticked terms, and clears back to not recorded when none is ticked', async () => {
      const { w, fetch } = await render({
        [`PUT ${RULE('ZZ103')}`]: (init: RequestInit) => {
          const { terms } = sentBody(init) as { terms: number[] };
          saved = curriculum([{ ...BASE_GROUP, courses: [BASE_GROUP.courses[0]!, BASE_GROUP.courses[1]!, course('ZZ103', { offeringTerms: terms })] }, ELECTIVE_GROUP]);
          return Response.json({ courseCode: 'ZZ103', terms });
        },
        [`DELETE ${RULE('ZZ103')}`]: () => {
          saved = curriculum();
          return Response.json({ courseCode: 'ZZ103', terms: null });
        },
      });
      const cell = () => get(courseRow(w, 'ZZ103'), 'offering-terms');
      let dialog = await openFor(w, 'ZZ103');
      await get(dialog, 'term-3').setValue(true);
      await get(dialog, 'term-2').setValue(true);
      await submit(w);
      expect(sentBody(calls(fetch, 'PUT')[0]![1])).toEqual({ terms: [2, 3] });
      expect([cell().attributes('data-state'), cell().text()]).toEqual(['recorded', 'HK2, HK3']);
      expect(useToast().message).toBe('Đã lưu kỳ mở của ZZ103.');

      dialog = await openFor(w, 'ZZ103');
      await get(dialog, 'term-2').setValue(false);
      await get(dialog, 'term-3').setValue(false);
      await submit(w);
      // An offering list is never empty: nothing ticked is a DELETE, not an empty PUT.
      expect(calls(fetch, 'PUT')).toHaveLength(1);
      expect(calls(fetch, 'DELETE').map(pathOf)).toEqual([RULE('ZZ103')]);
      expect([cell().attributes('data-state'), cell().text()]).toEqual(['not-recorded', 'Chưa ghi nhận']);
      expect(useToast().message).toBe('Kỳ mở của ZZ103 trở về “Chưa ghi nhận”.');
    });
  });

  describe('a write whose answer is lost (UC-11 A7)', () => {
    const editElective = async (w: VueWrapper, name: string) => {
      await get(groupRow(w, ELECTIVE_GROUP.name), 'group-edit').trigger('click');
      await flushPromises();
      await get(w.get('dialog[open]'), 'group-name').setValue(name);
      await submit(w);
    };
    beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

    it('reloads the saved data, and says the change is saved only because the reloaded data has it', async () => {
      const { w, fetch } = await render({
        [`PATCH ${GROUPS}/${GROUP_ELECTIVE_ID}`]: () => {
          // The API saved it, but the answer never arrived.
          saved = curriculum([BASE_GROUP, { ...ELECTIVE_GROUP, name: 'Tự chọn thử B' }]);
          return lost();
        },
      });
      const reads = calls(fetch, 'GET').length;
      await editElective(w, 'Tự chọn thử B');
      expect(calls(fetch, 'GET').length).toBe(reads + 1);
      expect(calls(fetch, 'PATCH')).toHaveLength(1);
      expect(w.find('dialog[open]').exists()).toBe(false);
      expect(get(w, 'admin-notice').text()).toBe('Máy chủ không trả lời yêu cầu lưu, nên OmniCourse đã tải lại dữ liệu đã lưu. Dữ liệu đã lưu có thay đổi này.');
      expect(useToast().message).toBe('');
      expect(groupRow(w, 'Tự chọn thử B').exists()).toBe(true);
    });

    it('keeps the form open and says the saved data does not have the change, without sending the write again', async () => {
      const { w, fetch } = await render({ [`PATCH ${GROUPS}/${GROUP_ELECTIVE_ID}`]: lost });
      await editElective(w, 'Tự chọn thử B');
      expect(calls(fetch, 'PATCH')).toHaveLength(1);
      expect(problem(w).attributes('data-code')).toBe('not_applied');
      expect(problem(w).text()).toBe('Máy chủ không trả lời yêu cầu lưu, nên OmniCourse đã tải lại dữ liệu đã lưu. Dữ liệu đã lưu chưa có thay đổi này. Kiểm tra lại, rồi lưu lần nữa nếu cần.');
      expect((get(w.get('dialog[open]'), 'group-name').element as HTMLInputElement).value).toBe('Tự chọn thử B');
      expect(useToast().message).toBe('');
      expect(has(w, 'admin-notice')).toBe(false);
    });

    it('says the outcome is unknown when the saved data cannot be reloaded either, never "saved", and offers the reload', async () => {
      let offline = false;
      const { w, fetch } = await render({
        [READ]: () => (offline ? lost() : Response.json(saved)),
        [`PATCH ${GROUPS}/${GROUP_ELECTIVE_ID}`]: () => {
          saved = curriculum([BASE_GROUP, { ...ELECTIVE_GROUP, name: 'Tự chọn thử B' }]);
          offline = true;
          return lost();
        },
      });
      await editElective(w, 'Tự chọn thử B');
      expect(problem(w).attributes('data-code')).toBe('unknown');
      expect(problem(w).text()).toContain('Chưa rõ thay đổi đã được lưu hay chưa. Hãy tải lại dữ liệu trước khi thử lại.');
      expect(useToast().message).toBe('');
      expect(w.text()).not.toContain('Đã lưu nhóm');
      // The page still shows the values from before the write.
      expect(groupRow(w, 'Tự chọn thử').exists()).toBe(true);

      // Reload reads the saved data again and settles the same write from it; the write itself is not sent again.
      offline = false;
      await get(w.get('dialog[open]'), 'admin-reload').trigger('click');
      await flushPromises();
      expect(calls(fetch, 'PATCH')).toHaveLength(1);
      expect(w.find('dialog[open]').exists()).toBe(false);
      expect(get(w, 'admin-notice').text()).toBe('Máy chủ không trả lời yêu cầu lưu, nên OmniCourse đã tải lại dữ liệu đã lưu. Dữ liệu đã lưu có thay đổi này.');
      expect(useToast().message).toBe('');
      expect(groupRow(w, 'Tự chọn thử B').exists()).toBe(true);
    });

    it('replaces "unknown" with "not saved" when the reload shows the saved data without the change', async () => {
      let offline = false;
      const { w, fetch } = await render({
        [READ]: () => (offline ? lost() : Response.json(saved)),
        [`PATCH ${GROUPS}/${GROUP_ELECTIVE_ID}`]: () => {
          offline = true;
          return lost();
        },
        [`PUT ${GROUPS}/${GROUP_BASE_ID}/courses/ZZ104`]: () => {
          offline = true;
          return lost();
        },
      });
      await editElective(w, 'Tự chọn thử B');
      expect(problem(w).attributes('data-code')).toBe('unknown');
      // Still offline: still unknown, and still no claim either way.
      await get(w.get('dialog[open]'), 'admin-reload').trigger('click');
      await flushPromises();
      expect(problem(w).attributes('data-code')).toBe('unknown');
      offline = false;
      await get(w.get('dialog[open]'), 'admin-reload').trigger('click');
      await flushPromises();
      expect(problem(w).attributes('data-code')).toBe('not_applied');
      expect(w.find('dialog[open] [data-test="admin-reload"]').exists()).toBe(false);
      expect((get(w.get('dialog[open]'), 'group-name').element as HTMLInputElement).value).toBe('Tự chọn thử B');
      expect(calls(fetch, 'PATCH')).toHaveLength(1);
      await get(w.get('dialog[open]'), 'dialog-cancel').trigger('click');
      await flushPromises();

      // The link form, which has no dialog, settles the same way beside its box.
      await get(w, 'link-code').setValue('ZZ104');
      await get(w, 'group-panel').get('form').trigger('submit');
      await flushPromises();
      const note = () => get(w, 'group-panel').get('[data-test="admin-problem"]');
      expect(note().attributes('data-code')).toBe('unknown');
      saved = curriculum([{ ...BASE_GROUP, courses: [...BASE_GROUP.courses, course('ZZ104')] }, ELECTIVE_GROUP]);
      offline = false;
      await get(note(), 'admin-reload').trigger('click');
      await flushPromises();
      expect(get(w, 'group-panel').find('[data-test="admin-problem"]').exists()).toBe(false);
      expect(get(w, 'admin-notice').text()).toContain('Dữ liệu đã lưu có thay đổi này.');
      expect(courseRow(w, 'ZZ104').exists()).toBe(true);
      expect((get(w, 'link-code').element as HTMLInputElement).value).toBe('');
      expect(calls(fetch, 'PUT')).toHaveLength(1);
    });

    it('treats a server error the same way: unknown until the saved data is read', async () => {
      const { w } = await render({ [`DELETE ${GROUPS}/${GROUP_ELECTIVE_ID}`]: status(500, { statusCode: 500, message: 'Internal server error' }) });
      await get(groupRow(w, ELECTIVE_GROUP.name), 'group-delete').trigger('click');
      await flushPromises();
      await get(w.get('dialog[open]'), 'confirm-yes').trigger('click');
      await flushPromises();
      expect(problem(w).attributes('data-code')).toBe('not_applied');
      expect(groupRow(w, ELECTIVE_GROUP.name).exists()).toBe(true);
    });

    it('settles a lost link the same way, beside the code box', async () => {
      const { w } = await render({
        [`PUT ${GROUPS}/${GROUP_BASE_ID}/courses/ZZ104`]: () => {
          saved = curriculum([{ ...BASE_GROUP, courses: [...BASE_GROUP.courses, course('ZZ104')] }, ELECTIVE_GROUP]);
          return lost();
        },
        [`PUT ${GROUPS}/${GROUP_BASE_ID}/courses/ZZ105`]: lost,
      });
      await get(w, 'link-code').setValue('ZZ104');
      await get(w, 'group-panel').get('form').trigger('submit');
      await flushPromises();
      expect(get(w, 'admin-notice').text()).toContain('Dữ liệu đã lưu có thay đổi này.');
      expect(courseRow(w, 'ZZ104').exists()).toBe(true);

      await get(w, 'link-code').setValue('ZZ105');
      await get(w, 'group-panel').get('form').trigger('submit');
      await flushPromises();
      expect(has(w, 'admin-notice')).toBe(false);
      expect(get(w, 'group-panel').get('[data-test="admin-problem"]').attributes('data-code')).toBe('not_applied');
      expect((get(w, 'link-code').element as HTMLInputElement).value).toBe('ZZ105');
    });

    it('asks for the reload before another write when a lost link cannot be checked, also from the Add group button', async () => {
      let offline = false;
      const { w, fetch } = await render({
        [READ]: () => (offline ? lost() : Response.json(saved)),
        [`PUT ${GROUPS}/${GROUP_BASE_ID}/courses/ZZ104`]: () => {
          offline = true;
          return lost();
        },
      });
      await get(w, 'link-code').setValue('ZZ104');
      await get(w, 'group-panel').get('form').trigger('submit');
      await flushPromises();
      expect(get(w, 'group-panel').get('[data-test="admin-problem"]').attributes('data-code')).toBe('unknown');

      // The link may be saved: no other write starts before the saved data has been read.
      await get(w, 'add-group').trigger('click');
      await flushPromises();
      expect(w.find('dialog[open]').exists()).toBe(false);
      expect(has(w, 'curriculum-stale')).toBe(true);
      expect(get(w, 'add-group').attributes('disabled')).toBeDefined();
      expect(writes(fetch)).toHaveLength(1);
    });
  });

  it('says so when a confirmed save cannot be shown, and reloads on request', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let offline = false;
    const { w } = await render({
      [READ]: () => (offline ? lost() : Response.json(saved)),
      [`DELETE ${GROUPS}/${GROUP_ELECTIVE_ID}`]: () => {
        saved = curriculum([BASE_GROUP]);
        offline = true;
        return new Response(null, { status: 204 });
      },
    });
    await get(groupRow(w, ELECTIVE_GROUP.name), 'group-delete').trigger('click');
    await flushPromises();
    await get(w.get('dialog[open]'), 'confirm-yes').trigger('click');
    await flushPromises();
    // The API answered: it is deleted. Only the list on screen is old.
    expect(useToast().message).toBe('Đã xóa nhóm Tự chọn thử.');
    expect(get(w, 'curriculum-stale').text()).toContain('Chưa tải lại được dữ liệu đã lưu. Những gì đang hiện có thể đã cũ.');
    offline = false;
    await get(w, 'curriculum-reload').trigger('click');
    await flushPromises();
    expect(has(w, 'curriculum-stale')).toBe(false);
    expect(w.findAll('[data-test="group-row"]')).toHaveLength(1);
  });

  describe('a save the API refuses because the grant was revoked meanwhile (UC-11 A4)', () => {
    it('keeps the form, the draft and the refusal on screen when the only grant is gone, while the navigation loses its entry', async () => {
      const { w, pinia } = await render({
        [`POST ${GROUPS}`]: () => {
          own = NO_GRANTS;
          return NO_PROGRAM_PERMISSION();
        },
      });
      await get(w, 'add-group').trigger('click');
      await flushPromises();
      await get(w.get('dialog[open]'), 'group-name').setValue('Nhóm đang nhập dở');
      await get(w.get('dialog[open]'), 'group-kind-elective').setValue(true);
      await submit(w);
      await flushPromises();

      // The grants were asked again: the navigation no longer lists Administration.
      expect(useAdminAccess(pinia).any).toBe(false);
      // The form is still there, with what was typed, and says why nothing was saved.
      expect(problem(w).attributes('data-code')).toBe('permission_required');
      expect(problem(w).text()).toBe('Thao tác này cần quyền “Quản trị chương trình”. Tài khoản của bạn không có quyền đó. Chưa lưu gì.');
      expect((get(w.get('dialog[open]'), 'group-name').element as HTMLInputElement).value).toBe('Nhóm đang nhập dở');
      expect(has(w, 'admin-no-permission')).toBe(false);

      // After Cancel the page is kept, and still says that the save was refused, and why.
      await get(w.get('dialog[open]'), 'dialog-cancel').trigger('click');
      await flushPromises();
      const refused = get(w, 'admin-refused');
      expect(refused.attributes('role')).toBe('alert');
      expect(refused.attributes('data-permission')).toBe('program_admin');
      expect(refused.text()).toContain('Lần lưu vừa rồi bị từ chối: thao tác đó cần quyền “Quản trị chương trình”, mà tài khoản của bạn không có. Chưa lưu gì.');
      expect(groupRow(w, BASE_GROUP.name).exists()).toBe(true);
      expect(has(w, 'admin-no-permission')).toBe(false);

      // Only when the administrator has read it does the page follow the grants they hold now.
      await get(w, 'admin-refused-close').trigger('click');
      await flushPromises();
      expect(has(w, 'admin-refused')).toBe(false);
      expect(has(w, 'admin-no-permission')).toBe(true);
      expect(w.find('[data-test="group-row"]').exists()).toBe(false);
    });

    it('says the save was refused when the administrator still holds another kind of permission, and keeps the link form as typed', async () => {
      const { w } = await render({
        [`PUT ${GROUPS}/${GROUP_BASE_ID}/courses/ZZ104`]: () => {
          own = CATALOG_MAINTAINER;
          return NO_PROGRAM_PERMISSION();
        },
      });
      await get(w, 'link-code').setValue('ZZ104');
      await get(w, 'group-panel').get('form').trigger('submit');
      await flushPromises();
      await flushPromises();
      // The sections follow the grants held now, but this one is not closed under the message.
      expect(w.findAll('.admin-tabs a').map((a) => a.text())).toEqual(['Danh mục học phần']);
      expect(has(w, 'admin-section-denied')).toBe(false);
      const note = get(w, 'group-panel').get('[data-test="admin-problem"]');
      expect(note.attributes('data-code')).toBe('permission_required');
      expect(note.text()).toContain('“Quản trị chương trình”');
      expect((get(w, 'link-code').element as HTMLInputElement).value).toBe('ZZ104');
      expect(get(w, 'admin-refused').text()).toContain('Lần lưu vừa rồi bị từ chối');
      expect(get(w, 'admin-refused').text()).toContain('Trang này được giữ nguyên để bạn chép lại những gì đã nhập.');
      useLocale().set('en');
      await flushPromises();
      expect(get(w, 'admin-refused').text()).toContain('The last save was refused: it needs the “Program administrator” permission, which your account does not hold. Nothing was saved.');
      expect(get(w, 'admin-refused-close').text()).toBe('Reload with my current permissions');

      await get(w, 'admin-refused-close').trigger('click');
      await flushPromises();
      expect(get(w, 'admin-section-denied').attributes('data-permission')).toBe('program_admin');
      expect(has(w, 'group-panel')).toBe(false);
    });

    it('keeps the offering-terms form open with its choice', async () => {
      const { w } = await render({
        [`PUT ${COHORT}/courses/ZZ103/offering-terms`]: () => {
          own = NO_GRANTS;
          return NO_PROGRAM_PERMISSION();
        },
      });
      await get(courseRow(w, 'ZZ103'), 'edit-terms').trigger('click');
      await flushPromises();
      await get(w.get('dialog[open]'), 'term-2').setValue(true);
      await submit(w);
      await flushPromises();
      expect(problem(w).attributes('data-code')).toBe('permission_required');
      expect((get(w.get('dialog[open]'), 'term-2').element as HTMLInputElement).checked).toBe(true);
      expect(has(w, 'admin-no-permission')).toBe(false);
    });

    it('stops offering a program whose grant was revoked, once the refusal has been read, and never sends the kept draft to another program', async () => {
      const { w, fetch } = await render({
        'GET /admin/programs': () => Response.json(own === BOTH_PROGRAMS ? adminPrograms() : { programs: [adminPrograms().programs[0]] }),
        [`PATCH ${GROUPS}/${GROUP_ELECTIVE_ID}`]: () => {
          own = ONLY_EMPTY_PROGRAM;
          return NO_PROGRAM_PERMISSION();
        },
      });
      await get(groupRow(w, ELECTIVE_GROUP.name), 'group-edit').trigger('click');
      await flushPromises();
      await get(w.get('dialog[open]'), 'group-name').setValue('Tên khác');
      await submit(w);
      await flushPromises();
      expect(problem(w).attributes('data-code')).toBe('permission_required');
      // The administrator still holds a program grant, so the section stays; the page is kept until the refusal is read.
      expect(optionsOf(get(w, 'admin-program'))).toHaveLength(2);
      // A second Save of the kept draft goes to the same cohort, which refuses it again.
      await submit(w);
      await flushPromises();
      expect(calls(fetch, 'PATCH').map(pathOf)).toEqual(Array(2).fill(`${GROUPS}/${GROUP_ELECTIVE_ID}`));
      await get(w.get('dialog[open]'), 'dialog-cancel').trigger('click');
      await flushPromises();
      await get(w, 'admin-refused-close').trigger('click');
      await flushPromises();
      expect(optionsOf(get(w, 'admin-program'))).toEqual(['ZZEMPTY · Chương trình thử chưa có khóa']);
      expect(has(w, 'no-cohorts')).toBe(true);
    });

    it('follows a change of the program grants that comes with no refusal at once', async () => {
      const { w, pinia } = await render({ 'GET /admin/programs': () => Response.json(own === BOTH_PROGRAMS ? adminPrograms() : { programs: [adminPrograms().programs[0]] }) });
      expect(optionsOf(get(w, 'admin-program'))).toHaveLength(2);
      own = ONLY_EMPTY_PROGRAM;
      useAdminAccess(pinia).cache = { userId: own.userId, grants: own };
      await flushPromises();
      expect(optionsOf(get(w, 'admin-program'))).toEqual(['ZZEMPTY · Chương trình thử chưa có khóa']);
    });
  });

  describe('a lost answer is settled from the right saved data (UC-11 A7)', () => {
    beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
    const reads = (fetch: ReturnType<typeof mockApi>, year: number) => calls(fetch, 'GET').filter((call) => pathOf(call) === `/programs/ZZPROG/curricula/${year}`).length;

    it('checks a link against the cohort it was sent to, after the administrator has moved to another cohort', async () => {
      let lose!: () => void;
      const other = curriculum([group('00000000-0000-4000-8000-000000000b01', 'Nhóm thử khóa 2025')], { id: CURRICULUM_2025_ID, code: 'ZZPROG2025', cohortYear: 2025, nameVi: 'CTĐT thử khóa 2025' });
      const { w, fetch } = await render({
        'GET /programs/ZZPROG/curricula/2025': other,
        [`PUT ${GROUPS}/${GROUP_BASE_ID}/courses/ZZ104`]: () =>
          new Promise<Response>((_resolve, reject) => {
            lose = () => {
              // The API linked the course in cohort 2024; only the answer is lost.
              saved = curriculum([{ ...BASE_GROUP, courses: [...BASE_GROUP.courses, course('ZZ104')] }, ELECTIVE_GROUP]);
              reject(new TypeError('Failed to fetch'));
            };
          }),
      });
      await get(w, 'link-code').setValue('ZZ104');
      await get(w, 'group-panel').get('form').trigger('submit');
      await flushPromises();
      // The request is still out when the administrator opens another cohort.
      await chooseOption(get(w, 'admin-cohort'), 'Khóa 2025');
      await flushPromises();
      expect(get(w, 'curriculum-summary').text()).toContain('ZZPROG2025');
      const [before2024, before2025] = [reads(fetch, 2024), reads(fetch, 2025)];
      lose();
      await flushPromises();
      // The saved data of cohort 2024 is read, not that of the cohort now on screen.
      expect([reads(fetch, 2024), reads(fetch, 2025)]).toEqual([before2024 + 1, before2025]);
      const late = get(w, 'admin-late');
      expect(late.text()).toContain('ZZPROG · Khóa 2024');
      expect(late.text()).toContain('Dữ liệu đã lưu có thay đổi này.');
      // Nothing claims the link is missing, and cohort 2025 stays on screen untouched.
      expect(w.find('[data-test="admin-problem"]').exists()).toBe(false);
      expect(w.findAll('[data-test="group-row"]').map((row) => row.attributes('data-group-name'))).toEqual(['Nhóm thử khóa 2025']);
    });

    it('reads the saved data again for a new group even when a group of that name is already on screen', async () => {
      const { w, fetch } = await render({ [`POST ${GROUPS}`]: lost });
      const before = reads(fetch, 2024);
      await get(w, 'add-group').trigger('click');
      await flushPromises();
      await get(w.get('dialog[open]'), 'group-name').setValue(ELECTIVE_GROUP.name);
      await get(w.get('dialog[open]'), 'group-kind-elective').setValue(true);
      await get(w.get('dialog[open]'), 'group-notes').setValue(ELECTIVE_GROUP.officialNotes!);
      await submit(w);
      // "OmniCourse reloaded the saved data" is said only after a reload.
      expect(reads(fetch, 2024)).toBe(before + 1);
      expect(problem(w).attributes('data-code')).toBe('not_applied');
    });

    it('finds a new group by an ID that was not there before, whatever its name', async () => {
      const twin = group(NEW_GROUP_ID, 'Nhóm thử mới', { kind: 'elective' });
      const { w } = await render({
        [`POST ${GROUPS}`]: () => {
          saved = curriculum([BASE_GROUP, twin, ELECTIVE_GROUP]);
          return lost();
        },
      });
      await get(w, 'add-group').trigger('click');
      await flushPromises();
      await get(w.get('dialog[open]'), 'group-name').setValue('Nhóm thử mới');
      await get(w.get('dialog[open]'), 'group-kind-elective').setValue(true);
      await submit(w);
      expect(w.find('dialog[open]').exists()).toBe(false);
      expect(get(w, 'admin-notice').text()).toContain('Dữ liệu đã lưu có thay đổi này.');
      expect(get(w, 'group-panel').attributes('data-group-id')).toBe(NEW_GROUP_ID);
    });

    it('warns that the page may be out of date after Cancel on an unknown outcome, and asks for the reload before another write', async () => {
      let offline = false;
      const { w, fetch } = await render({
        [READ]: () => (offline ? lost() : Response.json(saved)),
        [`PATCH ${GROUPS}/${GROUP_ELECTIVE_ID}`]: () => {
          saved = curriculum([BASE_GROUP, { ...ELECTIVE_GROUP, name: 'Tự chọn thử B' }]);
          offline = true;
          return lost();
        },
      });
      await get(groupRow(w, ELECTIVE_GROUP.name), 'group-edit').trigger('click');
      await flushPromises();
      await get(w.get('dialog[open]'), 'group-name').setValue('Tự chọn thử B');
      await submit(w);
      expect(problem(w).attributes('data-code')).toBe('unknown');
      // The same write cannot be sent again before the saved data has been read.
      expect(get(w.get('dialog[open]'), 'dialog-save').attributes('disabled')).toBeDefined();
      await submit(w);
      expect(calls(fetch, 'PATCH')).toHaveLength(1);

      await get(w.get('dialog[open]'), 'dialog-cancel').trigger('click');
      await flushPromises();
      expect(get(w, 'curriculum-stale').text()).toContain('Những gì đang hiện có thể đã cũ.');
      for (const control of ['add-group', 'group-edit', 'group-delete', 'edit-prerequisites', 'edit-terms', 'unlink-course']) expect(get(w, control).attributes('disabled'), control).toBeDefined();
      await get(w, 'link-code').setValue('ZZ104');
      expect(get(w, 'link-submit').attributes('disabled')).toBeDefined();

      offline = false;
      await get(w, 'curriculum-reload').trigger('click');
      await flushPromises();
      expect(has(w, 'curriculum-stale')).toBe(false);
      expect(groupRow(w, 'Tự chọn thử B').exists()).toBe(true);
      expect(get(w, 'add-group').attributes('disabled')).toBeUndefined();
      expect(get(w, 'link-submit').attributes('disabled')).toBeUndefined();
    });
  });

  it('stays on the page while a write is out, and leaves once it is answered', async () => {
    let answer!: (response: Response) => void;
    const { w, router } = await render({ [`PATCH ${GROUPS}/${GROUP_ELECTIVE_ID}`]: () => new Promise<Response>((resolve) => (answer = resolve)) });
    await get(groupRow(w, ELECTIVE_GROUP.name), 'group-edit').trigger('click');
    await flushPromises();
    await get(w.get('dialog[open]'), 'group-name').setValue('Tên khác');
    await submit(w);
    await router.push('/admin/access').catch(() => {});
    expect(router.currentRoute.value.name).toBe('admin-curriculum');
    expect(w.find('dialog[open]').exists()).toBe(true);
    answer(NO_PROGRAM_PERMISSION());
    await flushPromises();
    expect(problem(w).attributes('data-code')).toBe('permission_required');
    // The request is answered and its result is on screen: the administrator may leave.
    await router.push('/admin/access');
    expect(router.currentRoute.value.name).toBe('admin-access');
  });

  it('clears a refused link code\'s error when the administrator does something else', async () => {
    const { w } = await render({
      [`PUT ${GROUPS}/${GROUP_BASE_ID}/courses/a%20b!`]: status(400, { statusCode: 400, code: 'validation_failed', message: 'courseCode: "a b!" is not a course code (letters A-Z and digits, 2 to 20)' }),
    });
    await get(w, 'link-code').setValue('a b!');
    await get(w, 'group-panel').get('form').trigger('submit');
    await flushPromises();
    expect(w.find('#link-error').exists()).toBe(true);
    // Typing a new code: the old refusal is no longer about what is in the box.
    await get(w, 'link-code').setValue('ZZ104');
    expect(w.find('#link-error').exists()).toBe(false);
    expect(get(w, 'group-panel').find('[data-test="admin-problem"]').exists()).toBe(false);

    await get(w, 'link-code').setValue('a b!');
    await get(w, 'group-panel').get('form').trigger('submit');
    await flushPromises();
    expect(w.find('#link-error').exists()).toBe(true);
    // Another action on the page, here opening a form.
    await get(courseRow(w, 'ZZ103'), 'edit-terms').trigger('click');
    await flushPromises();
    expect(w.find('#link-error').exists()).toBe(false);
    expect(get(w, 'link-code').attributes('aria-invalid')).toBeUndefined();
  });

  it('shows a long printed rule in two lines with a control to read all of it, and a short one in full', async () => {
    const long = 'Sinh viên chọn tối thiểu 12 tín chỉ trong nhóm này, trong đó có ít nhất một học phần thực hành, theo ghi chú in dưới bảng của văn bản chính thức năm 2024.';
    saved = curriculum([BASE_GROUP, { ...ELECTIVE_GROUP, officialNotes: 'Chọn 8 tín chỉ.' }, group(NEW_GROUP_ID, 'Tự chọn thử khác', { kind: 'elective', officialNotes: long })]);
    const { w } = await render();
    const rows = w.findAll('[data-test="group-note-row"]');
    expect(rows).toHaveLength(2);
    // The short rule: all of it, and nothing to press.
    expect(rows[0]!.get('[data-test="group-note"]').classes()).not.toContain('clamped');
    expect(rows[0]!.find('[data-test="group-note-toggle"]').exists()).toBe(false);
    // The long rule: the whole text is in the page, cut to two lines for the eye, with a button that says its state.
    const note = rows[1]!.get('[data-test="group-note"]');
    const toggle = rows[1]!.get('[data-test="group-note-toggle"]');
    expect(note.text()).toBe(long);
    expect(note.classes()).toContain('clamped');
    expect([toggle.element.tagName, toggle.text(), toggle.attributes('aria-expanded'), toggle.attributes('aria-controls')]).toEqual(['BUTTON', 'Xem thêm', 'false', note.attributes('id')]);
    // The name a screen reader says starts with the words on the button, then says which group.
    expect(toggle.attributes('aria-label')).toBe('Xem thêm ghi chú quy tắc của nhóm Tự chọn thử khác');
    await toggle.trigger('click');
    expect(note.classes()).not.toContain('clamped');
    expect([toggle.text(), toggle.attributes('aria-expanded'), toggle.attributes('aria-label')]).toEqual(['Thu gọn', 'true', 'Thu gọn ghi chú quy tắc của nhóm Tự chọn thử khác']);
    await toggle.trigger('click');
    expect(note.classes()).toContain('clamped');
  });

  it('opens another cohort of the program, and says when a program has no cohort', async () => {
    const other = curriculum([group('00000000-0000-4000-8000-000000000b01', 'Nhóm thử khóa 2025')], { id: CURRICULUM_2025_ID, code: 'ZZPROG2025', cohortYear: 2025, nameVi: 'CTĐT thử khóa 2025' });
    const { w, fetch } = await render({
      'GET /programs/ZZPROG/curricula/2025': other,
      [`POST /admin/programs/${PROGRAM_ID}/cohorts/${CURRICULUM_2025_ID}/requirement-groups`]: status(409, { statusCode: 409, code: 'duplicate_name', message: 'x' }),
    });
    await chooseOption(get(w, 'admin-cohort'), 'Khóa 2025');
    await flushPromises();
    expect(get(w, 'curriculum-summary').text()).toContain('CTĐT thử khóa 2025 · ZZPROG2025');
    expect(w.findAll('[data-test="group-row"]').map((row) => row.attributes('data-group-name'))).toEqual(['Nhóm thử khóa 2025']);
    // A write goes to the cohort on screen.
    await get(w, 'add-group').trigger('click');
    await flushPromises();
    await submit(w);
    expect(calls(fetch, 'POST').map(pathOf)).toEqual([`/admin/programs/${PROGRAM_ID}/cohorts/${CURRICULUM_2025_ID}/requirement-groups`]);
    await get(w.get('dialog[open]'), 'dialog-cancel').trigger('click');

    await chooseOption(get(w, 'admin-program'), 'ZZEMPTY · Chương trình thử chưa có khóa');
    await flushPromises();
    expect(get(w, 'no-cohorts').text()).toBe('Chương trình này chưa có khóa nào. Trang này chưa thêm khóa được.');
    expect(has(w, 'admin-cohort')).toBe(false);
    expect(has(w, 'add-group')).toBe(false);
  });

  it('says when the programs or the curriculum cannot be loaded, and tries again', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let programsDown = true;
    let curriculumDown = true;
    const fetch = mockApi({
      'GET /admin/grants': PROGRAM_ADMIN,
      'GET /admin/programs': () => (programsDown ? new Response(null, { status: 503 }) : Response.json({ programs: [adminPrograms().programs[1]] })),
      [READ]: () => (curriculumDown ? new Response(null, { status: 503 }) : Response.json(saved)),
    });
    const app = await setup('/admin/curriculum');
    wrapper = mount(RouterView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
    await flushPromises();
    expect(get(wrapper, 'programs-failed').text()).toContain('Chưa tải được các chương trình bạn quản trị.');
    programsDown = false;
    await get(wrapper, 'programs-failed').get('button').trigger('click');
    await flushPromises();
    expect(get(wrapper, 'curriculum-failed').text()).toContain('Chưa tải được chương trình đào tạo của khóa này.');
    curriculumDown = false;
    await get(wrapper, 'curriculum-failed').get('button').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('[data-test="group-row"]')).toHaveLength(2);
    expect(fetch).toHaveBeenCalled();
  });

  it('says when the cohort has no curriculum (404), which is not a failure', async () => {
    const { w } = await render({ [READ]: status(404, { statusCode: 404, message: 'No curriculum for this program and cohort', error: 'Not Found' }) });
    expect(get(w, 'no-curriculum').text()).toBe('Khóa này chưa có chương trình đào tạo.');
    expect(has(w, 'curriculum-failed')).toBe(false);
  });

  it('reads in English', async () => {
    const { w } = await render();
    useLocale().set('en');
    await flushPromises();
    expect(get(w, 'groups-title').text()).toBe('2 requirement groups');
    expect(groupRow(w, ELECTIVE_GROUP.name).findAll('td').slice(0, 2).map((cell) => cell.text())).toEqual(['Elective', 'At least 8 cr']);
    expect(get(w, 'add-group').text()).toBe('Add group');
    expect(get(w, 'link-submit').text()).toBe('Add course to group');
    expect(get(courseRow(w, 'ZZ101'), 'edit-prerequisites').attributes('aria-label')).toBe('Edit the prerequisites of ZZ101');
    await get(courseRow(w, 'ZZ101'), 'edit-terms').trigger('click');
    await flushPromises();
    expect(w.get('dialog[open] h2').text()).toBe('Offering terms of ZZ101');
    expect(w.get('dialog[open]').findAll('label.check').map((label) => label.text())).toEqual(['Term 1', 'Term 2', 'Term 3']);
  });

  it('says the late answer of a link sent for another group with that group, not under the box of the group now open (#160)', async () => {
    let answer!: (res: Response) => void;
    const { w } = await render({ [`PUT ${GROUPS}/${GROUP_BASE_ID}/courses/ZZ999`]: () => new Promise<Response>((resolve) => (answer = resolve)) });
    await get(w, 'link-code').setValue('ZZ999');
    await get(w, 'group-panel').get('form').trigger('submit');
    await flushPromises();
    await groupRow(w, ELECTIVE_GROUP.name).get('[data-test="group-open"]').trigger('click');
    await flushPromises();
    answer(Response.json({ statusCode: 404, code: 'not_found', message: 'x' }, { status: 404 }));
    await flushPromises();
    expect(get(w, 'group-panel').attributes('data-group-id')).toBe(GROUP_ELECTIVE_ID);
    expect(get(w, 'group-panel').find('[data-test="admin-problem"]').exists()).toBe(false);
    expect(get(w, 'admin-late').text()).toContain(BASE_GROUP.name);
    expect(get(w, 'admin-late').text()).toContain('Không tìm thấy');
  });

});
