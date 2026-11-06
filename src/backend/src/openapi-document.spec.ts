import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument, serializeOpenApi } from './openapi-document.js';

describe('openapi.json', () => {
  it('matches the contract the code builds (run `npm run build && npm run openapi -w src/backend` after an API change)', async () => {
    const committed = readFileSync(join(__dirname, '..', 'openapi.json'), 'utf8');
    expect(serializeOpenApi(await buildOpenApiDocument())).toBe(committed);
  });
});
