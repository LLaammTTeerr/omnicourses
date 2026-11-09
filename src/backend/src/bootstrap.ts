import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { apiDocs, corsOrigin, trustProxy } from './config/env.js';

const API_PREFIX = 'api';
const OPENAPI_VERSION = '3.2.0';

// Shared by main.ts and the e2e tests, so the app under test is configured
// exactly like the deployed one.
export function configureApp(app: INestApplication): OpenAPIObject {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: corsOrigin() });
  const proxy = trustProxy();
  if (proxy) app.getHttpAdapter().getInstance().set('trust proxy', proxy);
  // Express answers `X-Powered-By: Express` unless told not to.
  app.getHttpAdapter().getInstance().disable('x-powered-by');

  // The document is always built (openapi.json, the e2e tests); the docs
  // pages are served only where apiDocs() allows (not in production by default).
  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  if (apiDocs()) SwaggerModule.setup(`${API_PREFIX}/docs`, app, document);
  return document;
}

export function buildOpenApiConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setOpenAPIVersion(OPENAPI_VERSION)
    .setTitle('OmniCourse API')
    .setDescription('REST API of OmniCourse: degree audit, curriculum and roadmap planning.')
    .setVersion('0.0.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'opaque' })
    .build();
}
