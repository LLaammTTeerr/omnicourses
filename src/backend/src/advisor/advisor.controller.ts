import { Body, Controller, Delete, Get, HttpCode, Post, Put, Res } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiProduces, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AiUnavailableDto } from '../ai/ai-unavailable.error.js';
import { streamChat } from '../ai/sse.js';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { User } from '../users/user.entity.js';
import { AdvisorConsentService } from './advisor-consent.service.js';
import { AdvisorConsentDto, AskDto, checkConversation } from './advisor.dto.js';
import { AdvisorService } from './advisor.service.js';

// F8 advisor chat (UC-08, ADR 0015). Only the signed-in student's own consent and record: no route
// takes a user id. The conversation is not stored: the browser sends it with each question.
@ApiTags('advisor')
@Authenticated()
@Controller('advisor')
export class AdvisorController {
  constructor(
    private readonly advisor: AdvisorService,
    private readonly consent: AdvisorConsentService,
  ) {}

  @Post('ask')
  @HttpCode(200)
  @ApiProduces('text/event-stream')
  @ApiOkResponse({
    description:
      'A `text/event-stream`, read with fetch (ADR 0003). Events: `tool_call` {name}, `tool_result` {name, ok}, then the vetted answer as ' +
      '`text` {delta}, `citations` {clauses: [{id, label, document, text}]}, `verdict` {outcome: answered | replaced | off_topic | ' +
      'needs_consent, reasons, promptVersion} and `done` {text}; or `error` {code: ai_unavailable, message} if the provider fails mid-answer. ' +
      'Off-topic questions get a fixed reply without a model call, which does not count toward the daily limit.',
  })
  @ApiBadRequestResponse({ description: 'A role other than user or assistant, a message too long (counted after NFKC) or with no visible text, too many messages, or no question last' })
  @ApiServiceUnavailableResponse({ type: AiUnavailableDto, description: 'No provider, provider down, or the daily AI limit is reached' })
  async ask(@CurrentUser() user: User, @Body() dto: AskDto, @Res() res: Response): Promise<void> {
    checkConversation(dto);
    await streamChat(res, this.advisor.ask(user.id, { language: dto.language, messages: dto.messages }));
  }

  @Get('consent')
  @ApiOkResponse({ type: AdvisorConsentDto, description: 'Whether the student consented to sending their pseudonymous record to the AI provider' })
  getConsent(@CurrentUser() user: User): Promise<AdvisorConsentDto> {
    return this.consent.statusFor(user.id);
  }

  @Put('consent')
  @ApiOkResponse({ type: AdvisorConsentDto, description: 'Consent recorded; consenting again keeps the first time' })
  grantConsent(@CurrentUser() user: User): Promise<AdvisorConsentDto> {
    return this.consent.grant(user.id);
  }

  @Delete('consent')
  @ApiOkResponse({ type: AdvisorConsentDto, description: 'Consent withdrawn: the record is no longer sent, and the advisor answers in general mode' })
  withdrawConsent(@CurrentUser() user: User): Promise<AdvisorConsentDto> {
    return this.consent.withdraw(user.id);
  }
}
