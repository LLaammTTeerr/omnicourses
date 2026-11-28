import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.base.config.mjs';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['src/**/*.live-spec.ts'],
      testTimeout: 60_000,
    },
  }),
);
