import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cdp, page } from 'vitest/browser';
import App from '../App.vue';
import '../styles.css';
import { mockApi } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import type { SharedPlan } from './api.js';

const TOKEN = 'q3T0c6mJm0mB1bqT8mWl2k0E1e8b6Zb1K3w1r5yX9aA';

const SHARED_PLAN: SharedPlan = {
  name: 'Kế hoạch tốt nghiệp đúng hạn',
  ownerName: 'Test Student',
  curriculum: {
    code: 'APCS2025',
    cohortYear: 2025,
    nameVi: 'Chương trình đào tạo - Chương trình Tiên tiến ngành Khoa học máy tính - Khóa tuyển 2025',
    nameEn: 'Curriculum - Advanced Program in Computer Science - Cohort 2025',
    program: {
      code: 'APCS',
      nameVi: 'Chương trình Tiên tiến ngành Khoa học máy tính',
      nameEn: 'Advanced Program in Computer Science',
    },
  },
  updatedAt: '2026-11-25T14:20:00.000Z',
  terms: [
    {
      term: { year: 2026, number: 1 },
      kind: 'main',
      credits: 4,
      caps: { min: 10, max: 22 },
      placements: [
        {
          kind: 'course',
          courseCode: 'CS161',
          nameVi: 'Nhập môn lập trình',
          nameEn: 'Introduction to Programming',
          credits: 4,
          requirementGroupName: null,
        },
      ],
    },
  ],
  issues: [],
  issueCodesNotShown: ['prerequisite_not_met', 'already_passed', 'already_in_progress', 'requirement_not_covered'],
};

describe('SharedPlanView print media in a real browser', () => {
  let host: HTMLDivElement;
  let wrapper: VueWrapper | undefined;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    host = document.createElement('div');
    host.id = 'app';
    document.body.append(host);
  });

  afterEach(async () => {
    await cdp().send('Emulation.setEmulatedMedia', { media: '' });
    await page.viewport(1280, 800);
    wrapper?.unmount();
    wrapper = undefined;
    host.remove();
    vi.restoreAllMocks();
  });

  it('keeps #main and the shared plan visible while hiding public chrome under @media print', async () => {
    await page.viewport(1280, 800);
    mockApi({ [`GET /shared-plans/${TOKEN}`]: SHARED_PLAN });
    const app = await setup(`/shared/${TOKEN}`, { signedIn: false });
    wrapper = mount(App, { attachTo: host, global: { plugins: [app.pinia, app.router] } });
    await vi.waitFor(() => expect(wrapper!.find('[data-test="shared-terms"]').exists()).toBe(true));

    await cdp().send('Emulation.setEmulatedMedia', { media: 'print' });
    expect(window.matchMedia('print').matches).toBe(true);

    const mainEl = host.querySelector<HTMLElement>('#main')!;
    const pageEl = host.querySelector<HTMLElement>('.shared-plan-page')!;
    const pubHead = host.querySelector<HTMLElement>('header.pub-head')!;
    const pubFoot = host.querySelector<HTMLElement>('footer.pub-foot')!;
    const printBtn = host.querySelector<HTMLElement>('[data-test="print-pdf"]')!;

    expect(getComputedStyle(host).display).not.toBe('none');
    expect(getComputedStyle(mainEl).display).not.toBe('none');
    expect(mainEl.getBoundingClientRect().height).toBeGreaterThan(100);
    expect(pageEl.getBoundingClientRect().height).toBeGreaterThan(100);
    expect(getComputedStyle(pubHead).display).toBe('none');
    expect(getComputedStyle(pubFoot).display).toBe('none');
    expect(getComputedStyle(printBtn.closest('.no-print')!).display).toBe('none');
    expect(printBtn.getBoundingClientRect().height).toBe(0);
  });

  it('hides the app sidebar and mobile bars while printing a shared plan when signed in', async () => {
    await page.viewport(1280, 800);
    mockApi({
      'GET /admin/grants': { programs: [], permissions: [] },
      'GET /notifications/unread-count': { unread: 0 },
      [`GET /shared-plans/${TOKEN}`]: SHARED_PLAN,
    });
    const app = await setup(`/shared/${TOKEN}`, { signedIn: true });
    wrapper = mount(App, { attachTo: host, global: { plugins: [app.pinia, app.router] } });
    await vi.waitFor(() => expect(wrapper!.find('[data-test="shared-terms"]').exists()).toBe(true));

    await cdp().send('Emulation.setEmulatedMedia', { media: 'print' });

    const mainEl = host.querySelector<HTMLElement>('#main')!;
    const sideEl = host.querySelector<HTMLElement>('.side')!;
    expect(mainEl.getBoundingClientRect().height).toBeGreaterThan(100);
    expect(getComputedStyle(sideEl).display).toBe('none');
  });
});
