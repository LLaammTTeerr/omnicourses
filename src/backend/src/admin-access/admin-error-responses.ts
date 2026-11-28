import { applyDecorators } from '@nestjs/common';
import { ApiBadRequestResponse, ApiForbiddenResponse, ApiNotFoundResponse, ApiProperty } from '@nestjs/swagger';
import { AdminErrorDto } from '../common/api-errors.js';
import type { PermissionKind } from './grants.js';

class PermissionRequiredDto extends AdminErrorDto {
  @ApiProperty({ enum: ['program_admin', 'catalog_maintainer', 'access_manager'], description: 'The grant the caller lacks' })
  permission!: PermissionKind;
}

export const AdminErrors = ({ notFound = true }: { notFound?: boolean } = {}) =>
  applyDecorators(
    ApiBadRequestResponse({ type: AdminErrorDto, description: '`validation_failed`: a malformed ID or code, an unknown field or an invalid value; nothing is saved' }),
    ApiForbiddenResponse({ type: PermissionRequiredDto, description: '`permission_required`: the caller lacks the grant this needs; `account_deletion_pending`' }),
    ...(notFound ? [ApiNotFoundResponse({ type: AdminErrorDto, description: '`not_found`: nothing with this ID or code within the authorised scope' })] : []),
  );
