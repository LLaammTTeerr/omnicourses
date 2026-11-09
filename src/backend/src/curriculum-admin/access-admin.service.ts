import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { conflict, notFound } from './admin-errors.js';
import type { GlobalPermission } from './admin-grant.entities.js';
import { AdminWriteService, lockAdminWrite } from './admin-write.service.js';
import { AccessProgramDto, UserGrantsDto } from './curriculum-admin.dto.js';

/** Thrown by the bootstrap; the CLI prints the message. */
export class BootstrapRefused extends Error {}

/**
 * The first access manager (ADR 0011, "Bootstrap and recovery"): an operator command, never
 * an HTTP route. Grants only access_manager, with granted_by null, and only while no active
 * access manager exists, so it is also the recovery path after the last one is deleted.
 */
export async function bootstrapAccessManager(db: DataSource, userId: string): Promise<void> {
  await db.transaction(async (em) => {
    const [user] = await lockAdminWrite(em, [userId]);
    if (!user) throw new BootstrapRefused(`No account has the ID ${userId}`);
    if (user.deletionRequestedAt) throw new BootstrapRefused('That account is waiting for deletion');
    if ((await activeAccessManagers(em)) > 0) {
      throw new BootstrapRefused('An active access manager already exists; they grant further permissions through the API');
    }
    await em.query(
      `INSERT INTO "global_admin_grants" ("user_id", "permission", "granted_by") VALUES ($1, 'access_manager', NULL) ON CONFLICT DO NOTHING`,
      [userId],
    );
  });
}

/** Active: the account is not waiting for deletion (ADR 0011). */
async function activeAccessManagers(em: EntityManager, except?: string): Promise<number> {
  const [{ n }] = await em.query(
    `SELECT count(*)::int AS "n" FROM "global_admin_grants" g JOIN "users" u ON u."id" = g."user_id"
     WHERE g."permission" = 'access_manager' AND u."deletion_requested_at" IS NULL AND ($1::uuid IS NULL OR g."user_id" <> $1::uuid)`,
    [except ?? null],
  );
  return n;
}

// Access-manager operations (ADR 0011): list programs, read one user's grants by exact ID, and
// grant or revoke any of the three permissions. No user directory, no search by email.
@Injectable()
export class AccessAdminService {
  constructor(private readonly writes: AdminWriteService) {}

  programs(callerId: string): Promise<AccessProgramDto[]> {
    return this.writes.run(callerId, { permission: 'access_manager' }, async (em) => {
      const rows: { id: string; code: string; name_vi: string }[] = await em.query('SELECT "id", "code", "name_vi" FROM "programs" ORDER BY "code" COLLATE "C"');
      return rows.map((r) => ({ id: r.id, code: r.code, nameVi: r.name_vi }));
    });
  }

  grantsOf(callerId: string, userId: string): Promise<UserGrantsDto> {
    return this.writes.run(callerId, { permission: 'access_manager' }, async (em) => {
      if (!(await userExists(em, userId))) throw notFound('No account has this ID');
      return userGrants(em, userId);
    });
  }

  grantProgram(callerId: string, userId: string, programId: string): Promise<UserGrantsDto> {
    return this.writes.run(
      callerId,
      { permission: 'access_manager' },
      async (em) => {
        await assertActiveRecipient(em, userId);
        const [program] = await em.query('SELECT 1 FROM "programs" WHERE "id" = $1', [programId]);
        if (!program) throw notFound('No program has this ID');
        // Idempotent: repeating a grant keeps its original attribution.
        await em.query(
          'INSERT INTO "program_admin_grants" ("user_id", "program_id", "granted_by") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [userId, programId, callerId],
        );
        return userGrants(em, userId);
      },
      [userId],
    );
  }

  revokeProgram(callerId: string, userId: string, programId: string): Promise<UserGrantsDto> {
    return this.writes.run(
      callerId,
      { permission: 'access_manager' },
      async (em) => {
        if (!(await userExists(em, userId))) throw notFound('No account has this ID');
        await em.query('DELETE FROM "program_admin_grants" WHERE "user_id" = $1 AND "program_id" = $2', [userId, programId]);
        return userGrants(em, userId);
      },
      [userId],
    );
  }

  grantGlobal(callerId: string, userId: string, permission: GlobalPermission): Promise<UserGrantsDto> {
    return this.writes.run(
      callerId,
      { permission: 'access_manager' },
      async (em) => {
        await assertActiveRecipient(em, userId);
        await em.query(
          'INSERT INTO "global_admin_grants" ("user_id", "permission", "granted_by") VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
          [userId, permission, callerId],
        );
        return userGrants(em, userId);
      },
      [userId],
    );
  }

  revokeGlobal(callerId: string, userId: string, permission: GlobalPermission): Promise<UserGrantsDto> {
    return this.writes.run(
      callerId,
      { permission: 'access_manager' },
      async (em) => {
        if (!(await userExists(em, userId))) throw notFound('No account has this ID');
        if (permission === 'access_manager' && (await activeAccessManagers(em, userId)) === 0) {
          throw conflict('last_access_manager', 'This is the last active access manager; grant the role to someone else first');
        }
        await em.query('DELETE FROM "global_admin_grants" WHERE "user_id" = $1 AND "permission" = $2', [userId, permission]);
        return userGrants(em, userId);
      },
      [userId],
    );
  }
}

async function userExists(em: EntityManager, userId: string): Promise<boolean> {
  return (await em.query('SELECT 1 FROM "users" WHERE "id" = $1', [userId])).length > 0;
}

async function assertActiveRecipient(em: EntityManager, userId: string): Promise<void> {
  const [user]: { deletion_requested_at: Date | null }[] = await em.query('SELECT "deletion_requested_at" FROM "users" WHERE "id" = $1', [userId]);
  if (!user) throw notFound('No account has this ID');
  if (user.deletion_requested_at) throw conflict('recipient_deletion_pending', 'That account is waiting for deletion');
}

/** The user's grants: IDs and scopes only, never identity or credentials (ADR 0011). */
async function userGrants(em: EntityManager, userId: string): Promise<UserGrantsDto> {
  const programs: { program_id: string; code: string; granted_at: Date; granted_by: string | null }[] = await em.query(
    `SELECT g."program_id", p."code", g."granted_at", g."granted_by" FROM "program_admin_grants" g
     JOIN "programs" p ON p."id" = g."program_id" WHERE g."user_id" = $1 ORDER BY p."code" COLLATE "C"`,
    [userId],
  );
  const globals: { permission: GlobalPermission; granted_at: Date; granted_by: string | null }[] = await em.query(
    'SELECT "permission", "granted_at", "granted_by" FROM "global_admin_grants" WHERE "user_id" = $1 ORDER BY "permission" COLLATE "C"',
    [userId],
  );
  return {
    userId,
    programs: programs.map((r) => ({ programId: r.program_id, programCode: r.code, grantedAt: r.granted_at, grantedBy: r.granted_by })),
    permissions: globals.map((r) => ({ permission: r.permission, grantedAt: r.granted_at, grantedBy: r.granted_by })),
  };
}
