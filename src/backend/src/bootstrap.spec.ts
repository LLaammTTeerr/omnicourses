import { describe, expect, it } from 'vitest';
import { buildOpenApiConfig, OPENAPI_VERSION } from './bootstrap.js';

describe('OpenAPI contract', () => {
  it('is published as OpenAPI 3.2.0', () => {
    expect(OPENAPI_VERSION).toBe('3.2.0');
    expect(buildOpenApiConfig().openapi).toBe('3.2.0');
  });

  // Session tokens are opaque random strings, not JWTs (ADR 0002). Issue #51.
  it('declares the bearer token as opaque, not a JWT', () => {
    const config = buildOpenApiConfig();

    // Named 'bearer' because @ApiBearerAuth() refers to that name by default.
    expect(config.components?.securitySchemes?.bearer).toEqual({
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'opaque',
    });
    expect(JSON.stringify(config)).not.toMatch(/jwt/i);
  });
});
