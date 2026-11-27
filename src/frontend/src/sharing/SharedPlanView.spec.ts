import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView } from 'vue-router';
import App from '../App.vue';
import { useLocale } from '../locale.js';
import { mockApi, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import type { SharedPlan } from './api.js';

const TOKEN = 'q3T0c6mJm0mB1bqT8mWl2k0E1e8b6Zb1K3w1r5yX9aA';

function sharedFixture(overrides: Partial<SharedPlan> = {}): SharedPlan {
  return {
    name: 'Kế hoạch tốt nghiệp đúng hạn',
    ownerName: null,
    curriculum: {
      code: 'APCS2024',
      cohortYear: 2024,
      nameVi: 'Cử nhân KHMT chương trình Tiên tiến khóa 2024',
      nameEn: 'BSc Computer Science (APCS) Cohort 2024',
      program: {
        code: 'APCS',
        nameVi: 'Chương trình Tiên tiến Khoa học máy tính',
        nameEn: 'Advanced Program in Computer Science',
      },
    },
    updatedAt: '2026-11-25T14:20:00.000Z',
    terms: [
      {
        term: { year: 2026, number: 1 },
        kind: 'main',
        credits: 8,
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
          {
            kind: 'slot',
            courseCode: null,
            nameVi: null,
            nameEn: null,
            credits: 4,
            requirementGroupName: 'Tự chọn Computer Science (C)',
          },
        ],
      },
    ],
    issues: [
      {
        code: 'load_below_minimum',
        kind: 'flag',
        term: { year: 2026, number: 1 },
        position: null,
        courseCode: null,
        offeredTermNumbers: [],
        credits: 8,
        limit: 10,
        citation: 'QĐ 1175/QĐ-KHTN Điều 7.2',
        message: '8 credits, below the minimum of 10.',
      },
      {
        code: 'not_offered',
        kind: 'violation',
        term: { year: 2026, number: 1 },
        position: 0,
        courseCode: 'CS161',
        offeredTermNumbers: [2],
        credits: null,
        limit: null,
        citation: 'QĐ 1175/QĐ-KHTN Điều 10.1',
        message: 'CS161 is not taught in term 1.',
      },
      {
        code: 'prerequisites_not_recorded',
        kind: 'unknown',
        term: { year: 2026, number: 1 },
        position: 0,
        courseCode: 'CS161',
        offeredTermNumbers: [],
        credits: null,
        limit: null,
        citation: 'QĐ 1175/QĐ-KHTN Điều 3.1',
        message: 'CS161: prerequisites not recorded yet.',
      },
    ],
    issueCodesNotShown: ['prerequisite_not_met', 'already_passed', 'already_in_progress', 'requirement_not_covered'],
    ...overrides,
  };
}

let wrapper: VueWrapper | undefined;

async function renderShared(path = `/shared/${TOKEN}`, signedIn = false, withShell = false) {
  const app = await setup(path, { signedIn });
  wrapper = mount(withShell ? App : RouterView, {
    global: { plugins: [app.pinia, app.router] },
    attachTo: document.body,
  });
  await flushPromises();
  return { w: wrapper, router: app.router };
}

