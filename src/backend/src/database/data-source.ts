import pg from 'pg';
import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseUrl, loadEnvFiles } from '../config/env.js';
import { MIGRATIONS } from './migrations/index.js';

// A PostgreSQL `date` is a calendar day, not an instant. node-postgres would read it as a Date at
// local midnight, so a raw query on a server at UTC+7 turned 2026-11-25 into
// "2026-11-24T17:00:00.000Z" (issue #174). Keep the 'YYYY-MM-DD' text PostgreSQL sends. TypeORM
// already hands a 'date' entity column a string, and passes a string through unchanged.
// For every connection in this process; every entry point imports this file.
pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

// Entities are registered by their feature modules (TypeOrmModule.forFeature).
export const dataSourceOptions = {
  type: 'postgres',
  migrations: MIGRATIONS,
  synchronize: false,
} satisfies DataSourceOptions;

export const connectionOptions = () => ({ ...dataSourceOptions, url: databaseUrl() });

export const migrate = (dataSource: DataSource) => dataSource.runMigrations({ transaction: 'each' });

export async function withDatabase<T>(work: (dataSource: DataSource) => Promise<T>): Promise<T> {
  loadEnvFiles();
  const dataSource = await new DataSource(connectionOptions()).initialize();
  try {
    return await work(dataSource);
  } finally {
    await dataSource.destroy();
  }
}
