import { json, type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import { payloadTooLarge } from './admin-errors.js';

// The four CSV import routes and their JSON body limit (ADR 0011, "CSV contract and UC-11
// handoff"). The controller builds its paths from the same two constants, so the limit and
// the routes cannot drift apart.

export const CATALOG_IMPORTS = 'admin/catalog/imports';
export const COHORT_IMPORTS = 'admin/programs/:programId/cohorts/:curriculumId/imports';
export const IMPORT_STEPS = ['preview', 'confirm'] as const;

/** A 1 MiB CSV with every character JSON-escaped (six bytes each), the wrapper and a review version. */
export const IMPORT_JSON_LIMIT_BYTES = 7 * 1024 * 1024;

/**
 * Parses the JSON body of `POST` on the four import routes with the 7 MiB limit, and of
 * nothing else: every other request passes through to Nest's default parser and its 100 KiB
 * limit. It must be registered before the app initialises, because the default parser, which
 * Nest adds then, skips a body that is already read. A path that does not match exactly
 * (another method, another letter case, a longer path) keeps the small limit.
 *
 * The inner function must not be named `jsonParser`: Nest takes a middleware of that name
 * for its own default parser and would then not add it for the other routes.
 */
export function importJsonBody(globalPrefix: string): RequestHandler {
  const parseLargeJson = json({ limit: IMPORT_JSON_LIMIT_BYTES });
  const paths = [CATALOG_IMPORTS, COHORT_IMPORTS].map((path) => path.replace(/:[A-Za-z]+/g, '[^/]+')).join('|');
  const importRoute = new RegExp(`^/${globalPrefix}/(?:${paths})/(?:${IMPORT_STEPS.join('|')})$`);
  return function importJsonBodyLimit(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== 'POST' || !importRoute.test(req.path)) return next();
    parseLargeJson(req, res, (error?: unknown) => {
      const tooLarge = (error as { type?: string } | undefined)?.type === 'entity.too.large';
      next(tooLarge ? payloadTooLarge('The request body is larger than 7 MiB') : error);
    });
  };
}
