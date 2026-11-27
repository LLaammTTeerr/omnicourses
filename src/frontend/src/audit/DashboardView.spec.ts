import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/store.js';
import { useLocale } from '../locale.js';
import type { Plan, PlanIssues } from '../plans/api.js';
import { mockApi, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import type { DegreeAudit, TermAttempt } from './api.js';
import DashboardView from './DashboardView.vue';
import { COMBINED, degreeAudit, GROUP_A, GROUP_C, GROUP_MATH } from './testing/fixtures.js';
import { AUDIT_MESSAGES } from './messages.js';

const PLAN_ID = '00000000-0000-4000-8000-0000000000c1';
const INTRO_KEY = 'oc-dashboard-intro';

let wrapper: VueWrapper | undefined;

const PAST_TOWARD_TOTAL = 4;

const attempt = (code: string, overrides: Partial<TermAttempt>): TermAttempt => ({
  code,
  name: `Học phần thử ${code}`,
  credits: 4,
  result: 'graded',
  grade: null,
  passed: true,
  inProgress: false,
  requirementGroupId: GROUP_A,
  ...overrides,
});

function dashboardAudit(): DegreeAudit {
  const base = degreeAudit();
  const first = base.terms[0]!;
  return degreeAudit({
    terms: [
      { ...first, failedCourseCodes: ['ZZ202'], cumulativeTowardTotal: PAST_TOWARD_TOTAL, attempts: [...first.attempts, attempt('ZZ202', { grade: 4.5, passed: false })] },
      {
        ...first,
        term: { year: 2026, number: 1 },
        average: null,
        accumulatedAverage: null,
        cumulativeAccumulatedAverage: null,
        cumulativeAccumulatedAverageChange: null,
        failedCourseCodes: [],
        inProgressCourseCodes: ['ZZ414'],
        capViolations: [],
        attempts: [attempt('ZZ414', { result: 'in_progress', passed: false, inProgress: true, requirementGroupId: GROUP_C })],
      },
    ],
  });
}

function auditAsOf2024(): DegreeAudit {
  const base = degreeAudit();
  return degreeAudit({ asOfTerm: { year: 2024, number: 1 }, credits: { ...base.credits, towardTotal: PAST_TOWARD_TOTAL, inProgressTowardTotal: 0, remaining: 16 } });
}

const answerAudit = (live: unknown) => (init: RequestInit | undefined, url: string) => {
  if (url.includes('asOfYear')) return Response.json(auditAsOf2024());
  return typeof live === 'function' ? live(init, url) : Response.json(live);
};

const plan: Plan = {
  id: PLAN_ID,
  name: 'Lộ trình thử',
  curriculum: { id: '00000000-0000-4000-8000-0000000000d1', code: 'APCS2024', programCode: 'APCS', cohortYear: 2024 },
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
  terms: [{ term: { year: 2027, number: 1 }, placements: [{ kind: 'course', courseCode: 'ZZ202' }, { kind: 'slot', requirementGroupId: GROUP_C, credits: 4 }] }],
};

const issues = (violations: number): PlanIssues => ({
  planId: PLAN_ID,
  trainingType: 'advanced',
  terms: [],
  issues: Array.from({ length: violations }, () => ({
    code: 'not_offered',
    kind: 'violation',
    term: { year: 2027, number: 1 },
    position: 0,
    courseCode: 'ZZ202',
    requirementGroupId: null,
    combinedMinimumId: null,
    missingCourseCodes: [],
    offeredTermNumbers: [2],
    credits: null,
    limit: null,
    citation: 'QĐ 1175/QĐ-KHTN Điều 7.2',
    message: 'Synthetic issue',
  })) as PlanIssues['issues'],
  coverage: {} as PlanIssues['coverage'],
});

const unread = {
  id: '00000000-0000-4000-8000-0000000000e1',
  kind: 'transcript_changed',
  createdAt: '2026-11-01T00:00:00.000Z',
  readAt: null,
  event: null,
  links: ['audit'],
};

function routes(audit: unknown, extra: Record<string, unknown> = {}) {
  return {
    'GET /users/me/audit': answerAudit(audit),
    'GET /plans': { plans: [{ ...plan, preview: { termCount: 1, courseCount: 1, slotCount: 1, firstTerm: null, lastTerm: null } }] },
    [`GET /plans/${PLAN_ID}`]: plan,
    [`GET /plans/${PLAN_ID}/issues`]: issues(2),
    'GET /notifications': { notifications: [unread], nextBefore: null },
    'GET /academic-calendar': { events: [{ kind: 'term_end', academicYear: 2027, term: 1, endsOn: '2028-01-20' }] },
    ...extra,
  };
}

async function render(audit: unknown = dashboardAudit(), extra: Record<string, unknown> = {}) {
  const fetch = mockApi(routes(audit, extra));
  const app = await setup('/dashboard');
  wrapper = mount(DashboardView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch, ...app };
}

const text = (w: VueWrapper, test: string) => w.get(`[data-test="${test}"]`).text();
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('DashboardView (F3, UC-03)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(INTRO_KEY, '1');
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('gives each figure PERF-01 times its own selector, and marks the load as busy', async () => {
    mockApi(routes(dashboardAudit()));
    const app = await setup('/dashboard');
    wrapper = mount(DashboardView, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
    expect(wrapper.get('[data-test="loading"]').attributes('aria-busy')).toBe('true');
    await flushPromises();
    const w = wrapper;
    expect(w.find('[aria-busy="true"]').exists()).toBe(false);
    expect(text(w, 'who')).toContain('APCS2024');
    expect(text(w, 'credits-toward-total')).toBe('8');
    expect(text(w, 'credits-remaining')).toBe('12');
    expect(text(w, 'credits-in-progress')).toBe('4 TC đang học');
    expect(text(w, 'gpa-accumulated-average')).toBe('8,00/10');
    const groups = w.findAll('[data-test="group"]');
    expect(groups.length).toBeGreaterThan(0);
    for (const g of groups) {
      expect(g.attributes('data-group')).toBeTruthy();
      expect(g.get('[data-test="group-credits"]').text()).not.toBe('');
    }
  });

  it('shows one row per minimum, with a group that has no minimum of its own only inside its combined row', async () => {
    const { w } = await render();
    const rows = Object.fromEntries(w.findAll('[data-test="group"]').map((g) => [g.attributes('data-group'), g]));
    expect(Object.keys(rows).sort()).toEqual([COMBINED, GROUP_A, GROUP_MATH].sort());
    expect(rows[GROUP_A]!.get('[data-test="group-credits"]').text()).toBe('4/8');
    expect(rows[GROUP_MATH]!.get('[data-test="group-credits"]').text()).toBe('4/4');
    expect(rows[COMBINED]!.get('[data-test="group-credits"]').text()).toBe('0/12');
    expect(rows[GROUP_A]!.text()).not.toContain('Chưa đạt');
    expect(rows[GROUP_A]!.get('.db-sec:has(.chip.bad)').text()).toContain('Học kỳ 1, 2027–28');
    expect(rows[GROUP_A]!.get('.chip.bad').text()).toBe('Học lại');
    expect(rows[COMBINED]!.text()).toContain('Tự chọn chưa chọn môn');
    expect(rows[COMBINED]!.text()).toContain('ZZ414');
  });

  it('opens a group spoiler and keeps it open', async () => {
    const { w } = await render();
    const g = w.get(`[data-group="${GROUP_A}"]`);
    (g.element as HTMLDetailsElement).open = true;
    await g.trigger('toggle');
    expect((w.get(`[data-group="${GROUP_A}"]`).element as HTMLDetailsElement).open).toBe(true);
  });

  it('focuses a group in the donut, the key and the list when an arc is hovered, with a tooltip', async () => {
    const { w } = await render();
    const arc = w.get(`.arc[data-g="${GROUP_A}"] path`);
    await arc.trigger('pointermove');
    expect(w.get('[data-test="donut"]').classes()).toContain('focus');
    expect(w.get(`.arc[data-g="${GROUP_A}"]`).classes()).toContain('on');
    expect(w.get(`.db-key [data-g="${GROUP_A}"]`).classes()).toContain('on');
    const tip = document.querySelector('.db-tip')!;
    expect(tip.classList.contains('show')).toBe(true);
    expect(tip.textContent).toContain('Kiến thức Computer Science (A): bắt buộc');
    expect(tip.textContent).toContain('4 TC');
    await wait(150);
    expect(w.get('.db-center').text()).toContain('/ 8 tín chỉ');
    await w.get('[data-test="donut"]').trigger('pointerleave');
    await wait(250);
    expect(w.get('[data-test="donut"]').classes()).not.toContain('focus');
    expect(w.get('.db-center').text()).toContain('/ 20 tín chỉ');
  });

  it('steps back to a past term and shows the audit as of that term, then returns with the arrow key', async () => {
    const { w, fetch } = await render();
    expect(text(w, 'term-label')).toBe('HK1 26–27 · nay');
    expect(w.get('[data-test="next-term"]').attributes('disabled')).toBeDefined();
    await w.get('[data-test="previous-term"]').trigger('click');
    expect(w.get('.dashboard-page').classes()).toContain('db-past');
    expect(text(w, 'term-label')).toBe('HK1 24–25');
    expect(w.get('#db-term-title').text()).toBe('Học kỳ 1, năm 1 (2024–2025)');
    expect(text(w, 'term-gpa')).toBe('7,75/10ĐTB học kỳ');
    expect(text(w, 'attention')).toContain('Tổng kết học kỳ');
    expect(text(w, 'term-card')).toContain('4,5');
    expect(text(w, 'credits-toward-total')).toBe(String(PAST_TOWARD_TOTAL));
    expect(text(w, 'credits-remaining')).toBe('16');
    expect(fetch.mock.calls.map(([url]) => String(url))).toContainEqual(expect.stringContaining('/users/me/audit?asOfYear=2024&asOfNumber=1'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    await flushPromises();
    expect(w.get('.dashboard-page').classes()).not.toContain('db-past');
    expect(text(w, 'term-label')).toBe('HK1 26–27 · nay');
  });

  it('lets the term picker preview with the arrow keys and close with Escape', async () => {
    const { w } = await render();
    await w.get('[data-test="term-label"]').trigger('click');
    await flushPromises();
    const options = w.findAll('[role="option"]');
    expect(options.map((o) => o.get('b').text())).toEqual(['HK1 26–27', 'HK1 24–25']);
    expect(options[0]!.attributes('aria-selected')).toBe('true');
    expect(options[1]!.text()).toContain(`${PAST_TOWARD_TOTAL} TC`);
    expect(document.activeElement).toBe(options[0]!.element);
    await w.get('#db-tpick').trigger('keydown', { key: 'ArrowDown' });
    expect(text(w, 'term-label')).toContain('xem trước');
    expect(w.get('.dashboard-page').classes()).toContain('db-past');
    await w.get('#db-tpick').trigger('keydown', { key: 'Escape' });
    expect(w.find('[role="option"]').exists()).toBe(false);
    expect(w.get('.dashboard-page').classes()).not.toContain('db-past');
    await w.get('[data-test="term-label"]').trigger('click');
    await flushPromises();
    await w.findAll('[role="option"]')[1]!.trigger('click');
    expect(text(w, 'term-label')).toBe('HK1 24–25');
    expect(w.find('[data-test="back-to-now"]').exists()).toBe(true);
  });

  it('previews a past term while a point of the GPA line is hovered, and keeps it on click', async () => {
    const { w } = await render();
    const dot = w.get('.db-spark [data-hi="0"]');
    await dot.trigger('mouseover');
    expect(w.get('.dashboard-page').classes()).toContain('db-past');
    await w.get('[data-test="row1"]').trigger('mouseleave');
    await wait(150);
    expect(w.get('.dashboard-page').classes()).not.toContain('db-past');
    await dot.trigger('click');
    await w.get('[data-test="row1"]').trigger('mouseleave');
    await wait(150);
    expect(w.get('.dashboard-page').classes()).toContain('db-past');
  });

  it('lists what needs attention: plan violations, the language standard, unchosen electives and unread notifications', async () => {
    const { w } = await render();
    const items = w.findAll('[data-test="attention"] a');
    expect(items.map((a) => a.get('b').text())).toEqual([
      '2 vi phạm trong lộ trình',
      'Chưa kiểm tra chuẩn ngoại ngữ',
      '4 TC tự chọn chưa chọn môn',
      expect.any(String),
    ]);
    expect(items[0]!.attributes('href')).toBe(`/plans/${PLAN_ID}`);
    expect(items[1]!.attributes('href')).toBe('/audit#graduation');
    expect(items[3]!.attributes('href')).toBe('/audit');
  });

  it('shows the expected graduation term from the plan with the end month from the calendar', async () => {
    const { w } = await render();
    expect(text(w, 'expected-graduation')).toContain('HK1 2027–28');
    expect(text(w, 'expected-graduation')).toContain('01/2028');
  });

  it('draws one cell per credit for each term, past, current and planned, then graduation', async () => {
    const { w } = await render();
    const terms = w.findAll('[data-test="terms"] .db-term');
    expect(terms.map((t) => t.get('.lb').text())).toEqual(['HK1 24–25', 'HK1 26–27 · nay', 'HK1 27–28', 'Tốt nghiệp']);
    expect(terms[0]!.findAll('.cells i')).toHaveLength(13);
    expect(terms[0]!.findAll('.cells i.fail')).toHaveLength(4);
    expect(terms[1]!.findAll('.cells i.cur')).toHaveLength(4);
    expect(terms[2]!.findAll('.cells i.todo')).toHaveLength(8);
    expect(terms[1]!.classes()).toContain('now');
  });

  it('shows the GPA change in points since the term before the last term with grades', async () => {
    const audit = dashboardAudit();
    const first = audit.terms[0]!;
    const graded = { ...first, term: { year: 2025, number: 1 }, average: 9, cumulativeAccumulatedAverageChange: -0.12, attempts: [] };
    const { w } = await render({ ...audit, terms: [first, graded, audit.terms[1]!] });
    expect(text(w, 'gpa-change')).toBe('▼ 0,12');
    expect(w.get('[data-test="gpa-change"]').attributes('title')).toContain('HK1 24–25');
  });

  it('still shows the audit figures when the plan, notifications and calendar cannot load', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render(dashboardAudit(), {
      'GET /plans': status(500),
      'GET /notifications': status(500),
      'GET /academic-calendar': status(500),
    });
    expect(text(w, 'credits-toward-total')).toBe('8');
    expect(w.findAll('[data-test="group"]')).toHaveLength(3);
    expect(text(w, 'expected-graduation')).toContain('—');
  });

  it('plays the intro once per browser session', async () => {
    sessionStorage.clear();
    const first = await render();
    expect(first.w.get('.dashboard-page').classes()).toContain('db-intro');
    first.w.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
    const again = await render();
    expect(again.w.get('.dashboard-page').classes()).not.toContain('db-intro');
  });

  it('switches to English', async () => {
    const { w } = await render();
    useLocale().set('en');
    await flushPromises();
    expect(w.get('h1').text()).toBe('Dashboard');
    expect(text(w, 'gpa-accumulated-average')).toBe('8.00/10');
    expect(text(w, 'term-label')).toBe('T1 26–27 · now');
    expect(w.get('.db-center').text()).toContain('/ 20 credits');
  });

  it('sends a student who has not finished onboarding there, with no error', async () => {
    const { w } = await render(status(409, { statusCode: 409, code: 'onboarding_required', message: 'Finish onboarding' }));
    const note = w.get('[data-test="onboarding-required"]');
    expect(note.get('a').attributes('href')).toBe('/onboarding');
    expect(w.find('[role="alert"]').exists()).toBe(false);
    expect(w.find('[data-test="group"]').exists()).toBe(false);
  });

  it('says when there is no curriculum for the program and cohort', async () => {
    const { w } = await render(status(409, { statusCode: 409, code: 'curriculum_not_found', message: 'No curriculum' }));
    expect(w.get('[data-test="curriculum-not-found"]').get('a').attributes('href')).toBe('/settings');
  });

  it('shows an error with a retry when the audit cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w, fetch } = await render(status(500));
    expect(w.get('[role="alert"]').text()).toContain(AUDIT_MESSAGES.vi.loadFailed);
    fetch.mockImplementation(async (input) => Response.json(String(input).includes('/users/me/audit') ? dashboardAudit() : {}));
    await w.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(w.find('[role="alert"]').exists()).toBe(false);
    expect(text(w, 'credits-toward-total')).toBe('8');
  });

  it('on a 401 signs the student out and shows no error of its own', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render(status(401));
    expect(useAuth().signedIn).toBe(false);
    expect(w.find('[role="alert"]').exists()).toBe(false);
    expect(w.find('[data-test="group"]').exists()).toBe(false);
  });
});
