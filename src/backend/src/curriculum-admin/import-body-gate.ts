import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { bearerToken } from '../auth/auth.guard.js';
import { AuthService } from '../auth/auth.service.js';
import { grantsOf } from './admin-write.service.js';
import { missingPermission, type Need } from './grant-scope.js';

/**
 * Decides who gets the 7 MiB JSON parser of the CSV import routes (import-body-limit.ts).
 * Body parsers run before every guard, so before authentication and before the rate limit:
 * without this gate anyone could make the server read 7 MiB per request on those paths.
 *
 * It is not the authorization of an import. That stays in the services, in the transaction
 * and, for a confirmation, under the write lock. A caller this gate refuses still reaches the
 * route, with the default 100 KiB parser, and gets the usual 401 or 403 there.
 */
@Injectable()
export class ImportBodyGate {
  constructor(
    private readonly auth: AuthService,
    private readonly db: DataSource,
  ) {}

  /**
   * True only for a live session (the lookup of the AuthGuard, `AuthService.authenticate`)
   * whose user holds, right now, the grant the route needs: catalog maintainer for the
   * catalog imports, the path's program for the cohort imports.
   */
  async allows(authorization: string | string[] | undefined, need: Need): Promise<boolean> {
    const token = bearerToken(authorization);
    const found = token ? await this.auth.authenticate(token) : null;
    if (!found) return false;
    return missingPermission(await grantsOf(this.db.manager, found.user.id), need) === null;
  }
}
