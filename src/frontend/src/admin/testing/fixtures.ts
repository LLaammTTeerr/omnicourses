import { user } from '../../auth/testing/fixtures.js';
import type { GlobalGrant, GlobalPermission, ProgramGrant, UserGrants } from '../api.js';

// Synthetic administration data (AGENTS.md hard rule 3): made-up programs, courses and account IDs.

export const PROGRAM_ID = '00000000-0000-4000-8000-0000000000a1';
export const OTHER_PROGRAM_ID = '00000000-0000-4000-8000-0000000000a2';
/** The access manager who granted the fixtures' permissions. */
export const MANAGER_ID = '00000000-0000-4000-8000-0000000000f1';

export const programGrant = (overrides: Partial<ProgramGrant> = {}): ProgramGrant => ({
  programId: PROGRAM_ID,
  programCode: 'ZZPROG',
  grantedAt: '2026-11-20T02:00:00.000Z',
  grantedBy: MANAGER_ID,
  ...overrides,
});

export const globalGrant = (permission: GlobalPermission, overrides: Partial<GlobalGrant> = {}): GlobalGrant => ({
  permission,
  grantedAt: '2026-11-20T02:00:00.000Z',
  grantedBy: MANAGER_ID,
  ...overrides,
});

/** The grants of the synthetic signed-in user (auth/testing/fixtures.ts); none unless given. */
export const grants = (overrides: Partial<UserGrants> = {}): UserGrants => ({ userId: user().id, programs: [], permissions: [], ...overrides });

export const NO_GRANTS = grants();
export const PROGRAM_ADMIN = grants({ programs: [programGrant()] });
export const CATALOG_MAINTAINER = grants({ permissions: [globalGrant('catalog_maintainer')] });
export const ACCESS_MANAGER = grants({ permissions: [globalGrant('access_manager')] });
/** The API lists the global permissions by name. */
export const EVERY_GRANT = grants({ programs: [programGrant()], permissions: [globalGrant('access_manager'), globalGrant('catalog_maintainer')] });
