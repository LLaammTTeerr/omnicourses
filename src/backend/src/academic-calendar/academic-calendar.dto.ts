import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Matches, Max, Min } from 'class-validator';
import { ifFilled, ifPresent, ifSet, IsCalendarDate, MaxCodePoints, NoNullCharacter, trimString } from '../common/field-validators.js';
import { ADMIN_CODE_MAX_LENGTH } from '../curriculum-admin/program-admin.dto.js';
import { MAX_ACADEMIC_YEAR, MIN_ACADEMIC_YEAR, TERM_NUMBERS, type TermNumber } from '../terms/term.js';
import {
  CALENDAR_EVENT_KIND_DOC,
  CALENDAR_EVENT_KINDS,
  type CalendarEventKind,
  SOURCE_URL_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from './academic-calendar-event.entity.js';

// Request and response shapes of the academic calendar (ADR 0017). Admin requests go through
// StrictBody: a field not declared here is a 400 `validation_failed`, never ignored.

const httpsUrl = IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true }, { message: 'sourceUrl must be an https:// link' });
// IsUrl accepts HTTPS:// too; the database CHECK (LIKE 'https://%') does not, so require lowercase here.
const lowercaseScheme = Matches(/^https:\/\//, { message: 'sourceUrl must start with https://' });

const NOTES_MAX_LENGTH = 2000;

// ---- Reads (any signed-in user) ------------------------------------------------------------

export class AcademicCalendarQueryDto {
  @ApiProperty({ required: false, example: 'APCS', description: "Program code. Absent: the caller's program from onboarding" })
  @IsOptional()
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(ADMIN_CODE_MAX_LENGTH)
  program?: string;

  @ApiProperty({ required: false, example: 2026, description: 'Only this academic year (ADR 0009: 2026 is 2026–2027)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(MIN_ACADEMIC_YEAR)
  @Max(MAX_ACADEMIC_YEAR)
  academicYear?: number;

  @ApiProperty({ required: false, example: '2026-09-01', description: 'Only dates that end on or after this day (YYYY-MM-DD)' })
  @IsOptional()
  @IsCalendarDate()
  from?: string;

  @ApiProperty({ required: false, example: '2027-01-31', description: 'Only dates that start on or before this day (YYYY-MM-DD)' })
  @IsOptional()
  @IsCalendarDate()
  to?: string;
}

export class CalendarProgramDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'APCS' })
  code!: string;

  @ApiProperty({ example: 'Chương trình Tiên tiến ngành Khoa học Máy tính' })
  nameVi!: string;

  @ApiProperty({ type: String, nullable: true })
  nameEn!: string | null;
}

export class AcademicCalendarEventDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 2026, description: 'ADR 0009: 2026 is the academic year 2026–2027' })
  academicYear!: number;

  @ApiProperty({ type: Number, enum: TERM_NUMBERS, nullable: true, example: 1, description: 'Term 1, 2 or 3; null for a date of the whole academic year' })
  term!: TermNumber | null;

  @ApiProperty({ enum: CALENDAR_EVENT_KINDS, example: 'registration', description: CALENDAR_EVENT_KIND_DOC })
  kind!: CalendarEventKind;

  @ApiProperty({ type: String, format: 'date', example: '2026-07-20', description: 'First day, inclusive' })
  startsOn!: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-07-31', description: 'Last day, inclusive; equals startsOn for a one-day date' })
  endsOn!: string;

  @ApiProperty({ example: 'Đăng ký học phần học kỳ 1' })
  title!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Term 1 course registration' })
  titleEn!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'https://example.edu.vn/thong-bao/dang-ky-hk1', description: "The school's announcement (https)" })
  sourceUrl!: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class AcademicCalendarDto {
  @ApiProperty({ type: CalendarProgramDto, nullable: true, description: 'null when no program was asked for and the caller has not chosen one in onboarding' })
  program!: CalendarProgramDto | null;

  @ApiProperty({ type: [AcademicCalendarEventDto], description: 'By startsOn, then endsOn, then title; [] when nothing is entered' })
  events!: AcademicCalendarEventDto[];
}

// ---- Writes (program administrator of that program) ----------------------------------------

