import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL, codePoints, failureKind, fetchHealth, HttpError, request, REQUEST_TIMEOUT_MS, send, statusOf, type Health } from './api.js';
import { contractEnum, contractNullable, contractShape, type Shape } from './testing/contract.js';
import { hang, restoreMocksAfterCheckingCalls } from './testing/fetch.js';

describe('Health against the contract', () => {
  afterEach(() => restoreMocksAfterCheckingCalls());

  it('has the fields of HealthDto', () => {
    expect(contractShape('HealthDto')).toEqual({ status: 'required', database: 'required' } satisfies Shape<Health>);
  });

  it('has no nullable field in HealthDto', () => {
    expect(contractNullable('HealthDto')).toEqual([]);
  });

  it('has the values of HealthDto', () => {
    const status: Record<Health['status'], true> = { ok: true, degraded: true };
    const database: Record<Health['database'], true> = { up: true, down: true };
    expect(Object.keys(status).sort()).toEqual(contractEnum('HealthDto', 'status'));
    expect(Object.keys(database).sort()).toEqual(contractEnum('HealthDto', 'database'));
  });

  it('returns the degraded payload on HTTP 503 database-down responses while still failing on proxy 502/503 HTML', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ status: 'degraded', database: 'down' }, { status: 503 }));
    await expect(fetchHealth()).resolves.toEqual({ status: 'degraded', database: 'down' });

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('<html>503</html>', { status: 503 }));
    await expect(fetchHealth()).rejects.toBeInstanceOf(HttpError);
  });
});

describe('request', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the body as JSON and the token as a bearer header', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ ok: true }));
    await expect(request('PUT', '/things', { body: { a: 1 }, token: 'zz-token' })).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/things`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer zz-token' },
      body: '{"a":1}',
      signal: expect.any(AbortSignal),
    });
  });

  it('sends neither header nor body when there is none', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await expect(request('POST', '/things')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/things`, { method: 'POST', headers: {}, body: undefined, signal: expect.any(AbortSignal) });
  });

  it('fails with the status and the messages of the error body', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ message: ['email must be an email'], statusCode: 400 }, { status: 400 }));
    const error = await request('POST', '/things').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 400, message: 'POST /things failed: 400', details: ['email must be an email'] });
    expect(statusOf(error)).toBe(400);
  });

  it('keeps a single message, and copes with a body that is not JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ message: 'Conflict' }, { status: 409 }));
    await expect(request('POST', '/things')).rejects.toMatchObject({ details: ['Conflict'] });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('<html>', { status: 502 }));
    await expect(request('POST', '/things')).rejects.toMatchObject({ status: 502, details: [] });
  });

  it('keeps the code of the error body, such as the reason for a 409', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ statusCode: 409, code: 'onboarding_required', message: 'Finish onboarding' }, { status: 409 }));
    await expect(request('GET', '/things')).rejects.toMatchObject({ status: 409, code: 'onboarding_required', details: ['Finish onboarding'] });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json({ message: 'Conflict', code: 7 }, { status: 409 }));
    await expect(request('GET', '/things')).rejects.toMatchObject({ code: null });
  });

  it('keeps the whole error body, for the fields an error adds beside its code', async () => {
    const answer = { statusCode: 403, code: 'permission_required', permission: 'catalog_maintainer', message: 'This needs the catalog_maintainer permission' };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json(answer, { status: 403 }));
    await expect(request('PATCH', '/things')).rejects.toMatchObject({ status: 403, code: 'permission_required', body: answer });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json(['not', 'an', 'object'], { status: 400 }));
    await expect(request('PATCH', '/things')).rejects.toMatchObject({ status: 400, body: null });
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('<html>', { status: 502 }));
    await expect(request('PATCH', '/things')).rejects.toMatchObject({ status: 502, body: null });
  });

  it('fails a call that gets no answer in time, with no status', async () => {
    hang();
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const error = await request('DELETE', '/things', { timeout: 10 }).catch((e: unknown) => e);
    expect(error).toMatchObject({ name: 'TimeoutError' });
    expect(statusOf(error)).toBeNull();
    expect(timeout).toHaveBeenCalledWith(10);
  });

  it('gives every JSON call a timeout by default, and a download none', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({}));
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    await request('GET', '/things');
    expect(timeout).toHaveBeenCalledExactlyOnceWith(REQUEST_TIMEOUT_MS);
    await send('GET', '/things/export');
    await request('GET', '/things', { timeout: null });
    expect(timeout).toHaveBeenCalledTimes(1);
    expect(vi.mocked(fetch).mock.calls[1]![1]).not.toHaveProperty('signal');
  });

  it('also stops when the caller aborts', async () => {
    hang();
    const caller = new AbortController();
    const pending = request('GET', '/things', { signal: caller.signal }).catch((e: unknown) => e);
    caller.abort(new DOMException('Left the page', 'AbortError'));
    expect(await pending).toMatchObject({ name: 'AbortError' });
  });

  it('has no status when the request got no answer', () => {
    expect(statusOf(new TypeError('Failed to fetch'))).toBeNull();
  });
});

describe('request for a public read', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends no token (ADR 0010) and fails a read that gets no answer in time, like any JSON call', async () => {
    hang();
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const timer = new AbortController();
    timeout.mockReturnValue(timer.signal);
    const pending = request('GET', '/guides').catch((e: unknown) => e);
    expect(timeout).toHaveBeenCalledExactlyOnceWith(REQUEST_TIMEOUT_MS);
    expect(vi.mocked(fetch).mock.calls[0]![1]).toMatchObject({ method: 'GET', headers: {} });
    timer.abort(new DOMException('The operation timed out.', 'TimeoutError'));
    expect(await pending).toMatchObject({ name: 'TimeoutError' });
  });
});

describe('failureKind', () => {
  it.each([
    [400, 'invalid'],
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [429, 'rate_limited'],
    [500, 'server_error'],
    [502, 'server_error'],
    [418, 'other'],
  ] as const)('reads a %s answer as %s', (status, kind) => {
    expect(failureKind(new HttpError('/x', status))).toBe(kind);
  });

  it('tells a timeout and a caller abort from a request that never reached the API', () => {
    expect(failureKind(new DOMException('The operation timed out.', 'TimeoutError'))).toBe('timed_out');
    expect(failureKind(new DOMException('Left the page', 'AbortError'))).toBe('aborted');
    expect(failureKind(new TypeError('Failed to fetch'))).toBe('unreachable');
  });
});

describe('codePoints', () => {
  it('counts characters as the API counts a text length (#179), not UTF-16 units', () => {
    expect(codePoints('')).toBe(0);
    expect(codePoints('Học máy')).toBe(7);
    expect(codePoints('😀😀')).toBe(2);
    expect(codePoints('✌️')).toBe(2);
  });
});
