import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiConfig } from './ai-config.js';

describe('aiConfig', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('reads positive whole numbers from the environment', () => {
    vi.stubEnv('AI_TIMEOUT_MS', '5000');
    vi.stubEnv('AI_DAILY_CALLS_PER_USER', '3');
    expect(aiConfig()).toMatchObject({ timeoutMs: 5000, dailyCallsPerUser: 3 });
  });

  it.each(['', ' ', 'abc', '0', '-1', '1.5'])('falls back to the defaults when a number is %j', (value) => {
    vi.stubEnv('AI_TIMEOUT_MS', value);
    vi.stubEnv('AI_DAILY_CALLS_PER_USER', value);
    expect(aiConfig()).toMatchObject({ timeoutMs: 30_000, dailyCallsPerUser: 20 });
  });
});
