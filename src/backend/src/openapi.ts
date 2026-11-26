import { writeFileSync } from 'node:fs';
import { buildOpenApiDocument, serializeOpenApi } from './openapi-document.js';

async function main(): Promise<void> {
  writeFileSync('openapi.json', serializeOpenApi(await buildOpenApiDocument()));
}

void main();
