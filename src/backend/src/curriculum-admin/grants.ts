import type { EntityManager } from 'typeorm';
import type { GlobalPermission } from './admin-grant.entities.js';
import type { UserGrantsDto } from './curriculum-admin.dto.js';

/** The grants one user holds right now (ADR 0011). */
export interface Grants {
  programIds: ReadonlySet<string>;
  permissions: ReadonlySet<GlobalPermission>;
}

/** What an operation needs. Each is independent: none implies another (ADR 0011). */
export type Need = { program: string } | { permission: GlobalPermission };

/** The permission names a 403 `permission_required` reports. */
export type PermissionKind = 'program_admin' | GlobalPermission;

/**
 * The permission `grants` lack for `need`, or null when they cover it. Default deny: an access
 * manager or a catalog maintainer gets no program, and a program grant gets nothing global.
 */
export function missingPermission(grants: Grants, need: Need): PermissionKind | null {
  if ('program' in need) return grants.programIds.has(need.program) ? null : 'program_admin';
  return grants.permissions.has(need.permission) ? null : need.permission;
}

export async function grantsOf(em: EntityManager, userId: string): Promise<Grants> {
  const programs: { program_id: string }[] = await em.query('SELECT "program_id" FROM "program_admin_grants" WHERE "user_id" = $1', [userId]);
  const globals: { permission: GlobalPermission }[] = await em.query('SELECT "permission" FROM "global_admin_grants" WHERE "user_id" = $1', [userId]);
  return { programIds: new Set(programs.map((row) => row.program_id)), permissions: new Set(globals.map((row) => row.permission)) };
}

/** The user's grants: IDs and scopes only, never identity or credentials (ADR 0011). */
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
