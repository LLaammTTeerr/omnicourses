import { ApiProperty } from '@nestjs/swagger';
import { Transform, type TransformFnParams, Type } from 'class-transformer';
import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { TERM_NUMBERS } from '../terms/term.js';
import { NOTIFICATION_KINDS, NOTIFICATION_LINKS, type NotificationKind, type NotificationLink } from './notification-kinds.js';

// Request and response shapes of the notification inbox (ADR 0018). A notification is a kind
// and data: it holds no sentence, no URL, no grade, no course and no rule value.

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 100;

const KIND_DOC =
  'registration_soon: a registration window opens in seven days; registration_open: it opens today; term_start: a term starts today; transcript_changed: the student saved a transcript that differs from the one saved before';

/** A query string is text: only the words true and false are booleans, anything else fails validation. */
const queryBoolean = ({ value }: TransformFnParams): unknown => (value === 'true' ? true : value === 'false' ? false : value);
/** `?kind=a` arrives as a string and `?kind=a&kind=b` as an array. */
const queryList = ({ value }: TransformFnParams): unknown => (value === undefined || Array.isArray(value) ? value : [value]);

export class NotificationsQueryDto {
  @ApiProperty({ required: false, description: 'true: only unread notifications; false: only read ones. Absent: both' })
  @IsOptional()
  @Transform(queryBoolean)
  @IsBoolean()
  unread?: boolean;

  @ApiProperty({ required: false, enum: NOTIFICATION_KINDS, isArray: true, description: `Only these kinds; repeat the parameter for several. ${KIND_DOC}` })
  @IsOptional()
  @Transform(queryList)
  @IsArray()
  @ArrayMaxSize(NOTIFICATION_KINDS.length)
  @ArrayUnique()
  @IsIn(NOTIFICATION_KINDS, { each: true })
  kind?: NotificationKind[];

  @ApiProperty({ required: false, type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE, description: 'How many notifications at most' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit?: number;

  @ApiProperty({ required: false, format: 'uuid', description: 'Only notifications older than this one: send the `nextBefore` of the previous page' })
  @IsOptional()
  @IsUUID()
  before?: string;
}

export class NotificationEventDto {
  @ApiProperty({ format: 'uuid', description: 'The ID of the school date. The date may have been changed or deleted since' })
  id!: string;

  @ApiProperty({ example: 'APCS', description: 'The program whose calendar held the date' })
  programCode!: string;

  @ApiProperty({ example: 2026, description: 'ADR 0009: 2026 is the academic year 2026–2027' })
  academicYear!: number;

  @ApiProperty({ type: Number, enum: TERM_NUMBERS, nullable: true, example: 2, description: 'Term 1, 2 or 3; null for a date of the whole academic year' })
  term!: 1 | 2 | 3 | null;

  @ApiProperty({ type: String, format: 'date', example: '2026-12-09', description: 'First day, inclusive' })
  startsOn!: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-12-20', description: 'Last day, inclusive' })
  endsOn!: string;

  @ApiProperty({ example: 'Đăng ký học phần học kỳ 2' })
  title!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Term 2 course registration' })
  titleEn!: string | null;
}

export class NotificationDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: NOTIFICATION_KINDS, example: 'registration_soon', description: KIND_DOC })
  kind!: NotificationKind;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When the student first marked it read; null while unread' })
  readAt!: Date | null;

  @ApiProperty({
    type: NotificationEventDto,
    nullable: true,
    description:
      'The school date announced, as it was when the notification was made: it does not follow later edits, and it stays when the date is deleted. The calendar holds the current dates. null for transcript_changed',
  })
  event!: NotificationEventDto | null;

  @ApiProperty({
    enum: NOTIFICATION_LINKS,
    isArray: true,
    example: ['calendar', 'planner'],
    description: 'Where the notification can send the student, as keys the screen maps to its own routes; the first is the main action. calendar: the school dates; planner: the plans; audit: the degree audit',
  })
  links!: NotificationLink[];
}

export class NotificationListDto {
  @ApiProperty({ type: [NotificationDto], description: 'Newest first; notifications made at the same instant are ordered by ID, the same way on every read' })
  notifications!: NotificationDto[];

  @ApiProperty({ type: String, format: 'uuid', nullable: true, description: 'Send it as `before` for the next page; null when this page is the last' })
  nextBefore!: string | null;
}

export class UnreadCountDto {
  @ApiProperty({ example: 2, minimum: 0, description: 'How many of the caller\'s notifications are unread' })
  unread!: number;
}

export class NotificationNotFoundDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: 'not_found' })
  code!: string;

  @ApiProperty()
  message!: string;
}
