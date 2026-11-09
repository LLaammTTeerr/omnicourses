import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Curriculum } from './curriculum.entity.js';
import { RequirementGroupCourse } from './requirement-group-course.entity.js';

/** ADR 0005: compulsory groups have a fixed credits_total, elective groups a credits_total_min. */
export const REQUIREMENT_GROUP_KINDS = ['compulsory', 'elective'] as const;
export type RequirementGroupKind = (typeof REQUIREMENT_GROUP_KINDS)[number];

// Table `requirement_groups` of migration 1792912952302.
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
