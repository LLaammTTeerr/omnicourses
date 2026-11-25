import type { NextFunction, Request, Response } from 'express';

/**
 * On every answer with a body under /api/shared-plans, whatever makes it: the plan, the "not shared"
 * 404, the rate limit's 429, and the framework's own 400 and 404 for a path that is no token. Search engines
 * must index none of them (UC-09 §7), and no cache may keep a plan past a stopped link (A2). It is
 * a middleware because it runs before the guards and before the route is matched; a header set in
 * the route handler would miss the answers that never reach it. The CORS answer to an OPTIONS
 * request is made before this runs; it is a 204 with no body.
 */
export function sharedPlanHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Cache-Control', 'no-store');
  next();
}
