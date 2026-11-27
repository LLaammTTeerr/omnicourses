import { ForbiddenException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AuthService } from '../auth/auth.service.js';
import { Clock } from '../config/clock.js';
import { accountDeletionGraceDays } from '../config/env.js';
import { DAY_MS } from '../config/time.js';
import { ACCESS_MANAGER_LOCK } from '../curriculum-admin/admin-write.service.js';
import { SharingService } from '../sharing/sharing.service.js';
import { User } from '../users/user.entity.js';
import { UsersService } from '../users/users.service.js';
import { findUserColumns, findUserTables, selectList } from './account-export.js';
import { AccountExportDto, DeletionScheduledDto } from './account.dto.js';

@Injectable()
export class AccountService {
  constructor(
    private readonly db: DataSource,
    private readonly users: UsersService,
    private readonly auth: AuthService,
    private readonly sharing: SharingService,
    private readonly clock: Clock,
  ) {}

  async export(userId: string): Promise<AccountExportDto> {
    return this.db.transaction('REPEATABLE READ', async (tx) => {
      await tx.query('SET TRANSACTION READ ONLY');
      const [user] = await tx.query(`SELECT ${selectList(await findUserColumns(tx))} FROM "users" WHERE "id" = $1`, [userId]);
      const tables: Record<string, Record<string, unknown>[]> = {};
      for (const t of await findUserTables(tx)) {
        tables[t.table] = await tx.query(`SELECT ${selectList(t.columns)} FROM ${t.qualifiedTable} WHERE user_id = $1`, [userId]);
      }
      return { exportedAt: this.clock.now(), user, tables };
    });
  }

  async requestDeletion(user: User, password: string): Promise<DeletionScheduledDto> {
    if (!(await this.auth.verifyPassword(user, password))) throw new ForbiddenException('Wrong password');
    const requestedAt = this.clock.now();
    const purgeAfter = new Date(requestedAt.getTime() + accountDeletionGraceDays() * DAY_MS);
    await this.db.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock($1)', [ACCESS_MANAGER_LOCK]);
      await this.users.markDeletionRequestedWithin(manager, user.id, requestedAt, purgeAfter);
      await this.auth.revokeAllWithin(manager, user.id);
      await this.sharing.stopAllWithin(manager, user.id);
    });
    return { purgeAfter };
  }
}
