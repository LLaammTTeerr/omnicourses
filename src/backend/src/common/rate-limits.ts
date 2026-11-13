import { applyDecorators } from '@nestjs/common';
import { ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

// ADR 0002: 120 requests a minute from one address on every route, 10 on a
// route that takes a password. @Throttle overrides a limit by throttler name.
const THROTTLER = 'default';
const MINUTE_MS = 60_000;

export const THROTTLERS = [{ name: THROTTLER, ttl: MINUTE_MS, limit: 120 }];

/** Brute-force limit for endpoints that take a password. */
const PASSWORD_LIMIT = { [THROTTLER]: { ttl: MINUTE_MS, limit: 10 } };

/** Applies PASSWORD_LIMIT to a route and documents its 429. */
export const PasswordRateLimit = () =>
  applyDecorators(Throttle(PASSWORD_LIMIT), ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' }));
