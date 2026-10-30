import { Body, Controller, Delete, Get, Header, HttpCode } from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiForbiddenResponse, ApiOkResponse, ApiTags, ApiTooManyRequestsResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser, PASSWORD_LIMIT } from '../auth/auth.decorators.js';
import { User } from '../users/user.entity.js';
import { AccountExportDto, DeleteAccountDto, DeletionScheduledDto } from './account.dto.js';
import { AccountService } from './account.service.js';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, expired or revoked token' })
@Controller('users/me')
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Get('export')
  @Header('Content-Disposition', 'attachment; filename="omnicourse-account.json"')
  @ApiOkResponse({ type: AccountExportDto, description: 'Everything OmniCourse holds about the signed-in user, as a JSON download.' })
  export(@CurrentUser() user: User): Promise<AccountExportDto> {
    return this.account.export(user.id);
  }

  @Delete()
  @HttpCode(202)
  @Throttle(PASSWORD_LIMIT)
  @ApiAcceptedResponse({ type: DeletionScheduledDto, description: 'Signed out everywhere; purged after the grace period unless the user signs in again.' })
  @ApiForbiddenResponse({ description: 'Wrong password' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  delete(@CurrentUser() user: User, @Body() dto: DeleteAccountDto): Promise<DeletionScheduledDto> {
    return this.account.requestDeletion(user, dto.password);
  }
}