describe('SharedPlanView (F9, UC-09 & UC-16, ADR 0010)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    document.head.querySelectorAll('meta[name="robots"]').forEach((el) => el.remove());
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    document.head.querySelectorAll('meta[name="robots"]').forEach((el) => el.remove());
    vi.restoreAllMocks();
  });

  it('sets <meta name="robots" content="noindex, nofollow"> on mount and removes it on unmount', async () => {
    mockApi({ [`GET /shared-plans/${TOKEN}`]: sharedFixture() });
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();

    const { w } = await renderShared();
    const meta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    expect(meta).not.toBeNull();
    expect(meta!.content).toBe('noindex, nofollow');

    w.unmount();
    wrapper = undefined;
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });

  it('renders publicly when signed out, showing terms, placements, caps, issues, and the withheld-checks callout', async () => {
    mockApi({ [`GET /shared-plans/${TOKEN}`]: sharedFixture() });
    const { w } = await renderShared(`/shared/${TOKEN}`, false, true);

    expect(w.find('.frame-public').exists()).toBe(true);
    expect(w.get('[data-test="readonly-banner"]').text()).toContain('chỉ đọc');
    expect(w.find('[data-test="owner-name"]').exists()).toBe(false);
    expect(w.get('h1').text()).toBe('Kế hoạch tốt nghiệp đúng hạn');
    expect(w.get('[data-test="curriculum-meta"]').text()).toContain('APCS');
    expect(w.get('[data-test="curriculum-meta"]').text()).toContain('2024');
    expect(w.get('[data-test="curriculum-meta"]').text()).toContain('APCS2024');

    const notice = w.get('[data-test="withheld-checks-notice"]');
    expect(notice.text()).toContain('Thiếu môn tiên quyết');
    expect(notice.text()).toContain('Nhóm còn thiếu');
    expect(w.find('[data-test="shared-coverage"]').exists()).toBe(false);

    const term = w.get('[data-test="term-2026-1"]');
    expect(term.get('[data-test="term-load"]').text()).toContain('8 / 22 TC');
    expect(term.get('[data-test="term-load"]').text()).toContain('10–22 TC');
    expect(term.get('[data-test="placement-CS161"]').text()).toContain('Nhập môn lập trình');
    expect(term.get('[data-test="placement-CS161"]').classes()).toContain('has-violation');
    expect(term.get('[data-test="placement-slot"]').text()).toContain('Chỗ cho Tự chọn Computer Science (C)');

    const rail = w.get('[data-test="shared-issues"]');
    expect(rail.get('[data-test="violation-count"]').text()).toBe('1');
    expect(rail.get('[data-test="issue-violation"]').text()).toContain('CS161 không mở ở HK1; chỉ mở HK2.');
    expect(rail.get('[data-test="issue-flag"]').text()).toContain('8 TC, dưới mức tối thiểu 10 TC.');
    expect(rail.get('[data-test="shared-unknowns"]').text()).toContain('CS161: chưa ghi nhận môn tiên quyết.');
  });

  it('works signed-in with app layout and renders ownerName, transcript issues, and requirement coverage when enabled', async () => {
    mockApi({
      'GET /admin/grants': { programs: [], permissions: [] },
      'GET /notifications/unread-count': { unread: 0 },
      [`GET /shared-plans/${TOKEN}`]: sharedFixture({
        ownerName: 'Nguyễn Minh An',
        issueCodesNotShown: [],
        issues: [
          {
            code: 'prerequisite_not_met',
            kind: 'violation',
            term: { year: 2026, number: 1 },
            position: 0,
            courseCode: 'CS162',
            missingCourseCodes: ['CS161'],
            offeredTermNumbers: [],
            credits: null,
            limit: null,
            citation: 'QĐ 1175/QĐ-KHTN Điều 3.1.c',
            message: 'CS162 needs CS161.',
          },
          {
            code: 'requirement_not_covered',
            kind: 'violation',
            term: null,
            position: null,
            courseCode: null,
            missingCourseCodes: ['CS499'],
            requirementGroupName: 'Khóa luận tốt nghiệp',
            combinedMinimumName: null,
            offeredTermNumbers: [],
            credits: 0,
            limit: 10,
            citation: 'QĐ 1175/QĐ-KHTN Điều 17.3',
            message: 'Thesis short.',
          },
        ],
        coverage: {
          groups: [
            { name: 'Kiến thức Computer Science: bắt buộc', kind: 'compulsory', requiredCredits: 48, credits: 48, remainingCredits: 0, met: true },
            { name: 'Khóa luận tốt nghiệp', kind: 'compulsory', requiredCredits: 10, credits: 0, remainingCredits: 10, met: false },
          ],
          combinedMinimums: [
            { name: 'Tự chọn Toán và KHMT', creditsMin: 43, credits: 40, remainingCredits: 3, met: false },
          ],
          totalRequired: 138,
          totalCredits: 125,
          totalRemaining: 13,
          graduation: 'not_yet',
        },
      }),
    });

    const { w } = await renderShared(`/shared/${TOKEN}`, true, true);
    useLocale().set('en');
    await flushPromises();

    expect(w.find('.frame-app').exists()).toBe(true);
    expect(w.get('[data-test="owner-name"]').text()).toBe('Shared by Nguyễn Minh An');
    expect(w.find('[data-test="withheld-checks-notice"]').exists()).toBe(false);

    const cov = w.get('[data-test="shared-coverage"]');
    expect(cov.text()).toContain('125/138 credits');
    expect(cov.get('[data-test="graduation-verdict"]').text()).toBe('Not enough to graduate yet');
    expect(cov.get('[data-test="groups-short"]').text()).toBe('2 groups still short');
    expect(cov.findAll('[data-test="coverage-group"]')).toHaveLength(2);
    expect(cov.get('[data-test="coverage-combined"]').text()).toContain('40/43 cr · 3 cr short');

    const issues = w.findAll('[data-test="issue-violation"]');
    expect(issues).toHaveLength(2);
    expect(issues[0]!.text()).toContain('CS162 needs CS161 passed or placed in an earlier term.');
    expect(issues[1]!.text()).toContain('Khóa luận tốt nghiệp still short: 0/10 credits; not placed: CS499.');
  });

  it('calls window.print() when Print / Save as PDF is clicked', async () => {
    mockApi({ [`GET /shared-plans/${TOKEN}`]: sharedFixture() });
    const printSpy = vi.fn();
    Object.defineProperty(window, 'print', { configurable: true, writable: true, value: printSpy });

    const { w } = await renderShared();
    await w.get('[data-test="print-pdf"]').trigger('click');
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  it('shows the not-shared empty card on 404 and retryable error state on 503', async () => {
    mockApi({
      'GET /shared-plans/stopped-token': status(404, { statusCode: 404, message: 'This plan is not shared', error: 'Not Found' }),
    });
    const { w } = await renderShared('/shared/stopped-token');
    useLocale().set('en');
    await flushPromises();

    expect(w.get('[data-test="not-shared"]').text()).toContain('This plan is not shared');
    expect(w.find('[data-test="print-pdf"]').exists()).toBe(false);

    w.unmount();
    wrapper = undefined;

    vi.spyOn(console, 'error').mockImplementation(() => {});
    let calls = 0;
    mockApi({
      [`GET /shared-plans/${TOKEN}`]: () => (++calls === 1 ? new Response(null, { status: 503 }) : Response.json(sharedFixture())),
    });
    const second = await renderShared(`/shared/${TOKEN}`);
    expect(second.w.find('[data-test="shared-failed"]').exists()).toBe(true);
    await second.w.get('[data-test="retry"]').trigger('click');
    await flushPromises();
    expect(second.w.get('h1').text()).toBe('Kế hoạch tốt nghiệp đúng hạn');
  });
});
