import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { aiConfig } from './ai-config.js';
import { AiUnavailableError } from './ai-unavailable.error.js';
import { AiUsage } from './ai-usage.entity.js';

const DAY_MS = 86_400_000;

// Per-user daily cap (ADR 0003). One call = one structured() or one chat(),
// however many tool steps it takes. Only calls that reached the model count:
// a missing key or a provider outage costs nothing and must not lock students
// out after it is fixed. The window rolls over 24 hours, so no time zone is
// involved. The monthly budget is the credit limit set on the
// OpenRouter key itself.
@Injectable()
export class AiCostGuard {
  constructor(@InjectRepository(AiUsage) private readonly usage: Repository<AiUsage>) {}

  async assertWithinCap(userId: string): Promise<void> {
    const createdAt = MoreThan(new Date(Date.now() - DAY_MS));
    const used = await this.usage.count({ where: [{ userId, createdAt, succeeded: true }, { userId, createdAt, inputTokens: MoreThan(0) }] });
    if (used >= aiConfig().dailyCallsPerUser) throw new AiUnavailableError('Daily AI limit reached, try again tomorrow');
  }

  async record(row: Pick<AiUsage, 'userId' | 'feature' | 'model' | 'inputTokens' | 'outputTokens' | 'latencyMs' | 'succeeded'>): Promise<void> {
    await this.usage.insert(row);
  }
}
