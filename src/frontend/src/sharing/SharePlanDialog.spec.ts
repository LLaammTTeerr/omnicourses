import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../auth/store.js';
import { useLocale } from '../locale.js';
import { PLAN_ID } from '../plans/testing/fixtures.js';
import { useToast } from '../shell/toast.js';
import { mockApi, sentBody, status } from '../testing/fetch.js';
import { signedInPinia } from '../testing/signed-in.js';
import type { PlanShare } from './api.js';
import SharePlanDialog from './SharePlanDialog.vue';

const SHARE_TOKEN = 'q3T0c6mJm0mB1bqT8mWl2k0E1e8b6Zb1K3w1r5yX9aA';

function makeShare(overrides: Partial<PlanShare> = {}): PlanShare {
  return {
    token: SHARE_TOKEN,
    showName: false,
    showTranscriptChecks: false,
    createdAt: '2026-11-25T10:30:00.000Z',
    ...overrides,
  };
}

let wrapper: VueWrapper | undefined;

function mountDialog(open = true, planName = 'Kế hoạch chính') {
  const pinia = signedInPinia();
  wrapper = mount(SharePlanDialog, {
    props: { open, planId: PLAN_ID, planName },
    global: { plugins: [pinia] },
    attachTo: document.body,
  });
  return { w: wrapper, pinia };
}

