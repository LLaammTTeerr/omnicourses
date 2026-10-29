import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { aiConfig } from './ai-config.js';
import { AiUnavailableError } from './ai-unavailable.error.js';
import { AiUsage } from './ai-usage.entity.js';
import type { AiCallContext } from './llm.service.js';

const DAY_MS = 86_400_000;

export type AiUsageResult = Pick<AiUsage, 'inputTokens' | 'outputTokens' | 'latencyMs' | 'succeeded'>;

// Per-user daily cap (ADR 0003). One call = one structured() or one chat(),
// however many tool steps it takes. A call counts once it is about to reach the
// model: the gateway reserves its row just before the first model request, so a
// call the student stops early, or one still running, counts like a finished
// one (the provider bills it either way). A call that fails before that (no
// key, no model configured) writes no row. The window rolls over 24 hours, so
// no time zone is involved. The monthly budget is the credit limit set on the
// OpenRouter key itself.
@Injectable()
export class AiCostGuard {
  constructor(@InjectRepository(AiUsage) private readonly usage: Repository<AiUsage>) {}

  /**
   * Counts and inserts in one transaction under a per-user advisory lock, so
   * parallel calls queue here and each sees the rows of the ones before it.
   * Returns the row id for finish(). Throws AiUnavailableError at the cap.
   */
  async reserve(context: AiCallContext, model: string): Promise<string> {
    const cap = aiConfig().dailyCallsPerUser;
    return this.usage.manager.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock(hashtext($1))', [context.userId]);
      const used = await em.count(AiUsage, { where: { userId: context.userId, createdAt: MoreThan(new Date(Date.now() - DAY_MS)) } });
      if (used >= cap) throw new AiUnavailableError('Daily AI limit reached, try again tomorrow');
      const { identifiers } = await em.insert(AiUsage, { userId: context.userId, feature: context.feature, model });
      return identifiers[0].id as string;
    });
  }

  /** Fills in the reserved row once the call ends, however it ends. */
  async finish(id: string, result: AiUsageResult): Promise<void> {
    await this.usage.update(id, result);
  }
}
