import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountModule } from './account/account.module.js';
import { AuthModule } from './auth/auth.module.js';
import { configureApp } from './bootstrap.js';
import { dataSourceOptions } from './database/data-source.js';
import { GuidesModule } from './guides/guides.module.js';
import { HealthModule } from './health/health.module.js';
import { TranscriptModule } from './transcript/transcript.module.js';
import { UsersModule } from './users/users.module.js';

// The OpenAPI contract, built without a database. Import every feature module
// here, or its routes are missing from the contract.
export async function buildOpenApiDocument(): Promise<OpenAPIObject> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      TypeOrmModule.forRoot({ ...dataSourceOptions, manualInitialization: true }),
      HealthModule,
      UsersModule,
      AuthModule,
      AccountModule,
      TranscriptModule,
      GuidesModule,
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  const document = configureApp(app);
  await app.close();
  return document;
}

export const serializeOpenApi = (document: OpenAPIObject): string => JSON.stringify(document, null, 2);
