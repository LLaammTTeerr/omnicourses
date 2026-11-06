import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { UserDto } from './user.dto.js';
import { User } from './user.entity.js';

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
