import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { CurrentUser } from '../auth/auth.decorators.js';
import { UserDto } from './user.dto.js';
import { User } from './user.entity.js';

@ApiTags('users')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, expired or revoked token' })
@Controller('users')
export class UsersController {
  @Get('me')
  @ApiOkResponse({ type: UserDto })
  me(@CurrentUser() user: User): UserDto {
    return UserDto.from(user);
  }
}
