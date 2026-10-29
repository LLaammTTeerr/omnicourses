import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsDefined, IsIn, IsInt, IsNumber, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateIf, ValidateNested } from 'class-validator';
import { Term, TranscriptEntry } from './transcript-entry.js';

export const MAX_TRANSCRIPT_ROWS = 300;

// ADR 0007: `year` is the first calendar year of the academic year; 3 is the summer term.
export class TermDto implements Term {
  @ApiProperty({ example: 2026, description: 'First calendar year of the academic year: 2026 means 2026–2027.' })
  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @ApiProperty({ enum: [1, 2, 3], description: '1 and 2 are main terms, 3 is the summer term.' })
  @IsIn([1, 2, 3])
  number!: 1 | 2 | 3;
}

export class TranscriptRowDto implements TranscriptEntry {
  @ApiProperty({ example: 'CSC10001' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @IsString()
  @Matches(/^[A-Z0-9]{2,20}$/, { message: 'courseCode must be 2–20 letters or digits' })
  courseCode!: string;

  @ApiProperty({ example: 'Introduction to Programming' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  courseName!: string;

  @ApiProperty({ example: 4, minimum: 0, maximum: 30 })
  @IsInt()
  @Min(0)
  @Max(30)
  credits!: number;

  // Must be sent: null means in progress (UC-02 A3), while a missing grade is an
  // incomplete row that cannot be saved (A2).
  @ApiProperty({ type: Number, nullable: true, example: 8.5, description: '10-point scale, one decimal; null while the course is in progress.' })
  @ValidateIf((row: TranscriptRowDto) => row.grade !== null)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(10)
  grade!: number | null;

  // @ValidateNested() alone lets a missing term through.
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
