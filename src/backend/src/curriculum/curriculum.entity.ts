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
import { Program } from './program.entity.js';
import { RequirementGroup } from './requirement-group.entity.js';
import { CODE_MAX_LENGTH, NAME_MAX_LENGTH } from '../common/column-limits.js';

export const LANGUAGE_MAX_LENGTH = 10;

@Entity({ name: 'curriculums' })
@Unique('uq_curriculums_program_cohort', ['programId', 'cohortYear'])
@Check('ck_curriculums_cohort_year_range', `"cohort_year" BETWEEN 2000 AND 2100`)
@Index('ix_curriculums_program_id', ['programId'])
export class Curriculum {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'curriculums_pkey' })
  id!: string;

  @Column({ name: 'program_id', type: 'uuid' })
  programId!: string;

  @ManyToOne(() => Program, (program) => program.curriculums, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'program_id', foreignKeyConstraintName: 'curriculums_program_id_fkey' })
  program!: Program;

  @Column({ name: 'cohort_year', type: 'integer' })
  cohortYear!: number;

  @Column({ type: 'varchar', length: CODE_MAX_LENGTH })
  code!: string;

  @Column({ name: 'name_vi', type: 'varchar', length: NAME_MAX_LENGTH })
  nameVi!: string;

  @Column({ name: 'name_en', type: 'varchar', length: NAME_MAX_LENGTH, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'varchar', length: LANGUAGE_MAX_LENGTH, nullable: true })
  language!: string | null;

  @Column({ name: 'total_credits_min', type: 'integer', nullable: true })
  totalCreditsMin!: number | null;

  @OneToMany(() => RequirementGroup, (group) => group.curriculum)
  requirementGroups!: RequirementGroup[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
