import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Program } from '../curriculum/api.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import { NOT_STARTED, type Onboarding } from './api.js';
import StudySettings from './StudySettings.vue';
import { onboarding } from './testing/fixtures.js';

const PROGRAMS: Program[] = [{ code: 'APCS', nameVi: 'Chương trình Tiên tiến thử', nameEn: null, faculty: null, cohortYears: [2024, 2025] }];

let wrapper: VueWrapper | undefined;

async function render(saved: Onboarding, routes: Record<string, unknown> = {}) {
  const fetch = mockApi({
    'GET /programs': { programs: PROGRAMS },
    'PUT /users/me/onboarding': (init: RequestInit) => Response.json(sentBody(init)),
    ...routes,
  });
  const app = await setup('/settings', { onboarded: saved });
  wrapper = mount(StudySettings, { global: { plugins: [app.pinia, app.router] }, attachTo: document.body });
  await flushPromises();
  return { w: wrapper, fetch };
}

const value = (w: VueWrapper, selector: string) => (w.get(selector).element as HTMLInputElement | HTMLSelectElement).value;

describe('StudySettings (UC-01 A9)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('shows the saved answers and saves the whole object, still finished', async () => {
    const { w, fetch } = await render(onboarding());
    const [program, cohort] = w.findAll('.study-program select');
    expect((program!.element as HTMLSelectElement).value).toBe('APCS');
    expect((cohort!.element as HTMLSelectElement).value).toBe('2024');
    expect(value(w, '#study-graduation')).toBe('2027-2');
    expect(value(w, '#study-credits')).toBe('18');
    expect(value(w, '#study-internship')).toBe('none');

    await cohort!.setValue('2025');
    await w.get('#study-credits').setValue('');
    await w.get('form').trigger('submit');
    await flushPromises();
    expect(sentBody(fetch.mock.calls.find(([, init]) => init?.method === 'PUT')![1])).toEqual(onboarding({ cohort: 2025, creditsPerTerm: null }));
    expect(useToast().message).toBe('Đã lưu chương trình và mục tiêu.');
  });

  it('does not send credits that are not a whole number of 1 or more', async () => {
    const { w, fetch } = await render(onboarding());
    await w.get('#study-credits').setValue('2,5');
    await w.get('form').trigger('submit');
    await flushPromises();
    expect(w.get('[data-test="credits-error"]').text()).toBe('Nhập một số nguyên từ 1 trở lên.');
    expect(fetch.mock.calls.some(([, init]) => init?.method === 'PUT')).toBe(false);
  });

  it('shows a refused goal under its field', async () => {
    const { w } = await render(onboarding(), {
      'PUT /users/me/onboarding': status(400, { message: ['targetGraduationTerm must be from 2026–2027 term 1 (the current term) to 2034–2035 term 3'] }),
    });
    await w.get('form').trigger('submit');
    await flushPromises();
    expect(w.get('#study-graduation-error').text()).toContain('targetGraduationTerm must be from');
    expect(w.get('#study-graduation').attributes('aria-invalid')).toBe('true');
  });

  it('sends a student who has not finished onboarding back to it', async () => {
    const { w } = await render({ ...NOT_STARTED, program: 'APCS', cohort: 2024 });
    expect(w.find('[data-test="study-form"]').exists()).toBe(false);
    expect(w.get('[data-test="finish-onboarding"]').attributes('href')).toBe('/onboarding');
  });
});
