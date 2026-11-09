import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique, UpdateDateColumn } from 'typeorm';
import { Curriculum } from '../curriculum/curriculum.entity.js';
import { User } from '../users/user.entity.js';

// Table `plans` of migration 1794218005469 (ADR 0014): one of a student's plans.
@Entity({ name: 'plans' })
@Unique('uq_plans_id_user', ['id', 'userId'])
@Check('ck_plans_name', `length(btrim("name")) > 0`)
@Index('ix_plans_user_id', ['userId'])
@Index('ix_plans_curriculum_id', ['curriculumId'])
export class Plan {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'plans_pkey' })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'plans_user_id_fkey' })
  user!: User;

  @Column({ name: 'curriculum_id', type: 'uuid' })
  curriculumId!: string;

  // RESTRICT: F12 refuses to delete a curriculum a saved plan uses (ADR 0011).
  @ManyToOne(() => Curriculum, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'curriculum_id', foreignKeyConstraintName: 'plans_curriculum_id_fkey' })
  curriculum!: Curriculum;

  @Column({ type: 'varchar', length: 100 })
  name!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
