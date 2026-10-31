import { Body, Controller, Get, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/auth.decorators.js';
import { User } from '../users/user.entity.js';
import { TranscriptDto } from './transcript.dto.js';
import { TranscriptService } from './transcript.service.js';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, expired or revoked token' })
@Controller('users/me/transcript')
export class TranscriptController {
  constructor(private readonly transcript: TranscriptService) {}

  @Get()
  @ApiOkResponse({ type: TranscriptDto, description: 'The saved transcript, oldest term first; no rows if none is saved.' })
  async get(@CurrentUser() user: User): Promise<TranscriptDto> {
    return { rows: await this.transcript.rowsFor(user.id) };
  }

  @Put()
  @ApiOkResponse({ type: TranscriptDto, description: 'The reviewed rows replace the whole saved transcript.' })
  @ApiBadRequestResponse({ description: 'A row is invalid or incomplete; nothing is saved' })
  replace(@CurrentUser() user: User, @Body() dto: TranscriptDto): Promise<TranscriptDto> {
    return this.transcript.replace(user.id, dto);
  }
}
