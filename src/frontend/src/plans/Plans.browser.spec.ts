import { mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { page } from 'vitest/browser';
import { RouterView } from 'vue-router';
import '../styles.css';
import { mockApi, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import type { PlanIssues, PlanTerm } from './api.js';
import { CORE_GROUP, course, CURRICULUM, ELECTIVE_GROUP, issue, OTHER_ID, plan, PLAN_ID, report, summary } from './testing/fixtures.js';

const PHONE = 360;
const DESKTOP = 1280;
const HEIGHT = 800;

const SAVED: PlanTerm[] = [
  { term: { year: 2026, number: 1 }, placements: [course('ZZ101'), course('ZZ102')] },
  { term: { year: 2026, number: 2 }, placements: [course('ZZ201')] },
];

const REPORT: PlanIssues = report({
  terms: [
    { term: { year: 2026, number: 1 }, kind: 'main', credits: 8, caps: { min: 10, max: 22 } },
    { term: { year: 2026, number: 2 }, kind: 'main', credits: 3, caps: { min: 10, max: 22 } },
  ],
  issues: [
    issue({
      code: 'prerequisite_not_met',
      kind: 'violation',
      term: { year: 2026, number: 1 },
      position: 1,
      courseCode: 'ZZ102',
      missingCourseCodes: ['ZZ101'],
      citation: 'QĐ 1175/QĐ-KHTN Điều 3.1.c',
    }),
  ],
  coverage: {
    groups: [
      { id: CORE_GROUP, name: 'Kiến thức Computer Science (A): bắt buộc', kind: 'compulsory', requiredCredits: 11, credits: 11, remainingCredits: 0, met: true },
      { id: ELECTIVE_GROUP, name: 'Tự chọn Computer Science (C)', kind: 'elective', requiredCredits: 4, credits: 0, remainingCredits: 4, met: false },
    ],
    combinedMinimums: [],
    totalRequired: 20,
    totalCredits: 11,
    totalRemaining: 9,
    graduation: 'not_yet',
  },
});

describe('PlanEditorView and StatusStrip in a real browser', () => {
  let host: HTMLDivElement;
  let wrapper: VueWrapper | undefined;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    host = document.createElement('div');
    document.body.append(host);
  });

  afterEach(async () => {
    await page.viewport(DESKTOP, HEIGHT);
    wrapper?.unmount();
    wrapper = undefined;
    host.remove();
    vi.restoreAllMocks();
  });

  async function render(width: number) {
    await page.viewport(width, HEIGHT);
    mockApi({
      [`GET /plans/${PLAN_ID}`]: plan(SAVED),
      [`GET /plans/${PLAN_ID}/issues`]: REPORT,
      'GET /programs/APCS/curricula/2024': CURRICULUM,
      'GET /users/me/transcript': { rows: [] },
      'GET /plans': { plans: [summary(), summary({ id: OTHER_ID, name: 'Kế hoạch so sánh tải học kỳ' })] },
      'GET /users/me/audit': status(409, { statusCode: 409, code: 'onboarding_required', message: 'Onboarding first' }),
    });
    const app = await setup(`/plans/${PLAN_ID}`);
    wrapper = mount(RouterView, { attachTo: host, global: { plugins: [app.pinia, app.router] } });
    await vi.waitFor(() => expect(wrapper!.find('[data-test="estimate"]').exists()).toBe(true));
    return wrapper;
  }

  const box = (el: Element) => el.getBoundingClientRect();

  it.each([PHONE, DESKTOP])('renders the plan editor and status strip at %i px with no sideways scroll', async (width) => {
    const w = await render(width);
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(width);
    expect(w.get('h1').text()).toBe('Kế hoạch thử');
    expect(w.find('[data-test="status-strip"]').exists()).toBe(true);
    expect(w.get('[data-test="save-state"]').text()).toBe('Đã lưu');
    expect(w.findAll('[data-test="strip-group"]')).toHaveLength(2);
    expect(w.find('[data-test="tile-ZZ102"]').exists()).toBe(true);
    expect(w.find('[data-test="issues-panel"]').exists()).toBe(true);
  });

  it('lays out the status strip in three columns on desktop and stacks it on a phone', async () => {
    const desk = await render(DESKTOP);
    const deskEst = box(desk.get('[data-test="estimate"]').element);
    const deskCov = box(desk.get('[data-test="strip-coverage"]').element);
    const deskSave = box(desk.get('[data-test="save-state"]').element);
    expect(deskCov.left).toBeGreaterThanOrEqual(deskEst.right);
    expect(deskSave.left).toBeGreaterThanOrEqual(deskCov.right);
    desk.unmount();

    const phone = await render(PHONE);
    const phoneEst = box(phone.get('[data-test="estimate"]').element);
    const phoneCov = box(phone.get('[data-test="strip-coverage"]').element);
    const phoneSave = box(phone.get('[data-test="save-state"]').element);
    expect(phoneCov.top).toBeGreaterThanOrEqual(phoneEst.bottom);
    expect(phoneSave.top).toBeGreaterThanOrEqual(phoneCov.bottom);
  });
});
