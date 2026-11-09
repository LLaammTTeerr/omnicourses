import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Curriculum } from './curriculum.entity.js';
import { RequirementGroup } from './requirement-group.entity.js';

// Table `combined_minimums` of migration 1794300000000 (ADR 0013): a number of credits several
// requirement groups of one curriculum must reach together, such as APCS's (B) + (C) ≥ 43 (p.5).
@Entity({ name: 'combined_minimums' })
@Unique('uq_combined_minimums_curriculum_name', ['curriculumId', 'name'])
@Check('ck_combined_minimums_credits_min', `"credits_min" > 0`)
export class CombinedMinimum {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'combined_minimums_pkey' })
  id!: string;

  @Column({ name: 'curriculum_id', type: 'uuid' })
  curriculumId!: string;

  @ManyToOne(() => Curriculum, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'curriculum_id', foreignKeyConstraintName: 'combined_minimums_curriculum_id_fkey' })
  curriculum!: Curriculum;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'credits_min', type: 'integer' })
  creditsMin!: number;

  @Column({ name: 'official_notes', type: 'text', nullable: true })
  officialNotes!: string | null;

  @OneToMany(() => CombinedMinimumGroup, (link) => link.combinedMinimum)
  groupLinks!: CombinedMinimumGroup[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

// Table `combined_minimum_groups`: the groups a combined minimum adds up.
@Entity({ name: 'combined_minimum_groups' })
@Index('ix_combined_minimum_groups_requirement_group_id', ['requirementGroupId'])
export class CombinedMinimumGroup {
  @PrimaryColumn({ name: 'combined_minimum_id', type: 'uuid', primaryKeyConstraintName: 'combined_minimum_groups_pkey' })
  combinedMinimumId!: string;

  @PrimaryColumn({ name: 'requirement_group_id', type: 'uuid', primaryKeyConstraintName: 'combined_minimum_groups_pkey' })
  requirementGroupId!: string;

  @ManyToOne(() => CombinedMinimum, (minimum) => minimum.groupLinks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'combined_minimum_id', foreignKeyConstraintName: 'combined_minimum_groups_combined_minimum_id_fkey' })
  combinedMinimum!: CombinedMinimum;

  @ManyToOne(() => RequirementGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requirement_group_id', foreignKeyConstraintName: 'combined_minimum_groups_requirement_group_id_fkey' })
  requirementGroup!: RequirementGroup;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
