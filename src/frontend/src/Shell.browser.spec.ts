import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import type { App as VueApp } from 'vue';
import { createMemoryHistory, type Router } from 'vue-router';
import { createOmniCourseApp } from './app.js';
import { SESSION_STORAGE_KEY } from './auth/store.js';
import { authResult, session } from './auth/testing/fixtures.js';
import { createAppRouter } from './router.js';
import { NOT_STARTED } from './onboarding/api.js';
import { onboarding } from './onboarding/testing/fixtures.js';
import { mockApi, sentBody } from './testing/fetch.js';
import { HEALTHY } from './testing/health.js';

// The new screens in Chromium: the layout at a phone's width, the native dialog, and the sign-in round trip.

const LONG = 'Mônhọcthửcótênrấtdàikhôngcóchỗngắtdòngnàocảđểthửbềrộng';
const ROWS = [
  { courseCode: 'ZZ101', courseName: LONG, credits: 4, result: 'graded', grade: 8.5, term: { year: 2024, number: 1 } },
  { courseCode: 'ZZ102', courseName: 'Môn thử hai', credits: 3, result: 'in_progress', grade: null, term: { year: 2025, number: 3 } },
];
const LONG_GROUP = 'Nhóm thử có tên rất dài để xem tiêu đề nhóm xuống dòng thế nào trên điện thoại';
const course = (code: string, nameVi: string) => ({ code, nameVi, nameEn: null, credits: 4, theoryPeriods: 45, labPeriods: 30, exercisePeriods: null, projectPeriods: null });
const CURRICULUM = {
  id: '00000000-0000-4000-8000-0000000000c1',
  code: 'APCS2024',
  program: { code: 'APCS', nameVi: 'Chương trình Tiên tiến thử', nameEn: null, faculty: null },
  cohortYear: 2024,
  nameVi: 'CTĐT thử khóa 2024',
  nameEn: null,
  language: 'en',
  totalCreditsMin: 163,
  requirementGroups: [
    { id: '00000000-0000-4000-8000-000000000a01', name: 'Kiến thức Math', kind: 'compulsory', creditsTotal: 8, creditsTotalMin: null, officialNotes: null, courses: [course('ZZ101', 'Giải tích thử'), course('ZZ102', LONG)] },
    { id: '00000000-0000-4000-8000-000000000a02', name: LONG_GROUP, kind: 'elective', creditsTotal: null, creditsTotalMin: 12, officialNotes: LONG_GROUP, courses: [course('ZZ414', 'Học máy thử')] },
  ],
};
const PROGRAMS = { programs: [{ code: 'APCS', nameVi: 'Chương trình Tiên tiến thử', nameEn: null, faculty: null, cohortYears: [2024, 2025] }] };
const SESSIONS = [
  session({ current: true }),
  session({ id: '00000000-0000-4000-8000-0000000000b2', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Version/18.0 Mobile/15E148 Safari/604.1' }),
];

let app: VueApp | undefined;
let host: HTMLDivElement | undefined;

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
});
afterEach(() => {
  app?.unmount();
  host?.remove();
  app = host = undefined;
  sessionStorage.clear();
  localStorage.clear();
  vi.restoreAllMocks();
});

