import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { uuidParam } from './admin-params.js';

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
