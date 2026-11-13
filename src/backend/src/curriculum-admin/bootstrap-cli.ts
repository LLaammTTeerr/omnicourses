import { DataSource } from 'typeorm';
import { UUID_PATTERN } from '../common/uuid.js';
import { databaseUrl, loadEnvFiles } from '../config/env.js';
import { dataSourceOptions } from '../database/data-source.js';
import { bootstrapAccessManager } from './access-admin.service.js';

// `npm run admin:bootstrap -w src/backend -- --user-id <uuid>` (ADR 0011): makes an existing
// account the first access manager, or the next one after the last was deleted. The Project
// Lead runs it in a trusted deployment shell; it is refused while an active one exists.
async function main(): Promise<void> {
  const at = process.argv.indexOf('--user-id');
  const userId = at > 0 ? process.argv[at + 1] : undefined;
  if (!userId || !UUID_PATTERN.test(userId)) throw new Error('Usage: npm run admin:bootstrap -w src/backend -- --user-id <user-uuid> (GET /api/users/me shows it)');
  loadEnvFiles();
  const dataSource = new DataSource({ ...dataSourceOptions, url: databaseUrl() });
  await dataSource.initialize();
  try {
    await bootstrapAccessManager(dataSource, userId);
    console.log(`${userId} is now an access manager.`);
  } finally {
    await dataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
