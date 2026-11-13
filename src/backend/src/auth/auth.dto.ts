import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { trimString } from '../common/transforms.js';
import { UserDto } from '../users/user.dto.js';
import { DISPLAY_NAME_MAX_LENGTH, EMAIL_MAX_LENGTH } from '../users/user.entity.js';

export const PASSWORD_MAX_LENGTH = 128;

const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);

export class SignUpDto {
  @ApiProperty({ example: 'student@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(EMAIL_MAX_LENGTH)
  email!: string;

  @ApiProperty({ minLength: 10, maxLength: PASSWORD_MAX_LENGTH, example: 'correct horse battery' })
  @IsString()
  @MinLength(10)
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;

  @ApiProperty({ example: 'Nguyễn Văn A', maxLength: DISPLAY_NAME_MAX_LENGTH })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(DISPLAY_NAME_MAX_LENGTH)
  displayName!: string;

  @ApiProperty({ description: 'Consent to the terms and the privacy notice. Must be true.', example: true })
  @Equals(true, { message: 'acceptedTerms must be true' })
  acceptedTerms!: boolean;
}

export class SignInDto {
  @ApiProperty({ example: 'student@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'correct horse battery' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(PASSWORD_MAX_LENGTH)
  password!: string;
}

export class AuthResultDto {
  @ApiProperty({ description: 'Bearer token. Send as `Authorization: Bearer <token>`.' })
  token!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: Date;

  @ApiProperty({ type: UserDto })
  user!: UserDto;

  @ApiProperty({ description: 'True when this sign-in cancelled a pending account deletion; tell the student.' })
  accountRestored!: boolean;
}

export class SessionDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  userAgent!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  expiresAt!: Date;

  @ApiProperty({ description: 'True for the session making this request.' })
  current!: boolean;
}
