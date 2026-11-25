import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildOpenApiDocument, serializeOpenApi } from './openapi-document.js';

describe('openapi.json', () => {
  it('matches the contract the code builds (run `npm run build && npm run openapi -w src/backend` after an API change)', async () => {
    const committed = readFileSync(join(__dirname, '..', 'openapi.json'), 'utf8');
    expect(serializeOpenApi(await buildOpenApiDocument())).toBe(committed);
  });

  it('documents only 200 and 401 for the two administration reads every signed-in user may call (#160)', async () => {
    const document = await buildOpenApiDocument();
    const answers = (path: string) => Object.keys(document.paths[path]?.get?.responses ?? {}).sort();
    expect(answers('/api/admin/grants')).toEqual(['200', '401']);
    expect(answers('/api/admin/programs')).toEqual(['200', '401']);
  });
});
