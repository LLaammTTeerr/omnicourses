import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { AiCostGuard } from '../src/ai/ai-cost-guard.service.js';
import { AiUnavailableError } from '../src/ai/ai-unavailable.error.js';
import { AiUsage } from '../src/ai/ai-usage.entity.js';
import { LlmService } from '../src/ai/llm.service.js';
import { AppModule } from '../src/app.module.js';
import { UsersService } from '../src/users/users.service.js';

// The gateway against PostgreSQL, with no OpenRouter key: the usage table, the
// daily cap under concurrency and the "AI is not configured" path. No model is
// ever called.
describe('AI gateway against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let userId: string;

  async function createUser(): Promise<string> {
    const user = await app
      .get(UsersService)
      .create({ email: `ai-${randomUUID()}@example.com`, passwordHash: 'not-a-real-hash', displayName: 'Test Student', consentAt: new Date() });
    return user.id;
  }

  beforeAll(async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('AI_MODEL_STRUCTURED', 'any-model');
    vi.stubEnv('AI_DAILY_CALLS_PER_USER', '2');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.get(DataSource).runMigrations({ transaction: 'each' });
    await app.init();
    userId = await createUser();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it('answers ai_unavailable without a key, before reserving, so the attempt does not count', async () => {
    const llm = app.get(LlmService);
    const call = llm.structured({ context: { userId, feature: 'e2e' }, instructions: '', input: '', schema: z.object({}) });
    await expect(call).rejects.toThrow(new AiUnavailableError('AI is not configured'));
    expect(await app.get(DataSource).getRepository(AiUsage).countBy({ userId })).toBe(0);
  });

  it('counts a reserved call that never finished, and refuses once the daily cap is reached', async () => {
    const guard = app.get(AiCostGuard, { strict: false });
    const finished = await guard.reserve({ userId, feature: 'e2e' }, 'any-model');
    await guard.finish(finished, { inputTokens: 1, outputTokens: 1, latencyMs: 1, succeeded: true });
    // Stopped before the model's first turn ended: no tokens, never finished.
    await guard.reserve({ userId, feature: 'e2e' }, 'any-model');
    await expect(guard.reserve({ userId, feature: 'e2e' }, 'any-model')).rejects.toThrow(new AiUnavailableError('Daily AI limit reached, try again tomorrow'));
    const rows = await app.get(DataSource).getRepository(AiUsage).find({ where: { userId }, order: { createdAt: 'ASC' } });
    expect(rows).toEqual([
      expect.objectContaining({ id: finished, feature: 'e2e', model: 'any-model', inputTokens: 1, outputTokens: 1, latencyMs: 1, succeeded: true }),
      expect.objectContaining({ inputTokens: 0, outputTokens: 0, latencyMs: 0, succeeded: false }),
    ]);
  });

  it('lets exactly the cap through when calls arrive in parallel', async () => {
    const guard = app.get(AiCostGuard, { strict: false });
    const parallelUser = await createUser();
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => guard.reserve({ userId: parallelUser, feature: 'e2e' }, 'any-model')));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(2);
    for (const r of results.filter((r) => r.status === 'rejected')) {
      expect((r as PromiseRejectedResult).reason).toEqual(new AiUnavailableError('Daily AI limit reached, try again tomorrow'));
    }
    expect(await app.get(DataSource).getRepository(AiUsage).countBy({ userId: parallelUser })).toBe(2);
  });

  it('deletes usage rows with the user', async () => {
    const db = app.get(DataSource);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    expect(await db.getRepository(AiUsage).countBy({ userId })).toBe(0);
  });
});
