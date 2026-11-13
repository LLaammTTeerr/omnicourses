import { SEEDERS } from '../seeders.js';
import { runCli } from './data-source.js';

// `npm run db:seed -w src/backend`: runs each feature's seeder (ADR 0010 for the guides).
// Run db:migrate first.
// `npm run db:seed -w src/backend -- --guide-fixtures` also loads the synthetic zz-* guides
// of TC-B1-GUIDE-01: test databases only, refused when NODE_ENV is production. Seeding again
// without the flag withdraws them.
const options = { guideFixtures: process.argv.includes('--guide-fixtures') };

void runCli(async (dataSource) => {
  for (const seed of SEEDERS) for (const line of await seed(dataSource, options)) console.log(line);
});
