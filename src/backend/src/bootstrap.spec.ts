import { describe, expect, it } from 'vitest';
import { buildOpenApiConfig, OPENAPI_VERSION } from './bootstrap.js';

describe('OpenAPI contract', () => {
  it('is published as OpenAPI 3.2.0', () => {
    expect(OPENAPI_VERSION).toBe('3.2.0');
    expect(buildOpenApiConfig().openapi).toBe('3.2.0');
  });
});
