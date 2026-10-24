import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiCostGuard } from './ai-cost-guard.service.js';
import { AiUsage } from './ai-usage.entity.js';
import { GatewayLlmService } from './gateway-llm.service.js';
import { LlmService } from './llm.service.js';
import { ModelClient } from './model-client.js';
import { OpenRouterModelClient } from './openrouter-model.client.js';

// No controllers: the gateway is transport only. Import AiModule and inject LlmService.
@Module({
  imports: [TypeOrmModule.forFeature([AiUsage])],
  providers: [AiCostGuard, { provide: ModelClient, useClass: OpenRouterModelClient }, { provide: LlmService, useClass: GatewayLlmService }],
  exports: [LlmService],
})
export class AiModule {}
