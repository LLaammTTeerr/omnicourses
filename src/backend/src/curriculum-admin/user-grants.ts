import type { EntityManager } from 'typeorm';
import type { GlobalPermission } from '../admin-access/admin-grant.entities.js';
import type { UserGrantsDto } from './curriculum-admin.dto.js';

export async function userGrants(em: EntityManager, userId: string): Promise<UserGrantsDto> {
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
    programs: programs.map((row) => ({ programId: row.program_id, programCode: row.code, grantedAt: row.granted_at, grantedBy: row.granted_by })),
    permissions: globals.map((row) => ({ permission: row.permission, grantedAt: row.granted_at, grantedBy: row.granted_by })),
  };
}
