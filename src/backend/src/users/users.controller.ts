import { Controller, Get, Patch } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { StrictBody } from '../common/api-requests.js';
import { UpdateProfileDto, UserDto } from './user.dto.js';
import { User } from './user.entity.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Authenticated()
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('me')
  @ApiOkResponse({ type: UserDto })
  me(@CurrentUser() user: User): UserDto {
    return UserDto.from(user);
  }

  @Patch('me')
  @ApiBody({ type: UpdateProfileDto })
  @ApiOkResponse({ type: UserDto, description: 'Saved; the account as it now stands. Only the fields sent change.' })
  @ApiBadRequestResponse({ description: 'A student ID that is not 8 digits, a class name too long or with a control character, or any other field in the body' })
  async updateMe(@CurrentUser() user: User, @StrictBody() dto: UpdateProfileDto): Promise<UserDto> {
    return UserDto.from(await this.users.updateProfile(user.id, dto));
  }
}
