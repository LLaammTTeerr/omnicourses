import { BadRequestException, PayloadTooLargeException, UnsupportedMediaTypeException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';
import { AdminErrorDto, conflict } from '../common/api-errors.js';

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

export const prerequisiteCycle = (cycle: string[]) =>
  new BadRequestException({ statusCode: 400, code: 'prerequisite_cycle', cycle, message: `Prerequisite cycle: ${cycle.join(' → ')}` });

/** A CSV file that cannot be imported whatever the database holds. Nothing of the file is echoed outside `errors`. */
export const importRejected = (message: string, errors: ImportRowErrorDto[]) => new BadRequestException({ statusCode: 400, code: 'validation_failed', message, errors });

/** The JSON body, the decoded CSV or its record count is over an import limit (ADR 0011). */
export const payloadTooLarge = (message: string) => new PayloadTooLargeException({ statusCode: 413, code: 'payload_too_large', message });

/** The import routes read a body as it is sent: they never inflate one (ADR 0011). */
export const compressedBody = () =>
  new UnsupportedMediaTypeException({ statusCode: 415, code: 'unsupported_content_encoding', message: 'The import routes do not accept a compressed request body' });

export const referencedItem = (message: string, references: string[]) => conflict('referenced_item', message, { references });
