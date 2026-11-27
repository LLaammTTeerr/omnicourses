import { applyDecorators, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { AdminErrorDto } from '../common/api-errors.js';
import { StrictBody, uuidParam } from '../common/api-requests.js';
import { User } from '../users/user.entity.js';
import { AdminErrors } from '../admin-access/admin-error-responses.js';
import { CohortDetailsDto, CohortListDto, CreateCohortDto, CreateProgramDto, ProgramDetailsDto, UpdateCohortDto, UpdateProgramDto } from './program-admin.dto.js';
import { ProgramAdminService } from './program-admin.service.js';

const PROGRAM = 'admin/programs/:programId';
const COHORT = `${PROGRAM}/cohorts/:curriculumId`;

const ProgramRoute = () => applyDecorators(AdminErrors(), ApiParam({ name: 'programId', type: String, format: 'uuid' }));
const CohortRoute = () => applyDecorators(ProgramRoute(), ApiParam({ name: 'curriculumId', type: String, format: 'uuid' }));

@ApiTags('curriculum-admin')
@Authenticated()
@Controller()
export class ProgramAdminController {
  constructor(private readonly programs: ProgramAdminService) {}

  @Post('admin/programs')
  @AdminErrors({ notFound: false })
  @ApiBody({ type: CreateProgramDto })
  @ApiCreatedResponse({ type: ProgramDetailsDto, description: 'Created, with no training type. The creator gets no grant on it: an access manager grants the program to its administrator.' })
  @ApiConflictResponse({ type: AdminErrorDto, description: '`duplicate_code`: a program has this code already; nothing is saved' })
  createProgram(@CurrentUser() user: User, @StrictBody() dto: CreateProgramDto): Promise<ProgramDetailsDto> {
    return this.programs.createProgram(user.id, dto);
  }

  @Patch(PROGRAM)
  @ProgramRoute()
  @ApiBody({ type: UpdateProgramDto })
  @ApiOkResponse({ type: ProgramDetailsDto, description: 'Saved. A body that names the code or the training type is refused with 400, not ignored.' })
  updateProgram(@CurrentUser() user: User, @Param('programId', uuidParam('programId')) programId: string, @StrictBody() dto: UpdateProgramDto): Promise<ProgramDetailsDto> {
    return this.programs.updateProgram(user.id, programId, dto);
  }

  @Get(`${PROGRAM}/cohorts`)
  @ProgramRoute()
  @ApiOkResponse({ type: CohortListDto })
  async listCohorts(@CurrentUser() user: User, @Param('programId', uuidParam('programId')) programId: string): Promise<CohortListDto> {
    return { cohorts: await this.programs.listCohorts(user.id, programId) };
  }

  @Post(`${PROGRAM}/cohorts`)
  @ProgramRoute()
  @ApiBody({ type: CreateCohortDto })
  @ApiCreatedResponse({ type: CohortDetailsDto, description: 'Created empty: no requirement group, link or rule, and no credit total. No other cohort changes.' })
  @ApiConflictResponse({ type: AdminErrorDto, description: '`duplicate_cohort`: the program has a cohort of this year. `duplicate_code`: a curriculum has this code. Nothing is saved.' })
  createCohort(@CurrentUser() user: User, @Param('programId', uuidParam('programId')) programId: string, @StrictBody() dto: CreateCohortDto): Promise<CohortDetailsDto> {
    return this.programs.createCohort(user.id, programId, dto);
  }

  @Get(COHORT)
  @CohortRoute()
  @ApiOkResponse({ type: CohortDetailsDto })
  getCohort(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
  ): Promise<CohortDetailsDto> {
    return this.programs.getCohort(user.id, programId, curriculumId);
  }

  @Patch(COHORT)
  @CohortRoute()
  @ApiBody({ type: UpdateCohortDto })
  @ApiOkResponse({ type: CohortDetailsDto, description: 'Saved. A body that names the program, the cohort year, the code or the credit total is refused with 400, not ignored.' })
  updateCohort(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @StrictBody() dto: UpdateCohortDto,
  ): Promise<CohortDetailsDto> {
    return this.programs.updateCohort(user.id, programId, curriculumId, dto);
  }
}
