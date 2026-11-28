import { BadRequestException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { UuidOr404Pipe, uuidParam } from './api-requests.js';

const meta = { type: 'param', data: 'programId' } as const;

describe('uuidParam', () => {
  it('hands the handler a UUID in lower case, whatever case the path used', async () => {
    const id = '0f8e7d6c-5b4a-4321-8fed-cba987654321';
    await expect(uuidParam('programId').transform(id.toUpperCase(), meta)).resolves.toBe(id);
    await expect(uuidParam('programId').transform(id, meta)).resolves.toBe(id);
  });

  it('refuses a value that is not a UUID with validation_failed, naming the parameter', async () => {
    const refused = uuidParam('programId').transform('not-a-uuid', meta);
    await expect(refused).rejects.toBeInstanceOf(BadRequestException);
    await expect(refused).rejects.toMatchObject({ response: { code: 'validation_failed', message: 'programId: must be a UUID' } });
  });
});

describe('UuidOr404Pipe', () => {
  it('answers 404 for a malformed plan id, as for an unknown one, and lower-cases a valid one', () => {
    const pipe = new UuidOr404Pipe(() => new NotFoundException('No plan with this id'));
    for (const id of ['not-a-uuid', '1', "' OR 1=1 --"]) expect(() => pipe.transform(id)).toThrow(NotFoundException);
    expect(pipe.transform('3F2B8C1E-0D4A-4C6B-9E1F-2A3B4C5D6E7F')).toBe('3f2b8c1e-0d4a-4c6b-9e1f-2a3b4c5d6e7f');
  });
});
