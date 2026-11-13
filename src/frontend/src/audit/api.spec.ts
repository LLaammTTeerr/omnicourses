import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL, HttpError } from '../api.js';
import { contractEnum } from '../testing/contract.js';
import { mockApi, status } from '../testing/fetch.js';
import { AUDIT_UNAVAILABLE_CODES, fetchAudit } from './api.js';
import { degreeAudit } from './testing/fixtures.js';

describe('the audit codes the client tells apart', () => {
  it('has every code of AuditUnavailableDto.code', () => {
    expect([...AUDIT_UNAVAILABLE_CODES].sort()).toEqual(contractEnum('AuditUnavailableDto', 'code'));
  });
});

describe('fetchAudit', () => {
  afterEach(() => vi.restoreAllMocks());

  it('reads the signed-in student’s audit with their token', async () => {
    const audit = degreeAudit();
    const fetch = mockApi({ 'GET /users/me/audit': audit });
    await expect(fetchAudit('zz-token')).resolves.toEqual({ status: 'ready', audit });
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/users/me/audit`, expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer zz-token' } }));
  });

  it.each(AUDIT_UNAVAILABLE_CODES)('answers a 409 %s as a state of the account, not a failure', async (code) => {
    mockApi({ 'GET /users/me/audit': status(409, { statusCode: 409, code, message: 'Synthetic reason' }) });
    await expect(fetchAudit('zz-token')).resolves.toEqual({ status: code });
  });

  it('fails on a 409 it does not know, and on any other error', async () => {
    mockApi({ 'GET /users/me/audit': status(409, { statusCode: 409, code: 'something_else', message: 'x' }) });
    await expect(fetchAudit('zz-token')).rejects.toBeInstanceOf(HttpError);
    vi.restoreAllMocks();
    mockApi({ 'GET /users/me/audit': status(401) });
    await expect(fetchAudit('zz-token')).rejects.toMatchObject({ status: 401 });
    vi.restoreAllMocks();
    mockApi({ 'GET /users/me/audit': status(500) });
    await expect(fetchAudit('zz-token')).rejects.toMatchObject({ status: 500 });
  });
});
