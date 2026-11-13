import { runCli } from './data-source.js';

// `npm run db:migrate -w src/backend`: applies pending migrations, then exits.
void runCli(async (dataSource) => {
  const applied = await dataSource.runMigrations({ transaction: 'each' });
  console.log(applied.length ? `Applied: ${applied.map((m) => m.name).join(', ')}` : 'Database is up to date.');
});
