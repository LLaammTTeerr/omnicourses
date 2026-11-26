import { describe, expect, it } from 'vitest';
import contract from '../../../backend/openapi.json';
import { contractShape, type Shape } from '../testing/contract.js';
import { DISPLAY_NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, type AuthResult, type Session, type SignInBody, type SignUpBody, type User } from './api.js';

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

  it('checks the display name length the API checks', () => {
    expect(contract.components.schemas.SignUpDto.properties.displayName.maxLength).toBe(DISPLAY_NAME_MAX_LENGTH);
  });
});
