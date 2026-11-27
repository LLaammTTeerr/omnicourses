import { ApiProperty } from '@nestjs/swagger';
import { COURSE_CODE_PATTERN } from '../common/course-code.js';
import {
  COURSE_READINESS_STATES,
  TRANSCRIPT_COURSE_STATUSES,
  type CourseReadiness,
  type CourseStandingItem,
  type CurriculumStanding,
  type TranscriptCourseStatus,
} from '../rules/types.js';

export class CourseStandingDto implements CourseStandingItem {
  @ApiProperty({ example: 'CS470', pattern: COURSE_CODE_PATTERN.source })
  code!: string;

  @ApiProperty({
    enum: TRANSCRIPT_COURSE_STATUSES,
    nullable: true,
    description: 'Official transcript status from the rule engine (QĐ 1175/QĐ-KHTN Điều 14). null: not taken.',
  })
  transcriptStatus!: TranscriptCourseStatus | null;

  @ApiProperty({
    enum: COURSE_READINESS_STATES,
    nullable: true,
    description: 'Prerequisite readiness for a course not yet passed or in progress. null when prerequisites are not recorded or the course is already passed/in progress.',
  })
  readiness!: CourseReadiness | null;

  @ApiProperty({ type: [String], example: ['CS469'], description: 'Sorted course codes of unmet prerequisites when readiness is locked.' })
  missingPrerequisites!: string[];
}

export class CurriculumStandingDto implements CurriculumStanding {
  @ApiProperty({ type: [CourseStandingDto], description: 'Standing of every course in the curriculum against the signed-in student’s transcript.' })
  courses!: CourseStandingDto[];
}