async function open(path: string, { signedIn = true, routes = {} as Record<string, unknown> } = {}): Promise<Router> {
  if (signedIn) sessionStorage.setItem(SESSION_STORAGE_KEY, 'zz-saved');
  else sessionStorage.removeItem(SESSION_STORAGE_KEY);
  mockApi({
    'POST /auth/refresh': () => Response.json(authResult()),
    'GET /health': HEALTHY,
    'GET /guides': { guides: [] },
    'GET /auth/sessions': SESSIONS,
    'GET /users/me/transcript': { rows: ROWS },
    'GET /users/me/onboarding': onboarding(),
    'GET /programs': PROGRAMS,
    'GET /programs/APCS/curricula/2024': CURRICULUM,
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

describe('the new screens at a phone width and on a desktop', () => {
  const pages: [string, boolean, string, Record<string, unknown>?][] = [
    ['/', false, 'Biết chính xác còn thiếu gì để tốt nghiệp.'],
    ['/sign-in', false, 'Chào mừng trở lại.'],
    ['/sign-up', false, 'Tạo tài khoản.'],
    ['/guides', true, 'Hướng dẫn thủ tục'],
    ['/settings', true, 'Cài đặt'],
    ['/transcript', true, 'Bảng điểm'],
    ['/explorer', true, 'Chương trình đào tạo'],
    ['/onboarding', true, 'Bạn đang học chương trình nào?', { 'GET /users/me/onboarding': NOT_STARTED }],
  ];

  it.each([400, 1280])('never scroll sideways at %i px, in either theme', async (width) => {
    await page.viewport(width, 800);
    for (const theme of ['light', 'dark']) {
      localStorage.setItem('omnicourse.theme', theme);
      for (const [path, signedIn, heading, routes] of pages) {
        await open(path, { signedIn, routes });
        await expect.element(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
        if (path === '/transcript') {
          // An invalid row, with its reasons spelled out, is the widest the table gets.
          await page.getByRole('button', { name: 'Thêm dòng' }).click();
          await expect.poll(() => document.querySelector('[data-test="rows"]')?.textContent).toContain('Cần sửa:');
          expect([...document.querySelectorAll('input')].some((input) => input.value === LONG)).toBe(true);
          // Every column fits the card, beside the sidebar too: nothing is cut off or hidden behind a scroll.
          const wrap = document.querySelector('.review-card .table-wrap')!;
          expect(wrap.scrollWidth, `the review table at ${width} px`).toBeLessThanOrEqual(wrap.clientWidth);
        }
        expect(document.documentElement.dataset.theme).toBe(theme);
        expect(document.documentElement.scrollWidth, `${path} at ${width} px`).toBeLessThanOrEqual(window.innerWidth);
        close();
      }
    }
  });

  it('shows the sidebar on a desktop and the tab bar on a phone', async () => {
    await page.viewport(1280, 800);
    await open('/settings');
    await expect.element(page.getByRole('complementary').getByRole('link', { name: 'Bảng điểm' })).toBeVisible();
    close();

    await page.viewport(400, 800);
    await open('/settings');
    const tabs = page.getByRole('navigation', { name: 'Điều hướng nhanh' });
    await expect.element(tabs.getByRole('link', { name: 'Cài đặt' })).toBeVisible();
    // Four tabs fit side by side at 400 px.
    const links = [...(tabs.element() as HTMLElement).querySelectorAll('a')];
    expect(links.map((a) => a.textContent?.trim())).toEqual(['Bảng điểm', 'Chương trình', 'Lộ trình', 'Hướng dẫn', 'Cài đặt']);
    expect(new Set(links.map((a) => Math.round(a.getBoundingClientRect().top))).size).toBe(1);
    await expect.element(page.getByRole('complementary')).not.toBeInTheDocument();
  });

  it('keeps every sidebar label for screen readers when the rail is narrow', async () => {
    await page.viewport(1280, 800);
    await open('/transcript');
    await expect.element(page.getByRole('heading', { level: 1, name: 'Bảng điểm' })).toBeVisible();
    await userEvent.keyboard('[[');
    const side = page.getByRole('complementary');
    await expect.poll(() => (side.element() as HTMLElement).getBoundingClientRect().width).toBeLessThan(100);
    await expect.element(side.getByRole('link', { name: 'Hướng dẫn' })).toBeInTheDocument();
    await expect.element(side.getByRole('button', { name: 'Thu gọn' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('dialogs in a real browser', () => {
  it('opens a course drawer from the explorer and closes it on Escape, giving focus back', async () => {
    await page.viewport(400, 800);
    await open('/explorer');
    const tile = page.getByRole('button', { name: /ZZ414/ });
    await tile.click();
    const drawer = page.getByRole('dialog', { name: 'Học máy thử' });
    await expect.element(drawer).toBeVisible();
    expect((drawer.element() as HTMLElement).getBoundingClientRect().width).toBeLessThanOrEqual(400);
    await userEvent.keyboard('{Escape}');
    await expect.element(drawer).not.toBeInTheDocument();
    await expect.element(tile).toHaveFocus();
  });

  it('moves focus into the deletion dialog, closes on Escape and gives focus back', async () => {
    await page.viewport(1280, 800);
    await open('/settings');
    const opener = page.getByRole('button', { name: 'Xóa tài khoản' });
    await opener.click();
    const dialog = page.getByRole('alertdialog', { name: 'Xóa tài khoản?' });
    await expect.element(dialog).toBeVisible();
    await expect.element(dialog.getByLabelText('Nhập mật khẩu để xác nhận')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect.element(dialog).not.toBeInTheDocument();
    await expect.element(opener).toHaveFocus();
  });
});

describe('signing in and out (issue #13)', () => {
  it('sends a visitor from a private page to sign-in and back, then signs out', async () => {
    await page.viewport(1280, 800);
    const router = await open('/settings', {
      signedIn: false,
      routes: {
        'POST /auth/sign-in': (init: RequestInit) => {
          expect(sentBody(init)).toEqual({ email: 'zz-student@example.com', password: 'zz-password-1' });
          return Response.json(authResult());
        },
        'POST /auth/sign-out': () => new Response(null, { status: 204 }),
      },
    });
    await expect.element(page.getByRole('heading', { level: 1, name: 'Chào mừng trở lại.' })).toBeVisible();
    expect(router.currentRoute.value.fullPath).toBe('/sign-in?redirect=/settings');

    await page.getByLabelText('Email').fill('zz-student@example.com');
    await page.getByLabelText('Mật khẩu').fill('zz-password-1');
    await page.getByRole('button', { name: 'Đăng nhập' }).click();
    await expect.element(page.getByRole('heading', { level: 1, name: 'Cài đặt' })).toBeVisible();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe('zz-token');

    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect.element(page.getByRole('heading', { level: 1, name: 'Biết chính xác còn thiếu gì để tốt nghiệp.' })).toBeVisible();
    await expect.element(page.getByRole('status').filter({ hasText: 'Đã đăng xuất.' })).toBeInTheDocument();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});
