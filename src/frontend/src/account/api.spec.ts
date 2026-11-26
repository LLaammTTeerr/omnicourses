import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import { contractShape, type Shape } from '../testing/contract.js';
import { signedInPinia } from '../testing/signed-in.js';
import { exportAccount, revokeSession, saveFile, type DeleteAccountBody, type DeletionScheduled } from './api.js';

describe('account types against the contract', () => {
  it.each([
    ['DeleteAccountDto', { password: 'required' } satisfies Shape<DeleteAccountBody>],
    ['DeletionScheduledDto', { purgeAfter: 'required' } satisfies Shape<DeletionScheduled>],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
  });
});

describe('exportAccount', () => {
  beforeEach(() => signedInPinia());
  afterEach(() => vi.restoreAllMocks());

  it('downloads the export with the token, as a file', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ exportedAt: '2026-11-09T00:00:00.000Z' }));
    const blob = await exportAccount();
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/users/me/export`, expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer zz-token' } }));
    expect(JSON.parse(await blob.text())).toEqual({ exportedAt: '2026-11-09T00:00:00.000Z' });
  });
});

describe('revokeSession', () => {
  beforeEach(() => signedInPinia());
  afterEach(() => vi.restoreAllMocks());

  it('names the session in the address, escaped, and sends the token', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await revokeSession('a/b');
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/auth/sessions/a%2Fb`, expect.objectContaining({ method: 'DELETE', headers: { Authorization: 'Bearer zz-token' } }));
  });
});

describe('saveFile', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('clicks a download link to an object URL, then lets the URL go', () => {
    vi.useFakeTimers();
    const created = vi.fn(() => 'blob:zz');
    const revoked = vi.fn();
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
    const clicks: { href: string; download: string; inPage: boolean }[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push({ href: this.href, download: this.download, inPage: document.body.contains(this) });
    });

    saveFile(new Blob(['{}']), 'omnicourse-account.json');
    expect(clicks).toEqual([{ href: 'blob:zz', download: 'omnicourse-account.json', inPage: true }]);
    expect(document.querySelector('a[download]')).toBeNull();
    expect(revoked).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(revoked).toHaveBeenCalledWith('blob:zz');
  });
});
