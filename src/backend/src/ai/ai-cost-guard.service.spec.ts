import { Logger } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AiCostGuard } from './ai-cost-guard.service.js';
import { AI_REASONS, AiUnavailableError } from './ai-unavailable.error.js';

const context = { userId: 'u1', feature: 'advisor' };

describe('AiCostGuard', () => {
  let em: { query: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn> };
  let usage: { manager: { transaction: ReturnType<typeof vi.fn> }; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let guard: AiCostGuard;

  beforeEach(() => {
    em = { query: vi.fn(async () => []), count: vi.fn(async () => 0), insert: vi.fn(async () => ({ identifiers: [{ id: 'row-1' }] })) };
    usage = { manager: { transaction: vi.fn(async (work: (m: typeof em) => unknown) => work(em)) }, update: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) };
    guard = new AiCostGuard(usage as never, { dailyCallsPerUser: 20 });
  });

  afterEach(() => vi.restoreAllMocks());

  describe('reserve', () => {
    it('reserves a row below the cap and returns its id', async () => {
      em.count.mockResolvedValue(19);
      await expect(guard.reserve(context, 'chat-model')).resolves.toBe('row-1');
    });

    it('refuses at the configured cap without inserting', async () => {
      guard = new AiCostGuard(usage as never, { dailyCallsPerUser: 3 });
      em.count.mockResolvedValue(3);
      await expect(guard.reserve(context, 'chat-model')).rejects.toThrow(new AiUnavailableError(AI_REASONS.dailyLimit));
      expect(em.insert).not.toHaveBeenCalled();
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

  describe('release', () => {
    it('deletes the reserved row of a call the provider refused without billing', async () => {
      await guard.release('row-1');
      expect(usage.delete).toHaveBeenCalledWith('row-1');
    });

    it('never throws: a failed delete is logged by error name only, and the call keeps counting', async () => {
      const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      usage.delete.mockRejectedValue(new TypeError('connection lost while sending prompt text'));
      await expect(guard.release('row-1')).resolves.toBeUndefined();
      expect(warn).toHaveBeenCalledWith('Could not release AI usage: TypeError');
    });
  });
});
