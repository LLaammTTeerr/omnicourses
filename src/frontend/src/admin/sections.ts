import type { PermissionKind } from './api.js';

// The sections of the administration page, each for the permissions its routes need (ADR 0011). A section is listed
// here once its screen is built on routes that exist; the page offers a user the sections they hold any permission of.

export interface AdminSection {
  id: 'curriculum' | 'catalog' | 'import' | 'access';
  /** A route name in router.ts, a child of /admin. */
  route: string;
  /** Any one of these opens the section; the API checks the one each request needs. */
  permissions: readonly PermissionKind[];
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { id: 'curriculum', route: 'admin-curriculum', permissions: ['program_admin'] },
  { id: 'catalog', route: 'admin-catalog', permissions: ['catalog_maintainer'] },
  // CSV import (UC-11 A9): catalog courses for a catalog maintainer, group links for a program administrator.
  { id: 'import', route: 'admin-import', permissions: ['catalog_maintainer', 'program_admin'] },
  { id: 'access', route: 'admin-access', permissions: ['access_manager'] },
];

/** The user holds a permission that opens the section. */
export const opens = (section: AdminSection, holds: (permission: PermissionKind) => boolean): boolean => section.permissions.some(holds);
