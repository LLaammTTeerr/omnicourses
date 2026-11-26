import { Check, Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Curriculum } from './curriculum.entity.js';
import { CODE_MAX_LENGTH, NAME_MAX_LENGTH } from '../common/column-limits.js';

export const TRAINING_TYPES = ['advanced', 'joint', 'high_quality', 'standard'] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];

export const FACULTY_MAX_LENGTH = 100;

@Entity({ name: 'programs' })
@Unique('uq_programs_code', ['code'])
@Check('ck_programs_training_type', `"training_type" IN ('advanced', 'joint', 'high_quality', 'standard')`)
export class Program {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'programs_pkey' })
  id!: string;

  @Column({ type: 'varchar', length: CODE_MAX_LENGTH })
  code!: string;

  @Column({ name: 'name_vi', type: 'varchar', length: NAME_MAX_LENGTH })
  nameVi!: string;

  @Column({ name: 'name_en', type: 'varchar', length: NAME_MAX_LENGTH, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'varchar', length: FACULTY_MAX_LENGTH, nullable: true })
  faculty!: string | null;

  @Column({ name: 'training_type', type: 'varchar', length: 20, nullable: true })
  trainingType!: TrainingType | null;

  @OneToMany(() => Curriculum, (curriculum) => curriculum.program)
  curriculums!: Curriculum[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
