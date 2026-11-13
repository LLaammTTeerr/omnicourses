import { describe, expect, it } from 'vitest';
import { AccountController } from '../account/account.controller.js';
import { AuthController } from '../auth/auth.controller.js';
import { PasswordRateLimit, THROTTLERS } from './rate-limits.js';

const limitOf = (route: object) => ({
  limit: Reflect.getMetadata('THROTTLER:LIMITdefault', route) as unknown,
  ttl: Reflect.getMetadata('THROTTLER:TTLdefault', route) as unknown,
});

describe('rate limits (ADR 0002)', () => {
  it('allow 120 requests a minute on every route', () => {
    expect(THROTTLERS).toEqual([{ name: 'default', ttl: 60_000, limit: 120 }]);
  });

  it('PasswordRateLimit allows 10 a minute and documents the 429', () => {
    class Probe {
      @PasswordRateLimit()
      route(): void {}
    }
    const route = Probe.prototype.route;
    expect(limitOf(route)).toEqual({ limit: 10, ttl: 60_000 });
    expect(Reflect.getMetadata('swagger/apiResponse', route)).toMatchObject({ 429: { description: 'Rate limit exceeded' } });
  });

  it.each([
    ['sign-up', AuthController.prototype.signUp],
    ['sign-in', AuthController.prototype.signIn],
    ['account deletion', AccountController.prototype.delete],
  ])('apply the password limit to %s', (_, route) => {
    expect(limitOf(route)).toEqual({ limit: 10, ttl: 60_000 });
  });
});
