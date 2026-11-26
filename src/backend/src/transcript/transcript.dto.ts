import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDefined, IsIn, IsInt, IsNumber, IsString, Matches, Max, Min, MinLength, ValidateBy, ValidateIf, ValidateNested } from 'class-validator';
import { COURSE_CODE_PATTERN } from '../common/course-code.js';
import { MaxCodePoints, NoNullCharacter, TermDto, trimString } from '../common/field-validators.js';
import { COURSE_NAME_MAX_LENGTH } from './transcript-row.entity.js';
import { TRANSCRIPT_RESULTS, TranscriptEntry, TranscriptResult } from './transcript-entry.js';

export const MAX_TRANSCRIPT_ROWS = 300;
const MAX_ROW_CREDITS = 30;
const MAX_GRADE = 10;

export class TranscriptRowDto implements TranscriptEntry {
  @ApiProperty({ example: 'CSC10001' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(COURSE_CODE_PATTERN, { message: 'courseCode must be 2–20 letters or digits' })
  courseCode!: string;

  @ApiProperty({ example: 'Introduction to Programming' })
  @Transform(trimString)
  @IsString()
  @NoNullCharacter
  @MinLength(1)
  @MaxCodePoints(COURSE_NAME_MAX_LENGTH)
  courseName!: string;

  @ApiProperty({ example: 4, minimum: 0, maximum: MAX_ROW_CREDITS })
  @IsInt()
  @Min(0)
  @Max(MAX_ROW_CREDITS)
  credits!: number;

  @ApiProperty({
    enum: TRANSCRIPT_RESULTS,
    example: 'graded',
    description: 'graded: the grade is set. in_progress (UC-02 A3), exempt, pass, fail: no grade.',
  })
  @IsIn(TRANSCRIPT_RESULTS)
  result!: TranscriptResult;

  @ApiProperty({ type: Number, nullable: true, required: false, example: 8.5, description: '10-point scale, one decimal. Required when result is graded; null otherwise.' })
  @ValidateIf((row: TranscriptRowDto) => row.result === 'graded' || (row.grade !== null && row.grade !== undefined))
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(MAX_GRADE)
  @ValidateBy({
    name: 'nullUnlessGraded',
    validator: {
      validate: (_grade, args) => {
        const { result } = args?.object as TranscriptRowDto;
        return result === 'graded' || !(TRANSCRIPT_RESULTS as readonly unknown[]).includes(result);
      },
      defaultMessage: () => 'grade must be null unless result is graded',
    },
  })
  grade!: number | null;

  @ApiProperty({ type: TermDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => TermDto)
  term!: TermDto;
}

export class TranscriptDto {
  @ApiProperty({ type: [TranscriptRowDto], description: `The whole transcript, at most ${MAX_TRANSCRIPT_ROWS} rows. A retaken course has one row per attempt.` })
  @IsArray()
  @ArrayMaxSize(MAX_TRANSCRIPT_ROWS)
  @ValidateNested({ each: true })
  @Type(() => TranscriptRowDto)
  rows!: TranscriptRowDto[];
}
