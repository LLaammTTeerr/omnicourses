import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { RouterView } from 'vue-router';
import { authResult } from '../auth/testing/fixtures.js';
import { mockApi } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import { useUnreadPolling } from './store.js';

const ONE_MINUTE_MS = 60_000;

let wrapper: VueWrapper | undefined;

const Host = defineComponent({
  setup() {
    useUnreadPolling();
    return () => h(RouterView);
  },
});

async function render(path: string, signedIn: boolean, routes: Record<string, unknown> = {}) {
  mockApi({ 'GET /notifications/unread-count': { unread: 0 }, ...routes });
  const { pinia, router } = await setup(path, { signedIn });
  wrapper = mount(Host, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return { router };
}

const unreadReads = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/notifications/unread-count')).length;

describe('polling the unread count', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('reads the count again on each page and every minute while the tab is shown, and never while signed out', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { router } = await render('/guides', true);
    const first = unreadReads();
    expect(first).toBe(1);
    await router.push('/privacy');
    await flushPromises();
    expect(unreadReads()).toBe(first + 1);
    vi.advanceTimersByTime(ONE_MINUTE_MS - 1);
    await flushPromises();
    expect(unreadReads()).toBe(first + 1);
    vi.advanceTimersByTime(1);
    await flushPromises();
    expect(unreadReads()).toBe(first + 2);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    vi.advanceTimersByTime(ONE_MINUTE_MS);
    await flushPromises();
    expect(unreadReads()).toBe(first + 2);
    wrapper!.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();

    await render('/guides', false);
    vi.advanceTimersByTime(ONE_MINUTE_MS);
    await flushPromises();
    expect(unreadReads()).toBe(0);
  });

  it('reads the count once when the student signs in and is sent on to the page they asked for', async () => {
    const { router } = await render('/sign-in?redirect=/guides', false, { 'POST /auth/sign-in': authResult() });
    await wrapper!.get('#sign-in-email').setValue('zz-student@example.com');
    await wrapper!.get('#sign-in-password').setValue('zz-password');
    await wrapper!.get('form').trigger('submit');
    await flushPromises();
    expect(router.currentRoute.value.path).toBe('/guides');
    expect(unreadReads()).toBe(1);
  });
});