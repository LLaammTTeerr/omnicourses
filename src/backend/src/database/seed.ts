import { DataSource } from 'typeorm';
import { databaseUrl, loadEnvFiles } from '../config/env.js';
import { seed as seedGuides } from '../guides/seed-guides.js';
import { dataSourceOptions } from './data-source.js';
import { seed as seedCurricula } from './seeds/index.js';

// `npm run db:seed -w src/backend`: each feature loads its seed data in its own
// transaction (ADR 0010 for the guides). Run db:migrate first.
// `npm run db:seed -w src/backend -- --guide-fixtures` also loads the synthetic zz-* guides
// of TC-B1-GUIDE-01: test databases only, refused when NODE_ENV is production. Seeding again
// without the flag withdraws them.
async function main(): Promise<void> {
  loadEnvFiles();
  const options = { guideFixtures: process.argv.includes('--guide-fixtures') };
  const dataSource = new DataSource({ ...dataSourceOptions, url: databaseUrl() });
  await dataSource.initialize();
  try {
    // Guides first, so a refused --guide-fixtures run stops before anything is written.
    for (const line of await seedGuides(dataSource, options)) console.log(line);
    for (const line of await seedCurricula(dataSource)) console.log(line);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
