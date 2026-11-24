import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextTick } from 'vue';
import { useAuth } from '../auth/store.js';
import { user } from '../auth/testing/fixtures.js';
import { mockApi, status } from '../testing/fetch.js';
import { useAdminAccess } from './store.js';
import { ACCESS_MANAGER, EVERY_GRANT, grants, NO_GRANTS, PROGRAM_ADMIN } from './testing/fixtures.js';

function signIn(overrides = {}) {
  const auth = useAuth();
  auth.token = 'zz-token';
  auth.user = user(overrides);
}

describe('the signed-in user\'s own grants (ADR 0011)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    signIn();
  });
  afterEach(() => vi.restoreAllMocks());

  it('holds nothing before the API answers, and nothing for a user with no grant', async () => {
    const fetch = mockApi({ 'GET /admin/grants': NO_GRANTS });
    const access = useAdminAccess();
    expect([access.any, access.held, access.grants]).toEqual([false, [], null]);
    expect(await access.load()).toEqual(NO_GRANTS);
    expect([access.any, access.held, access.failed]).toEqual([false, [], false]);
    expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer zz-token' } });
  });

  it('lists the kinds of permission held, each independent of the others', async () => {
    mockApi({ 'GET /admin/grants': EVERY_GRANT });
    const access = useAdminAccess();
    await access.load();
    expect(access.held).toEqual(['program_admin', 'catalog_maintainer', 'access_manager']);
    expect(access.any).toBe(true);
    access.cache = { userId: user().id, grants: ACCESS_MANAGER };
    expect(access.held).toEqual(['access_manager']);
    expect([access.holds('access_manager'), access.holds('program_admin'), access.holds('catalog_maintainer')]).toEqual([true, false, false]);
  });

  it('asks the API once per account, and again only when told to', async () => {
    let answer = PROGRAM_ADMIN;
    const fetch = mockApi({ 'GET /admin/grants': () => Response.json(answer) });
    const access = useAdminAccess();
    await Promise.all([access.load(), access.load()]);
    await access.load();
    expect(fetch).toHaveBeenCalledTimes(1);
    answer = NO_GRANTS;
    await access.load({ fresh: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(access.any).toBe(false);
  });

  it('hides the entry when the grants cannot be loaded, and says the load failed', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({ 'GET /admin/grants': status(503) });
    const access = useAdminAccess();
    await expect(access.load()).resolves.toBeNull();
    expect([access.any, access.failed, access.grants]).toEqual([false, true, null]);
    expect(logged).toHaveBeenCalledTimes(1);
  });

  it('keeps the grants it had when a later load fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let fail = false;
    mockApi({ 'GET /admin/grants': () => (fail ? new Response(null, { status: 503 }) : Response.json(PROGRAM_ADMIN)) });
    const access = useAdminAccess();
    await access.load();
    fail = true;
    await access.load({ fresh: true });
    expect([access.any, access.failed]).toEqual([true, true]);
    fail = false;
    await access.load({ fresh: true });
    expect(access.failed).toBe(false);
  });

  it('never rejects, even on a call the API does not serve', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({});
    await expect(useAdminAccess().load()).resolves.toBeNull();
  });

  it('signs out on a 401 without reporting an error', async () => {
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockApi({ 'GET /admin/grants': status(401) });
    await useAdminAccess().load();
    expect(useAuth().signedIn).toBe(false);
    expect(logged).not.toHaveBeenCalled();
  });

  it('asks nothing when nobody is signed in', async () => {
    const fetch = mockApi({});
    useAuth().clear();
    await expect(useAdminAccess().load()).resolves.toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('forgets the grants at sign-out: the same account signing in again asks the API again', async () => {
    let answer = EVERY_GRANT;
    const fetch = mockApi({ 'GET /admin/grants': () => Response.json(answer) });
    const access = useAdminAccess();
    await access.load();
    expect(access.any).toBe(true);
    useAuth().clear();
    await nextTick();
    expect(access.cache).toBeNull();
    // Signed out, the grants were revoked. The same account signs in again in this tab.
    answer = NO_GRANTS;
    signIn();
    expect(access.any).toBe(false);
    await access.load();
    expect(fetch).toHaveBeenCalledTimes(2);
    expect([access.any, access.grants]).toEqual([false, NO_GRANTS]);
  });

  it('drops an answer that arrives after the sign-out it was asked before', async () => {
    let answer!: (response: Response) => void;
    mockApi({ 'GET /admin/grants': () => new Promise<Response>((resolve) => (answer = resolve)) });
    const access = useAdminAccess();
    const loading = access.load();
    useAuth().clear();
    await nextTick();
    signIn();
    answer(Response.json(EVERY_GRANT));
    await loading;
    expect([access.any, access.cache]).toEqual([false, null]);
  });

  it('keeps a refused save to show until it is read, and forgets it at sign-out', async () => {
    const access = useAdminAccess();
    access.refusal = { permission: 'program_admin' };
    expect(access.refusal).toEqual({ permission: 'program_admin' });
    useAuth().clear();
    await nextTick();
    expect(access.refusal).toBeNull();
  });

  it('never shows one account the grants of another', async () => {
    const other = '00000000-0000-4000-8000-000000000009';
    let answer = EVERY_GRANT;
    mockApi({ 'GET /admin/grants': () => Response.json(answer) });
    const access = useAdminAccess();
    await access.load();
    expect(access.any).toBe(true);
    // Another account signs in in the same tab: nothing of the first one shows, before or after its own answer.
    signIn({ id: other });
    expect([access.any, access.grants]).toEqual([false, null]);
    answer = grants({ userId: other });
    await access.load();
    expect([access.any, access.grants?.userId]).toEqual([false, other]);
  });
});
