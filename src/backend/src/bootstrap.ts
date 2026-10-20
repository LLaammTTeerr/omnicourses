import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

export const API_PREFIX = 'api';
export const OPENAPI_VERSION = '3.2.0';

// Shared by main.ts and the e2e tests, so the app under test is configured
// exactly like the deployed one.
export function configureApp(app: INestApplication): OpenAPIObject {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' });

  const document = SwaggerModule.createDocument(app, buildOpenApiConfig());
  SwaggerModule.setup(`${API_PREFIX}/docs`, app, document);
  return document;
}

export function buildOpenApiConfig(): Omit<OpenAPIObject, 'paths'> {
  return new DocumentBuilder()
    .setOpenAPIVersion(OPENAPI_VERSION)
    .setTitle('OmniCourse API')
    .setDescription('REST API of OmniCourse: degree audit, curriculum and roadmap planning.')
    .setVersion('0.0.0')
    .build();
}
