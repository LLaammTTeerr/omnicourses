import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';
import type { AdvisorLanguage } from './advisor-prompt.js';

/** Limits on a request (ADR 0015). History lives in the browser, so the client sends it each time. */
export const ADVISOR_LIMITS = {
  messages: 20,
  userMessageLength: 2000,
  assistantMessageLength: 4000,
  totalLength: 24_000,
} as const;

export class AdvisorMessageDto {
  // Only these two: a client cannot inject a system or tool message (AGENTS.md, AI gateway).
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ maxLength: ADVISOR_LIMITS.assistantMessageLength, description: `At most ${ADVISOR_LIMITS.userMessageLength} characters in a user message` })
  @IsString()
  @IsNotEmpty()
  @MaxLength(ADVISOR_LIMITS.assistantMessageLength)
  content!: string;
}

export class AskDto {
  @ApiProperty({ enum: ['vi', 'en'], description: 'The UI language; the answer is in it. Clause text stays Vietnamese.' })
  @IsIn(['vi', 'en'])
  language!: AdvisorLanguage;

  @ApiProperty({
    type: [AdvisorMessageDto],
    minItems: 1,
    maxItems: ADVISOR_LIMITS.messages,
    description: 'The conversation so far, oldest first, ending with the student’s question. The server stores none of it.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(ADVISOR_LIMITS.messages)
  @ValidateNested({ each: true })
  @Type(() => AdvisorMessageDto)
  messages!: AdvisorMessageDto[];
}

/** Checks a validated request as a whole; throws 400. */
export function checkConversation(dto: AskDto): void {
  if (dto.messages.at(-1)?.role !== 'user') throw new BadRequestException('The last message must be the student’s question');
  if (dto.messages.some((m) => m.role === 'user' && m.content.length > ADVISOR_LIMITS.userMessageLength)) {
    throw new BadRequestException(`A question has at most ${ADVISOR_LIMITS.userMessageLength} characters`);
  }
  if (dto.messages.reduce((sum, m) => sum + m.content.length, 0) > ADVISOR_LIMITS.totalLength) {
    throw new BadRequestException('The conversation is too long; start a new one');
  }
}

export class AdvisorConsentDto {
  @ApiProperty()
  consented!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When the student consented; null without consent' })
  consentedAt!: string | null;
}
