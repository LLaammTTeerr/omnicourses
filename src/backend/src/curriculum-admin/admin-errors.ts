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

export const importRejected = (message: string, errors: ImportRowErrorDto[]) => new BadRequestException({ statusCode: 400, code: 'validation_failed', message, errors });

export const payloadTooLarge = (message: string) => new PayloadTooLargeException({ statusCode: 413, code: 'payload_too_large', message });

export const compressedBody = () =>
  new UnsupportedMediaTypeException({ statusCode: 415, code: 'unsupported_content_encoding', message: 'The import routes do not accept a compressed request body' });

export const referencedItem = (message: string, references: string[]) => conflict('referenced_item', message, { references });

const COUNTED_REFERENCES = {
  prerequisiteLists: 'curricula record its prerequisites',
  requiredBy: 'courses require it',
  offeringTerms: 'offering-term rows name it',
  transcriptRows: 'transcript rows name it',
  plans: 'saved plans place it',
} as const;
export type CountedReference = keyof typeof COUNTED_REFERENCES;

export const REFERENCES = {
  links: (code: string) => `links ${code}`,
  requires: (course: string, code: string) => `${course} requires ${code}`,
  ownPrerequisites: (code: string) => `prerequisites of ${code} are recorded`,
  ownTerms: (code: string) => `offering terms of ${code} are recorded`,
  linkedIn: (curriculumCode: string) => `linked in ${curriculumCode}`,
  groupPlans: (count: number | null) => (count === null ? 'saved plans use it' : `${count} saved plans use it`),
  groupOverflows: (count: number) => `${count} overflow rules name it`,
  groupCombinedMinimums: (count: number) => `${count} combined-minimum rules name it`,
  countingRule: (code: string) => `counting_rule:${code}`,
  counted: (count: number, what: CountedReference) => `${count} ${COUNTED_REFERENCES[what]}`,
} as const;
