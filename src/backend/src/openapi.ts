import { writeFileSync } from 'node:fs';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from './account/account.module.js';
import { AuthModule } from './auth/auth.module.js';
import { configureApp } from './bootstrap.js';
import { dataSourceOptions } from './database/data-source.js';
import { HealthModule } from './health/health.module.js';
import { TranscriptModule } from './transcript/transcript.module.js';
import { UsersModule } from './users/users.module.js';

// Writes the OpenAPI contract to openapi.json without a database, so CI can
// publish it as an artifact on every pull request. Import every feature module
// here, or its routes are missing from the contract.
async function main(): Promise<void> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({ ...dataSourceOptions, manualInitialization: true }),
      HealthModule,
      UsersModule,
      AuthModule,
      AccountModule,
      TranscriptModule,
    ],
  }).compile();
  const document = configureApp(moduleRef.createNestApplication());
  writeFileSync('openapi.json', JSON.stringify(document, null, 2));
}

void main();
