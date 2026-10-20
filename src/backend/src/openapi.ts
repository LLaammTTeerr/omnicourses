import { writeFileSync } from 'node:fs';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { HealthModule } from './health/health.module.js';
import { configureApp } from './bootstrap.js';

// Writes the OpenAPI contract to openapi.json without a database, so CI can
// publish it as an artifact on every pull request.
async function main(): Promise<void> {
  const moduleRef = await Test.createTestingModule({ imports: [HealthModule] })
    .useMocker((token) => (token === DataSource ? { query: async () => [] } : undefined))
    .compile();
  const document = configureApp(moduleRef.createNestApplication());
  writeFileSync('openapi.json', JSON.stringify(document, null, 2));
}

void main();
