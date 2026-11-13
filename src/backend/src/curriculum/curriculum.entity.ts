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
import { TERM_YEAR_MAX, TERM_YEAR_MIN } from '../terms/term.js';
import { Program } from './program.entity.js';
import { RequirementGroup } from './requirement-group.entity.js';

// Table `curriculums` of migration 1792912952302: one curriculum per program and cohort (ADR 0005).
@Entity({ name: 'curriculums' })
@Unique('uq_curriculums_program_cohort', ['programId', 'cohortYear'])
@Check('ck_curriculums_cohort_year_range', `"cohort_year" BETWEEN ${TERM_YEAR_MIN} AND ${TERM_YEAR_MAX}`)
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

  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'name_vi', type: 'varchar', length: 255 })
  nameVi!: string;

  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
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
