// ADR 0002: 120 requests a minute from one address on every route, 10 on a
// route that takes a password. @Throttle overrides a limit by throttler name.
const THROTTLER = 'default';
const MINUTE_MS = 60_000;

export const THROTTLERS = [{ name: THROTTLER, ttl: MINUTE_MS, limit: 120 }];

/** Brute-force limit for endpoints that take a password: `@Throttle(PASSWORD_LIMIT)`. */
export const PASSWORD_LIMIT = { [THROTTLER]: { ttl: MINUTE_MS, limit: 10 } };
