import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import type { PermissionKind } from './grant-scope.js';

// Every F12 error carries a stable `code` (ADR 0011, "Validation, errors and removal"), the
// same body shape as `ai_unavailable`, so a client branches on the code, not the message.

export class AdminErrorDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({ example: 'referenced_item' })
  code!: string;

  @ApiProperty({ description: 'English text for the developer; the screen words its own message from `code`' })
  message!: string | string[];
}

export class PermissionRequiredDto extends AdminErrorDto {
  @ApiProperty({ enum: ['program_admin', 'catalog_maintainer', 'access_manager'], description: 'The grant the caller lacks' })
  permission!: PermissionKind;
}

export class PrerequisiteCycleDto extends AdminErrorDto {
  @ApiProperty({ type: [String], example: ['ZZ101', 'ZZ201', 'ZZ101'], description: 'The cycle, from the edited course back to it: each code requires the next' })
  cycle!: string[];
}

export class ReferencedItemDto extends AdminErrorDto {
  @ApiProperty({ type: [String], description: 'What still needs the item, in words' })
  references!: string[];
}

export class AffectedCurriculumDto {
  @ApiProperty({ format: 'uuid' })
  curriculumId!: string;

  @ApiProperty({ example: 'APCS2024' })
  curriculumCode!: string;

  @ApiProperty({ example: 'APCS' })
  programCode!: string;

  @ApiProperty({ example: 2024 })
  cohortYear!: number;
}

export class ImpactConfirmationDto extends AdminErrorDto {
  @ApiProperty({ type: [AffectedCurriculumDto], description: 'Every curriculum that links the course and will read the new values' })
  affectedCurricula!: AffectedCurriculumDto[];

  @ApiProperty({ description: 'Send it back as `confirmImpact` to apply exactly this change to exactly these curricula' })
  reviewVersion!: string;
}

export const permissionRequired = (permission: PermissionKind) =>
  new ForbiddenException({ statusCode: 403, code: 'permission_required', permission, message: `This needs the ${permission} permission` });

export const accountDeletionPending = () =>
  new ForbiddenException({ statusCode: 403, code: 'account_deletion_pending', message: 'An account waiting for deletion cannot administer curricula' });

export const notFound = (message: string) => new NotFoundException({ statusCode: 404, code: 'not_found', message });

export const validationFailed = (message: string | string[]) => new BadRequestException({ statusCode: 400, code: 'validation_failed', message });

export const prerequisiteCycle = (cycle: string[]) =>
  new BadRequestException({ statusCode: 400, code: 'prerequisite_cycle', cycle, message: `Prerequisite cycle: ${cycle.join(' → ')}` });

export const conflict = (code: string, message: string, extra: Record<string, unknown> = {}) =>
  new ConflictException({ statusCode: 409, code, message, ...extra });

export const referencedItem = (message: string, references: string[]) => conflict('referenced_item', message, { references });
