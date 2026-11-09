import { Check, Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

// Table `courses` of migration 1792912952302: the shared catalog, keyed by course code (ADR 0005).
// The period columns are nullable with a default of 0, as the migration declares them.
@Entity({ name: 'courses' })
@Check('ck_courses_code_format', `"code" ~ '^[A-Z0-9]{2,20}$'`)
@Check('ck_courses_credits_positive', `"credits" > 0`)
@Check(
  'ck_courses_periods_non_negative',
  `COALESCE("theory_periods", 0) >= 0 AND COALESCE("lab_periods", 0) >= 0 AND COALESCE("exercise_periods", 0) >= 0 AND COALESCE("project_periods", 0) >= 0`,
)
export class Course {
  @PrimaryColumn({ type: 'varchar', length: 20, primaryKeyConstraintName: 'courses_pkey' })
  code!: string;

  @Column({ name: 'name_vi', type: 'varchar', length: 255 })
  nameVi!: string;

  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'integer' })
  credits!: number;

  @Column({ name: 'theory_periods', type: 'integer', nullable: true, default: 0 })
  theoryPeriods!: number | null;

  @Column({ name: 'lab_periods', type: 'integer', nullable: true, default: 0 })
  labPeriods!: number | null;

  @Column({ name: 'exercise_periods', type: 'integer', nullable: true, default: 0 })
  exercisePeriods!: number | null;

  @Column({ name: 'project_periods', type: 'integer', nullable: true, default: 0 })
  projectPeriods!: number | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
