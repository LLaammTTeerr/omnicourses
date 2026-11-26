import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { CourseDto } from '../curriculum/curriculum.dto.js';
import { AffectedCurriculumDto, ImportRowErrorDto } from './admin-errors.js';
import { CSV_MAX_BYTES, CSV_MAX_RECORDS, inMiB } from './csv-file.js';
import { COURSE_FIELDS, type CourseField } from './curriculum-admin.dto.js';

export const CATALOG_FILE = 'catalog_courses';
export const GROUP_LINKS_FILE = 'group_links';

const CSV_DESCRIPTION = `The whole file as text: UTF-8, optional BOM, comma-delimited, LF or CRLF, fields quoted with doubled quotes where needed. At most ${inMiB(CSV_MAX_BYTES)} and ${CSV_MAX_RECORDS.toLocaleString('en')} data records.`;

export class ImportPreviewRequestDto {
  @ApiProperty({ description: CSV_DESCRIPTION })
  @IsString()
  csv!: string;
}

export class ImportConfirmRequestDto {
  @ApiProperty({ description: `${CSV_DESCRIPTION} The file that was previewed. The review version covers the rows after parsing: line endings, spaces around a field and the letter case of a course code do not count, and any other difference is refused.` })
  @IsString()
  csv!: string;

  @ApiProperty({ maxLength: 128, description: 'The reviewVersion of the preview of this file. It is refused once the file, the saved values or the references it covers have changed.' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  reviewVersion!: string;
}

export class ImportSummaryDto {
  @ApiProperty({ example: 12, description: 'Rows that are new' })
  inserts!: number;

  @ApiProperty({ example: 3, description: 'Rows that change a saved course; always 0 for group links' })
  updates!: number;

  @ApiProperty({ example: 40, description: 'Rows equal to what is saved already' })
  noOps!: number;
}

export class CatalogImportRowDto extends CourseDto {
  @ApiProperty({ example: 2, description: 'The logical CSV record; the header is record 1' })
  record!: number;

  @ApiProperty({ enum: ['insert', 'update', 'no_op'], description: 'What confirming would do with this row. The other fields are the normalized values it would save.' })
  action!: 'insert' | 'update' | 'no_op';

  @ApiProperty({ enum: COURSE_FIELDS, isArray: true, description: 'For an update: the fields whose saved value differs' })
  changedFields!: CourseField[];

  @ApiProperty({ type: CourseDto, nullable: true, description: 'For an update: the saved course as it is now. Otherwise null.' })
  current!: CourseDto | null;

  @ApiProperty({ type: [AffectedCurriculumDto], description: 'For an update: every curriculum that links the course and will read the new values' })
  affectedCurricula!: AffectedCurriculumDto[];
}

class ImportPreviewDto {
  @ApiProperty({ type: [ImportRowErrorDto], description: 'Every error of the file, by record. Any error blocks the whole file.' })
  errors!: ImportRowErrorDto[];

  @ApiProperty({ type: ImportSummaryDto, description: 'Counts over `rows`' })
  summary!: ImportSummaryDto;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Send it back with the same csv to the matching confirm route. null while the file has an error: such a file cannot be confirmed.',
  })
  reviewVersion!: string | null;
}

export class CatalogImportPreviewDto extends ImportPreviewDto {
  @ApiProperty({ enum: [CATALOG_FILE] })
  fileType!: typeof CATALOG_FILE;

  @ApiProperty({ type: [CatalogImportRowDto], description: 'The rows without an error, normalized, in file order' })
  rows!: CatalogImportRowDto[];

  @ApiProperty({ type: [AffectedCurriculumDto], description: 'The union over every changed course: each curriculum that will read new values' })
  affectedCurricula!: AffectedCurriculumDto[];
}

export class GroupLinkImportRowDto {
  @ApiProperty({ example: 2, description: 'The logical CSV record; the header is record 1' })
  record!: number;

  @ApiProperty({ enum: ['insert', 'no_op'], description: 'insert: confirming links the course to the group. no_op: it is linked already.' })
  action!: 'insert' | 'no_op';

  @ApiProperty({ description: "The group's name, trimmed; it matched a group of the route's cohort exactly" })
  requirementGroupName!: string;

  @ApiProperty({ format: 'uuid' })
  requirementGroupId!: string;

  @ApiProperty({ example: 'CSC10001', description: 'Trimmed and upper-cased; a course of the catalog' })
  courseCode!: string;
}

export class GroupLinkImportPreviewDto extends ImportPreviewDto {
  @ApiProperty({ enum: [GROUP_LINKS_FILE] })
  fileType!: typeof GROUP_LINKS_FILE;

  @ApiProperty({ format: 'uuid', description: "The route's program; no CSV field can change it" })
  programId!: string;

  @ApiProperty({ format: 'uuid', description: "The route's cohort; no CSV field can change it" })
  curriculumId!: string;

  @ApiProperty({ type: [GroupLinkImportRowDto], description: 'The rows without an error, normalized, in file order' })
  rows!: GroupLinkImportRowDto[];
}

export class ImportResultDto {
  @ApiProperty({ enum: [CATALOG_FILE, GROUP_LINKS_FILE] })
  fileType!: typeof CATALOG_FILE | typeof GROUP_LINKS_FILE;

  @ApiProperty({ type: ImportSummaryDto, description: 'What the one transaction saved' })
  summary!: ImportSummaryDto;
}
