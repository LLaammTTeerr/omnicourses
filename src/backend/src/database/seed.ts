import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source.js';
import { CATALOG_DECISIONS, CURRICULUM_SEEDS } from './seeds/index.js';
import { seedCurricula } from './seeds/seed-curricula.js';

// `npm run db:seed -w src/backend`: loads the curriculum seed data, insert-only,
// in one transaction. Run db:migrate first.
async function main(): Promise<void> {
  for (const file of ['.env', '../../.env']) {
    if (existsSync(file) && !process.env.DATABASE_URL) process.loadEnvFile(file);
  }
  const dataSource = new DataSource({ ...dataSourceOptions, url: process.env.DATABASE_URL });
  await dataSource.initialize();
  try {
    const report = await seedCurricula(dataSource, CURRICULUM_SEEDS, CATALOG_DECISIONS);
    console.log(`Inserted: ${JSON.stringify(report.inserted)}`);
    console.log(`Already present, left untouched: ${JSON.stringify(report.skipped)}`);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
