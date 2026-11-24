import type { PermissionKind } from './api.js';

// The sections of the administration page, each for one of the three independent permissions (ADR 0011). A section
// is listed here once its screen is built on routes that exist; the page offers a user the sections they hold.

export interface AdminSection {
  id: 'curriculum' | 'catalog' | 'access';
  /** A route name in router.ts, a child of /admin. */
  route: string;
  /** The permission its routes need. */
  permission: PermissionKind;
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { id: 'curriculum', route: 'admin-curriculum', permission: 'program_admin' },
  { id: 'catalog', route: 'admin-catalog', permission: 'catalog_maintainer' },
  { id: 'access', route: 'admin-access', permission: 'access_manager' },
];