export class CreateCalendarEventDto {
  @ApiProperty({ example: 2026, description: 'ADR 0009: 2026 is 2026–2027. startsOn must fall in 2026 or 2027' })
  @IsInt()
  @Min(MIN_ACADEMIC_YEAR)
  @Max(MAX_ACADEMIC_YEAR)
  academicYear!: number;

  @ApiProperty({ type: Number, enum: TERM_NUMBERS, nullable: true, required: false, description: 'Absent or null: the whole academic year' })
  @ifSet
  @IsIn(TERM_NUMBERS)
  term?: TermNumber | null;

  @ApiProperty({ enum: CALENDAR_EVENT_KINDS, description: CALENDAR_EVENT_KIND_DOC })
  @IsIn(CALENDAR_EVENT_KINDS)
  kind!: CalendarEventKind;

  @ApiProperty({ type: String, format: 'date', example: '2026-07-20' })
  @IsCalendarDate()
  startsOn!: string;

  @ApiProperty({ type: String, format: 'date', required: false, example: '2026-07-31', description: 'Absent: the same day as startsOn. Never before startsOn' })
  @ifPresent
  @IsCalendarDate()
  endsOn?: string;

  @ApiProperty({ maxLength: TITLE_MAX_LENGTH, example: 'Đăng ký học phần học kỳ 1', description: 'Vietnamese title, as the school words it' })
  @Transform(trimString)
  @IsString()
  @NoNullCharacter
  @IsNotEmpty()
  @MaxCodePoints(TITLE_MAX_LENGTH)
  title!: string;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: TITLE_MAX_LENGTH, example: 'Term 1 course registration' })
  @Transform(trimString)
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(TITLE_MAX_LENGTH)
  titleEn?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: SOURCE_URL_MAX_LENGTH, description: "The school's announcement; https only. '' or null: none" })
  @Transform(trimString)
  @ifFilled
  @NoNullCharacter
  @MaxCodePoints(SOURCE_URL_MAX_LENGTH)
  @httpsUrl
  @lowercaseScheme
  sourceUrl?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: NOTES_MAX_LENGTH })
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(NOTES_MAX_LENGTH)
  notes?: string | null;
}

export class UpdateCalendarEventDto {
  @ApiProperty({ required: false, example: 2026 })
  @ifPresent
  @IsInt()
  @Min(MIN_ACADEMIC_YEAR)
  @Max(MAX_ACADEMIC_YEAR)
  academicYear?: number;

  @ApiProperty({ type: Number, enum: TERM_NUMBERS, nullable: true, required: false, description: 'null: the whole academic year' })
  @ifSet
  @IsIn(TERM_NUMBERS)
  term?: TermNumber | null;

  @ApiProperty({ enum: CALENDAR_EVENT_KINDS, required: false })
  @ifPresent
  @IsIn(CALENDAR_EVENT_KINDS)
  kind?: CalendarEventKind;

  @ApiProperty({ type: String, format: 'date', required: false, description: 'Checked against the stored endsOn when sent alone' })
  @ifPresent
  @IsCalendarDate()
  startsOn?: string;

  @ApiProperty({ type: String, format: 'date', required: false, description: 'Checked against the stored startsOn when sent alone' })
  @ifPresent
  @IsCalendarDate()
  endsOn?: string;

  @ApiProperty({ required: false, maxLength: TITLE_MAX_LENGTH })
  @ifPresent
  @Transform(trimString)
  @IsString()
  @NoNullCharacter
  @IsNotEmpty()
  @MaxCodePoints(TITLE_MAX_LENGTH)
  title?: string;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: TITLE_MAX_LENGTH })
  @Transform(trimString)
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(TITLE_MAX_LENGTH)
  titleEn?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: SOURCE_URL_MAX_LENGTH, description: "https only; '' or null removes it" })
  @Transform(trimString)
  @ifFilled
  @NoNullCharacter
  @MaxCodePoints(SOURCE_URL_MAX_LENGTH)
  @httpsUrl
  @lowercaseScheme
  sourceUrl?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: NOTES_MAX_LENGTH })
  @ifSet
  @IsString()
  @NoNullCharacter
  @MaxCodePoints(NOTES_MAX_LENGTH)
  notes?: string | null;
}
