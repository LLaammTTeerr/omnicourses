import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.base.config.mjs';

export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['src/**/*.spec.ts'],
      coverage: {
        include: [
          'src/**/*.ts',
        ],
        exclude: [
          'src/**/*.spec.ts',
          'src/**/testing/**',
          'src/database/migrations/**',
          'src/main.ts',
          'src/**/*.live-spec.ts'
        ],
        thresholds: {
          'src/rules/**': {
            statements: 80,
          }
        }
      }
    },
  }),
);
