import { Check, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Course } from './course.entity.js';
import { CoursePrerequisiteList } from './course-prerequisite-list.entity.js';

// Table `course_prerequisites` of migration 1794230000000: within one curriculum, course_code
// requires prerequisite_code to be passed first. All of a course's rows apply (GLOSSARY).
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
