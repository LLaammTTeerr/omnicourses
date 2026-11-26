import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Course } from './course.entity.js';
import { Curriculum } from './curriculum.entity.js';

export const REQUIREMENT_GROUP_KINDS = ['compulsory', 'elective'] as const;
export type RequirementGroupKind = (typeof REQUIREMENT_GROUP_KINDS)[number];

@Entity({ name: 'requirement_groups' })
@Unique('uq_requirement_groups_curriculum_name', ['curriculumId', 'name'])
@Check('ck_requirement_groups_kind', `"kind" IN ('compulsory', 'elective')`)
@Index('ix_requirement_groups_curriculum_id', ['curriculumId'])
export class RequirementGroup {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'requirement_groups_pkey' })
  id!: string;

  @Column({ name: 'curriculum_id', type: 'uuid' })
  curriculumId!: string;

  @ManyToOne(() => Curriculum, (curriculum) => curriculum.requirementGroups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'curriculum_id', foreignKeyConstraintName: 'requirement_groups_curriculum_id_fkey' })
  curriculum!: Curriculum;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'varchar', length: 20 })
  kind!: RequirementGroupKind;

  @Column({ name: 'official_notes', type: 'text', nullable: true })
  officialNotes!: string | null;

  @Column({ name: 'credits_total', type: 'integer', nullable: true })
  creditsTotal!: number | null;

  @Column({ name: 'credits_total_min', type: 'integer', nullable: true })
  creditsTotalMin!: number | null;

  @OneToMany(() => RequirementGroupCourse, (link) => link.requirementGroup)
  courseLinks!: RequirementGroupCourse[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'requirement_group_courses' })
@Check('ck_requirement_group_courses_code_format', `"course_code" ~ '^[A-Z0-9]{2,20}$'`)
@Index('ix_requirement_group_courses_course_code', ['courseCode'])
export class RequirementGroupCourse {
  @PrimaryColumn({ name: 'requirement_group_id', type: 'uuid', primaryKeyConstraintName: 'requirement_group_courses_pkey' })
  requirementGroupId!: string;

  @PrimaryColumn({ name: 'course_code', type: 'varchar', length: 20, primaryKeyConstraintName: 'requirement_group_courses_pkey' })
  courseCode!: string;

  @Column({ name: 'counts_toward_total', type: 'boolean', default: true })
  countsTowardTotal!: boolean;

  @Column({ name: 'counts_toward_gpa', type: 'boolean', default: true })
  countsTowardGpa!: boolean;

  @ManyToOne(() => RequirementGroup, (group) => group.courseLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requirement_group_id', foreignKeyConstraintName: 'requirement_group_courses_requirement_group_id_fkey' })
  requirementGroup!: RequirementGroup;

  @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_code', foreignKeyConstraintName: 'requirement_group_courses_course_code_fkey' })
  course!: Course;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'requirement_group_overflows' })
@Check('ck_requirement_group_overflows_not_self', `"from_group_id" <> "to_group_id"`)
@Index('ix_requirement_group_overflows_to_group_id', ['toGroupId'])
export class RequirementGroupOverflow {
  @PrimaryColumn({ name: 'from_group_id', type: 'uuid', primaryKeyConstraintName: 'requirement_group_overflows_pkey' })
  fromGroupId!: string;

  @Column({ name: 'to_group_id', type: 'uuid' })
  toGroupId!: string;

  @ManyToOne(() => RequirementGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_group_id', foreignKeyConstraintName: 'requirement_group_overflows_from_group_id_fkey' })
  fromGroup!: RequirementGroup;

  @ManyToOne(() => RequirementGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_group_id', foreignKeyConstraintName: 'requirement_group_overflows_to_group_id_fkey' })
  toGroup!: RequirementGroup;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
