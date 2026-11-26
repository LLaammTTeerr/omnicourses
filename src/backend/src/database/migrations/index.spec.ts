import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MIGRATIONS } from './index.js';

describe('MIGRATIONS', () => {
  const timestamp = (name: string) => /(\d{13})$/.exec(name)?.[1];

  it('gives every migration a name that is its class name and ends in a timestamp', () => {
    for (const Migration of MIGRATIONS) {
      expect(timestamp(Migration.name), Migration.name).toBeDefined();
      expect(new Migration().name).toBe(Migration.name);
    }
  });

  it('gives every migration a timestamp of its own, since TypeORM would run two with one timestamp in list order without a warning', () => {
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
