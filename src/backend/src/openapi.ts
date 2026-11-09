import { writeFileSync } from 'node:fs';
import { buildOpenApiDocument, serializeOpenApi } from './openapi-document.js';

// `npm run openapi -w src/backend` (after a build): rewrites the committed openapi.json.
// CI also publishes it as an artifact on every pull request.
async function main(): Promise<void> {
  writeFileSync('openapi.json', serializeOpenApi(await buildOpenApiDocument()));
}

void main();
