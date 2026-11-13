import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AuthenticatedRequest, Public } from './auth.decorators.js';
import { AuthGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';

class Routes {
  @Public()
  open(): void {}

  closed(): void {}
}

@Public()
class PublicRoutes {
  any(): void {}
}

function contextFor(request: AuthenticatedRequest, controller: new () => object = Routes, handler = Routes.prototype.closed): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => controller,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function guard(found: unknown = null): AuthGuard {
  const auth = { authenticate: vi.fn(async () => found) } as unknown as AuthService;
  return new AuthGuard(new Reflector(), auth);
}

describe('AuthGuard', () => {
  it('lets a route marked @Public() through without a token', async () => {
    await expect(guard().canActivate(contextFor({ headers: {} }, Routes, Routes.prototype.open))).resolves.toBe(true);
  });

  it('lets every route of a controller marked @Public() through without a token', async () => {
    await expect(guard().canActivate(contextFor({ headers: {} }, PublicRoutes, PublicRoutes.prototype.any))).resolves.toBe(true);
  });

  it('does not let @Public() on one route open its neighbour', async () => {
    await expect(guard().canActivate(contextFor({ headers: {} }, Routes, Routes.prototype.closed))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it.each([
    ['no header', undefined],
    ['a non-bearer scheme', 'Basic abc'],
    ['an empty bearer', 'Bearer '],
  ])('rejects %s', async (_, authorization) => {
    await expect(guard().canActivate(contextFor({ headers: { authorization } }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a token the service does not recognise', async () => {
    await expect(guard(null).canActivate(contextFor({ headers: { authorization: 'Bearer stale' } }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('attaches the user and session for a valid token', async () => {
    const found = { user: { id: 'u1' }, session: { id: 's1' } };
    const request: AuthenticatedRequest = { headers: { authorization: 'Bearer good' } };
    await expect(guard(found).canActivate(contextFor(request))).resolves.toBe(true);
    expect(request.user).toBe(found.user);
    expect(request.session).toBe(found.session);
  });
});
