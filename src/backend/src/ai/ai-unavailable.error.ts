import { ServiceUnavailableException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export const AI_REASONS = {
  unavailable: 'AI is unavailable',
  notConfigured: 'AI is not configured',
  creditUsedUp: 'AI credit is used up',
  busy: 'The AI provider is busy, try again shortly',
  timedOut: 'The AI provider timed out',
  providerFailed: 'The AI provider failed',
  unusableReply: 'The model returned an unusable reply',
  streamEndedEarly: 'The model stream ended early',
  dailyLimit: 'Daily AI limit reached, try again tomorrow',
} as const;

export class AiUnavailableError extends ServiceUnavailableException {
  readonly billed: boolean;

  constructor(
    readonly reason: string = AI_REASONS.unavailable,
    options: { billed?: boolean } = {},
  ) {
    super({ statusCode: 503, code: 'ai_unavailable', message: reason });
    this.billed = options.billed ?? true;
  }
}

export class AiUnavailableDto {
  @ApiProperty({ example: 503 })
  statusCode!: number;

  @ApiProperty({ example: 'ai_unavailable' })
  code!: string;

  @ApiProperty({ example: AI_REASONS.unavailable })
  message!: string;
}
