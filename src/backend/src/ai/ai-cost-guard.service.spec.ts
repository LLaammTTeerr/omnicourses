import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCostGuard } from './ai-cost-guard.service.js';
import { AiUnavailableError } from './ai-unavailable.error.js';

describe('AiCostGuard', () => {
  let usage: { count: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn> };
  let guard: AiCostGuard;

  beforeEach(() => {
    usage = { count: vi.fn(async () => 0), insert: vi.fn(async () => undefined) };
    guard = new AiCostGuard(usage as never);
  });

  afterEach(() => vi.unstubAllEnvs());

  it('counts only this user\'s calls that reached the model in the last 24 hours', async () => {
    usage.count.mockResolvedValue(19);
    await expect(guard.assertWithinCap('u1')).resolves.toBeUndefined();
    const [succeeded, billed] = usage.count.mock.calls[0][0].where;
    expect(succeeded).toMatchObject({ userId: 'u1', succeeded: true });
    expect(billed).toMatchObject({ userId: 'u1', inputTokens: expect.objectContaining({ value: 0 }) });
    const since = succeeded.createdAt.value as Date;
    expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(86_400_000 - 1000);
    expect(Date.now() - since.getTime()).toBeLessThan(86_400_000 + 1000);
  });

  it('refuses at the cap, which AI_DAILY_CALLS_PER_USER sets', async () => {
    vi.stubEnv('AI_DAILY_CALLS_PER_USER', '3');
    usage.count.mockResolvedValue(3);
    await expect(guard.assertWithinCap('u1')).rejects.toThrow(new AiUnavailableError('Daily AI limit reached, try again tomorrow'));
  });
});
