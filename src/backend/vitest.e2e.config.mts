import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.base.config.mjs';

// End-to-end tests boot the whole app against a real PostgreSQL (DATABASE_URL).
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['test/**/*.e2e-spec.ts'],
      setupFiles: ['test/support/setup.ts'],
      testTimeout: 30_000,
      // Files share one database and each runs the migrations: run them one at a time.
      fileParallelism: false,
    },
  }),
);
