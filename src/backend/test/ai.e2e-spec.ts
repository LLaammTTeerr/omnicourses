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
// daily cap and the "AI is not configured" path. No model is ever called.
describe('AI gateway against PostgreSQL (e2e)', () => {
  let app: INestApplication;
  let userId: string;

  beforeAll(async () => {
    vi.stubEnv('OPENROUTER_API_KEY', '');
    vi.stubEnv('AI_MODEL_STRUCTURED', 'any-model');
    vi.stubEnv('AI_DAILY_CALLS_PER_USER', '2');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.get(DataSource).runMigrations({ transaction: 'each' });
    await app.init();
    const user = await app
      .get(UsersService)
      .create({ email: `ai-${randomUUID()}@example.com`, passwordHash: 'not-a-real-hash', displayName: 'Test Student', consentAt: new Date() });
    userId = user.id;
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await app?.close();
  });

  it('answers ai_unavailable without a key, logging the attempt without counting it', async () => {
    const llm = app.get(LlmService);
    const call = llm.structured({ context: { userId, feature: 'e2e' }, instructions: '', input: '', schema: z.object({}) });
    await expect(call).rejects.toThrow(new AiUnavailableError('AI is not configured'));
    const rows = await app.get(DataSource).getRepository(AiUsage).findBy({ userId });
    expect(rows).toEqual([expect.objectContaining({ feature: 'e2e', model: 'any-model', inputTokens: 0, succeeded: false })]);
    await expect(app.get(AiCostGuard, { strict: false }).assertWithinCap(userId)).resolves.toBeUndefined();
  });

  it('refuses once the daily cap is reached', async () => {
    const guard = app.get(AiCostGuard, { strict: false });
    await guard.record({ userId, feature: 'e2e', model: 'any-model', inputTokens: 1, outputTokens: 1, latencyMs: 1, succeeded: true });
    await guard.record({ userId, feature: 'e2e', model: 'any-model', inputTokens: 9, outputTokens: 0, latencyMs: 1, succeeded: false });
    await expect(guard.assertWithinCap(userId)).rejects.toThrow(new AiUnavailableError('Daily AI limit reached, try again tomorrow'));
  });

  it('deletes usage rows with the user', async () => {
    const db = app.get(DataSource);
    await db.query('DELETE FROM users WHERE id = $1', [userId]);
    expect(await db.getRepository(AiUsage).countBy({ userId })).toBe(0);
  });
});
