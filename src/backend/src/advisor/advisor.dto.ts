import { BadRequestException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';
import { type AdvisorOutcome, type AnswerReason, type SegmentKind } from './advisor-answer.js';
import { PROMPT_VERSION, type AdvisorLanguage } from './advisor-prompt.js';
import { cleanInput } from './retrieval/text.js';

/** Limits on a request (ADR 0016). History lives in the browser, so the client sends it each time. */
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

/**
 * Checks a validated request as a whole; throws 400. Lengths are measured on the text as cleaned
 * (NFKC, no invisible characters), which is what reaches the model: NFKC can make a character 18
 * times longer (U+FDFA), so a check on the raw text would not bound the cost (ADR 0016).
 */
export function checkConversation(dto: AskDto): void {
  if (dto.messages.at(-1)?.role !== 'user') throw new BadRequestException('The last message must be the student’s question');
  const cleaned = dto.messages.map((m) => ({ role: m.role, content: cleanInput(m.content) }));
  if (cleaned.some((m) => !m.content.trim())) throw new BadRequestException('A message has no visible text');
  if (cleaned.some((m) => m.role === 'user' && m.content.length > ADVISOR_LIMITS.userMessageLength)) {
    throw new BadRequestException(`A question has at most ${ADVISOR_LIMITS.userMessageLength} characters`);
  }
  if (cleaned.some((m) => m.role === 'assistant' && m.content.length > ADVISOR_LIMITS.assistantMessageLength)) {
    throw new BadRequestException(`An earlier answer has at most ${ADVISOR_LIMITS.assistantMessageLength} characters`);
  }
  if (cleaned.reduce((sum, m) => sum + m.content.length, 0) > ADVISOR_LIMITS.totalLength) {
    throw new BadRequestException('The conversation is too long; start a new one');
  }
}

export class AdvisorConsentDto {
  @ApiProperty()
  consented!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When the student consented; null without consent' })
  consentedAt!: string | null;
}

export class AdvisorCitationDto {
  @ApiProperty({ example: 'qd-1175-2021/d7/k2/b', description: 'The passage id' })
  id!: string;

  @ApiProperty({ example: 'Điều 7.2.b', description: 'The citation as a student reads it' })
  label!: string;

  @ApiProperty({ example: 'QĐ 1175/QĐ-KHTN', description: 'The document' })
  document!: string;

  @ApiProperty({ type: [Number], description: 'Printed page numbers' })
  pages!: number[];
}

export class AdvisorSegmentDto {
  @ApiProperty({
    enum: ['engine', 'passage', 'explanation', 'notice'],
    description:
      '`engine`: a fact about a course, the student’s record or the rule engine’s result, written by the server in fixed wording. ' +
      '`passage`: a regulation or handbook passage, word for word (Vietnamese); render it as plain text, never as HTML or auto-linked, since the handbook prints some non-HCMUS links. ' +
      '`explanation`: the only model-written text; render it next to `badge`. `notice`: a fixed server text (refusal, redaction, “could not check”).',
  })
  kind!: SegmentKind;

  @ApiProperty({
    description:
      'Plain text, for every kind: render it as text (a text node, `{{ }}` in Vue), never as HTML or Markdown, and never auto-linked. ' +
      'An `engine` segment carries catalogue and engine strings (course and group names, condition descriptions, plan messages) as one line with ' +
      'control, bidi and zero-width characters removed; `<`, `>` and `&` are kept as typed, not escaped. A `passage` keeps its line breaks.',
  })
  text!: string;

  @ApiProperty({ type: AdvisorCitationDto, nullable: true, description: 'The passage a `passage` segment shows; null for the other kinds' })
  citation!: AdvisorCitationDto | null;
}

export class AdvisorAnswerDto {
  @ApiProperty({
    enum: ['answered', 'partial', 'replaced', 'off_topic', 'needs_consent'],
    description:
      '`answered`: everything the model picked was checked and is shown. `partial`: something was dropped (an unknown id, the explanation, a refusal notice that ' +
      'contradicted what is shown, or facts from the record after consent was withdrawn), the rest is shown. ' +
      '`replaced`: nothing could be checked, or the model called too many tools; a fixed notice and the passages retrieved for the question are shown. ' +
      '`off_topic`, `needs_consent`: a fixed reply without a model call.',
  })
  outcome!: AdvisorOutcome;

  @ApiProperty({ type: [AdvisorSegmentDto], description: 'The answer, in order: notices (redaction, refusal), engine facts, passages, then the explanation, or a last notice that it was withheld' })
  segments!: AdvisorSegmentDto[];

  @ApiProperty({
    example: 'AI explanation, not an official decision; your audit is the source',
    description: 'Always present, in the request language. The screen must show it with every answer (ADR 0016).',
  })
  badge!: string;

  @ApiProperty({ type: [String], description: 'Fixed codes for what was dropped and why; never content' })
  reasons!: AnswerReason[];

  @ApiProperty({ example: PROMPT_VERSION, description: 'The system prompt the answer ran against' })
  promptVersion!: string;
}
