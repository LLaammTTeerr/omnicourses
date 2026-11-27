import { Test } from '@nestjs/testing';
import { OpenAPIObject } from '@nestjs/swagger';
import { TypeOrmModule } from '@nestjs/typeorm';
import { configureApp } from './bootstrap.js';
import { dataSourceOptions } from './database/data-source.js';
import { FEATURE_MODULES, platformImports } from './features.js';

type Module = (typeof FEATURE_MODULES)[number];

export async function buildOpenApiDocument(modules: readonly Module[] = FEATURE_MODULES): Promise<OpenAPIObject> {
  const moduleRef = await Test.createTestingModule({
    imports: platformImports(TypeOrmModule.forRoot({ ...dataSourceOptions, autoLoadEntities: true, manualInitialization: true }), modules),
  }).compile();
  const app = moduleRef.createNestApplication();
  const document = configureApp(app);
  await app.close();
  return sortOpenApi(document);
}

const byKey = <T>(record: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

const OPENAPI_OPERATION_ORDER = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace', 'query'];
const rank = (key: string): number => OPENAPI_OPERATION_ORDER.indexOf(key);

const sortPathItem = <T extends object>(pathItem: T): T =>
  Object.fromEntries(
    Object.entries(pathItem)
      .map((entry, index) => ({ entry, index, method: rank(entry[0]) }))
      .sort((a, b) => a.method - b.method || a.index - b.index)
      .map(({ entry }) => entry),
  ) as T;

function sortOpenApi(document: OpenAPIObject): OpenAPIObject {
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
