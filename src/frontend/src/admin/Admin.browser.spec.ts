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

describe('the groups table with long printed rules', () => {
  const RULE =
    'Sinh viên tích lũy tối thiểu 12 tín chỉ trong nhóm này. Trong đó có ít nhất một học phần thực hành và không quá hai học phần thuộc cùng một hướng chuyên ngành. ' +
    'Học phần đã tính cho nhóm khác không được tính lại. Sinh viên chọn hướng khóa luận phải hoàn thành cả hai học phần của hướng đó; nếu không, tín chỉ của học phần đầu không được tính. ' +
    'Ghi chú này chép nguyên văn từ văn bản chính thức, mục 7.3.';
  const NINE = curriculum(
    Array.from({ length: 9 }, (_unused, i) =>
      group(`00000000-0000-4000-8000-0000000009a${i}`, `Nhóm kiến thức thử số ${i + 1} của chương trình`, { kind: i % 2 ? 'elective' : 'compulsory', creditsTotalMin: i % 2 ? 12 : null, creditsTotal: i % 2 ? null : 24, officialNotes: RULE, courses: i === 0 ? BASE_GROUP.courses : [] }),
    ),
  );
  const height = (el: Element | null | undefined) => el!.getBoundingClientRect().height;

  it.each([
    // Font metrics differ between machines (CI measured 275 to 279 px where a laptop measured under 270), so the
    // phone bound leaves room for that. A row was 448 px (vi) and 649 px (en) before the rule was cut to two lines.
    [400, 'vi', 300],
    [400, 'en', 300],
    [1280, 'vi', 130],
    [1280, 'en', 130],
  ] as const)('keeps a row compact at %i px in %s, with its actions on screen and the whole rule one key press away', async (width, lang, tallest) => {
    await page.viewport(width, 844);
    localStorage.setItem('omnicourse.lang', lang);
    await open('/admin/curriculum', { 'GET /programs/ZZPROG/curricula/2024': NINE });
    await expect.poll(() => document.querySelectorAll('[data-test="group-row"]').length).toBe(9);
    const rows = [...document.querySelectorAll('[data-test="group-row"]')];
    const notes = [...document.querySelectorAll('[data-test="group-note-row"]')];
    for (const [i, row] of rows.entries()) {
      // A group takes its row and the two lines of its rule, not a screen of text (a card with every value named, on a phone).
      expect(height(row) + height(notes[i]), `group ${i + 1} at ${width} px (${lang})`).toBeLessThanOrEqual(tallest);
      // The exact property, whatever the font: the closed rule is two lines high at most.
      const closed = notes[i]!.querySelector<HTMLElement>('[data-test="group-note"]')!;
      const style = getComputedStyle(closed);
      const line = parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.6;
      expect(height(closed), `rule of group ${i + 1} at ${width} px (${lang})`).toBeLessThanOrEqual(2 * line + 2);
      for (const button of row.querySelectorAll('button')) {
        const box = button.getBoundingClientRect();
        expect(box.left, button.textContent ?? '').toBeGreaterThanOrEqual(0);
        expect(box.right, button.textContent ?? '').toBeLessThanOrEqual(window.innerWidth);
      }
    }
    // Nothing of the table is off to the side.
    const wrap = document.querySelector('.admin-groups')!.parentElement!;
    expect(wrap.scrollWidth).toBeLessThanOrEqual(wrap.clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);

    // The rule is cut to two lines for the eye only. Its button is reached and pressed from the keyboard, says
    // whether the rule is open, and then all of the text shows.
    const note = notes[0]!.querySelector<HTMLElement>('[data-test="group-note"]')!;
    const toggle = notes[0]!.querySelector<HTMLButtonElement>('[data-test="group-note-toggle"]')!;
    expect(note.textContent).toBe(RULE);
    expect(note.scrollHeight).toBeGreaterThan(note.clientHeight);
    const before = height(note);
    toggle.focus();
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => toggle.getAttribute('aria-expanded')).toBe('true');
    expect(height(note)).toBeGreaterThan(before);
    expect(note.scrollHeight).toBeLessThanOrEqual(note.clientHeight + 1);
    expect(document.activeElement).toBe(toggle);
    await userEvent.keyboard('{Enter}');
    await expect.poll(() => toggle.getAttribute('aria-expanded')).toBe('false');
    expect(height(note)).toBe(before);
  });

  it('shows each course of the open group as a card on a phone, with its rules named and their controls on screen', async () => {
    await page.viewport(400, 844);
    await open('/admin/curriculum');
    await expect.poll(() => document.querySelectorAll('[data-test="course-row"]').length).toBe(4);
    for (const row of document.querySelectorAll('[data-test="course-row"]')) {
      for (const button of row.querySelectorAll('button')) {
        const box = button.getBoundingClientRect();
        expect(box.left).toBeGreaterThanOrEqual(0);
        expect(box.right).toBeLessThanOrEqual(window.innerWidth);
      }
      // The column heads are not on screen at this width: each rule carries its own name.
      expect(getComputedStyle(row.querySelector('[data-test="prerequisites"]')!, '::before').content).toBe('"Tiên quyết"');
    }
    const wrap = document.querySelector('.admin-courses')!.parentElement!;
    expect(wrap.scrollWidth).toBeLessThanOrEqual(wrap.clientWidth);
  });
});

describe('the program list of the access screen on a phone', () => {
  it('shows a long program name whole, inside the screen', async () => {
    const long = 'Cử nhân ngành Khoa học máy tính thử nghiệm - Chương trình Tiên tiến có tên rất dài';
    await page.viewport(400, 844);
    await open('/admin/access', { 'GET /admin/access/programs': { programs: [{ id: PROGRAM_ID, code: 'ZZPROG', nameVi: long }, ...accessPrograms().programs.slice(0, 1)] } });
    await page.getByRole('textbox', { name: 'Mã người dùng' }).fill(authResult().user.id);
    await userEvent.keyboard('{Enter}');
    const select = page.getByRole('combobox', { name: 'Chương trình' });
    await expect.element(select).toBeVisible();
    await select.click();
    const list = page.getByRole('listbox');
    await expect.element(list).toBeVisible();
    const box = (list.element() as HTMLElement).getBoundingClientRect();
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.right).toBeLessThanOrEqual(window.innerWidth);
    for (const option of (list.element() as HTMLElement).querySelectorAll<HTMLElement>('[role="option"]')) {
      expect(option.getBoundingClientRect().right, option.textContent ?? '').toBeLessThanOrEqual(window.innerWidth);
      // Not cut: the name wraps instead.
      expect(option.scrollWidth, option.textContent ?? '').toBeLessThanOrEqual(option.clientWidth);
    }
    expect((list.element() as HTMLElement).textContent).toContain(long);
    expect((list.element() as HTMLElement).scrollWidth).toBeLessThanOrEqual((list.element() as HTMLElement).clientWidth);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
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
