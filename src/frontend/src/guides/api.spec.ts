import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import { fetchGuide } from './api.js';

describe('fetchGuide', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks for the id escaped and gives the guide', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ id: 'a b' }));
    await expect(fetchGuide('a b')).resolves.toEqual({ id: 'a b' });
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/guides/a%20b`);
  });

  it('gives null when no published guide has the id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 404 }));
    await expect(fetchGuide('zz-missing')).resolves.toBeNull();
  });

  it('fails on any other error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    await expect(fetchGuide('zz-fresh')).rejects.toThrow('GET /guides/zz-fresh failed: 500');
  });
});
