import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CombinedMinimum, CombinedMinimumGroup } from './combined-minimum.entity.js';
import { Course } from './course.entity.js';
import { CurriculumRulesReader } from './curriculum-rules.reader.js';
import { CurriculumController } from './curriculum.controller.js';
import { Curriculum } from './curriculum.entity.js';
import { CurriculumService } from './curriculum.service.js';
import { Program } from './program.entity.js';
import { RequirementGroupCourse } from './requirement-group-course.entity.js';
import { RequirementGroupOverflow } from './requirement-group-overflow.entity.js';
import { RequirementGroup } from './requirement-group.entity.js';

// Curriculum reads (F4, ADR 0005). Other modules (rule engine, onboarding, planner)
// import this module and inject CurriculumService. The rule engine reads the rules it
// applies through CurriculumRulesReader (ADR 0013).
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
    ]),
  ],
  controllers: [CurriculumController],
  providers: [CurriculumService, CurriculumRulesReader],
  exports: [CurriculumService, CurriculumRulesReader],
})
export class CurriculumModule {}