describe('SharePlanDialog (F9, UC-09, ADR 0010)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('fetches GET /plans/:id/share only once opened, creates a link, and shows the open link', async () => {
    const puts: unknown[] = [];
    const fetch = mockApi({
      [`GET /plans/${PLAN_ID}/share`]: { share: null },
      [`PUT /plans/${PLAN_ID}/share`]: (init: RequestInit | undefined) => {
        const body = sentBody(init) as { showName?: boolean; showTranscriptChecks?: boolean };
        puts.push(body);
        return Response.json(makeShare({ showName: Boolean(body.showName), showTranscriptChecks: Boolean(body.showTranscriptChecks) }));
      },
    });

    const { w } = mountDialog(false);
    await flushPromises();
    expect(fetch).not.toHaveBeenCalled();

    await w.setProps({ open: true });
    await flushPromises();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(w.find('[data-test="active-share"]').exists()).toBe(false);
    expect(w.find('[data-test="transcript-checks-warning"]').exists()).toBe(false);

    await w.get('[data-test="share-show-name"]').setValue(true);
    await w.get('[data-test="create-share-link"]').trigger('click');
    await flushPromises();

    expect(puts).toEqual([{ showName: true, showTranscriptChecks: false }]);
    const urlInput = w.get('[data-test="share-url"]').element as HTMLInputElement;
    expect(urlInput.value).toBe(`${window.location.origin}/shared/${SHARE_TOKEN}`);
    const openLink = w.get('[data-test="open-shared-plan"]');
    expect(openLink.attributes('href')).toBe(`/shared/${SHARE_TOKEN}`);
    expect(openLink.attributes('target')).toBe('_blank');
  });

  it('stages active-link option changes so the ADR 0010 privacy warning is shown before saving (vi and en)', async () => {
    let current = makeShare();
    const puts: unknown[] = [];
    mockApi({
      [`GET /plans/${PLAN_ID}/share`]: () => Response.json({ share: current }),
      [`PUT /plans/${PLAN_ID}/share`]: (init: RequestInit | undefined) => {
        const body = sentBody(init) as { showName?: boolean; showTranscriptChecks?: boolean };
        puts.push(body);
        current = { ...current, ...body };
        return Response.json(current);
      },
    });

    const { w } = mountDialog(true);
    await flushPromises();
    expect(w.find('[data-test="transcript-checks-warning"]').exists()).toBe(false);
    expect((w.get('[data-test="save-share-options"]').element as HTMLButtonElement).disabled).toBe(true);

    await w.get('[data-test="share-show-transcript-checks"]').setValue(true);
    await flushPromises();
    expect(puts).toEqual([]);
    expect((w.get('[data-test="save-share-options"]').element as HTMLButtonElement).disabled).toBe(false);
    const warningVi = w.get('[data-test="transcript-checks-warning"]').text();
    expect(warningVi).toContain('đạt, trượt hoặc đang học');
    expect(warningVi).toContain('Điểm số');

    useLocale().set('en');
    await flushPromises();
    const warningEn = w.get('[data-test="transcript-checks-warning"]').text();
    expect(warningEn).toContain('passed, failed, or are taking in progress');
    expect(warningEn).toContain('Grades and transcript rows are never shown');

    await w.get('[data-test="save-share-options"]').trigger('click');
    await flushPromises();
    expect(puts).toEqual([{ showName: false, showTranscriptChecks: true }]);
    expect((w.get('[data-test="save-share-options"]').element as HTMLButtonElement).disabled).toBe(true);

    await w.get('[data-test="share-show-transcript-checks"]').setValue(false);
    await flushPromises();
    expect(puts).toEqual([{ showName: false, showTranscriptChecks: true }]);
    expect(w.find('[data-test="transcript-checks-warning"]').exists()).toBe(false);
    await w.get('[data-test="save-share-options"]').trigger('click');
    await flushPromises();
    expect(puts).toEqual([
      { showName: false, showTranscriptChecks: true },
      { showName: false, showTranscriptChecks: false },
    ]);
  });

  it('shows the privacy warning before link creation when ticking showTranscriptChecks in draft state', async () => {
    mockApi({ [`GET /plans/${PLAN_ID}/share`]: { share: null } });
    const { w } = mountDialog(true);
    useLocale().set('en');
    await flushPromises();

    await w.get('[data-test="share-show-transcript-checks"]').setValue(true);
    expect(w.get('[data-test="transcript-checks-warning"]').text()).toContain('passed, failed, or are taking in progress');
  });

  it('copies the full URL via navigator.clipboard and falls back when clipboard write fails', async () => {
    mockApi({ [`GET /plans/${PLAN_ID}/share`]: { share: makeShare() } });
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Denied'));
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    const { w } = mountDialog(true);
    useLocale().set('en');
    await flushPromises();

    const expectedUrl = `${window.location.origin}/shared/${SHARE_TOKEN}`;
    await w.get('[data-test="copy-share-link"]').trigger('click');
    await flushPromises();
    expect(writeText).toHaveBeenCalledWith(expectedUrl);
    expect(w.get('[data-test="copy-share-link"]').text()).toContain('Copied');
    expect(useToast().message).toContain('Copied');

    const inputEl = w.get('[data-test="share-url"]').element as HTMLInputElement;
    const selectSpy = vi.spyOn(inputEl, 'select');
    await w.get('[data-test="copy-share-link"]').trigger('click');
    await flushPromises();
    expect(selectSpy).toHaveBeenCalled();
    expect(w.get('[data-test="copy-fallback-notice"]').text()).toContain('Ctrl+C');
  });

  it('revokes the live share link via DELETE /plans/:id/share', async () => {
    let deleted = false;
    mockApi({
      [`GET /plans/${PLAN_ID}/share`]: { share: makeShare({ showName: true, showTranscriptChecks: true }) },
      [`DELETE /plans/${PLAN_ID}/share`]: () => {
        deleted = true;
        return new Response(null, { status: 204 });
      },
    });

    const { w } = mountDialog(true);
    await flushPromises();
    expect(w.find('[data-test="active-share"]').exists()).toBe(true);

    await w.get('[data-test="stop-sharing"]').trigger('click');
    await flushPromises();

    expect(deleted).toBe(true);
    expect(w.find('[data-test="active-share"]').exists()).toBe(false);
    expect(w.find('[data-test="create-share-link"]').exists()).toBe(true);
    expect((w.get('[data-test="share-show-name"]').element as HTMLInputElement).checked).toBe(false);
    expect((w.get('[data-test="share-show-transcript-checks"]').element as HTMLInputElement).checked).toBe(false);
  });

  it('reverts a failed choice update and offers retry when loading fails, signing out on 401', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let attempts = 0;
    mockApi({
      [`GET /plans/${PLAN_ID}/share`]: () =>
        ++attempts === 1 ? new Response(null, { status: 503 }) : Response.json({ share: makeShare({ showName: false }) }),
      [`PUT /plans/${PLAN_ID}/share`]: status(503),
    });

    const { w } = mountDialog(true);
    await flushPromises();
    expect(w.find('[data-test="share-load-failed"]').exists()).toBe(true);

    await w.get('[data-test="share-retry"]').trigger('click');
    await flushPromises();
    expect(w.find('[data-test="active-share"]').exists()).toBe(true);

    await w.get('[data-test="share-show-name"]').setValue(true);
    await w.get('[data-test="save-share-options"]').trigger('click');
    await flushPromises();
    expect((w.get('[data-test="share-show-name"]').element as HTMLInputElement).checked).toBe(true);
    expect(w.find('[data-test="share-action-error"]').exists()).toBe(true);

    w.unmount();
    wrapper = undefined;

    mockApi({ [`GET /plans/${PLAN_ID}/share`]: status(401) });
    mountDialog(true);
    await flushPromises();
    expect(useAuth().signedIn).toBe(false);
  });
});
