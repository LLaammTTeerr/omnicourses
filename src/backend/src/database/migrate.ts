import { migrate, withDatabase } from './data-source.js';

// `npm run db:migrate -w src/backend`: applies pending migrations, then exits.
async function main(): Promise<void> {
  await withDatabase(async (dataSource) => {
    const applied = await migrate(dataSource);
    console.log(applied.length ? `Applied: ${applied.map((m) => m.name).join(', ')}` : 'Database is up to date.');
  });
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
