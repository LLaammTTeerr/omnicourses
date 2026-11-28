import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterView, type Router } from 'vue-router';
import type { Program } from '../curriculum/api.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import { NOT_STARTED, type Onboarding } from './api.js';
import { onboarding } from './testing/fixtures.js';
import { chooseOption } from '../testing/select.js';
import { GOAL_MESSAGES, ONBOARDING_MESSAGES } from './messages.js';

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
    expect(w.get('h1').text()).toBe(ONBOARDING_MESSAGES.vi.programQuestion);
    const apcs = w.get('[data-test="program-APCS"]');
    expect(apcs.text()).toContain('Chương trình Tiên tiến thử');
    expect(apcs.attributes('disabled')).toBeUndefined();
    expect(w.find('[data-test="program-ZZCLC"]').exists()).toBe(false);
    const other = w.get('[data-test="not-offered"]');
    expect(other.get('summary').text()).toBe('1 chương trình khác chưa hỗ trợ trong bản này');
    expect(other.text()).toContain('Chương trình thử chưa hỗ trợ · ZZCLC');

    await next(w);
    expect(w.get('[role="alert"]').text()).toBe(ONBOARDING_MESSAGES.vi.pickProgram);
    expect(eyebrow(w)).toBe('Câu 1 / 4 · Chương trình');
  });

  it('saves the whole object after each step, then finishes and opens the page asked for', async () => {
    const { w, fetch } = await render();
    await w.get('[data-test="program-APCS"]').trigger('click');
    expect(w.get('[data-test="program-APCS"]').attributes('aria-pressed')).toBe('true');
    await next(w);

    expect(w.findAll('[data-test^="cohort-"]').map((b) => b.text())).toEqual([expect.stringContaining('Khóa 2024'), expect.stringContaining('Khóa 2025')]);
    expect(document.activeElement).toBe(w.get('h1').element);
    await w.get('[data-test="cohort-2025"]').trigger('click');
    await next(w);
    expect(puts(fetch)).toEqual([{ ...NOT_STARTED, program: 'APCS', cohort: 2025 }]);

    expect(eyebrow(w)).toBe('Câu 3 / 4 · Mục tiêu');
    await chooseOption(w.get('#onboarding-graduation'), 'HK2 2027–2028');
    await next(w);

    expect(eyebrow(w)).toBe('Câu 4 / 4 · Tải học');
    await w.get('#onboarding-credits').setValue('40');
    await chooseOption(w.get('#onboarding-internship'), 'Không thực tập');
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
    expect(useToast().message).toBe(ONBOARDING_MESSAGES.vi.finished);
  }, 15_000);

  it('resumes at the first unanswered step (A8)', async () => {
    const { w } = await render(onboarding({ finished: false, targetGraduationTerm: null }));
    expect(eyebrow(w)).toBe('Câu 3 / 4 · Mục tiêu');
  });

  it('takes any whole number of credits of 1 or more, and refuses the rest before sending', async () => {
    const { w, fetch } = await render(onboarding({ finished: false, creditsPerTerm: null }));
    await next(w);
    await w.get('#onboarding-credits').setValue('0');
    expect(w.get('[data-test="credits-error"]').text()).toBe(GOAL_MESSAGES.vi.creditsProblems.whole);
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
    await chooseOption(w.get('#onboarding-graduation'), 'HK1 2028–2029');
    await next(w);
    expect(w.get('[data-test="save-failed"]').text()).toContain('Câu trả lời vẫn còn ở đây');
    expect(w.get('#onboarding-graduation').text()).toBe('HK1 2028–2029');
  });

  it('lets the student leave and come back later (A7, A8)', async () => {
    const { w } = await render();
    expect(w.get('[data-test="later"]').attributes('href')).toBe('/');
  });

  it('shows an error and retries when the program list fails to load even if saved answers loaded', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let failPrograms = true;
    const { w, fetch } = await render(NOT_STARTED, {
      'GET /programs': () => (failPrograms ? status(500)() : Response.json({ programs: PROGRAMS })),
    });
    expect(w.find('form').exists()).toBe(false);
    expect(w.get('[role="alert"]').text()).toContain(ONBOARDING_MESSAGES.vi.loadFailed);

    failPrograms = false;
    await w.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(w.get('[data-test="program-APCS"]').text()).toContain('Chương trình Tiên tiến thử');
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/programs'))).toHaveLength(2);
  });

  it('waits for the program list before showing the wizard, and retries both loads after a failure', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let resolvePrograms!: (res: Response) => void;
    let failInitial = true;
    const fetch = mockApi({
      'GET /programs': () => (failInitial ? status(503)() : new Promise<Response>((resolve) => { resolvePrograms = resolve; })),
      'GET /users/me/onboarding': () => (failInitial ? status(503)() : Response.json(NOT_STARTED)),
    });
    const app = await setup('/onboarding', { onboarded: null });
    router = app.router;
    wrapper = mount(RouterView, { global: { plugins: [app.pinia, router] }, attachTo: document.body });
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain(ONBOARDING_MESSAGES.vi.loadFailed);

    failInitial = false;
    await wrapper.get('[role="alert"] button').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain(ONBOARDING_MESSAGES.vi.loading);
    expect(wrapper.find('form').exists()).toBe(false);

    resolvePrograms(Response.json({ programs: PROGRAMS }));
    await flushPromises();
    expect(wrapper.get('[data-test="program-APCS"]').text()).toContain('Chương trình Tiên tiến thử');
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith('/programs')).length).toBeGreaterThanOrEqual(2);
  });

  it('names goal comboboxes via aria-label without wrapping labels or dangling error ids', async () => {
    const { w } = await render(onboarding({ finished: false, creditsPerTerm: null }));
    const grad = w.get('#onboarding-graduation');
    expect(grad.attributes('aria-label')).toBe(GOAL_MESSAGES.vi.graduation);
    expect(grad.element.closest('label')).toBeNull();
    expect(grad.attributes('aria-describedby')).toBe('onboarding-graduation-hint');

    await next(w);
    const credits = w.get('#onboarding-credits');
    const internship = w.get('#onboarding-internship');
    expect(credits.attributes('aria-describedby')).toBe('onboarding-credits-hint');
    expect(internship.attributes('aria-label')).toBe(GOAL_MESSAGES.vi.internship);
    expect(internship.element.closest('label')).toBeNull();
    expect(internship.attributes('aria-describedby')).toBe('onboarding-internship-hint');

    await credits.setValue('0');
    expect(credits.attributes('aria-describedby')).toBe('onboarding-credits-hint onboarding-credits-error');
  });
});
