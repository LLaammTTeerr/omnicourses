import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { ACCEPTS_PREVIOUS_TOKEN, AuthenticatedRequest, IS_PUBLIC } from './auth.decorators.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

function contextFor(request: AuthenticatedRequest): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guard(isPublic: boolean, found: unknown = null, acceptsPrevious = false): AuthGuard {
  const metadata: Record<string, boolean> = { [IS_PUBLIC]: isPublic, [ACCEPTS_PREVIOUS_TOKEN]: acceptsPrevious };
  const reflector = { getAllAndOverride: vi.fn((key: string) => metadata[key]) } as unknown as Reflector;
  authenticate = vi.fn(async () => found);
  const auth = Object.assign(Object.create(AuthService.prototype), { authenticate }) as AuthService;
  return new AuthGuard(reflector, auth);
}

let authenticate: ReturnType<typeof vi.fn>;

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
    expect(authenticate).toHaveBeenCalledWith('good', false);
  });

  it('accepts the previous token only on a route marked with @AcceptsPreviousToken()', async () => {
    const found = { user: { id: 'u1' }, session: { id: 's1' } };
    await guard(false, found, true).canActivate(contextFor({ headers: { authorization: 'Bearer previous' } }));
    expect(authenticate).toHaveBeenCalledWith('previous', true);
  });
});
