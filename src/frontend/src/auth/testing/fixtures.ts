import type { AuthResult, Session, User } from '../api.js';

// Synthetic accounts for tests: no real names, emails or student IDs.

export function user(overrides: Partial<User> = {}): User {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    email: 'zz-student@example.com',
    displayName: 'Sinh viên thử',
    emailVerifiedAt: null,
    createdAt: '2026-10-01T08:00:00.000Z',
    ...overrides,
  };
}

export function authResult(overrides: Partial<AuthResult> = {}): AuthResult {
  return { token: 'zz-token', expiresAt: '2026-11-16T08:00:00.000Z', user: user(), accountRestored: false, ...overrides };
}

export function session(overrides: Partial<Session> = {}): Session {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36',
    createdAt: '2026-11-01T08:00:00.000Z',
    expiresAt: '2026-11-08T08:00:00.000Z',
    current: false,
    ...overrides,
  };
}
