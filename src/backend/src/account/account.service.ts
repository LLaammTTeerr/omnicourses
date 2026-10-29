import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service.js';
import { positiveInt } from '../config/env.js';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { findUserTables, withoutSecrets } from './account-export.js';
import { AccountExportDto, DeletionScheduledDto } from './account.dto.js';

const DAY_MS = 86_400_000;

export const deletionGraceMs = (): number => positiveInt(process.env.ACCOUNT_DELETION_GRACE_DAYS, 30) * DAY_MS;

// Privacy NFR (Vision §6, Luật 91/2025/QH15): export and delete a whole account. ADR 0004.
@Injectable()
export class AccountService {
  constructor(
    private readonly db: DataSource,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  async export(userId: string): Promise<AccountExportDto> {
    const [user] = await this.db.query(`SELECT * FROM "users" WHERE "id" = $1`, [userId]);
    const tables: Record<string, Record<string, unknown>[]> = {};
    for (const t of await findUserTables(this.db)) {
      const rows: Record<string, unknown>[] = await this.db.query(`SELECT * FROM ${t.qualifiedTable} WHERE ${t.quotedColumn} = $1`, [userId]);
      // A table that references users twice gets one entry per column.
      tables[t.table in tables ? `${t.table}.${t.column}` : t.table] = rows.map(withoutSecrets);
    }
    return { exportedAt: new Date(), user: withoutSecrets(user), tables };
  }

  /**
   * Starts the grace period: every session is revoked, and the account is purged
   * after it unless the student signs in again. 403, not 401, on a wrong
   * password: the client treats 401 as "signed out".
   */
  async requestDeletion(user: User, password: string): Promise<DeletionScheduledDto> {
    if (!(await this.auth.verifyPassword(user, password))) throw new ForbiddenException('Wrong password');
    const requestedAt = new Date();
    await this.users.requestDeletion(user.id, requestedAt);
    await this.auth.revokeAll(user.id);
    return { purgeAfter: new Date(requestedAt.getTime() + deletionGraceMs()) };
  }
}
