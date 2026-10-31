import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { Equals, IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { UserDto } from '../users/user.dto.js';

const normalizeEmail = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class SignUpDto {
  @ApiProperty({ example: 'student@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ minLength: 10, maxLength: 128, example: 'correct horse battery' })
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ example: 'Nguyễn Văn A', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
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
  @MaxLength(128)
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
