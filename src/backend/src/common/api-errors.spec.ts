import { ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { conflict, forbidden } from './api-errors.js';

const body = (error: { getResponse(): string | object }) => JSON.stringify(error.getResponse());

describe('coded API errors', () => {
  it('puts the extra field of a 403 before the message', () => {
    const error = forbidden('permission_required', 'No access', { permission: 'curriculum.write' });
    expect(error).toBeInstanceOf(ForbiddenException);
    expect(error.getStatus()).toBe(403);
    expect(body(error)).toBe('{"statusCode":403,"code":"permission_required","permission":"curriculum.write","message":"No access"}');
  });

  it('puts the extra field of a 409 after the message', () => {
    const error = conflict('referenced_item', 'In use', { references: ['one'] });
    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getStatus()).toBe(409);
    expect(body(error)).toBe('{"statusCode":409,"code":"referenced_item","message":"In use","references":["one"]}');
  });

  it('adds nothing when there are no extra fields', () => {
    expect(body(forbidden('x', 'm'))).toBe('{"statusCode":403,"code":"x","message":"m"}');
    expect(body(conflict('x', 'm'))).toBe('{"statusCode":409,"code":"x","message":"m"}');
  });
});
