import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView, type Router } from 'vue-router';
import type { Program } from '../curriculum/api.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import { NOT_STARTED, type Onboarding } from './api.js';
import { onboarding } from './testing/fixtures.js';

// Synthetic programs: APCS as the API lists it, and one the release does not offer.
const PROGRAMS: Program[] = [
  { code: 'APCS', nameVi: 'Chương trình Tiên tiến thử', nameEn: 'Advanced Program (test)', faculty: null, trainingType: 'advanced', cohortYears: [2023, 2024, 2025] },
  { code: 'ZZCLC', nameVi: 'Chương trình thử chưa hỗ trợ', nameEn: null, faculty: null, trainingType: null, cohortYears: [2025] },
];

let wrapper: VueWrapper | undefined;
let router: Router;

async function render(saved: Onboarding = NOT_STARTED, routes: Record<string, unknown> = {}) {
  const fetch = mockApi({
    'GET /programs': { programs: PROGRAMS },
    'PUT /users/me/onboarding': (init: RequestInit) => Response.json(sentBody(init)),
    'GET /users/me/transcript': { rows: [] },
    ...routes,
  });
  const app = await setup('/onboarding?redirect=/transcript', { onboarded: saved });
  router = app.router;
  wrapper = mount(RouterView, { global: { plugins: [app.pinia, router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch };
}

const eyebrow = (w: VueWrapper) => w.get('[data-test="eyebrow"]').text();
const next = async (w: VueWrapper) => {
  await w.get('form').trigger('submit');
  await flushPromises();
};
const puts = (fetch: ReturnType<typeof mockApi>) => fetch.mock.calls.filter(([, init]) => init?.method === 'PUT').map(([, init]) => sentBody(init));

describe('OnboardingView (UC-01 steps 6–9)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('offers only the programs of this release, and says why another cannot be picked (A7)', async () => {
    const { w } = await render();
    expect(eyebrow(w)).toBe('Câu 1 / 4 · Chương trình');
    expect(w.get('h1').text()).toBe('Bạn đang học chương trình nào?');
    const apcs = w.get('[data-test="program-APCS"]');
    expect(apcs.text()).toContain('Chương trình Tiên tiến thử');
    expect(apcs.attributes('disabled')).toBeUndefined();
    expect(w.find('[data-test="program-ZZCLC"]').exists()).toBe(false);
    const other = w.get('[data-test="not-offered"]');
    expect(other.get('summary').text()).toBe('1 chương trình khác chưa hỗ trợ trong bản này');
    expect(other.text()).toContain('Chương trình thử chưa hỗ trợ · ZZCLC');

    await next(w);
    expect(w.get('[role="alert"]').text()).toBe('Hãy chọn một chương trình.');
    expect(eyebrow(w)).toBe('Câu 1 / 4 · Chương trình');
  });

  it('saves the whole object after each step, then finishes and opens the page asked for', async () => {
    const { w, fetch } = await render();
    await w.get('[data-test="program-APCS"]').trigger('click');
    expect(w.get('[data-test="program-APCS"]').attributes('aria-pressed')).toBe('true');
    await next(w);

    // Only the offered cohorts that have a curriculum.
    expect(w.findAll('[data-test^="cohort-"]').map((b) => b.text())).toEqual([expect.stringContaining('Khóa 2024'), expect.stringContaining('Khóa 2025')]);
    expect(document.activeElement).toBe(w.get('h1').element);
    await w.get('[data-test="cohort-2025"]').trigger('click');
    await next(w);
    expect(puts(fetch)).toEqual([{ ...NOT_STARTED, program: 'APCS', cohort: 2025 }]);

    expect(eyebrow(w)).toBe('Câu 3 / 4 · Mục tiêu');
    await w.get('#onboarding-graduation').setValue('2027-2');
    await next(w);

    expect(eyebrow(w)).toBe('Câu 4 / 4 · Tải học');
    await w.get('#onboarding-credits').setValue('40');
    await w.get('#onboarding-internship').setValue('none');
    expect(w.get('button[type="submit"]').text()).toBe('Xong');
    await next(w);

    expect(puts(fetch).at(-1)).toEqual({
      program: 'APCS',
      cohort: 2025,
      targetGraduationTerm: { year: 2027, number: 2 },
      creditsPerTerm: 40,
      internshipTerm: 'none',
      finished: true,
    });
    expect(router.currentRoute.value.fullPath).toBe('/transcript');
    expect(useToast().message).toBe('Đã lưu. Bạn có thể đổi các câu trả lời này trong Cài đặt.');
  }, 15_000); // Four steps and four saves: slower than the rest on a busy machine.

  it('resumes at the first unanswered step (A8)', async () => {
    const { w } = await render(onboarding({ finished: false, targetGraduationTerm: null }));
    expect(eyebrow(w)).toBe('Câu 3 / 4 · Mục tiêu');
  });

  it('takes any whole number of credits of 1 or more, and refuses the rest before sending', async () => {
    const { w, fetch } = await render(onboarding({ finished: false, creditsPerTerm: null }));
    await next(w);
    await w.get('#onboarding-credits').setValue('0');
    expect(w.get('[data-test="credits-error"]').text()).toBe('Nhập một số nguyên từ 1 trở lên.');
    expect(w.get('#onboarding-credits').attributes('aria-invalid')).toBe('true');
    const before = puts(fetch).length;
    await next(w);
    expect(puts(fetch)).toHaveLength(before);
    expect(router.currentRoute.value.name).toBe('onboarding');
  });

  it('shows the API’s message under the field it names, on that field’s step (400)', async () => {
    const { w } = await render(onboarding({ finished: false }), {
      'PUT /users/me/onboarding': status(400, { message: ['creditsPerTerm is too large to store'] }),
    });
    expect(eyebrow(w)).toBe('Câu 3 / 4 · Mục tiêu');
    await next(w);
    expect(eyebrow(w)).toBe('Câu 4 / 4 · Tải học');
    expect(w.get('[data-test="credits-error"]').text()).toBe('creditsPerTerm is too large to store');
    expect(router.currentRoute.value.name).toBe('onboarding');
  });

  it('keeps the answers when saving fails for another reason', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render(onboarding({ finished: false }), { 'PUT /users/me/onboarding': status(503) });
    await w.get('#onboarding-graduation').setValue('2028-1');
    await next(w);
    expect(w.get('[data-test="save-failed"]').text()).toContain('Câu trả lời vẫn còn ở đây');
    expect((w.get('#onboarding-graduation').element as HTMLSelectElement).value).toBe('2028-1');
  });

  it('lets the student leave and come back later (A7, A8)', async () => {
    const { w } = await render();
    expect(w.get('[data-test="later"]').attributes('href')).toBe('/');
  });

  it('still offers APCS when the program list cannot be loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { w } = await render(NOT_STARTED, { 'GET /programs': status(500) });
    expect(w.get('[data-test="program-APCS"]').text()).toContain('APCS');
  });
});
