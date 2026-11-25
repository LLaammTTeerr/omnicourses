import { QueryFailedError } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { failureKind, failureStack } from './failure-kind.js';

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

describe('failureStack', () => {
  it('keeps the frames of an error that is not a database error, and drops the line with its message', () => {
    const error = new TypeError('Cannot read properties of undefined (reading synthetic-id)');
    const stack = failureStack(error);
    expect(stack).toBeDefined();
    expect(stack!.split('\n').every((line) => /^\s+at /.test(line))).toBe(true);
    expect(stack).toContain('failure-kind.spec.ts');
    expect(stack).not.toContain('synthetic-id');
    expect(stack).not.toContain('TypeError');
  });

  it('gives nothing for a refused statement: the class and the SQLSTATE are all it may log', () => {
    const driverError = Object.assign(new Error('violates foreign key constraint'), { code: '23503' });
    expect(failureStack(new QueryFailedError('INSERT INTO "notifications" …', ['synthetic-id'], driverError))).toBeUndefined();
  });

  it('gives nothing for a thrown value that is not an error, or an error without frames', () => {
    expect(failureStack('synthetic')).toBeUndefined();
    expect(failureStack(Object.assign(new Error('synthetic'), { stack: 'Error: synthetic' }))).toBeUndefined();
  });
});
