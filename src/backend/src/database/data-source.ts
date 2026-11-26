import pg from 'pg';
import { DataSource, DataSourceOptions } from 'typeorm';
import { databaseUrl, loadEnvFiles } from '../config/env.js';
import { MIGRATIONS } from './migrations/index.js';

pg.types.setTypeParser(pg.types.builtins.DATE, (value: string) => value);

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
