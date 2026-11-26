import { Controller, Delete, Get, HttpCode, Param, Patch, Post, Put } from '@nestjs/common';
import { ApiBadRequestResponse, ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { AdminErrorDto } from '../common/api-errors.js';
import { StrictBody, uuidParam } from '../common/api-requests.js';
import { User } from '../users/user.entity.js';
import { PrerequisiteCycleDto, ReferencedItemDto } from './admin-errors.js';
import { AdminErrors } from './admin-write.service.js';
import {
  AdminProgramListDto,
  CreateRequirementGroupDto,
  OfferingTermsDto,
  PrerequisitesDto,
  RequirementGroupAdminDto,
  SetOfferingTermsDto,
  SetPrerequisitesDto,
  UpdateRequirementGroupDto,
  UserGrantsDto,
} from './curriculum-admin.dto.js';
import { CurriculumAdminService } from './curriculum-admin.service.js';

const COHORT = 'admin/programs/:programId/cohorts/:curriculumId';

@ApiTags('curriculum-admin')
@Authenticated()
@Controller()
export class CurriculumAdminController {
  constructor(private readonly admin: CurriculumAdminService) {}

  @Get('admin/programs')
  @ApiOkResponse({ type: AdminProgramListDto, description: 'The programs the caller may administer, with their cohorts; empty without a grant.' })
  async programs(@CurrentUser() user: User): Promise<AdminProgramListDto> {
    return { programs: await this.admin.editablePrograms(user.id) };
  }

  @Get('admin/grants')
  @ApiOkResponse({
    type: UserGrantsDto,
    description: "The caller's own program grants and global permissions; empty lists without a grant. Never another user's.",
  })
  grants(@CurrentUser() user: User): Promise<UserGrantsDto> {
    return this.admin.ownGrants(user.id);
  }

  @Post(`${COHORT}/requirement-groups`)
  @ApiBody({ type: CreateRequirementGroupDto })
  @ApiCreatedResponse({ type: RequirementGroupAdminDto })
  @ApiConflictResponse({ type: AdminErrorDto, description: '`duplicate_name`: the cohort has a group with this name' })
  @AdminErrors()
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
  @AdminErrors()
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
  @ApiConflictResponse({ type: ReferencedItemDto, description: '`referenced_item`: the group still links courses, or saved plans use it (`references` gives their count, never a plan or a student)' })
  @AdminErrors()
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
  @AdminErrors()
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
  @AdminErrors()
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
  @AdminErrors()
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
  @AdminErrors()
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
  @AdminErrors()
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
  @AdminErrors()
  clearOfferingTerms(
    @CurrentUser() user: User,
    @Param('programId', uuidParam('programId')) programId: string,
    @Param('curriculumId', uuidParam('curriculumId')) curriculumId: string,
    @Param('courseCode') courseCode: string,
  ): Promise<OfferingTermsDto> {
    return this.admin.clearOfferingTerms(user.id, programId, curriculumId, courseCode);
  }
}
