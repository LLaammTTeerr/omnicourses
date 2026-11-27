import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import type { NextFunction, Request, Response } from 'express';
import { apiDocs, corsOrigin, trustProxy } from './config/env.js';
import { FEATURE_SETUPS } from './features.js';

const API_PREFIX = 'api';
const OPENAPI_VERSION = '3.2.0';

export function configureApp(app: INestApplication): OpenAPIObject {
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.enableCors({ origin: corsOrigin() });
  configureExpress(app);
  for (const setup of FEATURE_SETUPS) setup(app, API_PREFIX);
  return buildDocument(app);
}

function configureExpress(app: INestApplication): void {
  const express = app.getHttpAdapter().getInstance();
  const proxy = trustProxy();
  if (proxy) express.set('trust proxy', proxy);
  express.disable('x-powered-by');
  express.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });
}

function buildDocument(app: INestApplication): OpenAPIObject {
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
