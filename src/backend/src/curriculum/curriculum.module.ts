import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Course } from './course.entity.js';
import { CurriculumController } from './curriculum.controller.js';
import { Curriculum } from './curriculum.entity.js';
import { CurriculumService } from './curriculum.service.js';
import { Program } from './program.entity.js';
import { RequirementGroupCourse } from './requirement-group-course.entity.js';
import { RequirementGroup } from './requirement-group.entity.js';

// Curriculum reads (F4, ADR 0005). Other modules (rule engine, onboarding, planner)
// import this module and inject CurriculumService.
@Module({
  imports: [TypeOrmModule.forFeature([Program, Curriculum, RequirementGroup, Course, RequirementGroupCourse])],
  controllers: [CurriculumController],
  providers: [CurriculumService],
  exports: [CurriculumService],
})
export class CurriculumModule {}
