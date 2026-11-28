import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { NAMESPACED_LOCKS } from '../common/advisory-locks.js';
import { failureKind } from '../common/failure-kind.js';
import { Clock } from '../config/clock.js';
import { AI_CONFIG, type AiConfig } from '../config/env.js';
import { DAY_MS } from '../config/time.js';
import { AI_REASONS, AiUnavailableError } from './ai-unavailable.error.js';
import { AiUsage } from './ai-usage.entity.js';
import type { AiCallContext } from './llm.service.js';

type AiUsageResult = Pick<AiUsage, 'inputTokens' | 'outputTokens' | 'latencyMs' | 'succeeded'>;

@Injectable()
export class AiCostGuard {
  private readonly logger = new Logger(AiCostGuard.name);

  constructor(
    @InjectRepository(AiUsage) private readonly usage: Repository<AiUsage>,
    @Inject(AI_CONFIG) private readonly config: Pick<AiConfig, 'dailyCallsPerUser'>,
    private readonly clock: Clock,
  ) {}

  async reserve(context: AiCallContext, model: string): Promise<string> {
    const cap = this.config.dailyCallsPerUser;
    return this.usage.manager.transaction(async (em) => {
      await em.query('SELECT pg_advisory_xact_lock($1, hashtext($2))', [NAMESPACED_LOCKS.aiQuota, context.userId]);
      const now = this.clock.now();
      const used = await em.count(AiUsage, { where: { userId: context.userId, createdAt: MoreThan(new Date(now.getTime() - DAY_MS)) } });
      if (used >= cap) throw new AiUnavailableError(AI_REASONS.dailyLimit);
      const { identifiers } = await em.insert(AiUsage, { userId: context.userId, feature: context.feature, model, createdAt: now });
      return identifiers[0].id as string;
    });
  }

  async finish(id: string, result: AiUsageResult): Promise<void> {
    try {
      await this.usage.update(id, result);
    } catch (error) {
      this.logger.warn(`Could not record AI usage: ${failureKind(error)}`);
    }
  }

  async release(id: string): Promise<void> {
    try {
      await this.usage.delete(id);
    } catch (error) {
      this.logger.warn(`Could not release AI usage: ${failureKind(error)}`);
    }
  }
}
