import { Check, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Course } from './course.entity.js';
import { RequirementGroup } from './requirement-group.entity.js';

// Table `requirement_group_courses` of migration 1792912952302: a course's membership in a
// requirement group. It carries no compulsory flag; the group's kind says that (ADR 0005).
@Entity({ name: 'requirement_group_courses' })
@Check('ck_requirement_group_courses_code_format', `"course_code" ~ '^[A-Z0-9]{2,20}$'`)
@Index('ix_requirement_group_courses_course_code', ['courseCode'])
export class RequirementGroupCourse {
  @PrimaryColumn({ name: 'requirement_group_id', type: 'uuid', primaryKeyConstraintName: 'requirement_group_courses_pkey' })
  requirementGroupId!: string;

  @PrimaryColumn({ name: 'course_code', type: 'varchar', length: 20, primaryKeyConstraintName: 'requirement_group_courses_pkey' })
  courseCode!: string;

  @ManyToOne(() => RequirementGroup, (group) => group.courseLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requirement_group_id', foreignKeyConstraintName: 'requirement_group_courses_requirement_group_id_fkey' })
  requirementGroup!: RequirementGroup;

  @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_code', foreignKeyConstraintName: 'requirement_group_courses_course_code_fkey' })
  course!: Course;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
