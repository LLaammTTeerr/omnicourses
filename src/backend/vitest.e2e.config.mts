import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// End-to-end tests boot the whole app against a real PostgreSQL (DATABASE_URL).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    environment: 'node',
    testTimeout: 30_000,
    // Files share one database and each runs the migrations: run them one at a time.
    fileParallelism: false,
  },
});
