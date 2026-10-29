import { ServiceUnavailableException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

// The one failure type of the AI gateway (ADR 0003): no key, timeout, provider
// error after one retry, an unusable reply, or a spent cap. Callers show their
// manual path. The message is safe to show and log: it never carries the prompt.
// `billed` is false only when the provider refused the request outright (wrong
// key, no credit, rate limit), so the gateway can release the reserved call.
export class AiUnavailableError extends ServiceUnavailableException {
  readonly billed: boolean;

  constructor(
    readonly reason = 'AI is unavailable',
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

  @ApiProperty({ example: 'AI is unavailable' })
  message!: string;
}
