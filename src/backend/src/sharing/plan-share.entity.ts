import { Check, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { Plan } from '../plans/plan.entity.js';
import { User } from '../users/user.entity.js';

@Entity({ name: 'plan_shares' })
@Unique('uq_plan_shares_plan_id', ['planId'])
@Unique('uq_plan_shares_share_token', ['shareToken'])
@Index('ix_plan_shares_user_id', ['userId'])
@Check('ck_plan_shares_share_token', `"share_token" ~ '^[A-Za-z0-9_-]{43}$'`)
export class PlanShare {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'plan_shares_pkey' })
  id!: string;

  @Column({ name: 'plan_id', type: 'uuid' })
  planId!: string;

  @ManyToOne(() => Plan, { onDelete: 'CASCADE' })
  @JoinColumn([
    { name: 'plan_id', referencedColumnName: 'id', foreignKeyConstraintName: 'plan_shares_plan_fkey' },
    { name: 'user_id', referencedColumnName: 'userId', foreignKeyConstraintName: 'plan_shares_plan_fkey' },
  ])
  plan!: Plan;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', foreignKeyConstraintName: 'plan_shares_user_id_fkey' })
  user!: User;

  @Column({ name: 'share_token', type: 'varchar', length: 43 })
  shareToken!: string;

  @Column({ name: 'show_name', type: 'boolean', default: false })
  showName!: boolean;

  @Column({ name: 'show_transcript_checks', type: 'boolean', default: false })
  showTranscriptChecks!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
