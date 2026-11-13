// @vitest-environment node
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createClient } from '@hey-api/openapi-ts';
import { describe, expect, it } from 'vitest';
import { API_SCHEMA_DIR, apiSchemaConfig } from '../openapi-ts.config.js';

// ADR 0018: the API types are generated from src/backend/openapi.json and committed. This regenerates them from the
// contract as it stands and fails while the committed module differs, so a contract change cannot leave the client's
// types behind. Fix a failure with `npm run generate:api -w src/frontend`, never by editing the generated file.

describe('the generated API types', () => {
  it('match src/backend/openapi.json', async () => {
    const fresh = await mkdtemp(join(tmpdir(), 'omnicourse-api-schema-'));
    try {
      await createClient(apiSchemaConfig(fresh));
      const files = await readdir(fresh);
      expect(await readdir(API_SCHEMA_DIR)).toEqual(files);
      for (const file of files) {
        const committed = await readFile(join(API_SCHEMA_DIR, file), 'utf8');
        expect(committed, `src/api-schema/${file} is stale: run \`npm run generate:api -w src/frontend\``).toBe(await readFile(join(fresh, file), 'utf8'));
      }
    } finally {
      await rm(fresh, { recursive: true, force: true });
    }
  }, 30_000);
});
