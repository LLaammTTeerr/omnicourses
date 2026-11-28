import { Logger } from '@nestjs/common';
import { MoreThan } from 'typeorm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Clock } from '../config/clock.js';
import { AiCostGuard } from './ai-cost-guard.service.js';
import { AI_REASONS, AiUnavailableError } from './ai-unavailable.error.js';
import { AiUsage } from './ai-usage.entity.js';

const context = { userId: 'u1', feature: 'advisor' };
const fixedNow = new Date('2026-06-01T12:00:00.000Z');

describe('AiCostGuard', () => {
  let em: { query: ReturnType<typeof vi.fn>; count: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn> };
  let usage: { manager: { transaction: ReturnType<typeof vi.fn> }; update: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  let clock: Clock;
  let guard: AiCostGuard;

  beforeEach(() => {
    em = { query: vi.fn(async () => []), count: vi.fn(async () => 0), insert: vi.fn(async () => ({ identifiers: [{ id: 'row-1' }] })) };
    usage = { manager: { transaction: vi.fn(async (work: (m: typeof em) => unknown) => work(em)) }, update: vi.fn(async () => undefined), delete: vi.fn(async () => undefined) };
    clock = new Clock();
    vi.spyOn(clock, 'now').mockReturnValue(fixedNow);
    guard = new AiCostGuard(usage as never, { dailyCallsPerUser: 20 }, clock);
  });

  afterEach(() => vi.restoreAllMocks());

  describe('reserve', () => {
    it('reserves a row below the cap using the namespaced advisory lock and injected clock', async () => {
      em.count.mockResolvedValue(19);
      await expect(guard.reserve(context, 'chat-model')).resolves.toBe('row-1');
      expect(em.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock($1, hashtext($2))', [3003, 'u1']);
      expect(em.count).toHaveBeenCalledWith(AiUsage, {
        where: { userId: 'u1', createdAt: MoreThan(new Date('2026-05-31T12:00:00.000Z')) },
      });
      expect(em.insert).toHaveBeenCalledWith(AiUsage, {
        userId: 'u1',
        feature: 'advisor',
        model: 'chat-model',
        createdAt: fixedNow,
      });
    });

    it('refuses at the configured cap without inserting', async () => {
      guard = new AiCostGuard(usage as never, { dailyCallsPerUser: 3 }, clock);
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
