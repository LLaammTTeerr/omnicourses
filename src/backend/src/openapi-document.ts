import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configureApp } from './bootstrap.js';
import { dataSourceOptions } from './database/data-source.js';
import { FEATURE_MODULES } from './features.js';

// The OpenAPI contract, built without a database.
export async function buildOpenApiDocument(): Promise<OpenAPIObject> {
  const moduleRef = await Test.createTestingModule({
    imports: [TypeOrmModule.forRoot({ ...dataSourceOptions, autoLoadEntities: true, manualInitialization: true }), ...FEATURE_MODULES],
  }).compile();
  const app = moduleRef.createNestApplication();
  const document = configureApp(app);
  await app.close();
  return document;
}

export const serializeOpenApi = (document: OpenAPIObject): string => JSON.stringify(document, null, 2);
