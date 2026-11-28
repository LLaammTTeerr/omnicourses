import type { RouteComponent } from 'vue-router';
import type { PermissionKind } from './grants.js';

export interface AdminSection {
  id: 'curriculum' | 'calendar' | 'catalog' | 'import' | 'access';
  route: string;
  path: string;
  load: () => Promise<RouteComponent | { default: RouteComponent }>;
  permissions: readonly PermissionKind[];
}

export const ADMIN_SECTIONS: readonly AdminSection[] = [
  { id: 'curriculum', route: 'admin-curriculum', path: 'curriculum', load: () => import('./CurriculumAdmin.vue'), permissions: ['program_admin'] },
  { id: 'calendar', route: 'admin-calendar', path: 'calendar', load: () => import('./CalendarAdmin.vue'), permissions: ['program_admin'] },
  { id: 'catalog', route: 'admin-catalog', path: 'catalog', load: () => import('./CatalogAdmin.vue'), permissions: ['catalog_maintainer'] },
  { id: 'import', route: 'admin-import', path: 'import', load: () => import('./ImportAdmin.vue'), permissions: ['catalog_maintainer', 'program_admin'] },
  { id: 'access', route: 'admin-access', path: 'access', load: () => import('./AccessAdmin.vue'), permissions: ['access_manager'] },
];

export const opens = (section: AdminSection, holds: (permission: PermissionKind) => boolean): boolean => section.permissions.some(holds);
