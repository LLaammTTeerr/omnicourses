import { DataSource } from 'typeorm';
import { databaseUrl, loadEnvFiles } from '../config/env.js';
import { dataSourceOptions } from './data-source.js';

// `npm run db:migrate -w src/backend`: applies pending migrations, then exits.
async function main(): Promise<void> {
  loadEnvFiles();
  const dataSource = new DataSource({ ...dataSourceOptions, url: databaseUrl() });
  await dataSource.initialize();
  const applied = await dataSource.runMigrations({ transaction: 'each' });
  console.log(applied.length ? `Applied: ${applied.map((m) => m.name).join(', ')}` : 'Database is up to date.');
  await dataSource.destroy();
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
