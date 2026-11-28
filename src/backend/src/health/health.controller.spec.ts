import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { describe, expect, it, vi } from 'vitest';
import { HealthController } from './health.controller.js';

async function controllerWith(query: DataSource['query']): Promise<HealthController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: DataSource, useValue: { query } }],
  }).compile();
  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  it('reports ok when the database answers, without its version', async () => {
    const controller = await controllerWith(vi.fn().mockResolvedValue([{ server_version: '18.6' }]));
    await expect(controller.check()).resolves.toEqual({ status: 'ok', database: 'up' });
  });

  it('throws 503 ServiceUnavailableException with degraded status when the database is down', async () => {
    const controller = await controllerWith(vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    const error = await controller.check().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect((error as ServiceUnavailableException).getStatus()).toBe(503);
    expect((error as ServiceUnavailableException).getResponse()).toEqual({ status: 'degraded', database: 'down' });
  });
});
