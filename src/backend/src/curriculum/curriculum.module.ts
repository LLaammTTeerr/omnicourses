import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CombinedMinimum, CombinedMinimumGroup } from './combined-minimum.entity.js';
import { CourseOfferingTerm, CoursePrerequisite, CoursePrerequisiteList } from './course-rules.entities.js';
import { Course } from './course.entity.js';
import { CurriculumRulesReader } from './curriculum-rules.reader.js';
import { CurriculumController } from './curriculum.controller.js';
import { Curriculum } from './curriculum.entity.js';
import { CurriculumService } from './curriculum.service.js';
import { Program } from './program.entity.js';
import { RequirementGroup, RequirementGroupCourse, RequirementGroupOverflow } from './requirement-group.entity.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Program,
      Curriculum,
      RequirementGroup,
      Course,
      RequirementGroupCourse,
      CombinedMinimum,
      CombinedMinimumGroup,
      RequirementGroupOverflow,
      CoursePrerequisiteList,
      CoursePrerequisite,
      CourseOfferingTerm,
    ]),
  ],
  controllers: [CurriculumController],
  providers: [CurriculumService, CurriculumRulesReader],
  exports: [CurriculumService, CurriculumRulesReader],
})
export class CurriculumModule {}
