import type { GlobalPermission } from './admin-grant.entities.js';

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
