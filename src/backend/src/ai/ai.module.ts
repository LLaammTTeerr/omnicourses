import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { aiConfig } from '../config/env.js';
import { AI_CONFIG, type AiConfig } from './ai-config.js';
import { AiCostGuard } from './ai-cost-guard.service.js';
import { AiUsage } from './ai-usage.entity.js';
import { GatewayLlmService } from './gateway-llm.service.js';
import { LlmService } from './llm.service.js';
import { ModelClient } from './model-client.js';
import { OpenRouterModelClient } from './openrouter-model.client.js';

@Module({
  imports: [TypeOrmModule.forFeature([AiUsage])],
  providers: [
    { provide: AI_CONFIG, useFactory: aiConfig },
    // No client without a key: the app still boots, and AI calls answer 503 (ADR 0003).
    {
      provide: ModelClient,
      inject: [AI_CONFIG],
      useFactory: ({ apiKey, timeoutMs }: AiConfig): ModelClient | null => (apiKey ? new OpenRouterModelClient(apiKey, timeoutMs) : null),
    },
    AiCostGuard,
    { provide: LlmService, useClass: GatewayLlmService },
  ],
  exports: [LlmService],
})
export class AiModule {}
