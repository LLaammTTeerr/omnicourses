import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCostGuard } from './ai-cost-guard.service.js';
import { AiUnavailableError } from './ai-unavailable.error.js';
import { AiUsage } from './ai-usage.entity.js';

const context = { userId: 'u1', feature: 'advisor' };

describe('AiCostGuard', () => {
  let em: { query: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn> };
  let usage: { manager: { transaction: ReturnType<typeof vi.fn> }; update: ReturnType<typeof vi.fn> };
  let guard: AiCostGuard;

  beforeEach(() => {
    em = { query: vi.fn(async () => []), count: vi.fn(async () => 0), insert: vi.fn(async () => ({ identifiers: [{ id: 'row-1' }] })) };
    usage = { manager: { transaction: vi.fn(async (work: (m: typeof em) => unknown) => work(em)) }, update: vi.fn(async () => undefined) };
    guard = new AiCostGuard(usage as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe('reserve', () => {
    it('counts every row of this user in the last 24 hours, finished or not, under a per-user lock', async () => {
      em.count.mockResolvedValue(19);
      await expect(guard.reserve(context, 'chat-model')).resolves.toBe('row-1');
      expect(em.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', ['u1']);
      const [entity, { where }] = em.count.mock.calls[0];
      expect(entity).toBe(AiUsage);
      // No condition on succeeded or tokens: a call that reached the model and
      // was then stopped, or is still running, counts like a finished one.
      expect(Object.keys(where).sort()).toEqual(['createdAt', 'userId']);
      expect(where.userId).toBe('u1');
      const since = where.createdAt.value as Date;
      expect(Date.now() - since.getTime()).toBeGreaterThanOrEqual(86_400_000 - 1000);
      expect(Date.now() - since.getTime()).toBeLessThan(86_400_000 + 1000);
      expect(em.query.mock.invocationCallOrder[0]).toBeLessThan(em.count.mock.invocationCallOrder[0]);
    });

    it('inserts the row in the same transaction, before the model is called', async () => {
      await guard.reserve(context, 'chat-model');
      expect(usage.manager.transaction).toHaveBeenCalledTimes(1);
      expect(em.insert).toHaveBeenCalledWith(AiUsage, { userId: 'u1', feature: 'advisor', model: 'chat-model' });
    });

    it('refuses at the cap, which AI_DAILY_CALLS_PER_USER sets, without inserting', async () => {
      vi.stubEnv('AI_DAILY_CALLS_PER_USER', '3');
      em.count.mockResolvedValue(3);
      await expect(guard.reserve(context, 'chat-model')).rejects.toThrow(new AiUnavailableError('Daily AI limit reached, try again tomorrow'));
      expect(em.insert).not.toHaveBeenCalled();
    });

    it.each(['', 'twenty', '0', '-5', '2.5'])('falls back to a cap of 20 when AI_DAILY_CALLS_PER_USER is %j', async (value) => {
      vi.stubEnv('AI_DAILY_CALLS_PER_USER', value);
      em.count.mockResolvedValue(19);
      await expect(guard.reserve(context, 'm')).resolves.toBe('row-1');
      em.count.mockResolvedValue(20);
      await expect(guard.reserve(context, 'm')).rejects.toThrow(new AiUnavailableError('Daily AI limit reached, try again tomorrow'));
    });
  });

  describe('finish', () => {
    it('fills in tokens, latency and outcome on the reserved row', async () => {
      await guard.finish('row-1', { inputTokens: 10, outputTokens: 5, latencyMs: 300, succeeded: true });
      expect(usage.update).toHaveBeenCalledWith('row-1', { inputTokens: 10, outputTokens: 5, latencyMs: 300, succeeded: true });
    });

    it('never throws: a failed update is logged by error name only', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      usage.update.mockRejectedValue(new TypeError('connection lost while sending prompt text'));
      await expect(guard.finish('row-1', { inputTokens: 0, outputTokens: 0, latencyMs: 1, succeeded: false })).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith('Could not record AI usage: TypeError');
      expect(JSON.stringify(warn.mock.calls)).not.toContain('prompt');
    });
  });
});
