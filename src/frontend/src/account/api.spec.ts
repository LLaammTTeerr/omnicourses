import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import { exportAccount } from './api.js';

describe('exportAccount', () => {
  afterEach(() => vi.restoreAllMocks());

  it('downloads the export with the token, as a file', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ exportedAt: '2026-11-09T00:00:00.000Z' }));
    const blob = await exportAccount('zz-token');
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/users/me/export`, expect.objectContaining({ method: 'GET', headers: { Authorization: 'Bearer zz-token' } }));
    expect(JSON.parse(await blob.text())).toEqual({ exportedAt: '2026-11-09T00:00:00.000Z' });
  });
});
