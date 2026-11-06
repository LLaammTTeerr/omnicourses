import { ServiceUnavailableException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

/** Every reason the gateway gives. Safe to show and log: none carries the prompt. */
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

// The one failure type of the AI gateway (ADR 0003): no key, timeout, provider
// error after one retry, an unusable reply, or a spent cap. Callers show their
// manual path. `billed` is false only when the provider refused the request
// outright (wrong key, no credit, rate limit), so the gateway can release the
// reserved call.
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

/** Document it on AI routes: `@ApiServiceUnavailableResponse({ type: AiUnavailableDto })`. */
export class AiUnavailableDto {
  @ApiProperty({ example: 503 })
  statusCode!: number;

  @ApiProperty({ example: 'ai_unavailable' })
  code!: string;

  @ApiProperty({ example: AI_REASONS.unavailable })
  message!: string;
}
