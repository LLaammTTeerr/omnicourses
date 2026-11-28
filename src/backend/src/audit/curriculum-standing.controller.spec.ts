import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { RulesService } from '../rules/rules.service.js';
import type { User } from '../users/user.entity.js';
import { CurriculumStandingController } from './curriculum-standing.controller.js';

const user = { id: '00000000-0000-4000-8000-000000000001' } as User;

describe('CurriculumStandingController', () => {
  it('returns the rule-engine standing for a valid program and 4-digit cohort', async () => {
    const standingFor = vi.fn().mockResolvedValue({
      courses: [{ code: 'CS470', transcriptStatus: null, readiness: 'locked', missingPrerequisites: ['CS469'] }],
    });
    const controller = new CurriculumStandingController({ standingFor } as unknown as RulesService);

    await expect(controller.get(user, 'APCS', '2024')).resolves.toEqual({
      courses: [{ code: 'CS470', transcriptStatus: null, readiness: 'locked', missingPrerequisites: ['CS469'] }],
    });
    expect(standingFor).toHaveBeenCalledWith(user.id, 'APCS', 2024);
  });

  it.each([
    ['APCS', '24'],
    ['APCS', 'abcd'],
    ['AP\u0000CS', '2024'],
  ])('throws 404 before querying rules when program=%j or cohort=%j is malformed', async (program, cohort) => {
    const standingFor = vi.fn();
    const controller = new CurriculumStandingController({ standingFor } as unknown as RulesService);
    await expect(controller.get(user, program, cohort)).rejects.toBeInstanceOf(NotFoundException);
    expect(standingFor).not.toHaveBeenCalled();
  });

  it('throws 404 when the program or cohort has no curriculum', async () => {
    const standingFor = vi.fn().mockResolvedValue(null);
    const controller = new CurriculumStandingController({ standingFor } as unknown as RulesService);
    await expect(controller.get(user, 'APCS', '1999')).rejects.toBeInstanceOf(NotFoundException);
  });
});
