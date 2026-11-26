import { seed as seedCurricula } from '../curriculum/seed-curricula.js';
import { seed as seedGuides } from '../guides/seed-guides.js';
import { withDatabase } from './data-source.js';

async function main(): Promise<void> {
  const options = { guideFixtures: process.argv.includes('--guide-fixtures') };
  await withDatabase(async (dataSource) => {
    for (const line of await seedGuides(dataSource, options)) console.log(line);
    for (const line of await seedCurricula(dataSource)) console.log(line);
  });
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
