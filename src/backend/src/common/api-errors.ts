import { BadRequestException, ConflictException, ForbiddenException, type HttpException, NotFoundException } from '@nestjs/common';
import { ApiProperty } from '@nestjs/swagger';

export class AdminErrorDto {
  @ApiProperty({ example: 409 })
  statusCode!: number;

  @ApiProperty({ example: 'referenced_item' })
  code!: string;

  @ApiProperty({ description: 'English text for the developer; the screen words its own message from `code`' })
  message!: string | string[];
}

type Fields = Record<string, unknown>;

export const codedError = <T extends HttpException>(
  Exception: new (body: object) => T,
  statusCode: number,
  code: string,
  message: string | string[],
  { before = {}, after = {} }: { before?: Fields; after?: Fields } = {},
): T => new Exception({ statusCode, code, ...before, message, ...after });

export const notFound = (message: string) => codedError(NotFoundException, 404, 'not_found', message);

export const validationFailed = (message: string | string[]) => codedError(BadRequestException, 400, 'validation_failed', message);

export const conflict = (code: string, message: string, extra: Fields = {}) => codedError(ConflictException, 409, code, message, { after: extra });

export const forbidden = (code: string, message: string, extra: Fields = {}) => codedError(ForbiddenException, 403, code, message, { before: extra });
