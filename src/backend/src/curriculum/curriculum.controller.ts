import { Controller, Get, Param } from '@nestjs/common';
import { ApiNotFoundResponse, ApiOkResponse, ApiParam, ApiTags } from '@nestjs/swagger';
import { Authenticated } from '../auth/auth.decorators.js';
import { CourseDetailDto, CurriculumDto, ProgramListDto } from './curriculum.dto.js';
import { curriculumNotFound, CurriculumService } from './curriculum.service.js';

const COHORT_YEAR = /^\d{4}$/;

// F4 reads (ADR 0005). Signed-in users only, through the global AuthGuard; F12 writes
// live elsewhere (ADR 0011). Nothing here says whether a student may take a course.
@ApiTags('curriculum')
@Authenticated()
@Controller()
export class CurriculumController {
  constructor(private readonly curriculum: CurriculumService) {}

  @Get('programs')
  @ApiOkResponse({ type: ProgramListDto, description: 'Every program, with the cohorts that have a curriculum.' })
  async listPrograms(): Promise<ProgramListDto> {
    return { programs: await this.curriculum.listPrograms() };
  }

  @Get('programs/:program/curricula/:cohort')
  @ApiParam({ name: 'program', description: 'Program code', example: 'APCS' })
  @ApiParam({ name: 'cohort', description: 'Cohort year', example: '2024' })
  @ApiOkResponse({ type: CurriculumDto, description: 'The curriculum of the cohort, with its requirement groups and their courses.' })
  @ApiNotFoundResponse({ description: 'The program does not exist, has no curriculum for this cohort, or the cohort is not a 4-digit year.' })
  getCurriculum(@Param('program') program: string, @Param('cohort') cohort: string): Promise<CurriculumDto> {
    if (!COHORT_YEAR.test(cohort)) throw curriculumNotFound();
    return this.curriculum.getCurriculum(program, Number(cohort));
  }

  @Get('courses/:code')
  @ApiParam({ name: 'code', description: 'Course code, exactly as the catalog stores it', example: 'CSC10001' })
  @ApiOkResponse({ type: CourseDetailDto, description: 'A catalog course and every requirement group that links to it.' })
  @ApiNotFoundResponse({ description: 'No course has this code.' })
  getCourse(@Param('code') code: string): Promise<CourseDetailDto> {
    return this.curriculum.getCourse(code);
  }
}
