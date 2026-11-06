import { describe, expect, it } from 'vitest';
import type { Health } from './api.js';
import { contractEnum, contractShape, type Shape } from './testing/contract.js';

describe('Health against the contract', () => {
  it('has the fields of HealthDto', () => {
    expect(contractShape('HealthDto')).toEqual({ status: 'required', database: 'required', postgresVersion: 'required' } satisfies Shape<Health>);
  });

  it('has the values of HealthDto', () => {
    const status: Record<Health['status'], true> = { ok: true, degraded: true };
    const database: Record<Health['database'], true> = { up: true, down: true };
    expect(Object.keys(status).sort()).toEqual(contractEnum('HealthDto', 'status'));
    expect(Object.keys(database).sort()).toEqual(contractEnum('HealthDto', 'database'));
  });
});
