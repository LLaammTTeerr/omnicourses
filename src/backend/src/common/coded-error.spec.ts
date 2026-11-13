import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { codedError } from './coded-error.js';

describe('codedError', () => {
  it('builds the exception with the coded body and its own status', () => {
    const error = codedError(ConflictException, 'referenced_item', 'In use', { references: ['a plan'] });
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getStatus()).toBe(409);
    expect(error.getResponse()).toEqual({ statusCode: 409, code: 'referenced_item', message: 'In use', references: ['a plan'] });
  });

  it('keeps a list of messages and takes the status of each exception class', () => {
    expect(codedError(BadRequestException, 'validation_failed', ['a', 'b']).getResponse()).toEqual({ statusCode: 400, code: 'validation_failed', message: ['a', 'b'] });
    expect(codedError(ForbiddenException, 'permission_required', 'No').getResponse()).toMatchObject({ statusCode: 403 });
  });

});
