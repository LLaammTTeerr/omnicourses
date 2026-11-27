import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';
import { ifFilled, NoControlCharacter, NullableTextField, trimString } from '../common/field-validators.js';
import { CLASS_NAME_MAX_LENGTH, STUDENT_ID_LENGTH, User } from './user.entity.js';

export const STUDENT_ID_PATTERN = new RegExp(`^[0-9]{${STUDENT_ID_LENGTH}}$`);

const PRIVACY = 'Typed by the student; shown to them only, exported with the account and never sent to an AI model (ADR 0019).';

export class UserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'student@example.com' })
  email!: string;

  @ApiProperty({ example: 'Nguyễn Văn A' })
  displayName!: string;

  @ApiProperty({ type: String, nullable: true, example: '24120000', description: `Student ID (MSSV), 8 digits. ${PRIVACY}` })
  studentId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '24CTT0', description: `Class name. ${PRIVACY}` })
  className!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  emailVerifiedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  static from(user: User): UserDto {
    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      studentId: user.studentId,
      className: user.className,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    };
  }
}

export class UpdateProfileDto {
  @Matches(STUDENT_ID_PATTERN, { message: `studentId must be exactly ${STUDENT_ID_LENGTH} digits 0-9` })
  @IsString()
  @ifFilled
  @Transform(trimString)
  @ApiProperty({
    type: String,
    nullable: true,
    required: false,
    pattern: STUDENT_ID_PATTERN.source,
    example: '24120000',
    description: 'Student ID (MSSV): exactly 8 ASCII digits. null or a blank string clears it; leaving it out keeps it.',
  })
  studentId?: string | null;

  @NoControlCharacter
  @NullableTextField({ maxLength: CLASS_NAME_MAX_LENGTH, example: '24CTT0', description: 'Class name, trimmed. null or a blank string clears it; leaving it out keeps it.' })
  className?: string | null;
}
