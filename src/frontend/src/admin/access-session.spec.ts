import { flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { useAuth } from '../auth/store.js';
import { mockApi } from '../testing/fetch.js';
import { setup } from '../testing/signed-in.js';
import { useAdminAccess, useGrantsFollowSession } from './access.js';
import { EVERY_GRANT, NO_GRANTS } from './testing/fixtures.js';

const MAX_FAILED_LOADS = 3;

let wrapper: VueWrapper | undefined;

const Host = defineComponent({
  setup() {
    useGrantsFollowSession();
    return () => null;
  },
});

async function render(path: string, signedIn: boolean, routes: Record<string, unknown> = {}) {
  mockApi({ 'GET /admin/grants': NO_GRANTS, ...routes });
  const { pinia, router } = await setup(path, { signedIn });
  wrapper = mount(Host, { global: { plugins: [pinia, router] } });
  await flushPromises();
  return { router };
}

const grantReads = () => vi.mocked(fetch).mock.calls.filter(([url]) => String(url).endsWith('/admin/grants')).length;

describe('following the session for the administration grants', () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.restoreAllMocks();
  });

  it('asks for the grants again on the next page when the first request failed, so the entry appears without a reload', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let down = true;
    const { router } = await render('/guides', true, { 'GET /admin/grants': () => (down ? new Response(null, { status: 503 }) : Response.json(EVERY_GRANT)) });
    const access = useAdminAccess();
    expect(access.any).toBe(false);
    down = false;
    await router.push('/privacy');
    await flushPromises();
    expect(access.any).toBe(true);
    const before = grantReads();
    await router.push('/guides');
    await flushPromises();
    expect(grantReads()).toBe(before);
  });

  it('asks for no grants while nobody is signed in', async () => {
    await render('/guides', false);
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url)).filter((url) => url.includes('/admin/'))).toEqual([]);
    expect(useAuth().signedIn).toBe(false);
  });

  it('stops asking for the grants on each page after three failures in a row (#160)', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { router } = await render('/guides', true, { 'GET /admin/grants': () => new Response(null, { status: 503 }) });
    for (const path of ['/privacy', '/guides', '/privacy', '/guides', '/privacy', '/guides']) {
      await router.push(path);
      await flushPromises();
    }
    expect(grantReads()).toBe(MAX_FAILED_LOADS);
    expect(logged.mock.calls.filter(([text]) => String(text).includes('administration grants'))).toHaveLength(MAX_FAILED_LOADS);
  });
});
