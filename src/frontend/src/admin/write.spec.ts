import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../api.js';
import { useAuth } from '../auth/store.js';
import { user } from '../auth/testing/fixtures.js';
import { mockApi } from '../testing/fetch.js';
import { useAdminAccess } from './store.js';
import { PROGRAM_ADMIN } from './testing/fixtures.js';
import { settleWrite, useWrites } from './write.js';

const refusal = (status: number, code: string, extra: Record<string, unknown> = {}) => new HttpError('/admin/x', status, 'PUT', ['x'], code, { statusCode: status, code, message: 'x', ...extra });

describe('settleWrite (UC-11 A7)', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}));
  afterEach(() => vi.restoreAllMocks());

  it('reports saved when the API answers, without reloading', async () => {
    const landed = vi.fn(async () => true);
    expect(await settleWrite(async () => 'value', landed)).toEqual({ outcome: 'saved', value: 'value' });
    expect(landed).not.toHaveBeenCalled();
  });

  it('reports a refusal as the API gave it, without reloading', async () => {
    const landed = vi.fn(async () => true);
    const result = await settleWrite(() => Promise.reject(refusal(409, 'duplicate_name')), landed);
    expect(result).toEqual({ outcome: 'refused', failure: { kind: 'conflict', code: 'duplicate_name', references: [] } });
    expect(landed).not.toHaveBeenCalled();
  });

  it.each([
    ['a network error', new TypeError('Failed to fetch')],
    ['a timeout', new DOMException('The operation timed out.', 'TimeoutError')],
    ['a server error', new HttpError('/admin/x', 503, 'PUT')],
  ])('reloads the saved data after %s, and only then says whether the change is saved', async (_name, lost) => {
    const order: string[] = [];
    const write = vi.fn(async () => {
      order.push('write');
      throw lost;
    });
    const result = await settleWrite(write, async () => {
      order.push('reload');
      return true;
    });
    expect(result).toEqual({ outcome: 'confirmed' });
    expect(await settleWrite(write, async () => false)).toEqual({ outcome: 'not_applied' });
    expect(order).toEqual(['write', 'reload', 'write']);
  });

  it('never repeats the write itself', async () => {
    const write = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    await settleWrite(write, async () => false);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('says the outcome is unknown when the saved data cannot be reloaded either, never saved', async () => {
    const result = await settleWrite(
      () => Promise.reject(new TypeError('Failed to fetch')),
      () => Promise.reject(new TypeError('Failed to fetch')),
    );
    expect(result).toEqual({ outcome: 'unknown' });
  });

  it('reports a session that ended during the reload as signed out', async () => {
    const result = await settleWrite(
      () => Promise.reject(new TypeError('Failed to fetch')),
      () => Promise.reject(new HttpError('/admin/x', 401)),
    );
    expect(result).toEqual({ outcome: 'refused', failure: { kind: 'signed_out' } });
  });
});

