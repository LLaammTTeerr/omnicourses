import { QueryFailedError } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { failureKind } from './failure-kind.js';

describe('failureKind', () => {
  it('names the class of an error and nothing of its message', () => {
    expect(failureKind(new Error('Key (user_id)=(synthetic-id) is not present'))).toBe('Error');
    expect(failureKind(new TypeError('synthetic'))).toBe('TypeError');
  });

  it('adds the SQLSTATE of a refused statement, and neither the statement nor its parameters', () => {
    const driverError = Object.assign(new Error('insert or update on table "notifications" violates foreign key constraint'), { code: '23503', detail: 'Key (user_id)=(synthetic-id) is not present in table "users".' });
    const error = new QueryFailedError('INSERT INTO "notifications" …', ['synthetic-id', 'Synthetic title'], driverError);
    expect(failureKind(error)).toBe('QueryFailedError, SQLSTATE 23503');
  });

  it('leaves out a code that is not a SQLSTATE', () => {
    expect(failureKind(Object.assign(new Error('synthetic'), { driverError: { code: 'ECONNREFUSED' } }))).toBe('Error');
    expect(failureKind(Object.assign(new Error('synthetic'), { driverError: { code: 23503 } }))).toBe('Error');
  });

  it('names the type of a thrown value that is not an error', () => {
    expect(failureKind('synthetic')).toBe('string');
    expect(failureKind(null)).toBe('object');
    expect(failureKind(undefined)).toBe('undefined');
  });
});
