import { request } from '../api.js';
import type { AuthResultDto, SessionDto, SignInDto, SignUpDto, UserDto } from '../api-schema/types.gen.js';

// The auth and user DTOs of the API (ADR 0002), generated from the contract (ADR 0018).

export type User = UserDto;
export type AuthResult = AuthResultDto;
export type SignInBody = SignInDto;
export type Session = SessionDto;

/**
 * Narrower than SignUpDto on purpose: the contract types `acceptedTerms` as a boolean, but it is consent to processing
 * the student's data (Luật 91/2025/QH15) and the API refuses anything but true, so the client cannot send false.
 */
export type SignUpBody = Omit<SignUpDto, 'acceptedTerms'> & { acceptedTerms: true };

// The password rules of SignUpDto.
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 100;

/** A loose shape check, like the API's: something@something.something with no spaces. */
export const looksLikeEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export const signUp = (body: SignUpBody) => request<AuthResult>('POST', '/auth/sign-up', { body });
export const signIn = (body: SignInBody) => request<AuthResult>('POST', '/auth/sign-in', { body });
/** A new token for the session; the one sent stops working at once (ADR 0002). */
export const refresh = (token: string) => request<AuthResult>('POST', '/auth/refresh', { token });
export const signOut = (token: string) => request<void>('POST', '/auth/sign-out', { token });
export const listSessions = (token: string) => request<Session[]>('GET', '/auth/sessions', { token });
export const revokeSession = (token: string, id: string) => request<void>('DELETE', `/auth/sessions/${encodeURIComponent(id)}`, { token });