describe('useWrites', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    const auth = useAuth();
    auth.token = 'zz-token';
    auth.user = user();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('is busy while the write is out, sends the token, and has no problem once saved', async () => {
    const writes = useWrites();
    let answer!: (value: string) => void;
    const sent = writes.send(
      (token) => new Promise<string>((resolve) => (answer = (value) => resolve(`${value} ${token}`))),
      async () => false,
    );
    expect(writes.busy.value).toBe(true);
    answer('saved with');
    expect(await sent).toEqual({ outcome: 'saved', value: 'saved with zz-token' });
    expect(writes.busy.value).toBe(false);
    expect(writes.problem.value).toBeNull();
  });

  it('keeps a refusal and an unknown outcome as the problem to show, and clears it for the next write', async () => {
    const writes = useWrites();
    await writes.send(() => Promise.reject(refusal(409, 'referenced_item', { references: ['links ZZ101'] })), async () => false);
    expect(writes.problem.value).toEqual({ outcome: 'refused', failure: { kind: 'conflict', code: 'referenced_item', references: ['links ZZ101'] } });
    await writes.send(() => Promise.reject(new TypeError('Failed to fetch')), async () => false);
    expect(writes.problem.value).toEqual({ outcome: 'not_applied' });
    await writes.send(() => Promise.reject(new TypeError('Failed to fetch')), async () => true);
    expect(writes.problem.value).toBeNull();
    await writes.send(() => Promise.reject(new TypeError('Failed to fetch')), () => Promise.reject(new TypeError('Failed to fetch')));
    expect(writes.problem.value).toEqual({ outcome: 'unknown' });
    writes.clear();
    expect(writes.problem.value).toBeNull();
  });

  it('settles an unknown outcome from the saved data when asked to reload, without sending the write again', async () => {
    const writes = useWrites();
    const write = vi.fn(() => Promise.reject(new TypeError('Failed to fetch')));
    let landed: boolean | 'offline' = 'offline';
    const check = vi.fn(async () => {
      if (landed === 'offline') throw new TypeError('Failed to fetch');
      return landed;
    });
    await writes.send(write, check);
    expect(writes.problem.value).toEqual({ outcome: 'unknown' });

    // Still offline: still unknown.
    expect(await writes.recheck()).toEqual({ outcome: 'unknown' });
    expect(writes.problem.value).toEqual({ outcome: 'unknown' });
    // Back online, and the saved data does not have the change: say so.
    landed = false;
    expect(await writes.recheck()).toEqual({ outcome: 'not_applied' });
    expect(writes.problem.value).toEqual({ outcome: 'not_applied' });
    // Nothing is unknown any more, so there is nothing to check again.
    expect(await writes.recheck()).toBeNull();
    expect(check).toHaveBeenCalledTimes(3);
    expect(write).toHaveBeenCalledTimes(1);
  });

  it('sends nothing more while the outcome of the last write is unknown', async () => {
    const writes = useWrites();
    const offline = () => Promise.reject(new TypeError('Failed to fetch'));
    await writes.send(offline, offline);
    expect(writes.problem.value).toEqual({ outcome: 'unknown' });
    const again = vi.fn(async () => 'saved');
    expect(await writes.send(again, async () => true)).toEqual({ outcome: 'unknown' });
    expect(again).not.toHaveBeenCalled();
    expect(writes.problem.value).toEqual({ outcome: 'unknown' });
    // Once the screen has dropped the problem (and says the page may be out of date), a write goes out again.
    writes.clear();
    expect(await writes.send(again, async () => true)).toEqual({ outcome: 'saved', value: 'saved' });
  });

  it('clears the problem when the reload shows the change was saved after all', async () => {
    const writes = useWrites();
    let online = false;
    await writes.send(
      () => Promise.reject(new TypeError('Failed to fetch')),
      async () => {
        if (!online) throw new TypeError('Failed to fetch');
        return true;
      },
    );
    expect(writes.problem.value).toEqual({ outcome: 'unknown' });
    online = true;
    const rechecked = writes.recheck();
    expect(writes.busy.value).toBe(true);
    expect(await rechecked).toEqual({ outcome: 'confirmed' });
    expect(writes.busy.value).toBe(false);
    expect(writes.problem.value).toBeNull();
  });

  it('has nothing to check again after a refusal or a save', async () => {
    const writes = useWrites();
    const check = vi.fn(async () => true);
    await writes.send(() => Promise.reject(refusal(409, 'duplicate_name')), check);
    expect(await writes.recheck()).toBeNull();
    await writes.send(async () => 'saved', check);
    expect(await writes.recheck()).toBeNull();
    expect(check).not.toHaveBeenCalled();
  });

  it('asks for the grants again after a 403, since one was revoked', async () => {
    const fetch = mockApi({ 'GET /admin/grants': PROGRAM_ADMIN });
    const writes = useWrites();
    await writes.send(() => Promise.reject(refusal(403, 'permission_required', { permission: 'catalog_maintainer' })), async () => false);
    await vi.waitFor(() => expect(useAdminAccess().grants).toEqual(PROGRAM_ADMIN));
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(writes.problem.value).toEqual({ outcome: 'refused', failure: { kind: 'permission', permission: 'catalog_maintainer' } });
    // The page keeps the refusal to show, whatever the grants turn out to be.
    expect(useAdminAccess().refusal).toEqual({ permission: 'catalog_maintainer' });
  });

  it('signs the user out on a 401 and shows no problem: the shell takes them to sign in', async () => {
    const writes = useWrites();
    const result = await writes.send(() => Promise.reject(new HttpError('/admin/x', 401, 'PUT')), async () => false);
    expect(result).toEqual({ outcome: 'refused', failure: { kind: 'signed_out' } });
    expect(writes.problem.value).toBeNull();
    expect(useAuth().signedIn).toBe(false);
  });
});
