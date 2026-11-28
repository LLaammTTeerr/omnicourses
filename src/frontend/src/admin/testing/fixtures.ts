import { user } from '../../auth/testing/fixtures.js';
import type { CourseDetail, Curriculum, CurriculumCourse, RequirementGroup } from '../../curriculum/api.js';
import type { AccessProgramList, AdminProgramList, AffectedCurriculum } from '../api.js';
import type { GlobalGrant, GlobalPermission, ProgramGrant, UserGrants } from '../grants.js';

export const PROGRAM_ID = '00000000-0000-4000-8000-0000000000a1';
export const OTHER_PROGRAM_ID = '00000000-0000-4000-8000-0000000000a2';
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

export const grants = (overrides: Partial<UserGrants> = {}): UserGrants => ({ userId: user().id, programs: [], permissions: [], ...overrides });

export const NO_GRANTS = grants();
export const PROGRAM_ADMIN = grants({ programs: [programGrant()] });
export const CATALOG_MAINTAINER = grants({ permissions: [globalGrant('catalog_maintainer')] });
export const ACCESS_MANAGER = grants({ permissions: [globalGrant('access_manager')] });

export const CURRICULUM_ID = '00000000-0000-4000-8000-0000000000c1';
export const CURRICULUM_2025_ID = '00000000-0000-4000-8000-0000000000c2';
export const GROUP_BASE_ID = '00000000-0000-4000-8000-000000000a01';
export const GROUP_ELECTIVE_ID = '00000000-0000-4000-8000-000000000a02';

export const adminPrograms = (): AdminProgramList => ({
  programs: [
    { id: OTHER_PROGRAM_ID, code: 'ZZEMPTY', nameVi: 'Chương trình thử chưa có khóa', curricula: [] },
    {
      id: PROGRAM_ID,
      code: 'ZZPROG',
      nameVi: 'Chương trình thử',
      curricula: [
        { id: CURRICULUM_ID, code: 'ZZPROG2024', cohortYear: 2024 },
        { id: CURRICULUM_2025_ID, code: 'ZZPROG2025', cohortYear: 2025 },
      ],
    },
  ],
});

export const course = (code: string, overrides: Partial<CurriculumCourse> = {}): CurriculumCourse => ({
  code,
  nameVi: `Học phần thử ${code}`,
  nameEn: null,
  credits: 4,
  theoryPeriods: 45,
  labPeriods: 30,
  exercisePeriods: null,
  projectPeriods: null,
  prerequisites: null,
  offeringTerms: null,
  ...overrides,
});

export const group = (id: string, name: string, overrides: Partial<RequirementGroup> = {}): RequirementGroup => ({
  id,
  name,
  kind: 'compulsory',
  creditsTotal: null,
  creditsTotalMin: null,
  officialNotes: null,
  courses: [],
  ...overrides,
});

export const BASE_GROUP = group(GROUP_BASE_ID, 'Kiến thức cơ sở thử', {
  creditsTotal: 12,
  courses: [course('ZZ101', { prerequisites: [], offeringTerms: [1, 3], nameEn: 'Test course ZZ101' }), course('ZZ102', { prerequisites: ['ZZ101'] }), course('ZZ103')],
});
export const ELECTIVE_GROUP = group(GROUP_ELECTIVE_ID, 'Tự chọn thử', { kind: 'elective', creditsTotalMin: 8, officialNotes: 'Chọn tối thiểu 8 tín chỉ.' });

export const curriculum = (requirementGroups: RequirementGroup[] = [BASE_GROUP, ELECTIVE_GROUP], overrides: Partial<Curriculum> = {}): Curriculum => ({
  id: CURRICULUM_ID,
  code: 'ZZPROG2024',
  program: { code: 'ZZPROG', nameVi: 'Chương trình thử', nameEn: null, faculty: null, trainingType: null },
  cohortYear: 2024,
  nameVi: 'CTĐT thử khóa 2024',
  nameEn: null,
  language: 'vi',
  totalCreditsMin: 120,
  requirementGroups,
  ...overrides,
});

export const catalogCourse = (code: string, overrides: Partial<CourseDetail> = {}): CourseDetail => ({
  code,
  nameVi: `Học phần thử ${code}`,
  nameEn: null,
  credits: 4,
  theoryPeriods: 45,
  labPeriods: 30,
  exercisePeriods: null,
  projectPeriods: 0,
  memberships: [],
  ...overrides,
});

export const AFFECTED_2024: AffectedCurriculum = { curriculumId: CURRICULUM_ID, curriculumCode: 'ZZPROG2024', programCode: 'ZZPROG', cohortYear: 2024 };
export const AFFECTED_2025: AffectedCurriculum = { curriculumId: CURRICULUM_2025_ID, curriculumCode: 'ZZPROG2025', programCode: 'ZZPROG', cohortYear: 2025 };

export const SHARED_COURSE = catalogCourse('ZZ101', {
  nameEn: 'Test course ZZ101',
  memberships: [
    { programCode: 'ZZPROG', cohortYear: 2024, curriculumCode: 'ZZPROG2024', requirementGroupId: GROUP_BASE_ID, requirementGroupName: 'Kiến thức cơ sở thử', kind: 'compulsory' },
    { programCode: 'ZZPROG', cohortYear: 2025, curriculumCode: 'ZZPROG2025', requirementGroupId: '00000000-0000-4000-8000-000000000b01', requirementGroupName: 'Nhóm thử khóa 2025', kind: 'elective' },
  ],
});

export const OTHER_USER_ID = '00000000-0000-4000-8000-000000000002';

export const accessPrograms = (): AccessProgramList => ({
  programs: [
    { id: OTHER_PROGRAM_ID, code: 'ZZEMPTY', nameVi: 'Chương trình thử chưa có khóa' },
    { id: PROGRAM_ID, code: 'ZZPROG', nameVi: 'Chương trình thử' },
  ],
});

export const EVERY_GRANT = grants({ programs: [programGrant()], permissions: [globalGrant('access_manager'), globalGrant('catalog_maintainer')] });
