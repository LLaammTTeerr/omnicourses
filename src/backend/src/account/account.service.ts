import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service.js';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { findUserColumns, findUserTables, selectList } from './account-export.js';
import { AccountExportDto, DeletionScheduledDto } from './account.dto.js';

// Privacy NFR (Vision §6, Luật 91/2025/QH15): export and delete a whole account. ADR 0004.
@Injectable()
export class AccountService {
  constructor(
    private readonly db: DataSource,
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  async export(userId: string): Promise<AccountExportDto> {
    return this.db.transaction('REPEATABLE READ', async (tx) => {
      await tx.query('SET TRANSACTION READ ONLY');
      // Secret columns are never selected (AGENTS.md: never read users.password_hash).
      const [user] = await tx.query(`SELECT ${selectList(await findUserColumns(tx))} FROM "users" WHERE "id" = $1`, [userId]);
      const tables: Record<string, Record<string, unknown>[]> = {};
      for (const t of await findUserTables(tx)) {
        tables[t.table] = await tx.query(`SELECT ${selectList(t.columns)} FROM ${t.qualifiedTable} WHERE user_id = $1`, [userId]);
      }
      return { exportedAt: new Date(), user, tables };
    });
  }

  /**
   * Starts the grace period: every session is revoked, and the account is purged
   * after it unless the student signs in again. 403, not 401, on a wrong
   * password: the client treats 401 as "signed out".
   */
  async requestDeletion(user: User, password: string): Promise<DeletionScheduledDto> {
    if (!(await this.auth.verifyPassword(user, password))) throw new ForbiddenException('Wrong password');
    // One transaction: a failed revoke must not leave a deletion scheduled behind a 500.
    const purgeAfter = await this.db.transaction(async (manager) => {
      const deadline = await this.users.markDeletionRequestedWithin(manager, user.id, new Date());
      await this.auth.revokeAllWithin(manager, user.id);
      return deadline;
    });
    return { purgeAfter };
  }
}
