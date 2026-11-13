import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseUrl, loadEnvFiles } from '../config/env.js';
import { MIGRATIONS } from './migrations/index.js';

// Entities are registered by their feature modules (TypeOrmModule.forFeature).
// Without a URL: the OpenAPI document is built from it with no database.
export const dataSourceOptions = {
  type: 'postgres',
  migrations: MIGRATIONS,
  synchronize: false,
} satisfies DataSourceOptions;

export const connectionOptions = () => ({ ...dataSourceOptions, url: databaseUrl() });

/**
 * The body of every `npm run db:*` job: loads the env files, connects, runs
 * `work`, disconnects. On a failure it prints only the error's message (no
 * stack, no query parameters) and exits with code 1.
 */
export function runCli(work: (dataSource: DataSource) => Promise<void>): Promise<void> {
  return withDataSource(work).catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

async function withDataSource(work: (dataSource: DataSource) => Promise<void>): Promise<void> {
  loadEnvFiles();
  const dataSource = new DataSource(connectionOptions());
  await dataSource.initialize();
  try {
    await work(dataSource);
  } finally {
    await dataSource.destroy();
  }
}
