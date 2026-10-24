import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ description: 'The current password, asked again before deleting.' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

export class DeletionScheduledDto {
  @ApiProperty({ type: String, format: 'date-time', description: 'Signing in before this time cancels the deletion.' })
  purgeAfter!: Date;
}

export class AccountExportDto {
  @ApiProperty({ type: String, format: 'date-time' })
  exportedAt!: Date;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'The users row, without credentials.' })
  user!: Record<string, unknown>;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'array', items: { type: 'object', additionalProperties: true } },
    description: 'Every row that references this user, by table name, without credentials.',
  })
  tables!: Record<string, Record<string, unknown>[]>;
}
