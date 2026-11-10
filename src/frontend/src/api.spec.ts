import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL, HttpError, request, statusOf, type Health } from './api.js';
import { contractEnum, contractShape, type Shape } from './testing/contract.js';

describe('Health against the contract', () => {
  it('has the fields of HealthDto', () => {
    expect(contractShape('HealthDto')).toEqual({ status: 'required', database: 'required' } satisfies Shape<Health>);
  });

  it('has the values of HealthDto', () => {
    const status: Record<Health['status'], true> = { ok: true, degraded: true };
    const database: Record<Health['database'], true> = { up: true, down: true };
    expect(Object.keys(status).sort()).toEqual(contractEnum('HealthDto', 'status'));
    expect(Object.keys(database).sort()).toEqual(contractEnum('HealthDto', 'database'));
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
    });
  });

  it('sends neither header nor body when there is none', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await expect(request('POST', '/things')).resolves.toBeUndefined();
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/things`, { method: 'POST', headers: {}, body: undefined });
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

  it('has no status when the request got no answer', () => {
    expect(statusOf(new TypeError('Failed to fetch'))).toBeNull();
  });
});
