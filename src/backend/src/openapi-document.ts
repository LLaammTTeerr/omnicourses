import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configureApp } from './bootstrap.js';
import { ClockModule } from './config/clock.js';
import { dataSourceOptions } from './database/data-source.js';
import { FEATURE_MODULES } from './features.js';

type Module = (typeof FEATURE_MODULES)[number];

// The OpenAPI contract, built without a database. Nest lists the routes and schemas in the order it
// meets the modules; sortOpenApi makes the contract independent of that order.
export async function buildOpenApiDocument(modules: readonly Module[] = FEATURE_MODULES): Promise<OpenAPIObject> {
  const moduleRef = await Test.createTestingModule({
    imports: [TypeOrmModule.forRoot({ ...dataSourceOptions, autoLoadEntities: true, manualInitialization: true }), ClockModule, ...modules],
  }).compile();
  const app = moduleRef.createNestApplication();
  const document = configureApp(app);
  await app.close();
  return sortOpenApi(document);
}

const byKey = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

// The order the OpenAPI specification lists the operations of a path item in.
const METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace', 'query'];
const rank = (key: string): number => METHODS.indexOf(key);

// The fields of a path item that are not operations (summary, parameters) first, then the
// operations in METHODS order. Two modules can add operations to one path (GET and DELETE
// /api/users/me), so Nest's order follows the modules.
const sortPathItem = <T extends object>(item: T): T =>
  Object.fromEntries(
    Object.entries(item)
      .map((entry, index) => ({ entry, index, method: rank(entry[0]) }))
      .sort((a, b) => a.method - b.method || a.index - b.index)
      .map(({ entry }) => entry),
  ) as T;

// Sorts the paths, the component schemas and the tags by name, and the operations of each path by
// method. The properties inside a schema keep the order the code declares them in.
export function sortOpenApi(document: OpenAPIObject): OpenAPIObject {
  const components = document.components && {
    ...document.components,
    ...(document.components.schemas && { schemas: byKey(document.components.schemas) }),
  };
  return {
    ...document,
    paths: Object.fromEntries(Object.entries(byKey(document.paths)).map(([path, item]) => [path, sortPathItem(item)])),
    ...(document.tags && { tags: [...document.tags].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) }),
    ...(components && { components }),
  };
}

export const serializeOpenApi = (document: OpenAPIObject): string => JSON.stringify(document, null, 2);
