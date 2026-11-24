import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { App as VueApp } from 'vue';
import { createMemoryHistory, type Router } from 'vue-router';
import { createOmniCourseApp } from '../app.js';
import { SESSION_STORAGE_KEY } from '../auth/store.js';
import { authResult } from '../auth/testing/fixtures.js';
import { createAppRouter } from '../router.js';
import { mockApi } from '../testing/fetch.js';
import { accessPrograms, adminPrograms, BASE_GROUP, course, curriculum, CURRICULUM_ID, EVERY_GRANT, group, GROUP_BASE_ID, NO_GRANTS, PROGRAM_ID, SHARED_COURSE } from './testing/fixtures.js';

// The administration screens in Chromium: the layout at a phone's width and on a desktop, the native dialog, and the
// keyboard. Synthetic data only (AGENTS.md hard rule 3).

const LONG = 'Nhómyêucầuthửcótênrấtdàikhôngcóchỗngắtdòngnàocảđểthửbềrộngcủabảng';
const LONG_NOTES = 'Sinh viên chọn tối thiểu 12 tín chỉ trong nhóm này, trong đó có ít nhất một học phần thực hành, theo ghi chú in dưới bảng của văn bản chính thức.';
const WIDE = curriculum([
  { ...BASE_GROUP, courses: [...BASE_GROUP.courses, course('ZZ20CHARACTERSCODE01', { nameVi: LONG, prerequisites: ['ZZ101', 'ZZ102', 'ZZ103'], offeringTerms: [1, 2, 3] })] },
  group('00000000-0000-4000-8000-000000000a07', LONG, { kind: 'elective', creditsTotalMin: 12, officialNotes: LONG_NOTES }),
]);
// Only the program with cohorts, so the page opens on its curriculum.
const PROGRAMS = { programs: [adminPrograms().programs[1]] };
const COHORT = `/admin/programs/${PROGRAM_ID}/cohorts/${CURRICULUM_ID}`;

let app: VueApp | undefined;
let host: HTMLDivElement | undefined;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  close();
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});

async function open(path: string, routes: Record<string, unknown> = {}): Promise<Router> {
  sessionStorage.setItem(SESSION_STORAGE_KEY, 'zz-saved');
  mockApi({
    'POST /auth/refresh': () => Response.json(authResult()),
    'GET /admin/grants': EVERY_GRANT,
    'GET /admin/programs': PROGRAMS,
    'GET /programs/ZZPROG/curricula/2024': WIDE,
    'GET /courses/ZZ101': SHARED_COURSE,
    'GET /admin/access/programs': accessPrograms(),
    [`GET /admin/access/users/${authResult().user.id}/grants`]: EVERY_GRANT,
    ...routes,
  });
  const router = createAppRouter(createMemoryHistory());
  host = document.createElement('div');
  document.body.append(host);
  app = createOmniCourseApp(router);
  app.mount(host);
  await router.push(path);
  await router.isReady();
  return router;
}

function close() {
  app?.unmount();
  host?.remove();
  app = host = undefined;
}

describe('the administration screens at a phone width and on a desktop', () => {
  it.each([400, 1280])('never scroll the page sideways at %i px, in either theme and either language', async (width) => {
    await page.viewport(width, 800);
    for (const [theme, lang] of [
      ['light', 'vi'],
      ['dark', 'en'],
    ]) {
      localStorage.setItem('omnicourse.theme', theme!);
      localStorage.setItem('omnicourse.lang', lang!);
      const fits = (what: string) => expect(document.documentElement.scrollWidth, `${what} at ${width} px (${theme}, ${lang})`).toBeLessThanOrEqual(window.innerWidth);

      await open('/admin/curriculum');
      await expect.poll(() => document.querySelectorAll('[data-test="course-row"]').length).toBe(4);
      expect(document.body.textContent).toContain(LONG);
      fits('the curriculum editor');
      // The widest dialog content: a long group name in the title.
      await page.getByRole('button', { name: lang === 'vi' ? `Sửa nhóm ${LONG}` : `Edit the group ${LONG}` }).click();
      const dialog = page.getByRole('dialog');
      await expect.element(dialog).toBeVisible();
      const box = (dialog.element() as HTMLElement).getBoundingClientRect();
      expect(box.left, 'the dialog on screen').toBeGreaterThanOrEqual(0);
      expect(box.right, 'the dialog on screen').toBeLessThanOrEqual(window.innerWidth);
      expect((dialog.element() as HTMLElement).scrollWidth).toBeLessThanOrEqual((dialog.element() as HTMLElement).clientWidth);
      close();

      await open('/admin/catalog');
      await page.getByRole('textbox', { name: lang === 'vi' ? 'Mã học phần' : 'Course code' }).fill('ZZ101');
      await userEvent.keyboard('{Enter}');
      await expect.poll(() => document.querySelector('[data-test="catalog-course"]')?.getAttribute('data-course')).toBe('ZZ101');
      fits('the catalog');
      close();

      await open('/admin/access');
      await page.getByRole('textbox', { name: lang === 'vi' ? 'Mã người dùng' : 'User ID' }).fill(authResult().user.id);
      await userEvent.keyboard('{Enter}');
      await expect.poll(() => document.querySelector('[data-test="access-user"]')).not.toBeNull();
      fits('the access screen');
      close();
    }
  });

  it('lists Administration in the sidebar for a grant holder, and under More on a phone, never for a student', async () => {
    await page.viewport(1280, 800);
    await open('/admin');
    const link = page.getByRole('complementary').getByRole('link', { name: 'Quản trị' });
    await expect.element(link).toBeVisible();
    // The front door went on to the first section; the link stays marked there.
    await expect.poll(() => document.querySelector('[data-test="admin-tab-curriculum"]')?.getAttribute('aria-current')).toBe('page');
    await expect.element(link).toHaveClass(/router-link-active/);
    close();

    await page.viewport(400, 800);
    await open('/admin/catalog');
    const more = page.getByRole('navigation', { name: 'Điều hướng nhanh' }).getByRole('button', { name: 'Thêm' });
    await expect.element(more).toHaveClass(/router-link-active/);
    await more.click();
    await expect.element(page.getByRole('dialog').getByRole('link', { name: 'Quản trị' })).toBeVisible();
    close();

    await page.viewport(1280, 800);
    await open('/settings', { 'GET /admin/grants': NO_GRANTS, 'GET /auth/sessions': [], 'GET /programs': { programs: [] }, 'GET /users/me/onboarding': { program: null, cohort: null, targetGraduationTerm: null, creditsPerTerm: null, internshipTerm: null, finished: false } });
    await expect.element(page.getByRole('complementary').getByRole('link', { name: 'Cài đặt' })).toBeVisible();
    await expect.element(page.getByRole('complementary').getByRole('link', { name: 'Quản trị' })).not.toBeInTheDocument();
  });
});

