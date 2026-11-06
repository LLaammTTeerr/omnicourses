import { INestApplication } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AI_CONFIG, type AiConfig } from '../src/ai/ai-config.js';
import { AI_REASONS, AiUnavailableError } from '../src/ai/ai-unavailable.error.js';
import { AiUsage } from '../src/ai/ai-usage.entity.js';
import { LlmService } from '../src/ai/llm.service.js';
import { ModelClient, type ModelStreamEvent } from '../src/ai/model-client.js';
import { bootApp } from './support/app.js';
import { storedUser } from './support/users.js';

/** Answers every call at once, so the test sees only the gateway and PostgreSQL. */
class InstantModel extends ModelClient {
  async complete() {
    return { content: '{}', usage: { inputTokens: 1, outputTokens: 1 } };
  }

  async *stream(): AsyncIterable<ModelStreamEvent> {
    yield { type: 'text', delta: 'Up to 25.' };
    yield { type: 'end', content: 'Up to 25.', toolCalls: [], usage: { inputTokens: 1, outputTokens: 1 } };
  }
}

// The gateway against PostgreSQL: the usage table, the daily cap under
// concurrency, its 24-hour window and the "AI is not configured" path. No
// real model is ever called.
describe('AI gateway against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let llm: LlmService;
  let usage: Repository<AiUsage>;
  const config: AiConfig = { apiKey: 'test-key', structuredModel: 'any-model', chatModel: 'any-model', timeoutMs: 1000, dailyCallsPerUser: 2 };
  const structured = (userId: string) => llm.structured({ context: { userId, feature: 'e2e' }, instructions: '', input: '', schema: z.object({}) });

  beforeAll(async () => {
    app = await bootApp((builder) => builder.overrideProvider(AI_CONFIG).useValue(config).overrideProvider(ModelClient).useValue(new InstantModel()));
    llm = app.get(LlmService);
    usage = app.get(DataSource).getRepository(AiUsage);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('boots without a key and answers ai_unavailable before reserving, so the attempt does not count', async () => {
    const keyless = await bootApp((builder) => builder.overrideProvider(AI_CONFIG).useValue({ ...config, apiKey: null }));
    try {
      const userId = await storedUser(keyless);
      const call = keyless.get(LlmService).structured({ context: { userId, feature: 'e2e' }, instructions: '', input: '', schema: z.object({}) });
      await expect(call).rejects.toThrow(new AiUnavailableError(AI_REASONS.notConfigured));
      expect(await usage.countBy({ userId })).toBe(0);
    } finally {
      await keyless.close();
    }
  });

  it('counts a call the student stopped, and refuses once the daily cap is reached', async () => {
    const userId = await storedUser(app);
    await structured(userId);
    // The student closes the tab after the first text event.
    for await (const _event of llm.chat({ context: { userId, feature: 'e2e' }, instructions: '', messages: [] })) break;
    await expect(structured(userId)).rejects.toThrow(new AiUnavailableError(AI_REASONS.dailyLimit));
    const rows = await usage.find({ where: { userId }, order: { createdAt: 'ASC' } });
    expect(rows).toEqual([
      expect.objectContaining({ feature: 'e2e', model: 'any-model', inputTokens: 1, outputTokens: 1, succeeded: true }),
      expect.objectContaining({ inputTokens: 0, outputTokens: 0, succeeded: false }),
    ]);
  });

  it('counts only the calls of the last 24 hours', async () => {
    const userId = await storedUser(app);
    await usage.query(
      `INSERT INTO ai_usage (user_id, feature, model, created_at)
       VALUES ($1, 'e2e', 'any-model', now() - interval '25 hours'), ($1, 'e2e', 'any-model', now() - interval '23 hours')`,
      [userId],
    );
    await structured(userId);
    await expect(structured(userId)).rejects.toThrow(new AiUnavailableError(AI_REASONS.dailyLimit));
  });

  it('lets exactly the cap through when calls arrive in parallel', async () => {
    const userId = await storedUser(app);
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => structured(userId)));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    for (const r of results.filter((r) => r.status === 'rejected')) {
      expect((r as PromiseRejectedResult).reason).toEqual(new AiUnavailableError(AI_REASONS.dailyLimit));
    }
    expect(await usage.countBy({ userId })).toBe(2);
  });
});
