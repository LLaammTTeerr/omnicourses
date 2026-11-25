import { flushPromises, mount, type DOMWrapper, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView } from 'vue-router';
import { useLocale } from '../locale.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { chooseOption } from '../testing/select.js';
import { setup } from '../testing/signed-in.js';
import type { CatalogImportPreview, GroupLinkImportPreview, UserGrants } from './api.js';
import { AFFECTED_2024, AFFECTED_2025, adminPrograms, CATALOG_MAINTAINER, CURRICULUM_2025_ID, CURRICULUM_ID, EVERY_GRANT, GROUP_BASE_ID, PROGRAM_ADMIN, PROGRAM_ID } from './testing/fixtures.js';

// Synthetic files only (AGENTS.md hard rule 3): made-up codes and names.
const CATALOG = '/admin/catalog/imports';
const LINKS = (curriculumId: string) => `/admin/programs/${PROGRAM_ID}/cohorts/${curriculumId}/imports`;
const CATALOG_CSV = 'code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods\r\nZZ300,Học phần thử ZZ300,,4,45,30,,\r\nzz101,Học phần thử ZZ101,Test course ZZ101,3,45,30,,0\r\n';
const LINKS_CSV = 'requirement_group_name,course_code\nKiến thức cơ sở thử,ZZ300\nKiến thức cơ sở thử,ZZ101\n';
const course = { nameEn: null, theoryPeriods: 45, labPeriods: 30, exercisePeriods: 0, projectPeriods: 0 };

const catalogPreview = (overrides: Partial<CatalogImportPreview> = {}): CatalogImportPreview => ({
  fileType: 'catalog_courses',
  errors: [],
  summary: { inserts: 1, updates: 1, noOps: 0 },
  reviewVersion: 'zz-review-1',
  rows: [
    { record: 2, action: 'insert', code: 'ZZ300', nameVi: 'Học phần thử ZZ300', credits: 4, ...course, changedFields: [], current: null, affectedCurricula: [] },
    {
      record: 3,
      action: 'update',
      code: 'ZZ101',
      nameVi: 'Học phần thử ZZ101',
      credits: 3,
      ...course,
      nameEn: 'Test course ZZ101',
      changedFields: ['credits', 'exercisePeriods'],
      current: { code: 'ZZ101', nameVi: 'Học phần thử ZZ101', credits: 4, ...course, nameEn: 'Test course ZZ101', exercisePeriods: null },
      affectedCurricula: [AFFECTED_2024, AFFECTED_2025],
    },
  ],
  affectedCurricula: [AFFECTED_2024, AFFECTED_2025],
  ...overrides,
});
/** The same file once it is saved: every row is a no-op. */
const appliedPreview = () =>
  catalogPreview({ summary: { inserts: 0, updates: 0, noOps: 2 }, reviewVersion: 'zz-review-9', rows: catalogPreview().rows.map((row) => ({ ...row, action: 'no_op', changedFields: [], current: null, affectedCurricula: [] })), affectedCurricula: [] });
const linkPreview = (): GroupLinkImportPreview => ({
  fileType: 'group_links',
  programId: PROGRAM_ID,
  curriculumId: CURRICULUM_2025_ID,
  errors: [],
  summary: { inserts: 1, updates: 0, noOps: 1 },
  reviewVersion: 'zz-review-links',
  rows: [
    { record: 2, action: 'insert', requirementGroupName: 'Kiến thức cơ sở thử', requirementGroupId: GROUP_BASE_ID, courseCode: 'ZZ300' },
    { record: 3, action: 'no_op', requirementGroupName: 'Kiến thức cơ sở thử', requirementGroupId: GROUP_BASE_ID, courseCode: 'ZZ101' },
  ],
});

let wrapper: VueWrapper | undefined;
let own: UserGrants;

async function render(path = '/admin/import', routes: Record<string, unknown> = {}) {
  const fetch = mockApi({ 'GET /admin/grants': () => Response.json(own), 'GET /admin/programs': adminPrograms(), ...routes });
  const app = await setup(path);
  wrapper = mount(RouterView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch, ...app };
}

