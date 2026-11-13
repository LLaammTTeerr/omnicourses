import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from './migrations/index.js';

// ADR 0002: migrations are imported classes, so a file left out of index.ts
// never runs and nothing else would notice.
const DIR = join(__dirname, 'migrations');
const FILES = readdirSync(DIR).filter((name) => /^\d{13}-[a-z0-9-]+\.ts$/.test(name));

describe('migrations', () => {
  it('share the folder with nothing but the index', () => {
    expect(readdirSync(DIR).filter((name) => !FILES.includes(name))).toEqual(['index.ts']);
  });

  it.each(FILES)('%s is registered in MIGRATIONS', async (file) => {
    const exported = Object.values(await import(join(DIR, file)));
    expect(exported).toHaveLength(1);
    expect(MIGRATIONS).toContain(exported[0]);
    // The class carries the file's timestamp, which TypeORM orders migrations by.
    expect((exported[0] as { name: string }).name.endsWith(file.slice(0, 13))).toBe(true);
  });

  it('lists each migration once', () => {
    expect(new Set(MIGRATIONS).size).toBe(FILES.length);
    expect(MIGRATIONS).toHaveLength(FILES.length);
  });
});
