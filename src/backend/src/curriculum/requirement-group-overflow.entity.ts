import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { RequirementGroup } from './requirement-group.entity.js';

// Table `requirement_group_overflows` of migration 1794300000000 (ADR 0013): credits passed in
// the source group beyond its own minimum count toward the target group of the same curriculum
// (APCS: "Sinh viên có thể dùng số tín chỉ dư thuộc (A) cho (C)", p.5). One target per source.
@Entity({ name: 'requirement_group_overflows' })
@Check('ck_requirement_group_overflows_not_self', `"from_group_id" <> "to_group_id"`)
@Index('ix_requirement_group_overflows_to_group_id', ['toGroupId'])
export class RequirementGroupOverflow {
  @PrimaryColumn({ name: 'from_group_id', type: 'uuid', primaryKeyConstraintName: 'requirement_group_overflows_pkey' })
  fromGroupId!: string;

  @Column({ name: 'to_group_id', type: 'uuid' })
  toGroupId!: string;

  @ManyToOne(() => RequirementGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_group_id', foreignKeyConstraintName: 'requirement_group_overflows_from_group_id_fkey' })
  fromGroup!: RequirementGroup;

  @ManyToOne(() => RequirementGroup, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_group_id', foreignKeyConstraintName: 'requirement_group_overflows_to_group_id_fkey' })
  toGroup!: RequirementGroup;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