type Scope = Pick<DOMWrapper<Element>, 'get'>;
const get = (w: Scope, test: string) => w.get(`[data-test="${test}"]`);
const has = (w: VueWrapper, test: string) => w.find(`[data-test="${test}"]`).exists();
const posts = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.filter(([, init]) => init?.method === 'POST').map((call) => [String(call[0]).split('/api')[1], sentBody(call[1])]);
const disabled = (w: VueWrapper, test: string) => get(w, test).attributes('disabled') !== undefined;

async function choose(w: VueWrapper, content: string | Uint8Array<ArrayBuffer>, name = 'zz-thu.csv') {
  const input = get(w, 'import-file');
  Object.defineProperty(input.element, 'files', { value: [new File([content], name, { type: 'text/csv' })], configurable: true });
  await input.trigger('change');
  await vi.waitFor(() => expect(has(w, 'import-file-read') || has(w, 'import-file-problem')).toBe(true));
}
async function previewFile(w: VueWrapper) {
  await w.get('form.import-file').trigger('submit');
  await flushPromises();
}
async function press(w: VueWrapper, test: string) {
  await get(w, test).trigger('click');
  await flushPromises();
}

describe('ImportAdmin (F12, UC-11 A9): CSV bulk entry with a preview', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    own = EVERY_GRANT;
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('offers only the file types the user may import, each with its exact header to copy or download', async () => {
    own = CATALOG_MAINTAINER;
    const { w } = await render();
    expect(w.findAll('input[name="import-type"]').map((input) => input.attributes('value'))).toEqual(['catalog_courses']);
    expect((get(w, 'import-header').element as HTMLInputElement).value).toBe('code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods');
    const template = get(w, 'import-template');
    expect(template.attributes('download')).toBe('omnicourse-catalog-courses-template.csv');
    expect(decodeURIComponent(template.attributes('href')!.split(',')[1]!)).toBe('code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods\r\n');
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await press(w, 'import-copy-header');
    expect(writeText).toHaveBeenCalledWith('code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods');
    expect(useToast().message).toBe('Đã chép tiêu đề.');
    wrapper!.unmount();

    own = PROGRAM_ADMIN;
    const links = await render();
    expect(links.w.findAll('input[name="import-type"]').map((input) => input.attributes('value'))).toEqual(['group_links']);
    expect((get(links.w, 'import-header').element as HTMLInputElement).value).toBe('requirement_group_name,course_code');
  });

  it("reads the file in the browser, sends it as JSON text to the preview, and shows each row's action, the changes and the curricula they reach", async () => {
    const { w, fetch } = await render('/admin/import?type=catalog_courses', { [`POST ${CATALOG}/preview`]: catalogPreview() });
    expect(disabled(w, 'import-preview')).toBe(true);
    await choose(w, CATALOG_CSV);
    expect(get(w, 'import-file-read').text()).toBe('Đã đọc zz-thu.csv (1 KiB).');
    await previewFile(w);
    expect(posts(fetch)).toEqual([[`${CATALOG}/preview`, { csv: CATALOG_CSV }]]);
    expect(get(w, 'import-summary').text()).toBe('1 thêm mới · 1 cập nhật · 0 không đổi');
    const rows = w.findAll('[data-test="import-row"]');
    expect(rows.map((row) => [row.attributes('data-record'), row.attributes('data-action')])).toEqual([
      ['2', 'insert'],
      ['3', 'update'],
    ]);
    // In words, not by colour.
    expect(rows.map((row) => row.findAll('td')[0]!.text())).toEqual(['Thêm mới', 'Cập nhật']);
    expect(rows[1]!.findAll('.import-changes li').map((li) => li.text())).toEqual(['Tín chỉ: 4 → 3', 'Tiết bài tập (BT): Để trống → 0']);
    expect(w.findAll('[data-test="import-affected-curriculum"]').map((li) => li.text())).toEqual(['ZZPROG · Khóa 2024 (ZZPROG2024)', 'ZZPROG · Khóa 2025 (ZZPROG2025)']);
    expect(get(w, 'import-affected').text()).toContain('2 chương trình đào tạo sẽ đọc giá trị mới');
    expect(disabled(w, 'import-confirm')).toBe(false);
  });

  it('lists every error by its record number, never a line, and offers no confirmation', async () => {
    const errors = [
      { record: 3, field: 'credits', message: 'credits must be an integer number' },
      { record: 5, field: null, message: 'has 3 fields; the template has 8' },
    ];
    const { w } = await render('/admin/import?type=catalog_courses', {
      [`POST ${CATALOG}/preview`]: catalogPreview({ errors, reviewVersion: null, summary: { inserts: 1, updates: 0, noOps: 0 }, rows: [catalogPreview().rows[0]!], affectedCurricula: [] }),
    });
    await choose(w, CATALOG_CSV);
    await previewFile(w);
    const list = get(w, 'import-errors');
    expect(list.text()).toContain('Tệp có 2 lỗi. Chưa lưu gì: sửa tệp rồi chọn lại.');
    expect(w.findAll('[data-test="import-error"]').map((row) => row.findAll('th, td').map((cell) => cell.text()))).toEqual([
      ['Bản ghi 3', 'credits', 'credits must be an integer number'],
      ['Bản ghi 5', 'Cả bản ghi', 'has 3 fields; the template has 8'],
    ]);
    expect(list.text()).not.toMatch(/dòng \d/i);
    expect(disabled(w, 'import-confirm')).toBe(true);
    useLocale().set('en');
    await flushPromises();
    expect(w.findAll('[data-test="import-error"]').map((row) => row.get('th').text())).toEqual(['Record 3', 'Record 5']);
  });

  it('confirms the same text with the review version, says what was saved, and drops the file', async () => {
    const { w, fetch } = await render('/admin/import?type=catalog_courses', {
      [`POST ${CATALOG}/preview`]: catalogPreview(),
      [`POST ${CATALOG}/confirm`]: { fileType: 'catalog_courses', summary: { inserts: 1, updates: 1, noOps: 0 } },
    });
    await choose(w, CATALOG_CSV);
    await previewFile(w);
    await press(w, 'import-confirm');
    expect(posts(fetch)[1]).toEqual([`${CATALOG}/confirm`, { csv: CATALOG_CSV, reviewVersion: 'zz-review-1' }]);
    expect(useToast().message).toBe('Đã lưu tệp: 1 thêm mới, 1 cập nhật.');
    expect(has(w, 'import-result')).toBe(false);
    expect(has(w, 'import-file-read')).toBe(false);
    expect(document.activeElement).toBe(get(w, 'import-file').element);
  });

  it('sends nothing on Cancel, and drops the file and its preview', async () => {
    const { w, fetch } = await render('/admin/import?type=catalog_courses', { [`POST ${CATALOG}/preview`]: catalogPreview() });
    await choose(w, CATALOG_CSV);
    await previewFile(w);
    await press(w, 'import-cancel');
    expect(posts(fetch).map(([path]) => path)).toEqual([`${CATALOG}/preview`]);
    expect(useToast().message).toBe('Đã bỏ tệp. Chưa lưu gì.');
    expect(has(w, 'import-result')).toBe(false);
    expect(disabled(w, 'import-preview')).toBe(true);
  });

  it('says so when the data changed since the preview (409 impact_changed), previews again, and confirms the new review', async () => {
    let previews = 0;
    let confirms = 0;
    const { w, fetch } = await render('/admin/import?type=catalog_courses', {
      [`POST ${CATALOG}/preview`]: () => Response.json(catalogPreview({ reviewVersion: `zz-review-${++previews}` })),
      [`POST ${CATALOG}/confirm`]: () =>
        ++confirms === 1
          ? Response.json({ statusCode: 409, code: 'impact_changed', message: 'The file, the saved values or the references changed since the preview' }, { status: 409 })
          : Response.json({ fileType: 'catalog_courses', summary: { inserts: 1, updates: 1, noOps: 0 } }),
    });
    await choose(w, CATALOG_CSV);
    await previewFile(w);
    await press(w, 'import-confirm');
    expect(get(w, 'import-changed').text()).toBe('Từ lúc xem trước, tệp hoặc dữ liệu đã lưu đã đổi. Chưa lưu gì. Kết quả dưới đây là bản xem trước mới: xem lại rồi xác nhận lần nữa.');
    expect(has(w, 'admin-problem')).toBe(false);
    expect(previews).toBe(2);
    await press(w, 'import-confirm');
    expect(posts(fetch).filter(([path]) => path === `${CATALOG}/confirm`).map(([, body]) => (body as { reviewVersion: string }).reviewVersion)).toEqual(['zz-review-1', 'zz-review-2']);
    expect(useToast().message).toBe('Đã lưu tệp: 1 thêm mới, 1 cập nhật.');
  });

  it('shows where a file the API cannot read is wrong, by record', async () => {
    const { w } = await render('/admin/import?type=catalog_courses', {
      [`POST ${CATALOG}/preview`]: status(400, {
        statusCode: 400,
        code: 'validation_failed',
        message: 'The CSV does not have the header of this template',
        errors: [{ record: 1, field: null, message: 'the header must be exactly: code,name_vi,name_en,credits,theory_periods,lab_periods,exercise_periods,project_periods' }],
      }),
    });
    await choose(w, 'code,name\nZZ300,x\n');
    await previewFile(w);
    expect(get(w, 'import-errors').text()).toContain('Máy chủ không đọc được tệp này. Chưa lưu gì.');
    expect(w.findAll('[data-test="import-error"]').map((row) => row.attributes('data-record'))).toEqual(['1']);
    expect(disabled(w, 'import-confirm')).toBe(true);
  });

  it.each([
    [403, { statusCode: 403, code: 'permission_required', permission: 'catalog_maintainer', message: 'x' }, 'permission_required', 'Thao tác này cần quyền “Quản lý danh mục học phần”. Tài khoản của bạn không có quyền đó. Chưa lưu gì.'],
    [404, { statusCode: 404, code: 'not_found', message: 'No such cohort in this program' }, 'not_found', 'Không tìm thấy mục này. Có thể nó đã bị xóa, hoặc không thuộc chương trình này. Chưa lưu gì.'],
    [413, { statusCode: 413, code: 'payload_too_large', message: 'x' }, 'payload_too_large', 'Yêu cầu vượt giới hạn kích thước của máy chủ. Một tệp CSV được tối đa 1 MiB và 1.000 bản ghi khi tài khoản có quyền nhập loại tệp đó; nếu không, một yêu cầu chỉ được tối đa 100 KiB. Chia tệp thành nhiều tệp nhỏ hơn. Chưa lưu gì.'],
    [415, { statusCode: 415, code: 'unsupported_content_encoding', message: 'x' }, 'unsupported_content_encoding', 'Máy chủ không nhận yêu cầu đã nén. Chưa lưu gì.'],
  ])('says a %i refusal of the preview in words', async (code, body, reason, words) => {
    const { w } = await render('/admin/import?type=catalog_courses', { [`POST ${CATALOG}/preview`]: status(code, body), 'GET /admin/grants': () => Response.json(own) });
    await choose(w, CATALOG_CSV);
    await previewFile(w);
    const note = get(w, 'admin-problem');
    expect(note.attributes('data-code')).toBe(reason);
    expect(note.text()).toBe(words);
    expect(has(w, 'import-confirm')).toBe(false);
  });

  it('words a 413 so it is also true for the 100 KiB limit of a caller without the grant, in English too', async () => {
    const { w } = await render('/admin/import?type=catalog_courses', { [`POST ${CATALOG}/preview`]: status(413) });
    useLocale().set('en');
    await choose(w, CATALOG_CSV);
    await previewFile(w);
    expect(get(w, 'admin-problem').text()).toBe('The request is over a size limit of the server. A CSV file may have up to 1 MiB and 1,000 records when your account may import that type of file; otherwise a request may have only up to 100 KiB. Split the file into smaller files. Nothing was saved.');
  });

  it('sends no file over 1 MiB, with more than 1,000 records, or that is not UTF-8, and says why', async () => {
    const { w, fetch } = await render('/admin/import?type=catalog_courses');
    await choose(w, `${CATALOG_CSV}${'x'.repeat(1024 * 1024)}`);
    expect(get(w, 'import-file-problem').text()).toBe('Tệp nặng 1.0 MiB, quá 1 MiB. Chia thành nhiều tệp nhỏ hơn. Chưa gửi gì.');
    expect(get(w, 'import-file').attributes('aria-invalid')).toBe('true');
    expect(disabled(w, 'import-preview')).toBe(true);
    await choose(w, `requirement_group_name,course_code\n${'Nhóm thử,ZZ101\n'.repeat(1001)}`);
    expect(get(w, 'import-file-problem').text()).toBe('Tệp có 1001 bản ghi, quá 1.000. Chia thành nhiều tệp nhỏ hơn. Chưa gửi gì.');
    await choose(w, new Uint8Array([0x63, 0x6f, 0x64, 0x65, 0x0a, 0x4d, 0xf4, 0x6e]));
    expect(get(w, 'import-file-problem').text()).toBe('Tệp này không phải văn bản UTF-8. Lưu lại tệp dưới dạng “CSV UTF-8” rồi chọn lại. Chưa gửi gì.');
    expect(posts(fetch)).toEqual([]);
  });

  describe('a confirmation whose answer is lost (UC-11 A7)', () => {
    beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));

    async function lose(after: () => Response | Promise<Response>) {
      let previews = 0;
      const rendered = await render('/admin/import?type=catalog_courses', {
        [`POST ${CATALOG}/preview`]: () => (++previews === 1 ? Response.json(catalogPreview()) : after()),
        [`POST ${CATALOG}/confirm`]: () => {
          throw new TypeError('Failed to fetch');
        },
      });
      await choose(rendered.w, CATALOG_CSV);
      await previewFile(rendered.w);
      await press(rendered.w, 'import-confirm');
      return rendered;
    }
    const confirms = (fetch: ReturnType<typeof mockApi>) => posts(fetch).filter(([path]) => path === `${CATALOG}/confirm`);

    it('says saved when the file previews again as nothing to do, and never sends it twice', async () => {
      const { w, fetch } = await lose(() => Response.json(appliedPreview()));
      expect(confirms(fetch)).toHaveLength(1);
      expect(get(w, 'admin-notice').text()).toBe('Máy chủ không trả lời yêu cầu lưu, nên OmniCourse đã tải lại dữ liệu đã lưu. Dữ liệu đã lưu có thay đổi này.');
      expect(has(w, 'import-result')).toBe(false);
    });

    it('says not saved when the file still has changes to make, and shows that new preview to confirm', async () => {
      const { w, fetch } = await lose(() => Response.json(catalogPreview({ reviewVersion: 'zz-review-2' })));
      expect(get(w, 'admin-problem').attributes('data-code')).toBe('not_applied');
      expect(disabled(w, 'import-confirm')).toBe(false);
      await get(w, 'import-confirm').trigger('click');
      await flushPromises();
      expect(confirms(fetch).map(([, body]) => (body as { reviewVersion: string }).reviewVersion)).toEqual(['zz-review-1', 'zz-review-2']);
    });

    it('says unknown when the preview fails too, sends nothing more, and settles it on "Reload the data"', async () => {
      let online = false;
      const { w, fetch } = await lose(() => {
        if (!online) throw new TypeError('Failed to fetch');
        return Response.json(appliedPreview());
      });
      const note = get(w, 'admin-problem');
      expect(note.attributes('data-code')).toBe('unknown');
      expect(disabled(w, 'import-confirm')).toBe(true);
      online = true;
      await get(note, 'admin-reload').trigger('click');
      await flushPromises();
      expect(confirms(fetch)).toHaveLength(1);
      expect(get(w, 'admin-notice').text()).toContain('Dữ liệu đã lưu có thay đổi này.');
    });
  });

  it("imports the group links of the cohort the curriculum screen sent, through that cohort's routes", async () => {
    own = PROGRAM_ADMIN;
    const { w, fetch } = await render(`/admin/import?type=group_links&program=${PROGRAM_ID}&cohort=${CURRICULUM_2025_ID}`, {
      [`POST ${LINKS(CURRICULUM_2025_ID)}/preview`]: linkPreview(),
      [`POST ${LINKS(CURRICULUM_2025_ID)}/confirm`]: { fileType: 'group_links', summary: { inserts: 1, updates: 0, noOps: 1 } },
    });
    expect(get(w, 'import-cohort').text()).toContain('Khóa 2025');
    await choose(w, LINKS_CSV);
    await previewFile(w);
    expect(w.findAll('[data-test="import-row"]').map((row) => row.findAll('th, td').map((cell) => cell.text()))).toEqual([
      ['Bản ghi 2', 'Thêm mới', 'Kiến thức cơ sở thử', 'ZZ300'],
      ['Bản ghi 3', 'Không đổi', 'Kiến thức cơ sở thử', 'ZZ101'],
    ]);
    expect(has(w, 'import-affected')).toBe(false);
    await press(w, 'import-confirm');
    expect(posts(fetch)).toEqual([
      [`${LINKS(CURRICULUM_2025_ID)}/preview`, { csv: LINKS_CSV }],
      [`${LINKS(CURRICULUM_2025_ID)}/confirm`, { csv: LINKS_CSV, reviewVersion: 'zz-review-links' }],
    ]);
  });

  it('drops the preview when the file type or the cohort changes, since it was made for the other one', async () => {
    const { w } = await render(`/admin/import?type=group_links&program=${PROGRAM_ID}&cohort=${CURRICULUM_ID}`, { [`POST ${LINKS(CURRICULUM_ID)}/preview`]: linkPreview() });
    await choose(w, LINKS_CSV);
    await previewFile(w);
    expect(has(w, 'import-result')).toBe(true);
    await chooseOption(get(w, 'import-cohort'), 'Khóa 2025');
    await flushPromises();
    expect(has(w, 'import-result')).toBe(false);
    // The file read stays: it can be previewed for the cohort chosen now.
    expect(has(w, 'import-file-read')).toBe(true);
    await get(w, 'import-type-catalog_courses').setValue(true);
    await flushPromises();
    expect((get(w, 'import-header').element as HTMLInputElement).value.startsWith('code,name_vi')).toBe(true);
  });

  it('keeps the program and the cohort while a confirmation is out, and says its 409 for the cohort it was sent to (#165)', async () => {
    let answer: (response: Response) => void = () => {};
    let previews = 0;
    const { w, fetch } = await render(`/admin/import?type=group_links&program=${PROGRAM_ID}&cohort=${CURRICULUM_ID}`, {
      [`POST ${LINKS(CURRICULUM_ID)}/preview`]: () => Response.json({ ...linkPreview(), curriculumId: CURRICULUM_ID, reviewVersion: `zz-review-${++previews}` }),
      [`POST ${LINKS(CURRICULUM_ID)}/confirm`]: () => new Promise<Response>((resolve) => (answer = resolve)),
    });
    await choose(w, LINKS_CSV);
    await previewFile(w);
    await get(w, 'import-confirm').trigger('click');
    await flushPromises();
    expect(disabled(w, 'import-program')).toBe(true);
    expect(disabled(w, 'import-cohort')).toBe(true);
    answer(Response.json({ statusCode: 409, code: 'impact_changed', message: 'The file changed since the preview' }, { status: 409 }));
    await flushPromises();
    expect(get(w, 'import-cohort').text()).toContain('Khóa 2024');
    expect(has(w, 'import-changed')).toBe(true);
    expect(previews).toBe(2);
    expect(disabled(w, 'import-program')).toBe(false);
    expect(disabled(w, 'import-cohort')).toBe(false);
    expect(posts(fetch).map(([path]) => path)).toEqual([`${LINKS(CURRICULUM_ID)}/preview`, `${LINKS(CURRICULUM_ID)}/confirm`, `${LINKS(CURRICULUM_ID)}/preview`]);
  });

  it('drops the old preview and says nothing was saved when the preview after a 409 fails (#165)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let previews = 0;
    const { w, fetch } = await render('/admin/import?type=catalog_courses', {
      [`POST ${CATALOG}/preview`]: () => {
        if (++previews === 1) return Response.json(catalogPreview());
        throw new TypeError('Failed to fetch');
      },
      [`POST ${CATALOG}/confirm`]: status(409, { statusCode: 409, code: 'impact_changed', message: 'The file changed since the preview' }),
    });
    await choose(w, CATALOG_CSV);
    await previewFile(w);
    await press(w, 'import-confirm');
    expect(previews).toBe(2);
    expect(has(w, 'import-changed')).toBe(false);
    expect(has(w, 'import-row')).toBe(false);
    expect(has(w, 'import-confirm')).toBe(false);
    expect(has(w, 'import-preview-failed')).toBe(true);
    expect(get(w, 'admin-problem').attributes('data-code')).toBe('impact_changed');
    expect(posts(fetch).filter(([path]) => path === `${CATALOG}/confirm`)).toHaveLength(1);
  });

  it('says when nothing in the file would change, and offers no confirmation', async () => {
    const { w } = await render('/admin/import?type=catalog_courses', { [`POST ${CATALOG}/preview`]: appliedPreview() });
    await choose(w, CATALOG_CSV);
    await previewFile(w);
    expect(get(w, 'import-nothing').text()).toBe('Mọi bản ghi đều giống dữ liệu đã lưu. Không có gì để lưu.');
    expect(disabled(w, 'import-confirm')).toBe(true);
  });
});
