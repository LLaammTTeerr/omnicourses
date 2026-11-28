import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import contract from '../../../backend/openapi.json';
import { user } from '../auth/testing/fixtures.js';
import { contractNullable, contractShape, nullableKeys, type Shape } from '../testing/contract.js';
import { signedInPinia } from '../testing/signed-in.js';
import { CLASS_NAME_MAX_LENGTH, exportAccount, revokeSession, saveFile, STUDENT_ID_PATTERN, updateProfile, type AccountExport, type DeleteAccountBody, type DeletionScheduled, type ProfileBody } from './api.js';
import { restoreMocksAfterCheckingCalls } from '../testing/fetch.js';

const NULLABLE: Record<string, string[]> = {
  UpdateProfileDto: nullableKeys<ProfileBody>({ className: true, studentId: true }),
};

describe('account types against the contract', () => {
  it.each([
    ['AccountExportDto', { exportedAt: 'required', user: 'required', tables: 'required' } satisfies Shape<AccountExport>],
    ['DeleteAccountDto', { password: 'required' } satisfies Shape<DeleteAccountBody>],
    ['DeletionScheduledDto', { purgeAfter: 'required' } satisfies Shape<DeletionScheduled>],
    ['UpdateProfileDto', { studentId: 'optional', className: 'optional' } satisfies Shape<ProfileBody>],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
    expect(contractNullable(schema)).toEqual(NULLABLE[schema] ?? []);
  });

  it('checks the student ID and the class name as the API does', () => {
    const { studentId, className } = contract.components.schemas.UpdateProfileDto.properties;
    expect(studentId.pattern).toBe(STUDENT_ID_PATTERN.source);
    expect(className.maxLength).toBe(CLASS_NAME_MAX_LENGTH);
  });
});

describe('exportAccount', () => {
  beforeEach(() => signedInPinia());
  afterEach(() => restoreMocksAfterCheckingCalls());

  it('downloads the export with the token, as a file', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ exportedAt: '2026-11-09T00:00:00.000Z' }));
    const blob = await exportAccount();
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/users/me/export`, expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer zz-token' } }));
    expect(JSON.parse(await blob.text())).toEqual({ exportedAt: '2026-11-09T00:00:00.000Z' });
  });
});

describe('updateProfile', () => {
  beforeEach(() => signedInPinia());
  afterEach(() => restoreMocksAfterCheckingCalls());

  it('patches the account with the token and returns the account', async () => {
    const saved = user({ studentId: '24120000', className: '24CTT0' });
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(saved));
    await expect(updateProfile({ studentId: '24120000', className: '24CTT0' })).resolves.toEqual(saved);
    expect(fetch).toHaveBeenCalledWith(
      `${API_URL}/users/me`,
      expect.objectContaining({ method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer zz-token' }, body: '{"studentId":"24120000","className":"24CTT0"}' }),
    );
  });
});

describe('revokeSession', () => {
  beforeEach(() => signedInPinia());
  afterEach(() => restoreMocksAfterCheckingCalls());

  it('names the session in the address, escaped, and sends the token', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await revokeSession('a/b');
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/auth/sessions/a%2Fb`, expect.objectContaining({ method: 'DELETE', headers: { Authorization: 'Bearer zz-token' } }));
  });
});

describe('saveFile', () => {
  afterEach(() => {
    vi.useRealTimers();
    restoreMocksAfterCheckingCalls();
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
