import { describe, expect, it, vi } from 'vitest';
import type { User } from '../users/user.entity.js';
import { CurriculumAdminController } from './curriculum-admin.controller.js';
import type { UserGrantsDto } from './curriculum-admin.dto.js';
import type { CurriculumAdminService } from './curriculum-admin.service.js';

const CALLER = '00000000-0000-4000-8000-000000000001';

describe('GET /admin/grants', () => {
  it("asks for the signed-in user's grants only: the route takes no user ID", async () => {
    const none: UserGrantsDto = { userId: CALLER, programs: [], permissions: [] };
    const ownGrants = vi.fn(async () => none);
    const controller = new CurriculumAdminController({ ownGrants } as unknown as CurriculumAdminService);

    await expect(controller.grants({ id: CALLER } as User)).resolves.toEqual(none);
    expect(ownGrants).toHaveBeenCalledExactlyOnceWith(CALLER);
    expect(controller.grants).toHaveLength(1);
  });
});
