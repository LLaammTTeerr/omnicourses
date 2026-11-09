import { CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Course } from './course.entity.js';
import { CoursePrerequisite } from './course-prerequisite.entity.js';
import { Curriculum } from './curriculum.entity.js';

// Table `course_prerequisite_lists` of migration 1794230000000: the prerequisites of a course
// in one curriculum have been entered, possibly as none (ADR 0011, amended 9 November 2026).
// No row means "not recorded", which the read API reports as null, never as an empty list.
@Entity({ name: 'course_prerequisite_lists' })
@Index('ix_course_prerequisite_lists_course_code', ['courseCode'])
export class CoursePrerequisiteList {
  @PrimaryColumn({ name: 'curriculum_id', type: 'uuid', primaryKeyConstraintName: 'course_prerequisite_lists_pkey' })
  curriculumId!: string;

  @PrimaryColumn({ name: 'course_code', type: 'varchar', length: 20, primaryKeyConstraintName: 'course_prerequisite_lists_pkey' })
  courseCode!: string;

  @ManyToOne(() => Curriculum, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'curriculum_id', foreignKeyConstraintName: 'course_prerequisite_lists_curriculum_id_fkey' })
  curriculum!: Curriculum;

  @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_code', foreignKeyConstraintName: 'course_prerequisite_lists_course_code_fkey' })
  course!: Course;

  @OneToMany(() => CoursePrerequisite, (p) => p.list)
  prerequisites!: CoursePrerequisite[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
