import { BadRequestException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { importRejected, prerequisiteCycle, REFERENCES } from './admin-errors.js';

const body = (error: { getResponse(): string | object }) => JSON.stringify(error.getResponse());

const samples: unknown = JSON.parse(readFileSync(join(__dirname, '..', '..', 'test', 'fixtures', 'admin-references.json'), 'utf8'));

describe('REFERENCES', () => {
  it('builds the sentences of test/fixtures/admin-references.json, which the admin screen reads', () => {
    expect([
      REFERENCES.links('ZZ101'),
      REFERENCES.requires('ZZ201', 'ZZ101'),
      REFERENCES.ownPrerequisites('ZZ101'),
      REFERENCES.ownTerms('ZZ101'),
      REFERENCES.linkedIn('ZZ-PROG-2024'),
      REFERENCES.groupPlans(2),
      REFERENCES.groupPlans(null),
      REFERENCES.counted(3, 'prerequisiteLists'),
      REFERENCES.counted(3, 'requiredBy'),
      REFERENCES.counted(3, 'offeringTerms'),
      REFERENCES.counted(3, 'transcriptRows'),
      REFERENCES.counted(3, 'plans'),
    ]).toEqual(samples);
  });
});

describe('coded admin errors', () => {
  it('puts the cycle of a prerequisite cycle before the message', () => {
    const error = prerequisiteCycle(['A', 'B', 'A']);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(body(error)).toBe('{"statusCode":400,"code":"prerequisite_cycle","cycle":["A","B","A"],"message":"Prerequisite cycle: A → B → A"}');
  });

  it('puts the row errors of a rejected import after the message', () => {
    const error = importRejected('Bad file', [{ record: 2, field: null, message: 'wrong' }]);
    expect(error).toBeInstanceOf(BadRequestException);
    expect(error.getStatus()).toBe(400);
    expect(body(error)).toBe('{"statusCode":400,"code":"validation_failed","message":"Bad file","errors":[{"record":2,"field":null,"message":"wrong"}]}');
  });
});
