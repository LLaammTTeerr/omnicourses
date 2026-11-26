import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/bootstrap.js';
import { migrate } from '../../src/database/data-source.js';

export async function bootApp(override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (builder) => builder): Promise<INestApplication> {
  const moduleRef = await override(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = moduleRef.createNestApplication();
  try {
    configureApp(app);
    await migrate(app.get(DataSource));
    await app.init();
    return app;
  } catch (error) {
    await app.close();
    throw error;
  }
}
