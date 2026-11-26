import { seed as seedCurricula } from '../curriculum/seed-curricula.js';
import { seed as seedGuides } from '../guides/seed-guides.js';
import { withDatabase } from './data-source.js';

// `npm run db:seed -w src/backend`: each feature loads its seed data in its own
// transaction (ADR 0010 for the guides). Run db:migrate first.
// `npm run db:seed -w src/backend -- --guide-fixtures` also loads the synthetic zz-* guides
// of TC-B1-GUIDE-01: test databases only, refused when NODE_ENV is production. Seeding again
// without the flag withdraws them.
async function main(): Promise<void> {
  const options = { guideFixtures: process.argv.includes('--guide-fixtures') };
  await withDatabase(async (dataSource) => {
    // Guides first, so a refused --guide-fixtures run stops before anything is written.
    for (const line of await seedGuides(dataSource, options)) console.log(line);
    for (const line of await seedCurricula(dataSource)) console.log(line);
  });
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
