import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export class AdminErrorDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({ example: 'referenced_item' })
  code!: string;

  @ApiProperty({ description: 'English text for the developer; the screen words its own message from `code`' })
  message!: string | string[];
}

export const notFound = (message: string) => new NotFoundException({ statusCode: 404, code: 'not_found', message });

export const validationFailed = (message: string | string[]) => new BadRequestException({ statusCode: 400, code: 'validation_failed', message });

export const conflict = (code: string, message: string, extra: Record<string, unknown> = {}) =>
  new ConflictException({ statusCode: 409, code, message, ...extra });
