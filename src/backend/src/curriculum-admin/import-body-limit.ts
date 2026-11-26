import { type INestApplication, Injectable } from '@nestjs/common';
import { json, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service.js';
import { compressedBody, payloadTooLarge } from './admin-errors.js';
import { inMiB, MIB } from './csv-file.js';
import { grantsOf, missingPermission, type Need } from './grants.js';

export const CATALOG_IMPORTS = 'admin/catalog/imports';
export const COHORT_IMPORTS = 'admin/programs/:programId/cohorts/:curriculumId/imports';
const IMPORT_STEPS = ['preview', 'confirm'] as const;

export const IMPORT_JSON_LIMIT_BYTES = 7 * MIB;

type LargeBodyGate = (authorization: string | undefined, need: Need) => Promise<boolean>;

export function importJsonBody(globalPrefix: string, mayUseLargeParser: LargeBodyGate): RequestHandler {
  const parseLargeJson = json({ limit: IMPORT_JSON_LIMIT_BYTES, inflate: false });
  const cohort = COHORT_IMPORTS.replace(':programId', '(?<programId>[^/]+)').replace(':curriculumId', '[^/]+');
  const importRoute = new RegExp(`^/${globalPrefix}/(?:${CATALOG_IMPORTS}|${cohort})/(?:${IMPORT_STEPS.join('|')})$`);
  return function importJsonBodyLimit(req: Request, res: Response, next: NextFunction): void {
    const route = req.method === 'POST' ? importRoute.exec(req.path) : null;
    if (!route) return next();
    const encoding = req.headers['content-encoding']?.trim().toLowerCase();
    if (encoding && encoding !== 'identity') return next(compressedBody());

    const programId = route.groups?.programId;
    const need: Need = programId ? { program: programId.toLowerCase() } : { permission: 'catalog_maintainer' };
    void mayUseLargeParser(req.headers.authorization, need)
      .catch(() => false)
      .then((allowed) => {
        if (!allowed) return next();
        parseLargeJson(req, res, (error?: unknown) => {
          const tooLarge = (error as { type?: string } | undefined)?.type === 'entity.too.large';
          next(tooLarge ? payloadTooLarge(`The request body is larger than ${inMiB(IMPORT_JSON_LIMIT_BYTES)}`) : error);
        });
      });
  };
}

@Injectable()
export class ImportBodyGate {
  constructor(
    private readonly auth: AuthService,
    private readonly db: DataSource,
  ) {}

  async allows(authorization: string | string[] | undefined, need: Need): Promise<boolean> {
    const found = await this.auth.authenticateHeader(authorization);
    if (!found) return false;
    return missingPermission(await grantsOf(this.db.manager, found.user.id), need) === null;
  }
}

export function installImportBodyLimit(app: INestApplication, globalPrefix: string): void {
  app.use(importJsonBody(globalPrefix, async (authorization, need) => app.get(ImportBodyGate, { strict: false }).allows(authorization, need)));
}
