import { databaseUrl, loadEnvFiles } from '../../src/config/env.js';

loadEnvFiles();
// End-to-end tests need PostgreSQL: without it they fail, they never skip.
if (!databaseUrl()) throw new Error('Set DATABASE_URL, in the environment or in .env, to run the e2e tests.');
