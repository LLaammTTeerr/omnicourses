import { MINUTE_MS } from '../config/time.js';

const THROTTLER = 'default';

export const THROTTLERS = [{ name: THROTTLER, ttl: MINUTE_MS, limit: 120 }];

export const PASSWORD_ATTEMPTS = { ttl: MINUTE_MS, limit: 10 };

export const PASSWORD_LIMIT = { [THROTTLER]: PASSWORD_ATTEMPTS };
