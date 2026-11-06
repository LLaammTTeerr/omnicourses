import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap.js';

/**
 * The whole app, configured as main.ts configures it, on a migrated database.
 * Migrations run before init(), because init() starts the account purge.
 */
export async function bootApp(override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder): Promise<INestApplication> {
  const moduleRef = await override(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.get(DataSource).runMigrations({ transaction: 'each' });
  await app.init();
  return app;
}
