import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CatalogLookup } from './catalog-lookup.js';
import { CombinedMinimum, CombinedMinimumGroup } from './combined-minimum.entity.js';
import { CourseOfferingTerm } from './course-offering-term.entity.js';
import { CoursePrerequisiteList } from './course-prerequisite-list.entity.js';
import { CoursePrerequisite } from './course-prerequisite.entity.js';
import { CourseRulesService } from './course-rules.service.js';
import { Course } from './course.entity.js';
import { CurriculumRulesReader } from './curriculum-rules.reader.js';
import { CurriculumController } from './curriculum.controller.js';
import { Curriculum } from './curriculum.entity.js';
import { CurriculumService } from './curriculum.service.js';
import { Program } from './program.entity.js';
import { RequirementGroupCourse } from './requirement-group-course.entity.js';
import { RequirementGroupOverflow } from './requirement-group-overflow.entity.js';
import { RequirementGroup } from './requirement-group.entity.js';

// Curriculum reads (F4, ADR 0005). The explorer reads through CurriculumService; the rule engine
// reads the rules it applies through CurriculumRulesReader and CourseRulesService (ADR 0013);
// the planner and the engine make their bulk lookups through CatalogLookup.
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
  providers: [CurriculumService, CurriculumRulesReader, CourseRulesService, CatalogLookup],
  exports: [CurriculumService, CurriculumRulesReader, CourseRulesService, CatalogLookup],
})
export class CurriculumModule {}
