import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { conflict } from '../common/api-errors.js';
import { isWaitingForDeletion, noDeletionWaitingSql } from '../users/account-state.js';
import type { GlobalPermission } from '../admin-access/admin-grant.entities.js';
import { assertAccountExists, assertActiveRecipient, programIn } from './admin-lookups.js';
import { AdminWriteService, lockAdminWrite } from '../admin-access/admin-write.service.js';
import { AccessProgramDto, UserGrantsDto } from './curriculum-admin.dto.js';
import type { Need } from '../admin-access/grants.js';
import { userGrants } from './user-grants.js';

const ACCESS_MANAGER: Need = { permission: 'access_manager' };

class BootstrapRefused extends Error {}

export async function bootstrapAccessManager(db: DataSource, userId: string): Promise<void> {
  await db.transaction(async (em) => {
    const [user] = await lockAdminWrite(em, [userId], { lockAccessManagers: true });
    if (!user) throw new BootstrapRefused(`No account has the ID ${userId}`);
    if (isWaitingForDeletion(user)) throw new BootstrapRefused('That account is waiting for deletion');
    if ((await activeAccessManagers(em)) > 0) {
      throw new BootstrapRefused('An active access manager already exists; they grant further permissions through the API');
    }
    await em.query(
      `INSERT INTO "global_admin_grants" ("user_id", "permission", "granted_by") VALUES ($1, 'access_manager', NULL) ON CONFLICT DO NOTHING`,
      [userId],
    );
  });
}

async function activeAccessManagers(em: EntityManager, except?: string): Promise<number> {
  const [{ n: count }] = await em.query(
    `SELECT count(*)::int AS "n" FROM "global_admin_grants" g JOIN "users" u ON u."id" = g."user_id"
     WHERE g."permission" = 'access_manager' AND ${noDeletionWaitingSql('u')} AND ($1::uuid IS NULL OR g."user_id" <> $1::uuid)`,
    [except ?? null],
  );
  return count;
}

@Injectable()
export class AccessAdminService {
  constructor(private readonly writes: AdminWriteService) {}

  programs(callerId: string): Promise<AccessProgramDto[]> {
    return this.writes.run(callerId, ACCESS_MANAGER, async (em) => {
      const rows: { id: string; code: string; name_vi: string }[] = await em.query('SELECT "id", "code", "name_vi" FROM "programs" ORDER BY "code" COLLATE "C"');
      return rows.map((row) => ({ id: row.id, code: row.code, nameVi: row.name_vi }));
    });
  }

  grantsOf(callerId: string, userId: string): Promise<UserGrantsDto> {
    return this.writes.run(callerId, ACCESS_MANAGER, async (em) => {
      await assertAccountExists(em, userId);
      return userGrants(em, userId);
    });
  }

  grantProgram(callerId: string, userId: string, programId: string): Promise<UserGrantsDto> {
    return this.writes.runForRecipient(callerId, userId, async (em) => {
      await assertActiveRecipient(em, userId);
      await programIn(em, programId);
      await em.query(
        'INSERT INTO "program_admin_grants" ("user_id", "program_id", "granted_by") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [userId, programId, callerId],
      );
      return userGrants(em, userId);
    });
  }

  revokeProgram(callerId: string, userId: string, programId: string): Promise<UserGrantsDto> {
    return this.writes.runForRecipient(callerId, userId, async (em) => {
      await assertAccountExists(em, userId);
      await em.query('DELETE FROM "program_admin_grants" WHERE "user_id" = $1 AND "program_id" = $2', [userId, programId]);
      return userGrants(em, userId);
    });
  }

  grantGlobal(callerId: string, userId: string, permission: GlobalPermission): Promise<UserGrantsDto> {
    return this.writes.runForRecipient(callerId, userId, async (em) => {
      await assertActiveRecipient(em, userId);
      await em.query(
        'INSERT INTO "global_admin_grants" ("user_id", "permission", "granted_by") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [userId, permission, callerId],
      );
      return userGrants(em, userId);
    });
  }

  revokeGlobal(callerId: string, userId: string, permission: GlobalPermission): Promise<UserGrantsDto> {
    return this.writes.runForRecipient(
      callerId,
      userId,
      async (em) => {
        await assertAccountExists(em, userId);
        if (permission === 'access_manager' && (await activeAccessManagers(em, userId)) === 0) {
          throw conflict('last_access_manager', 'This is the last active access manager; grant the role to someone else first');
        }
        await em.query('DELETE FROM "global_admin_grants" WHERE "user_id" = $1 AND "permission" = $2', [userId, permission]);
        return userGrants(em, userId);
      },
      { lockAccessManagers: permission === 'access_manager' },
    );
  }
}
