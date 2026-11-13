import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import type { SignUpDto } from '../api-schema/types.gen.js';
import contract from '../../../backend/openapi.json';
import { DISPLAY_NAME_MAX_LENGTH, looksLikeEmail, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, revokeSession, type SignUpBody } from './api.js';

describe('auth types against the contract', () => {
  it('sends only a sign-up the contract allows, with the terms accepted', () => {
    expectTypeOf<SignUpBody>().toExtend<SignUpDto>();
    expectTypeOf<SignUpBody['acceptedTerms']>().toEqualTypeOf<true>();
  });

  it('checks the password length the API checks', () => {
    const password = contract.components.schemas.SignUpDto.properties.password;
    expect([password.minLength, password.maxLength]).toEqual([PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH]);
  });

  it('checks the display name length the API checks', () => {
    expect(contract.components.schemas.SignUpDto.properties.displayName.maxLength).toBe(DISPLAY_NAME_MAX_LENGTH);
  });
});

describe('looksLikeEmail', () => {
  it('accepts something@something.something with no spaces, around trimmed', () => {
    expect(looksLikeEmail(' zz@example.com ')).toBe(true);
    for (const email of ['', 'zz', 'zz@example', '@example.com', 'z z@example.com', 'zz@@example.com']) expect(looksLikeEmail(email)).toBe(false);
  });
});

describe('revokeSession', () => {
  afterEach(() => vi.restoreAllMocks());

  it('names the session in the address, escaped, and sends the token', async () => {
    const fetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));
    await revokeSession('zz-token', 'a/b');
    expect(fetch).toHaveBeenCalledWith(`${API_URL}/auth/sessions/a%2Fb`, expect.objectContaining({ method: 'DELETE', headers: { Authorization: 'Bearer zz-token' } }));
  });
});
