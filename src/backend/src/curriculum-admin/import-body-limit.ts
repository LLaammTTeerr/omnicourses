import type { INestApplication } from '@nestjs/common';
import { json, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { compressedBody, payloadTooLarge } from './admin-errors.js';
import type { Need } from './grant-scope.js';
import { ImportBodyGate } from './import-body-gate.js';

// The four CSV import routes and their JSON body limit (ADR 0011, "CSV contract and UC-11
// handoff"). The controller builds its paths from the same two constants, so the limit and
// the routes cannot drift apart.

export const CATALOG_IMPORTS = 'admin/catalog/imports';
export const COHORT_IMPORTS = 'admin/programs/:programId/cohorts/:curriculumId/imports';
export const IMPORT_STEPS = ['preview', 'confirm'] as const;

/** A 1 MiB CSV with every character JSON-escaped (six bytes each), the wrapper and a review version. */
export const IMPORT_JSON_LIMIT_BYTES = 7 * 1024 * 1024;

/** Whether the sender of this `Authorization` header may use the large parser for a route that needs `need`. */
export type LargeBodyGate = (authorization: string | undefined, need: Need) => Promise<boolean>;

/**
 * Parses the JSON body of `POST` on the four import routes with the 7 MiB limit, for the
 * callers `mayUseLargeParser` allows, and of nothing else. Every other request, and every
 * other caller of these routes, passes through to Nest's default parser and its 100 KiB
 * limit. A path that does not match exactly (another method, another letter case, a longer
 * path) keeps the small limit too.
 *
 * A body parser runs before the guards, so before authentication and before the rate limit.
 * Two rules keep these routes from costing more than any other route to someone who may not
 * import:
 * - the gate: no live session with the needed grant, no large parser (import-body-gate.ts);
 * - no inflation: a request with a `Content-Encoding` is refused with 415 before anything is
 *   read, for every caller, so a few compressed kilobytes cannot become megabytes here.
 *
 * It must be registered before the app initialises, because the default parser, which Nest
 * adds then, skips a body that is already read. The inner function must not be named
 * `jsonParser`: Nest takes a middleware of that name for its own default parser and would
 * then not add it for the other routes.
 */
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
    // A gate that fails (the database is down) allows nothing.
    void mayUseLargeParser(req.headers.authorization, need)
      .catch(() => false)
      .then((allowed) => {
        if (!allowed) return next();
        parseLargeJson(req, res, (error?: unknown) => {
          const tooLarge = (error as { type?: string } | undefined)?.type === 'entity.too.large';
          next(tooLarge ? payloadTooLarge('The request body is larger than 7 MiB') : error);
        });
      });
  };
}

// Here, so that the deployed app and the e2e app get the same limits: 7 MiB of JSON on the
// four CSV import routes for a caller who holds the grant (ADR 0011), the default 100 KiB
// for everyone and everything else. After CORS, so that a browser can read its 413.
// The gate is looked up per request: providers do not exist yet when this runs.
// An app without the curriculum-admin module has no gate: the lookup throws, and nobody gets the large parser.
export function installImportBodyLimit(app: INestApplication, globalPrefix: string): void {
  app.use(importJsonBody(globalPrefix, async (authorization, need) => app.get(ImportBodyGate, { strict: false }).allows(authorization, need)));
}
