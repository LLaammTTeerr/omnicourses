import type { EntityManager } from 'typeorm';
import type { GlobalPermission } from './admin-grant.entities.js';

interface Grants {
  programIds: ReadonlySet<string>;
  permissions: ReadonlySet<GlobalPermission>;
}

export type Need = { program: string } | { permission: GlobalPermission };

export type PermissionKind = 'program_admin' | GlobalPermission;

export function missingPermission(grants: Grants, need: Need): PermissionKind | null {
  if ('program' in need) return grants.programIds.has(need.program) ? null : 'program_admin';
  return grants.permissions.has(need.permission) ? null : need.permission;
}

export async function grantsOf(em: EntityManager, userId: string): Promise<Grants> {
  const programs: { program_id: string }[] = await em.query('SELECT "program_id" FROM "program_admin_grants" WHERE "user_id" = $1', [userId]);
  const globals: { permission: GlobalPermission }[] = await em.query('SELECT "permission" FROM "global_admin_grants" WHERE "user_id" = $1', [userId]);
  return { programIds: new Set(programs.map((row) => row.program_id)), permissions: new Set(globals.map((row) => row.permission)) };
}
