import { databaseUrl, loadEnvFiles } from '../../src/config/env.js';

loadEnvFiles();
if (!databaseUrl()) throw new Error('Set DATABASE_URL, in the environment or in .env, to run the e2e tests.');
