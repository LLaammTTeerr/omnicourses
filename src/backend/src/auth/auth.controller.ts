import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { SECOND_MS } from '../config/time.js';
import { User } from '../users/user.entity.js';
import { AcceptsPreviousToken, CurrentSession, CurrentUser, Public } from './auth.decorators.js';
import { AuthResultDto, SessionDto, SignInDto, SignUpDto } from './auth.dto.js';
import { AuthService, REFRESH_GRACE_MS } from './auth.service.js';
import { PASSWORD_LIMIT } from './rate-limits.js';
import { Session } from './session.entity.js';

@ApiTags('auth')
@ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Throttle(PASSWORD_LIMIT)
  @Post('sign-up')
  @ApiCreatedResponse({ type: AuthResultDto })
  @ApiConflictResponse({ description: 'Email already registered' })
  signUp(@Body() dto: SignUpDto, @Headers('user-agent') userAgent?: string): Promise<AuthResultDto> {
    return this.auth.signUp(dto, userAgent);
  }

  @Public()
  @Throttle(PASSWORD_LIMIT)
  @Post('sign-in')
  @HttpCode(200)
  @ApiOkResponse({ type: AuthResultDto, description: 'Signing in during the deletion grace period cancels the deletion (`accountRestored: true`).' })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  signIn(@Req() req: Request, @Body() dto: SignInDto, @Headers('user-agent') userAgent?: string): Promise<AuthResultDto> {
    return this.auth.signIn(dto, userAgent, req.ip);
  }

  @AcceptsPreviousToken()
  @Post('refresh')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({
    type: AuthResultDto,
    description:
      `New token. The token sent with this request stops working at once on every other route; this route still accepts it for ${REFRESH_GRACE_MS / SECOND_MS} seconds, so a reload during a refresh keeps the session.`,
  })
  refresh(@Req() req: Request, @CurrentSession() session: Session): Promise<AuthResultDto> {
    return this.auth.refresh(session, req.headers.authorization);
  }

  @Post('sign-out')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'The current session is revoked.' })
  signOut(@CurrentSession() session: Session): Promise<void> {
    return this.auth.signOut(session);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @ApiOkResponse({ type: [SessionDto] })
  sessions(@CurrentUser() user: User, @CurrentSession() session: Session): Promise<SessionDto[]> {
    return this.auth.listSessions(user.id, session.id);
  }

  @Delete('sessions/:id')
  @HttpCode(204)
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'The session is revoked.' })
  revoke(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.auth.revoke(user.id, id);
  }
}
