import { BadRequestException, ConflictException, ForbiddenException, NotFoundException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
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

export class ImportRowErrorDto {
  @ApiProperty({ example: 3, description: 'The logical CSV record, counting the header as record 1: the row number in a spreadsheet. A blank line is not a record. For malformed quoting: the record where reading stopped.' })
  record!: number;

  @ApiProperty({ type: String, nullable: true, example: 'credits', description: 'The CSV column, or null when the whole record is wrong' })
  field!: string | null;

  @ApiProperty({ example: 'must be an integer number' })
  message!: string;
}

export class ImportRejectedDto extends AdminErrorDto {
  @ApiProperty({ type: [ImportRowErrorDto], required: false, description: 'Present when a CSV file is refused: where it is wrong. Absent for a malformed request body.' })
  errors?: ImportRowErrorDto[];
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

/** A CSV file that cannot be imported whatever the database holds. Nothing of the file is echoed outside `errors`. */
export const importRejected = (message: string, errors: ImportRowErrorDto[]) => new BadRequestException({ statusCode: 400, code: 'validation_failed', message, errors });

/** The JSON body, the decoded CSV or its record count is over an import limit (ADR 0011). */
export const payloadTooLarge = (message: string) => new PayloadTooLargeException({ statusCode: 413, code: 'payload_too_large', message });

/** The import routes read a body as it is sent: they never inflate one (ADR 0011). */
export const compressedBody = () =>
  new UnsupportedMediaTypeException({ statusCode: 415, code: 'unsupported_content_encoding', message: 'The import routes do not accept a compressed request body' });

export const referencedItem = (message: string, references: string[]) => conflict('referenced_item', message, { references });
