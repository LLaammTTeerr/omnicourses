import { ServiceUnavailableException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

// The one failure type of the AI gateway (ADR 0003): no key, timeout, provider
// error after one retry, an unusable reply, or a spent cap. Callers show their
// manual path. The message is safe to show and log: it never carries the prompt.
export class AiUnavailableError extends ServiceUnavailableException {
  constructor(readonly reason = 'AI is unavailable') {
    super({ statusCode: 503, code: 'ai_unavailable', message: reason });
  }
}

/** Document it on AI routes: `@ApiServiceUnavailableResponse({ type: AiUnavailableDto })`. */
export class AiUnavailableDto {
  @ApiProperty({ example: 503 })
  statusCode!: number;

  @ApiProperty({ example: 'ai_unavailable' })
  code!: string;

  @ApiProperty({ example: 'AI is unavailable' })
  message!: string;
}
