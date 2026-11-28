import { request } from '../api.js';

export interface User {
  id: string;
  email: string;
  displayName: string;
  studentId: string | null;
  className: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
}

export interface AuthResult {
  token: string;
  expiresAt: string;
  user: User;
  accountRestored: boolean;
}

export interface SignUpBody {
  email: string;
  password: string;
  displayName: string;
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
  current: boolean;
}

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;
export const DISPLAY_NAME_MAX_LENGTH = 100;

export const signUp = (body: SignUpBody) => request<AuthResult>('POST', '/auth/sign-up', { body });
export const signIn = (body: SignInBody) => request<AuthResult>('POST', '/auth/sign-in', { body });
export const refresh = (token: string) => request<AuthResult>('POST', '/auth/refresh', { token });
export const signOut = (token: string) => request<void>('POST', '/auth/sign-out', { token });
