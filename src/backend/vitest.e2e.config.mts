import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.base.config.mjs';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['test/**/*.e2e-spec.ts'],
      setupFiles: ['test/support/setup.ts'],
      testTimeout: 30_000,
      fileParallelism: false,
    },
  }),
);
