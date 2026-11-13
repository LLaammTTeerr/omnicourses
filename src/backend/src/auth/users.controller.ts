import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { UserDto } from '../users/user.dto.js';
import { User } from '../users/user.entity.js';
import { Authenticated, CurrentUser } from './auth.decorators.js';

// The signed-in user's own account. It sits in auth, beside the decorators it needs, so users/
// (which auth depends on) depends on nothing of auth's.
@ApiTags('users')
@Authenticated()
@Controller('users')
export class UsersController {
  @Get('me')
  @ApiOkResponse({ type: UserDto })
  me(@CurrentUser() user: User): UserDto {
    return UserDto.from(user);
  }
}
