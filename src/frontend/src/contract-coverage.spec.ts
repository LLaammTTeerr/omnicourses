import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { contractSchemaNames } from './testing/contract.js';
import { sourceFiles } from './testing/files.js';

const CONTRACT_IMPORT = 'testing/contract.js';
const CHECKED_SCHEMA = /(?:contract\w+\(\s*'|\[\s*'(?=\w+',(?:(?!\n\s*\['|\]\)\()[\s\S])*?satisfies Shape))(\w+)'/g;

const NOT_READ_BY_THE_SCREENS = ['NotificationNotFoundDto'];

const checkedSchemas = new Set(
  sourceFiles('.spec.ts')
    .filter((path) => path !== import.meta.filename)
    .map((path) => readFileSync(path, 'utf8'))
    .filter((source) => source.includes(CONTRACT_IMPORT))
    .flatMap((source) => [...source.matchAll(CHECKED_SCHEMA)].map((match) => match[1])),
);

describe('the contract checks cover openapi.json', () => {
  it('names every schema in a contract check of some spec, except the ones no screen reads', () => {
    const unchecked = contractSchemaNames().filter((schema) => !checkedSchemas.has(schema) && !NOT_READ_BY_THE_SCREENS.includes(schema));
    expect(unchecked).toEqual([]);
  });

  it('lists only schemas that exist and have no check, so the list cannot go stale', () => {
    const existing = contractSchemaNames();
    expect(NOT_READ_BY_THE_SCREENS.filter((schema) => !existing.includes(schema) || checkedSchemas.has(schema))).toEqual([]);
  });

  it('finds the checks of the specs it reads', () => {
    expect(checkedSchemas.size).toBeGreaterThan(NOT_READ_BY_THE_SCREENS.length);
  });
});
