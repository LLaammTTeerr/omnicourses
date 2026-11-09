import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { loadEnvFiles, port } from './config/env.js';

async function main(): Promise<void> {
  loadEnvFiles();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  await app.listen(port());
}

void main();
