import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { bootApp } from './support/app.js';

const TABLES_OF_THE_AI_GATEWAY_OWNED_BY_AN_OPEN_PULL_REQUEST = ['ai_usage'];

describe('Entities against migrations (e2e)', () => {
  let app: INestApplication;
  let db: DataSource;

  beforeAll(async () => {
    app = await bootApp();
    db = app.get(DataSource);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('maps every table exactly as its migration creates it', async () => {
    const { upQueries } = await db.driver.createSchemaBuilder().log();
    const tables = db.entityMetadatas.map((m) => m.tableName).filter((t) => !TABLES_OF_THE_AI_GATEWAY_OWNED_BY_AN_OPEN_PULL_REQUEST.includes(t));
    const touching = upQueries.map((q) => q.query).filter((q) => tables.some((t) => q.includes(`"${t}"`)));
    expect(touching).toEqual([]);
  });
});
