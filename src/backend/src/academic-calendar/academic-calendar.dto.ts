import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, ValidateIf } from 'class-validator';
import { trimString } from '../common/transforms.js';
import { TERM_NUMBERS } from '../terms/term.js';
import { CALENDAR_EVENT_KINDS, type CalendarEventKind } from './academic-calendar-event.entity.js';
import { IsCalendarDate } from './calendar-date.js';

// Request and response shapes of the academic calendar (ADR 0016). Admin requests go through
// StrictBody: a field not declared here is a 400 `validation_failed`, never ignored.

/** Present: validated. Absent: left as it is. */
const ifPresent = ValidateIf((_: object, value: unknown) => value !== undefined);
/** Present and not null: validated. null clears the column. */
const ifSet = ValidateIf((_: object, value: unknown) => value !== undefined && value !== null);
/** Present, not null and not blank: validated. null or '' clears the column (an empty form field). */
const ifFilled = ValidateIf((_: object, value: unknown) => value !== undefined && value !== null && value !== '');

const httpsUrl = IsUrl({ protocols: ['https'], require_protocol: true, require_tld: true }, { message: 'sourceUrl must be an https:// link' });
// IsUrl accepts HTTPS:// too; the database CHECK (LIKE 'https://%') does not, so require lowercase here.
const lowercaseScheme = Matches(/^https:\/\//, { message: 'sourceUrl must start with https://' });

const KIND_DOC = 'term_start, term_end: first and last day of a term; registration: course registration window; add_drop: add/drop window; exam_period: final exams; holiday: no classes; other: anything else';

// ---- Reads (any signed-in user) ------------------------------------------------------------

export class AcademicCalendarQueryDto {
  @ApiProperty({ required: false, example: 'APCS', description: "Program code. Absent: the caller's program from onboarding" })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  program?: string;

  @ApiProperty({ required: false, example: 2026, description: 'Only this academic year (ADR 0009: 2026 is 2026–2027)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
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
  term!: 1 | 2 | 3 | null;

  @ApiProperty({ enum: CALENDAR_EVENT_KINDS, example: 'registration', description: KIND_DOC })
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
  @Min(2000)
  @Max(2100)
  academicYear!: number;

  @ApiProperty({ type: Number, enum: TERM_NUMBERS, nullable: true, required: false, description: 'Absent or null: the whole academic year' })
  @ifSet
  @IsIn(TERM_NUMBERS)
  term?: 1 | 2 | 3 | null;

  @ApiProperty({ enum: CALENDAR_EVENT_KINDS, description: KIND_DOC })
  @IsIn(CALENDAR_EVENT_KINDS)
  kind!: CalendarEventKind;

  @ApiProperty({ type: String, format: 'date', example: '2026-07-20' })
  @IsCalendarDate()
  startsOn!: string;

  @ApiProperty({ type: String, format: 'date', required: false, example: '2026-07-31', description: 'Absent: the same day as startsOn. Never before startsOn' })
  @ifPresent
  @IsCalendarDate()
  endsOn?: string;

  @ApiProperty({ maxLength: 255, example: 'Đăng ký học phần học kỳ 1', description: 'Vietnamese title, as the school words it' })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 255, example: 'Term 1 course registration' })
  @Transform(trimString)
  @ifSet
  @IsString()
  @MaxLength(255)
  titleEn?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 2048, description: "The school's announcement; https only. '' or null: none" })
  @Transform(trimString)
  @ifFilled
  @MaxLength(2048)
  @httpsUrl
  @lowercaseScheme
  sourceUrl?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 2000 })
  @ifSet
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

export class UpdateCalendarEventDto {
  @ApiProperty({ required: false, example: 2026 })
  @ifPresent
  @IsInt()
  @Min(2000)
  @Max(2100)
  academicYear?: number;

  @ApiProperty({ type: Number, enum: TERM_NUMBERS, nullable: true, required: false, description: 'null: the whole academic year' })
  @ifSet
  @IsIn(TERM_NUMBERS)
  term?: 1 | 2 | 3 | null;

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

  @ApiProperty({ required: false, maxLength: 255 })
  @ifPresent
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 255 })
  @Transform(trimString)
  @ifSet
  @IsString()
  @MaxLength(255)
  titleEn?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 2048, description: "https only; '' or null removes it" })
  @Transform(trimString)
  @ifFilled
  @MaxLength(2048)
  @httpsUrl
  @lowercaseScheme
  sourceUrl?: string | null;

  @ApiProperty({ type: String, nullable: true, required: false, maxLength: 2000 })
  @ifSet
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}
