import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { codedError, type CodedErrorBody } from '../common/coded-error.js';
import type { PermissionKind } from './grant-scope.js';

// Every F12 error carries a stable `code` (ADR 0011, "Validation, errors and removal"): the
// coded body of common/coded-error.ts, so a client branches on the code, not the message.

export class AdminErrorDto implements CodedErrorBody {
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
  codedError(ForbiddenException, 'permission_required', `This needs the ${permission} permission`, { permission });

export const accountDeletionPending = () =>
  codedError(ForbiddenException, 'account_deletion_pending', 'An account waiting for deletion cannot administer curricula');

export const notFound = (message: string) => codedError(NotFoundException, 'not_found', message);

export const validationFailed = (message: string | string[]) => codedError(BadRequestException, 'validation_failed', message);

export const prerequisiteCycle = (cycle: string[]) =>
  codedError(BadRequestException, 'prerequisite_cycle', `Prerequisite cycle: ${cycle.join(' → ')}`, { cycle });

export const conflict = (code: string, message: string, extra: Record<string, unknown> = {}) => codedError(ConflictException, code, message, extra);

export const referencedItem = (message: string, references: string[]) => conflict('referenced_item', message, { references });