describe('the administration dialogs with the keyboard', () => {
  it('opens a form from the keyboard, keeps the focus inside it, and gives the focus back on Escape, sending nothing', async () => {
    await page.viewport(1280, 800);
    await open('/admin/curriculum');
    const add = page.getByRole('button', { name: 'Thêm nhóm' });
    await expect.element(add).toBeVisible();
    (add.element() as HTMLElement).focus();
    await userEvent.keyboard('{Enter}');
    const dialog = page.getByRole('dialog', { name: 'Nhóm yêu cầu mới' });
    await expect.element(dialog).toBeVisible();
    // The first field has the focus, and its label names it.
    await expect.element(page.getByRole('textbox', { name: 'Tên nhóm' })).toHaveFocus();
    await userEvent.keyboard('Nhóm thử từ bàn phím');
    // Tab goes round inside the modal: after its last button the focus is still in the dialog.
    for (let i = 0; i < 8; i++) await userEvent.keyboard('{Tab}');
    expect((dialog.element() as HTMLElement).contains(document.activeElement)).toBe(true);
    await userEvent.keyboard('{Escape}');
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(add).toHaveFocus();
    // Nothing was sent to the administration API but reads.
    expect(vi.mocked(fetch).mock.calls.filter(([url, init]) => String(url).includes('/admin/') && (init?.method ?? 'GET') !== 'GET')).toEqual([]);
  });

  it('links a course from the keyboard alone, and keeps the focus on the code box for the next one', async () => {
    let saved = WIDE;
    await page.viewport(1280, 800);
    await open('/admin/curriculum', {
      'GET /programs/ZZPROG/curricula/2024': () => Response.json(saved),
      [`PUT ${COHORT}/requirement-groups/${GROUP_BASE_ID}/courses/zz777`]: () => {
        saved = curriculum([{ ...WIDE.requirementGroups[0]!, courses: [...WIDE.requirementGroups[0]!.courses, course('ZZ777')] }, WIDE.requirementGroups[1]!]);
        return new Response(null, { status: 204 });
      },
    });
    const box = page.getByRole('textbox', { name: 'Mã học phần' });
    await expect.element(box).toBeVisible();
    await box.fill('zz777');
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => document.querySelector('[data-test="course-row"][data-course="ZZ777"]')).not.toBeNull();
    await expect.element(box).toHaveFocus();
    await expect.element(box).toHaveValue('');
    // The result is announced in the live region.
    await expect.element(page.getByRole('status').filter({ hasText: 'Đã thêm ZZ777 vào nhóm Kiến thức cơ sở thử.' })).toBeInTheDocument();
  });

  it('tells "not recorded" from "none" in words a screen reader hears, not by colour', async () => {
    await page.viewport(1280, 800);
    await open('/admin/curriculum');
    await expect.poll(() => document.querySelectorAll('[data-test="course-row"]').length).toBe(4);
    const row = (code: string) => page.getByRole('row', { name: new RegExp(`^${code}\\b`) });
    await expect.element(row('ZZ101').getByText('Không có tiên quyết')).toBeVisible();
    await expect.element(row('ZZ103').getByText('Chưa ghi nhận').first()).toBeVisible();
  });
});
