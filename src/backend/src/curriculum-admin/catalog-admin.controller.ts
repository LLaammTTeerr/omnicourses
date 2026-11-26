import { Controller, Delete, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiBody, ApiConflictResponse, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Authenticated, CurrentUser } from '../auth/auth.decorators.js';
import { AdminErrorDto } from '../common/api-errors.js';
import { StrictBody } from '../common/api-requests.js';
import { CourseDto } from '../curriculum/curriculum.dto.js';
import { User } from '../users/user.entity.js';
import { ImpactConfirmationDto, ReferencedItemDto } from './admin-errors.js';
import { AdminErrors } from './admin-write.service.js';
import { CatalogAdminService } from './catalog-admin.service.js';
import { CreateCourseDto, UpdateCourseDto } from './curriculum-admin.dto.js';

@ApiTags('curriculum-admin')
@Authenticated()
@AdminErrors()
@Controller('admin/catalog/courses')
export class CatalogAdminController {
  constructor(private readonly catalog: CatalogAdminService) {}

  @Post()
  @ApiBody({ type: CreateCourseDto })
  @ApiCreatedResponse({ type: CourseDto })
  @ApiConflictResponse({ type: AdminErrorDto, description: '`duplicate_code`: the catalog has the code already' })
  create(@CurrentUser() user: User, @StrictBody() dto: CreateCourseDto): Promise<CourseDto> {
    return this.catalog.createCourse(user.id, dto);
  }

  @Patch(':courseCode')
  @ApiBody({ type: UpdateCourseDto })
  @ApiOkResponse({ type: CourseDto, description: 'Saved; every curriculum that links the course reads the new values.' })
  @ApiConflictResponse({
    type: ImpactConfirmationDto,
    description:
      '`impact_confirmation_required`: the course is linked to the curricula listed; resend with confirmImpact = reviewVersion. `impact_changed`: the values or links changed since that review; review the new list. Nothing is saved.',
  })
  update(@CurrentUser() user: User, @Param('courseCode') courseCode: string, @StrictBody() dto: UpdateCourseDto): Promise<CourseDto> {
    return this.catalog.updateCourse(user.id, courseCode, dto);
  }

  @Delete(':courseCode')
  @HttpCode(204)
  @ApiNoContentResponse({ description: 'Deleted.' })
  @ApiConflictResponse({ type: ReferencedItemDto, description: '`referenced_item`: a curriculum, rule or transcript still names the course' })
  delete(@CurrentUser() user: User, @Param('courseCode') courseCode: string): Promise<void> {
    return this.catalog.deleteCourse(user.id, courseCode);
  }
}
