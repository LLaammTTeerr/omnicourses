import { describe, expect, it } from 'vitest';
import { buildOpenApiConfig } from './bootstrap.js';

describe('OpenAPI contract', () => {
  it('is published as OpenAPI 3.2.0', () => {
    expect(buildOpenApiConfig().openapi).toBe('3.2.0');
  });
});
