import { DataSource } from 'typeorm';
import { databaseUrl } from '../../src/config/env.js';
import { dataSourceOptions } from '../../src/database/data-source.js';

/**
 * A freshly migrated schema of its own, for a test that must start empty or
 * rewrites shared rows. drop() removes it.
 */
export async function privateSchema(prefix: string): Promise<{ schema: string; dataSource: DataSource; drop: () => Promise<void> }> {
  const schema = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const admin = new DataSource({ ...dataSourceOptions, url: databaseUrl() });
  await admin.initialize();
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const dataSource = new DataSource({ ...dataSourceOptions, url: databaseUrl(), schema, extra: { options: `-c search_path=${schema}` } });
  const drop = async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.destroy();
  };
  try {
    await dataSource.initialize();
    await dataSource.runMigrations({ transaction: 'each' });
  } catch (error) {
    await drop();
    throw error;
  }
  return { schema, dataSource, drop };
}
