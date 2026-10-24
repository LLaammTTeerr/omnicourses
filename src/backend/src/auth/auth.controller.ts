import { Body, Controller, Delete, Get, Headers, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
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
import { User } from '../users/user.entity.js';
import { CurrentSession, CurrentUser, Public } from './auth.decorators.js';
import { AuthResultDto, SessionDto, SignInDto, SignUpDto } from './auth.dto.js';
import { AuthService } from './auth.service.js';
import { Session } from './session.entity.js';

// Brute-force limit on the two endpoints that take a password.
const PASSWORD_LIMIT = { default: { limit: 10, ttl: 60_000 } };

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
  @ApiOkResponse({ type: AuthResultDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  signIn(@Body() dto: SignInDto, @Headers('user-agent') userAgent?: string): Promise<AuthResultDto> {
    return this.auth.signIn(dto, userAgent);
  }

  @Post('refresh')
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOkResponse({ type: AuthResultDto, description: 'New token; the one used for this request stops working.' })
  refresh(@CurrentSession() session: Session): Promise<AuthResultDto> {
    return this.auth.refresh(session);
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
