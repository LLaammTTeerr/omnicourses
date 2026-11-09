import { Check, Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Curriculum } from './curriculum.entity.js';

/**
 * The training type the regulation names (GLOSSARY): Tiên tiến (advanced), Liên kết (joint),
 * Chất lượng cao (high_quality), đại trà (standard). It sets the terms and the credit caps
 * (QĐ 1175/QĐ-KHTN Điều 6.4 and 7.2, ADR 0012).
 */
export const TRAINING_TYPES = ['advanced', 'joint', 'high_quality', 'standard'] as const;
export type TrainingType = (typeof TRAINING_TYPES)[number];

// Table `programs` of migration 1792912952302 (ADR 0005). Read-only here; F12 writes (ADR 0011).
@Entity({ name: 'programs' })
@Unique('uq_programs_code', ['code'])
@Check('ck_programs_training_type', `"training_type" IN ('advanced', 'joint', 'high_quality', 'standard')`)
export class Program {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'programs_pkey' })
  id!: string;

  @Column({ type: 'varchar', length: 50 })
  code!: string;

  @Column({ name: 'name_vi', type: 'varchar', length: 255 })
  nameVi!: string;

  @Column({ name: 'name_en', type: 'varchar', length: 255, nullable: true })
  nameEn!: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  faculty!: string | null;

  // Migration 1794300000000. Null: not recorded, so no credit cap is checked (ADR 0013).
  @Column({ name: 'training_type', type: 'varchar', length: 20, nullable: true })
  trainingType!: TrainingType | null;

  @OneToMany(() => Curriculum, (curriculum) => curriculum.program)
  curriculums!: Curriculum[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
