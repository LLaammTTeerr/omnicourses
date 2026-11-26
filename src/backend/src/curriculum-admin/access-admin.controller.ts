import { Controller, Delete, Get, Param, PipeTransform, Put } from '@nestjs/common';
import { ApiConflictResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { AdminErrorDto, validationFailed } from '../common/api-errors.js';
import { uuidParam } from '../common/api-requests.js';
import { User } from '../users/user.entity.js';
import { AccessAdminService } from './access-admin.service.js';
import { GLOBAL_PERMISSIONS, type GlobalPermission } from './admin-grant.entities.js';
import { AdminErrors } from './admin-write.service.js';
import { AccessProgramListDto, UserGrantsDto } from './curriculum-admin.dto.js';

const permissionParam: PipeTransform<string, GlobalPermission> = {
  transform(value: string): GlobalPermission {
    if (!(GLOBAL_PERMISSIONS as readonly string[]).includes(value)) throw validationFailed(`permission: must be one of ${GLOBAL_PERMISSIONS.join(', ')}`);
    return value as GlobalPermission;
  },
};

@ApiTags('curriculum-admin')
@Authenticated()
@AdminErrors()
@Controller('admin/access')
export class AccessAdminController {
  constructor(private readonly access: AccessAdminService) {}

  @Get('programs')
  @ApiOkResponse({ type: AccessProgramListDto })
  async programs(@CurrentUser() user: User): Promise<AccessProgramListDto> {
    return { programs: await this.access.programs(user.id) };
  }

  @Get('users/:userId/grants')
  @ApiOkResponse({ type: UserGrantsDto })
  grants(@CurrentUser() user: User, @Param('userId', uuidParam('userId')) userId: string): Promise<UserGrantsDto> {
    return this.access.grantsOf(user.id, userId);
  }

  @Put('users/:userId/programs/:programId')
  @ApiOkResponse({ type: UserGrantsDto, description: 'Granted (or already held; the original attribution stays).' })
  @ApiConflictResponse({ type: AdminErrorDto, description: '`recipient_deletion_pending`' })
  grantProgram(
    @CurrentUser() user: User,
    @Param('userId', uuidParam('userId')) userId: string,
    @Param('programId', uuidParam('programId')) programId: string,
  ): Promise<UserGrantsDto> {
    return this.access.grantProgram(user.id, userId, programId);
  }

  @Delete('users/:userId/programs/:programId')
  @ApiOkResponse({ type: UserGrantsDto, description: 'Revoked (or not held).' })
  revokeProgram(
    @CurrentUser() user: User,
    @Param('userId', uuidParam('userId')) userId: string,
    @Param('programId', uuidParam('programId')) programId: string,
  ): Promise<UserGrantsDto> {
    return this.access.revokeProgram(user.id, userId, programId);
  }

  @Put('users/:userId/global/:permission')
  @ApiParam({ name: 'permission', enum: GLOBAL_PERMISSIONS })
  @ApiOkResponse({ type: UserGrantsDto, description: 'Granted (or already held).' })
  @ApiConflictResponse({ type: AdminErrorDto, description: '`recipient_deletion_pending`' })
  grantGlobal(
    @CurrentUser() user: User,
    @Param('userId', uuidParam('userId')) userId: string,
    @Param('permission', permissionParam) permission: GlobalPermission,
  ): Promise<UserGrantsDto> {
    return this.access.grantGlobal(user.id, userId, permission);
  }

  @Delete('users/:userId/global/:permission')
  @ApiParam({ name: 'permission', enum: GLOBAL_PERMISSIONS })
  @ApiOkResponse({ type: UserGrantsDto, description: 'Revoked (or not held).' })
  @ApiConflictResponse({ type: AdminErrorDto, description: '`last_access_manager`: revoking it would leave no active access manager' })
  revokeGlobal(
    @CurrentUser() user: User,
    @Param('userId', uuidParam('userId')) userId: string,
    @Param('permission', permissionParam) permission: GlobalPermission,
  ): Promise<UserGrantsDto> {
    return this.access.revokeGlobal(user.id, userId, permission);
  }
}
