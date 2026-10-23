import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticatedRequest } from './auth.decorators.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guard(isPublic: boolean, found: unknown = null): AuthGuard {
  const reflector = { getAllAndOverride: vi.fn(() => isPublic) } as unknown as Reflector;
  const auth = { authenticate: vi.fn(async () => found) } as unknown as AuthService;
  return new AuthGuard(reflector, auth);
}

describe('AuthGuard', () => {
  it('lets @Public() routes through without a token', async () => {
    await expect(guard(true).canActivate(contextFor({ headers: {} }))).resolves.toBe(true);
  });

  it.each([
    ['no header', undefined],
    ['a non-bearer scheme', 'Basic abc'],
    ['an empty bearer', 'Bearer '],
  ])('rejects %s', async (_, authorization) => {
    await expect(guard(false).canActivate(contextFor({ headers: { authorization } }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects a token the service does not recognise', async () => {
    await expect(
      guard(false, null).canActivate(contextFor({ headers: { authorization: 'Bearer stale' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('attaches the user and session for a valid token', async () => {
    const found = { user: { id: 'u1' }, session: { id: 's1' } };
    const request: AuthenticatedRequest = { headers: { authorization: 'Bearer good' } };
    await expect(guard(false, found).canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toBe(found.user);
    expect(request.session).toBe(found.session);
  });
});
