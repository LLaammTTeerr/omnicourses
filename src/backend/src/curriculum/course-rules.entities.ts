import { Check, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { Course } from './course.entity.js';
import { Curriculum } from './curriculum.entity.js';

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

@Entity({ name: 'course_prerequisites' })
@Check('ck_course_prerequisites_not_self', `"prerequisite_code" <> "course_code"`)
@Index('ix_course_prerequisites_prerequisite', ['curriculumId', 'prerequisiteCode'])
@Index('ix_course_prerequisites_prerequisite_code', ['prerequisiteCode'])
export class CoursePrerequisite {
  @PrimaryColumn({ name: 'curriculum_id', type: 'uuid', primaryKeyConstraintName: 'course_prerequisites_pkey' })
  curriculumId!: string;

  @PrimaryColumn({ name: 'course_code', type: 'varchar', length: 20, primaryKeyConstraintName: 'course_prerequisites_pkey' })
  courseCode!: string;

  @PrimaryColumn({ name: 'prerequisite_code', type: 'varchar', length: 20, primaryKeyConstraintName: 'course_prerequisites_pkey' })
  prerequisiteCode!: string;

  @ManyToOne(() => CoursePrerequisiteList, (list) => list.prerequisites, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'curriculum_id', referencedColumnName: 'curriculumId', foreignKeyConstraintName: 'course_prerequisites_curriculum_id_course_code_fkey' },
    { name: 'course_code', referencedColumnName: 'courseCode' },
  ])
  list!: CoursePrerequisiteList;

  @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'prerequisite_code', foreignKeyConstraintName: 'course_prerequisites_prerequisite_code_fkey' })
  prerequisite!: Course;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}

@Entity({ name: 'course_offering_terms' })
@Check('ck_course_offering_terms_term_number', `"term_number" IN (1, 2, 3)`)
@Index('ix_course_offering_terms_course_code', ['courseCode'])
export class CourseOfferingTerm {
  @PrimaryColumn({ name: 'curriculum_id', type: 'uuid', primaryKeyConstraintName: 'course_offering_terms_pkey' })
  curriculumId!: string;

  @PrimaryColumn({ name: 'course_code', type: 'varchar', length: 20, primaryKeyConstraintName: 'course_offering_terms_pkey' })
  courseCode!: string;

  @PrimaryColumn({ name: 'term_number', type: 'smallint', primaryKeyConstraintName: 'course_offering_terms_pkey' })
  termNumber!: number;

  @ManyToOne(() => Curriculum, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'curriculum_id', foreignKeyConstraintName: 'course_offering_terms_curriculum_id_fkey' })
  curriculum!: Curriculum;

  @ManyToOne(() => Course, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'course_code', foreignKeyConstraintName: 'course_offering_terms_course_code_fkey' })
  course!: Course;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
