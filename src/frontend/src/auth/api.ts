import { request } from '../api.js';

// The auth and user DTOs of the API, written by hand; api.spec.ts checks them against src/backend/openapi.json.

export interface User {
  id: string;
  email: string;
  displayName: string;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface AuthResult {
  /** Opaque bearer token (ADR 0002). */
  token: string;
  expiresAt: string;
  user: User;
  /** True when this sign-in cancelled a pending account deletion (ADR 0004). */
  accountRestored: boolean;
}

export interface SignUpBody {
  email: string;
  password: string;
  displayName: string;
  /** Consent to processing the student's data (Luật 91/2025/QH15); the API refuses anything but true. */
  acceptedTerms: true;
}

export interface SignInBody {
  email: string;
  password: string;
}

export interface Session {
  id: string;
  userAgent: string | null;
  createdAt: string;
  expiresAt: string;
  /** True for the session making the request. */
  current: boolean;
}

// The password rules of SignUpDto.
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 100;

export const signUp = (body: SignUpBody) => request<AuthResult>('POST', '/auth/sign-up', { body });
export const signIn = (body: SignInBody) => request<AuthResult>('POST', '/auth/sign-in', { body });
/** A new token for the session; the one sent stops working at once (ADR 0002). */
export const refresh = (token: string) => request<AuthResult>('POST', '/auth/refresh', { token });
export const signOut = (token: string) => request<void>('POST', '/auth/sign-out', { token });
export const listSessions = (token: string) => request<Session[]>('GET', '/auth/sessions', { token });
export const revokeSession = (token: string, id: string) => request<void>('DELETE', `/auth/sessions/${encodeURIComponent(id)}`, { token });
