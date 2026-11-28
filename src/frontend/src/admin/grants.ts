import { requestAsUser } from '../auth/store.js';

export const GLOBAL_PERMISSIONS = ['catalog_maintainer', 'access_manager'] as const;
export type GlobalPermission = (typeof GLOBAL_PERMISSIONS)[number];
export const PERMISSION_KINDS = ['program_admin', ...GLOBAL_PERMISSIONS] as const;
export type PermissionKind = (typeof PERMISSION_KINDS)[number];

export interface ProgramGrant {
  programId: string;
  programCode: string;
  grantedAt: string;
  grantedBy: string | null;
}

export interface GlobalGrant {
  permission: GlobalPermission;
  grantedAt: string;
  grantedBy: string | null;
}

export interface UserGrants {
  userId: string;
  programs: ProgramGrant[];
  permissions: GlobalGrant[];
}

export const fetchOwnGrants = () => requestAsUser<UserGrants>('GET', '/admin/grants');
