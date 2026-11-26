import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FEATURE_MODULES } from './features.js';
import { buildOpenApiDocument, serializeOpenApi } from './openapi-document.js';

describe('openapi.json', () => {
  it('matches the contract the code builds (run `npm run build && npm run openapi -w src/backend` after an API change)', async () => {
    const committed = readFileSync(join(__dirname, '..', 'openapi.json'), 'utf8');
    expect(serializeOpenApi(await buildOpenApiDocument())).toBe(committed);
  });

  it('does not depend on the order of the feature modules', async () => {
    const committed = readFileSync(join(__dirname, '..', 'openapi.json'), 'utf8');
    expect(serializeOpenApi(await buildOpenApiDocument([...FEATURE_MODULES].reverse()))).toBe(committed);
  });

  it('lists the paths and the component schemas sorted by name', async () => {
    const document = await buildOpenApiDocument();
    const sorted = (keys: string[]) => [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(Object.keys(document.paths)).toEqual(sorted(Object.keys(document.paths)));
    const schemas = Object.keys(document.components?.schemas ?? {});
    expect(schemas).toEqual(sorted(schemas));
    expect(Object.keys(document.paths['/api/users/me'] ?? {})).toEqual(['get', 'delete']);
  });

  it('documents only 200 and 401 for the two administration reads every signed-in user may call (#160)', async () => {
    const document = await buildOpenApiDocument();
    const answers = (path: string) => Object.keys(document.paths[path]?.get?.responses ?? {}).sort();
    expect(answers('/api/admin/grants')).toEqual(['200', '401']);
    expect(answers('/api/admin/programs')).toEqual(['200', '401']);
  });
});
