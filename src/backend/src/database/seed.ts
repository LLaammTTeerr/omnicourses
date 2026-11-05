import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { vietnamDate } from '../guides/out-of-date.js';
import { guideSeedFiles } from '../guides/seed-files.js';
import { seedGuides } from '../guides/seed-guides.js';
import { dataSourceOptions } from './data-source.js';
import { CATALOG_DECISIONS, CURRICULUM_SEEDS } from './seeds/index.js';
import { seedCurricula } from './seeds/seed-curricula.js';

// `npm run db:seed -w src/backend`: loads the curriculum seed data (insert-only) and the
// guides (ADR 0010), each in one transaction. Run db:migrate first.
// `npm run db:seed -w src/backend -- --guide-fixtures` also loads the synthetic zz-* guides
// of TC-B1-GUIDE-01: test databases only, refused when NODE_ENV is production. Seeding again
// without the flag withdraws them.
async function main(): Promise<void> {
  for (const file of ['.env', '../../.env']) {
    if (existsSync(file) && !process.env.DATABASE_URL) process.loadEnvFile(file);
  }
  const fixtures = process.argv.includes('--guide-fixtures');
  // Checked before connecting, so a refused run changes nothing.
  const files = guideSeedFiles({ fixtures, nodeEnv: process.env.NODE_ENV, today: vietnamDate(new Date()) });
  const dataSource = new DataSource({ ...dataSourceOptions, url: process.env.DATABASE_URL });
  await dataSource.initialize();
  try {
    const report = await seedCurricula(dataSource, CURRICULUM_SEEDS, CATALOG_DECISIONS);
    console.log(`Inserted: ${JSON.stringify(report.inserted)}`);
    console.log(`Already present, left untouched: ${JSON.stringify(report.skipped)}`);
    console.log(`Guides${fixtures ? ', with the test-only zz-* guides' : ''}: ${JSON.stringify(await seedGuides(dataSource, files))}`);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
