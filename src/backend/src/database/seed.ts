import type { Seeder } from '../common/seeder.js';
import { seed as seedCurricula } from '../curriculum/seed-curricula.js';
import { seed as seedGuides } from '../guides/seed-guides.js';
import { withDatabase } from './data-source.js';
import { parseSeedOptions } from './seed-options.js';

const SEEDERS: Seeder[] = [seedGuides, seedCurricula];

async function main(): Promise<void> {
  const options = parseSeedOptions(process.argv);
  await withDatabase(async (dataSource) => {
    for (const seeder of SEEDERS) for (const line of await seeder(dataSource, options)) console.log(line);
  });
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
