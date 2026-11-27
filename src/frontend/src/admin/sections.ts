import type { PermissionKind } from './api.js';

export interface AdminSection {
  id: 'curriculum' | 'calendar' | 'catalog' | 'import' | 'access';
  route: string;
  permissions: readonly PermissionKind[];
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { id: 'curriculum', route: 'admin-curriculum', permissions: ['program_admin'] },
  { id: 'calendar', route: 'admin-calendar', permissions: ['program_admin'] },
  { id: 'catalog', route: 'admin-catalog', permissions: ['catalog_maintainer'] },
  { id: 'import', route: 'admin-import', permissions: ['catalog_maintainer', 'program_admin'] },
  { id: 'access', route: 'admin-access', permissions: ['access_manager'] },
];

export const opens = (section: AdminSection, holds: (permission: PermissionKind) => boolean): boolean => section.permissions.some(holds);
