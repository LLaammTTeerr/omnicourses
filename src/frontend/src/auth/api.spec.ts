import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL } from '../api.js';
import contract from '../../../backend/openapi.json';
import { contractShape, type Shape } from '../testing/contract.js';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, revokeSession, type AuthResult, type Session, type SignInBody, type SignUpBody, type User } from './api.js';

describe('auth types against the contract', () => {
  it.each([
    ['UserDto', { id: 'required', email: 'required', displayName: 'required', emailVerifiedAt: 'required', createdAt: 'required' } satisfies Shape<User>],
    ['AuthResultDto', { token: 'required', expiresAt: 'required', user: 'required', accountRestored: 'required' } satisfies Shape<AuthResult>],
    ['SignUpDto', { email: 'required', password: 'required', displayName: 'required', acceptedTerms: 'required' } satisfies Shape<SignUpBody>],
    ['SignInDto', { email: 'required', password: 'required' } satisfies Shape<SignInBody>],
    ['SessionDto', { id: 'required', userAgent: 'required', createdAt: 'required', expiresAt: 'required', current: 'required' } satisfies Shape<Session>],
  ])('has the fields of %s', (schema, shape) => {
    expect(contractShape(schema)).toEqual(shape);
  });

  it('checks the password length the API checks', () => {
    const password = contract.components.schemas.SignUpDto.properties.password;
    expect([password.minLength, password.maxLength]).toEqual([PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH]);
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
