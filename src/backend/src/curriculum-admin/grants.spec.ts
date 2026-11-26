import { getMetadataArgsStorage } from 'typeorm';
import { describe, expect, it } from 'vitest';
import { GLOBAL_PERMISSIONS, GlobalAdminGrant, type GlobalPermission } from './admin-grant.entities.js';
import { missingPermission } from './grants.js';

const APCS = '00000000-0000-4000-8000-00000000000a';
const CLC = '00000000-0000-4000-8000-00000000000c';
const grants = (programIds: string[], permissions: GlobalPermission[] = []) => ({ programIds: new Set(programIds), permissions: new Set(permissions) });

describe('missingPermission (ADR 0011 grant scoping)', () => {
  it('lets a program administrator write only the granted program', () => {
    expect(missingPermission(grants([APCS]), { program: APCS })).toBeNull();
    expect(missingPermission(grants([APCS]), { program: CLC })).toBe('program_admin');
  });

  it('denies everything to a user with no grant', () => {
    expect(missingPermission(grants([]), { program: APCS })).toBe('program_admin');
    expect(missingPermission(grants([]), { permission: 'catalog_maintainer' })).toBe('catalog_maintainer');
    expect(missingPermission(grants([]), { permission: 'access_manager' })).toBe('access_manager');
  });

  it('gives a program grant no catalog or access-manager right', () => {
    expect(missingPermission(grants([APCS, CLC]), { permission: 'catalog_maintainer' })).toBe('catalog_maintainer');
    expect(missingPermission(grants([APCS, CLC]), { permission: 'access_manager' })).toBe('access_manager');
  });

  it('gives an access manager or a catalog maintainer no program and not each other', () => {
    expect(missingPermission(grants([], ['access_manager']), { program: APCS })).toBe('program_admin');
    expect(missingPermission(grants([], ['access_manager']), { permission: 'catalog_maintainer' })).toBe('catalog_maintainer');
    expect(missingPermission(grants([], ['catalog_maintainer']), { program: APCS })).toBe('program_admin');
    expect(missingPermission(grants([], ['catalog_maintainer']), { permission: 'access_manager' })).toBe('access_manager');
    expect(missingPermission(grants([], ['catalog_maintainer']), { permission: 'catalog_maintainer' })).toBeNull();
  });
});

describe('ck_global_admin_grants_permission', () => {
  it('allows exactly the permissions the API grants', () => {
    const check = getMetadataArgsStorage().checks.find((c) => c.target === GlobalAdminGrant && c.name === 'ck_global_admin_grants_permission');
    expect(check?.expression).toBe(`"permission" IN (${GLOBAL_PERMISSIONS.map((permission) => `'${permission}'`).join(', ')})`);
  });
});
