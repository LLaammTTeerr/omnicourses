import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';
import { HealthService } from './health.service.js';

async function controllerWith(query: DataSource['query']): Promise<HealthController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [HealthService, { provide: DataSource, useValue: { query } }],
  }).compile();
  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  it('reports ok and the server version when the database answers', async () => {
    const controller = await controllerWith(vi.fn().mockResolvedValue([{ server_version: '18.6' }]));
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'up',
      postgresVersion: '18.6',
    });
  });

  it('reports degraded instead of throwing when the database is down', async () => {
    const controller = await controllerWith(vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(controller.check()).resolves.toEqual({
      status: 'degraded',
      database: 'down',
      postgresVersion: null,
    });
  });
});
