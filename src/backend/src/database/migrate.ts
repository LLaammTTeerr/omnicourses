import { existsSync } from 'node:fs';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source.js';

// `npm run db:migrate -w src/backend`: applies pending migrations, then exits.
async function main(): Promise<void> {
  for (const file of ['.env', '../../.env']) {
    if (existsSync(file) && !process.env.DATABASE_URL) process.loadEnvFile(file);
  }
  const dataSource = new DataSource({ ...dataSourceOptions, url: process.env.DATABASE_URL });
  await dataSource.initialize();
  const applied = await dataSource.runMigrations({ transaction: 'each' });
  console.log(applied.length ? `Applied: ${applied.map((m) => m.name).join(', ')}` : 'Database is up to date.');
  await dataSource.destroy();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
