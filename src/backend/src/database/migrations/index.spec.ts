import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from './index.js';

// TypeORM sorts migrations by the 13-digit timestamp that ends the class name, and refuses only
// two migrations with the same name. Two migrations with the same timestamp would run in the
// order of the list, with nothing saying so: two branches can each add one on the same day.
describe('MIGRATIONS', () => {
  const timestamp = (name: string) => /(\d{13})$/.exec(name)?.[1];

  it('gives every migration a name that is its class name and ends in a timestamp', () => {
    for (const Migration of MIGRATIONS) {
      expect(timestamp(Migration.name), Migration.name).toBeDefined();
      expect(new Migration().name).toBe(Migration.name);
    }
  });

  it('gives every migration a timestamp of its own', () => {
    const timestamps = MIGRATIONS.map((Migration) => timestamp(Migration.name));
    expect(timestamps.filter((t, i) => timestamps.indexOf(t) !== i)).toEqual([]);
  });

  it('lists every migration file in the folder', async () => {
    const files = readdirSync(__dirname).filter((name) => /^\d{13}-.+\.ts$/.test(name));
    for (const name of files) {
      const exported: unknown[] = Object.values(await import(`./${name}`));
      expect(MIGRATIONS.some((Migration) => exported.includes(Migration)), name).toBe(true);
    }
    expect(files).toHaveLength(MIGRATIONS.length);
  });
});
