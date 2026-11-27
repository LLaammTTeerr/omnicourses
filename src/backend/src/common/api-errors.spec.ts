import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { importRejected, prerequisiteCycle } from '../curriculum-admin/admin-errors.js';
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

  it('puts the cycle of a prerequisite cycle before the message', () => {
    const error = prerequisiteCycle(['A', 'B', 'A']);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(body(error)).toBe('{"statusCode":400,"code":"prerequisite_cycle","cycle":["A","B","A"],"message":"Prerequisite cycle: A → B → A"}');
  });

  it('puts the row errors of a rejected import after the message', () => {
    const error = importRejected('Bad file', [{ record: 2, field: null, message: 'wrong' }]);
    expect(error.getStatus()).toBe(400);
    expect(body(error)).toBe('{"statusCode":400,"code":"validation_failed","message":"Bad file","errors":[{"record":2,"field":null,"message":"wrong"}]}');
  });

  it('adds nothing when there are no extra fields', () => {
    expect(body(forbidden('x', 'm'))).toBe('{"statusCode":403,"code":"x","message":"m"}');
    expect(body(conflict('x', 'm'))).toBe('{"statusCode":409,"code":"x","message":"m"}');
  });
});
