import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { User } from '../users/user.entity.js';
import { PrerequisiteCycleDto, ReferencedItemDto, AdminErrorDto } from './admin-errors.js';
import { AdminErrors, uuidParam } from './admin-params.js';
import {
  AdminProgramListDto,
  CreateRequirementGroupDto,
  OfferingTermsDto,
  PrerequisitesDto,
  RequirementGroupAdminDto,
  SetOfferingTermsDto,
  SetPrerequisitesDto,
  UpdateRequirementGroupDto,
} from './curriculum-admin.dto.js';
import { CurriculumAdminService } from './curriculum-admin.service.js';
import { StrictBody } from './strict-body.js';

const COHORT = 'admin/programs/:programId/cohorts/:curriculumId';

// F12 program-administrator routes (ADR 0011). Signed-in through the global AuthGuard; the
// service checks the caller's current grant for :programId inside each write's transaction.
// A cohort is a `curriculums` row; :curriculumId must belong to :programId.
@ApiTags('curriculum-admin')
@Authenticated()
@AdminErrors()
@Controller()
export class CurriculumAdminController {
  constructor(private readonly admin: CurriculumAdminService) {}

  @Get('admin/programs')
  @ApiOkResponse({ type: AdminProgramListDto, description: 'The programs the caller may administer, with their cohorts; empty without a grant.' })
  async programs(@CurrentUser() user: User): Promise<AdminProgramListDto> {
    return { programs: await this.admin.editablePrograms(user.id) };
  }

  @Post(`${COHORT}/requirement-groups`)
  @ApiBody({ type: CreateRequirementGroupDto })
  @ApiCreatedResponse({ type: RequirementGroupAdminDto })
  @ApiConflictResponse({ type: AdminErrorDto, description: '`duplicate_name`: the cohort has a group with this name' })
  createGroup(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @StrictBody() dto: CreateRequirementGroupDto,
  ): Promise<RequirementGroupAdminDto> {
    return this.admin.createGroup(user.id, programId, curriculumId, dto);
  }

  @Patch(`${COHORT}/requirement-groups/:groupId`)
  @ApiBody({ type: UpdateRequirementGroupDto })
  @ApiOkResponse({ type: RequirementGroupAdminDto })
  @ApiConflictResponse({ type: AdminErrorDto, description: '`duplicate_name`' })
  updateGroup(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @Param('groupId', uuidParam('groupId')) groupId: string,
    @StrictBody() dto: UpdateRequirementGroupDto,
  ): Promise<RequirementGroupAdminDto> {
    return this.admin.updateGroup(user.id, programId, curriculumId, groupId, dto);
  }

  @Delete(`${COHORT}/requirement-groups/:groupId`)
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiConflictResponse({ type: ReferencedItemDto, description: '`referenced_item`: the group still links courses' })
  deleteGroup(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @Param('groupId', uuidParam('groupId')) groupId: string,
  ): Promise<void> {
    return this.admin.deleteGroup(user.id, programId, curriculumId, groupId);
  }

  @Put(`${COHORT}/requirement-groups/:groupId/courses/:courseCode`)
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'The course is in the group (linked now, or already).' })
  linkCourse(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @Param('groupId', uuidParam('groupId')) groupId: string,
    @Param('courseCode') courseCode: string,
  ): Promise<void> {
    return this.admin.linkCourse(user.id, programId, curriculumId, groupId, courseCode);
  }

  @Delete(`${COHORT}/requirement-groups/:groupId/courses/:courseCode`)
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'The course left this group; the catalog course and its other links stay.' })
  @ApiConflictResponse({ type: ReferencedItemDto, description: '`referenced_item`: the course would leave the curriculum while its rules name it' })
  unlinkCourse(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @Param('groupId', uuidParam('groupId')) groupId: string,
    @Param('courseCode') courseCode: string,
  ): Promise<void> {
    return this.admin.unlinkCourse(user.id, programId, curriculumId, groupId, courseCode);
  }

  @Put(`${COHORT}/courses/:courseCode/prerequisites`)
  @ApiBody({ type: SetPrerequisitesDto })
  @ApiOkResponse({ type: PrerequisitesDto, description: 'The recorded list replaced the previous one.' })
  @ApiBadRequestResponse({ type: PrerequisiteCycleDto, description: '`prerequisite_cycle` names the cycle; `validation_failed` for a code outside the curriculum' })
  setPrerequisites(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @Param('courseCode') courseCode: string,
    @StrictBody() dto: SetPrerequisitesDto,
  ): Promise<PrerequisitesDto> {
    return this.admin.setPrerequisites(user.id, programId, curriculumId, courseCode, dto);
  }

  @Delete(`${COHORT}/courses/:courseCode/prerequisites`)
  @ApiOkResponse({ type: PrerequisitesDto, description: 'Back to not recorded: the read API answers null.' })
  clearPrerequisites(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @Param('courseCode') courseCode: string,
  ): Promise<PrerequisitesDto> {
    return this.admin.clearPrerequisites(user.id, programId, curriculumId, courseCode);
  }

  @Put(`${COHORT}/courses/:courseCode/offering-terms`)
  @ApiBody({ type: SetOfferingTermsDto })
  @ApiOkResponse({ type: OfferingTermsDto, description: 'The recorded terms replaced the previous ones.' })
  setOfferingTerms(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @Param('courseCode') courseCode: string,
    @StrictBody() dto: SetOfferingTermsDto,
  ): Promise<OfferingTermsDto> {
    return this.admin.setOfferingTerms(user.id, programId, curriculumId, courseCode, dto);
  }

  @Delete(`${COHORT}/courses/:courseCode/offering-terms`)
  @ApiOkResponse({ type: OfferingTermsDto, description: 'Back to not recorded: the read API answers null.' })
  clearOfferingTerms(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @Param('courseCode') courseCode: string,
  ): Promise<OfferingTermsDto> {
    return this.admin.clearOfferingTerms(user.id, programId, curriculumId, courseCode);
  }
}
