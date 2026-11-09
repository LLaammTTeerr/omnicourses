import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './bootstrap.js';
import { listenHost, loadEnvFiles, port } from './config/env.js';

async function main(): Promise<void> {
  loadEnvFiles();
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const host = listenHost();
  await (host ? app.listen(port(), host) : app.listen(port()));
}

void main();
