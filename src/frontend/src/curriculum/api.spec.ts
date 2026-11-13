import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import { fetchCourse, fetchCurriculum } from './api.js';

describe('curriculum addresses', () => {
  afterEach(() => vi.restoreAllMocks());

  it('escapes what goes into the path and sends the token', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    await fetchCurriculum('zz-token', 'A/B', 2024);
    await fetchCourse('zz-token', 'ZZ 101');
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([`${API_URL}/programs/A%2FB/curricula/2024`, `${API_URL}/courses/ZZ%20101`]);
    expect(fetch.mock.calls[0]![1]).toMatchObject({ method: 'GET', headers: { Authorization: 'Bearer zz-token' } });
  });
});
