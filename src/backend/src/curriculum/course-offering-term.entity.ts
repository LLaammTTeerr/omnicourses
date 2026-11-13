import { Check, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Course } from './course.entity.js';
import { TERM_NUMBERS } from '../terms/term.js';
import { Curriculum } from './curriculum.entity.js';

// Table `course_offering_terms` of migration 1794230000000: a term number (ADR 0009) in which a
// course of this curriculum is taught. Whether 3 is a main or a summer term follows the
// program's training type (ADR 0012). No row for a course means "not recorded".
@Entity({ name: 'course_offering_terms' })
@Check('ck_course_offering_terms_term_number', `"term_number" IN (${TERM_NUMBERS.join(', ')})`)
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
