import { Body, Controller, Delete, Get, HttpCode, Post, Put, Res } from '@nestjs/common';
import { ApiBadRequestResponse, ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AiUnavailableDto } from '../ai/ai-unavailable.error.js';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { User } from '../users/user.entity.js';
import { AdvisorConsentService } from './advisor-consent.service.js';
import { AdvisorAnswerDto, AdvisorConsentDto, AskDto, checkConversation } from './advisor.dto.js';
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
  @ApiOkResponse({
    type: AdvisorAnswerDto,
    description:
      'The checked answer as typed segments, with the badge the screen must show (ADR 0015, option A). Nothing the model writes is sent before the whole answer is checked, so the route answers JSON, not a stream. ' +
      'Off-topic questions get a fixed reply without a model call, which does not count toward the daily limit.',
  })
  @ApiBadRequestResponse({ description: 'A role other than user or assistant, a message too long (counted after NFKC) or with no visible text, too many messages, or no question last' })
  @ApiServiceUnavailableResponse({ type: AiUnavailableDto, description: 'No provider, provider down, or the daily AI limit is reached' })
  async ask(@CurrentUser() user: User, @Body() dto: AskDto, @Res({ passthrough: true }) res: Response): Promise<AdvisorAnswerDto> {
    checkConversation(dto);
    // A closed tab stops the model call; the call still counts toward the cap (ADR 0003).
    const aborted = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) aborted.abort();
    });
    return this.advisor.ask(user.id, { language: dto.language, messages: dto.messages }, aborted.signal);
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
